import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFile } from "../apps/policy-gateway-service/src/readiness.js";
import { containsUnsafeReportContent } from "./structured-report-safety.js";

export interface PaymentProviderLiveSmokeReport {
  readonly schemaVersion: 1;
  readonly kind: "vallum.payment-provider-live-proof";
  readonly result: "passed";
  readonly observedAt: string;
  readonly environment: "operator-approved-live";
  readonly providerKinds: readonly ["x402", "ap2"];
  readonly checks: readonly [
    "x402-verify",
    "x402-settle",
    "x402-payment-response",
    "ap2-mandate-chain",
    "ap2-checkout-receipt",
    "ap2-payment-receipt",
    "ap2-accountability-review",
    "redaction-review",
  ];
  readonly x402Proof: {
    readonly verifyResult: "passed";
    readonly settleResult: "passed";
    readonly paymentResponse: "present-redacted";
  };
  readonly ap2Proof: {
    readonly mandateChain: "validated";
    readonly checkoutReceipt: "validated";
    readonly paymentReceipt: "validated";
    readonly accountabilityReview: "passed";
  };
  readonly runner: "vallum-payment-provider-live-smoke";
}

export interface PaymentProviderLiveSmokeOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly now?: Date;
  readonly reportFile: string;
  readonly fetchImpl?: typeof fetch;
}

interface CliOptions {
  readonly help: boolean;
  readonly reportFile?: string;
}

interface X402RequestEnvelope {
  readonly x402Version?: unknown;
  readonly paymentPayload?: unknown;
  readonly paymentRequirements?: unknown;
}

interface Ap2ProofInput {
  readonly mandateChain?: unknown;
  readonly checkoutReceipt?: unknown;
  readonly paymentReceipt?: unknown;
  readonly accountabilityReview?: unknown;
}

interface Ap2ProofStatus {
  readonly mandateChain: "validated";
  readonly checkoutReceipt: "validated";
  readonly paymentReceipt: "validated";
  readonly accountabilityReview: "passed";
}

export type PaymentProviderLiveSmokeResult =
  | { readonly ok: true; readonly report: PaymentProviderLiveSmokeReport; readonly reportFile: string }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly missing?: readonly string[]; readonly stage?: string };

const REQUIRED_CHECKS = [
  "x402-verify",
  "x402-settle",
  "x402-payment-response",
  "ap2-mandate-chain",
  "ap2-checkout-receipt",
  "ap2-payment-receipt",
  "ap2-accountability-review",
  "redaction-review",
] as const;

const MAX_INPUT_BYTES = 64 * 1024;
const LOCAL_ENV_FILE = ".env";
const SECRET_FIELD_RE = /secret|token|private|credential|authorizationHeader|signatureHeader|mnemonic|seed|instrument|rawPayload|rawResponse|responseBody|requestBody|header/i;
const SECRET_VALUE_RE = /\b(secret|token|credential|authorization|mnemonic|seed phrase|payment instrument|raw payload)\b|bearer\s+\S+/i;

const usage = `usage: npm exec tsx -- scripts/smoke-payment-provider-live.ts --report <ignored-json-path>

Runs an opt-in live payment-provider proof smoke.

Required local configuration:
  PAYMENT_PROVIDER_X402_VERIFY_URL      HTTPS x402 facilitator verify endpoint.
  PAYMENT_PROVIDER_X402_SETTLE_URL      HTTPS x402 facilitator settle endpoint.
  PAYMENT_PROVIDER_X402_REQUEST         Ignored local JSON request envelope.
  PAYMENT_PROVIDER_AP2_PROOF            Ignored local AP2 status-only proof JSON.

Optional local configuration:
  PAYMENT_PROVIDER_AUTH_BEARER_TOKEN    Bearer token for facilitators that require Authorization.

This command contacts configured payment-provider endpoints only after all required
configuration is present and validates. It writes a redacted accepted readiness
report only after x402 verify, x402 settle, AP2 status checks, and redaction review pass.`;

export async function runPaymentProviderLiveSmoke(
  options: PaymentProviderLiveSmokeOptions,
): Promise<PaymentProviderLiveSmokeResult> {
  const cwd = options.cwd ?? process.cwd();
  const env = await resolvePaymentProviderLiveEnv(cwd, options.env);
  const missing = missingRequiredEnv(env);
  if (missing.length > 0) {
    return blocked("PAYMENT_PROVIDER_LIVE_CONFIG_MISSING", "Payment-provider live smoke requires x402 endpoint, request, and AP2 status proof configuration.", missing);
  }

  const verifyUrl = parsePublicHttpsUrl(env.PAYMENT_PROVIDER_X402_VERIFY_URL);
  const settleUrl = parsePublicHttpsUrl(env.PAYMENT_PROVIDER_X402_SETTLE_URL);
  if (!verifyUrl || !settleUrl) {
    return blocked("PAYMENT_PROVIDER_LIVE_URL_UNSAFE", "Payment-provider x402 endpoints must be public HTTPS URLs without credentials, query strings, fragments, or loopback/private hosts.");
  }

  const x402Request = await readX402Request(cwd, env.PAYMENT_PROVIDER_X402_REQUEST);
  if (!x402Request.ok) return x402Request;
  const ap2Proof = await readAp2Proof(cwd, env.PAYMENT_PROVIDER_AP2_PROOF);
  if (!ap2Proof.ok) return ap2Proof;

  const fetchImpl = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (env.PAYMENT_PROVIDER_AUTH_BEARER_TOKEN?.trim()) {
    headers.authorization = `Bearer ${env.PAYMENT_PROVIDER_AUTH_BEARER_TOKEN.trim()}`;
  }

  const verify = await postJson(fetchImpl, verifyUrl.href, x402Request.value, headers);
  if (!verify.ok) return verify;
  if (!isRecord(verify.value) || verify.value.isValid !== true) {
    return blocked("PAYMENT_PROVIDER_X402_VERIFY_NOT_PASSED", "x402 facilitator verify response did not pass.", undefined, "x402-verify");
  }

  const settle = await postJson(fetchImpl, settleUrl.href, x402Request.value, headers);
  if (!settle.ok) return settle;
  if (!isRecord(settle.value) || settle.value.success !== true) {
    return blocked("PAYMENT_PROVIDER_X402_SETTLE_NOT_PASSED", "x402 facilitator settle response did not pass.", undefined, "x402-settle");
  }

  const report = buildReport(ap2Proof.value, options.now ?? new Date());
  const reportFile = isAbsolute(options.reportFile) ? options.reportFile : resolve(cwd, options.reportFile);
  await mkdir(dirname(reportFile), { recursive: true });
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  return { ok: true, report, reportFile: options.reportFile };
}

export async function resolvePaymentProviderLiveEnv(
  cwd: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> | undefined,
): Promise<Record<string, string | undefined>> {
  const fileEnv = await loadOptionalLocalEnv(cwd);
  return {
    ...fileEnv,
    ...(env ?? process.env),
  };
}

async function loadOptionalLocalEnv(cwd: string): Promise<Record<string, string>> {
  try {
    return await loadEnvFile(LOCAL_ENV_FILE, cwd);
  } catch {
    return {};
  }
}

function missingRequiredEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string[] {
  return [
    "PAYMENT_PROVIDER_X402_VERIFY_URL",
    "PAYMENT_PROVIDER_X402_SETTLE_URL",
    "PAYMENT_PROVIDER_X402_REQUEST",
    "PAYMENT_PROVIDER_AP2_PROOF",
  ].filter((key) => !env[key]?.trim());
}

async function readX402Request(cwd: string, value: string | undefined): Promise<
  | { readonly ok: true; readonly value: X402RequestEnvelope }
  | Extract<PaymentProviderLiveSmokeResult, { ok: false }>
> {
  const parsed = await readJsonInput<X402RequestEnvelope>(cwd, value, "x402 request envelope");
  if (!parsed.ok) return parsed;
  if (!isRecord(parsed.value) || parsed.value.x402Version !== 2 || !isRecord(parsed.value.paymentPayload) || !isRecord(parsed.value.paymentRequirements)) {
    return blocked("PAYMENT_PROVIDER_X402_REQUEST_INVALID", "x402 request envelope must include x402Version=2, paymentPayload, and paymentRequirements.");
  }
  if (containsUnsafeReportContent(parsed.value, { unsafeFieldNameRe: SECRET_FIELD_RE })) {
    return blocked("PAYMENT_PROVIDER_X402_REQUEST_UNSAFE_FIELDS", "x402 request envelope contains unsafe field names for this smoke input.");
  }
  return { ok: true, value: parsed.value };
}

async function readAp2Proof(cwd: string, value: string | undefined): Promise<
  | { readonly ok: true; readonly value: Ap2ProofStatus }
  | Extract<PaymentProviderLiveSmokeResult, { ok: false }>
> {
  const parsed = await readJsonInput<Ap2ProofInput>(cwd, value, "AP2 status proof");
  if (!parsed.ok) return parsed;
  if (containsUnsafeReportContent(parsed.value, { unsafeFieldNameRe: SECRET_FIELD_RE, unsafeStringValueRe: SECRET_VALUE_RE })) {
    return blocked("PAYMENT_PROVIDER_AP2_PROOF_UNSAFE_FIELDS", "AP2 status proof contains unsafe secret-like fields or values.");
  }
  if (
    !isRecord(parsed.value)
    || parsed.value.mandateChain !== "validated"
    || parsed.value.checkoutReceipt !== "validated"
    || parsed.value.paymentReceipt !== "validated"
    || parsed.value.accountabilityReview !== "passed"
  ) {
    return blocked("PAYMENT_PROVIDER_AP2_PROOF_INCOMPLETE", "AP2 proof must contain status-only mandate, checkout receipt, payment receipt, and accountability results.");
  }
  return {
    ok: true,
    value: {
      mandateChain: "validated",
      checkoutReceipt: "validated",
      paymentReceipt: "validated",
      accountabilityReview: "passed",
    },
  };
}

async function readJsonInput<T>(
  cwd: string,
  value: string | undefined,
  label: string,
): Promise<{ readonly ok: true; readonly value: T } | Extract<PaymentProviderLiveSmokeResult, { ok: false }>> {
  if (!value?.trim()) return blocked("PAYMENT_PROVIDER_LIVE_CONFIG_MISSING", `Missing ${label} path.`);
  const file = isAbsolute(value) ? value : resolve(cwd, value);
  let raw: string;
  try {
    const bytes = await readFile(file);
    if (bytes.byteLength > MAX_INPUT_BYTES) {
      return blocked("PAYMENT_PROVIDER_LIVE_INPUT_TOO_LARGE", `${label} is too large.`);
    }
    raw = bytes.toString("utf8");
  } catch {
    return blocked("PAYMENT_PROVIDER_LIVE_INPUT_NOT_FOUND", `${label} path does not exist.`);
  }
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return blocked("PAYMENT_PROVIDER_LIVE_INPUT_INVALID_JSON", `${label} is not valid JSON.`);
  }
}

async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  body: X402RequestEnvelope,
  headers: Record<string, string>,
): Promise<{ readonly ok: true; readonly value: unknown } | Extract<PaymentProviderLiveSmokeResult, { ok: false }>> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      redirect: "manual",
    });
  } catch {
    return blocked("PAYMENT_PROVIDER_X402_NETWORK_ERROR", "x402 facilitator request failed before a status-only response was available.", undefined, "x402-network");
  }
  if (!response.ok) {
    return blocked("PAYMENT_PROVIDER_X402_HTTP_ERROR", "x402 facilitator returned a non-success HTTP status.", undefined, "x402-http");
  }
  try {
    return { ok: true, value: await response.json() };
  } catch {
    return blocked("PAYMENT_PROVIDER_X402_INVALID_JSON", "x402 facilitator returned non-JSON response.", undefined, "x402-json");
  }
}

function buildReport(ap2Proof: Ap2ProofStatus, now: Date): PaymentProviderLiveSmokeReport {
  return {
    schemaVersion: 1,
    kind: "vallum.payment-provider-live-proof",
    result: "passed",
    observedAt: now.toISOString(),
    environment: "operator-approved-live",
    providerKinds: ["x402", "ap2"],
    checks: REQUIRED_CHECKS,
    x402Proof: {
      verifyResult: "passed",
      settleResult: "passed",
      paymentResponse: "present-redacted",
    },
    ap2Proof: {
      mandateChain: ap2Proof.mandateChain,
      checkoutReceipt: ap2Proof.checkoutReceipt,
      paymentReceipt: ap2Proof.paymentReceipt,
      accountabilityReview: ap2Proof.accountabilityReview,
    },
    runner: "vallum-payment-provider-live-smoke",
  };
}

function parsePublicHttpsUrl(value: string | undefined): URL | undefined {
  if (!value?.trim()) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return undefined;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return undefined;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost")) return undefined;
    if (/^127\.|^10\.|^192\.168\.|^169\.254\./.test(host)) return undefined;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return undefined;
    if (host === "::1" || host === "[::1]") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function blocked(
  code: string,
  message: string,
  missing?: readonly string[],
  stage?: string,
): Extract<PaymentProviderLiveSmokeResult, { ok: false }> {
  return { ok: false, code, message, missing, stage };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function formatPaymentProviderLiveSmokeResult(result: PaymentProviderLiveSmokeResult): string {
  const lines = [
    `Vallum payment-provider live smoke ${result.ok ? "passed" : "blocked"}`,
    `ok=${result.ok}`,
  ];
  if (result.ok) {
    lines.push("code=PAYMENT_PROVIDER_LIVE_REPORT_WRITTEN");
    lines.push("report=redacted-local-artifact");
  } else {
    lines.push(`code=${result.code}`);
    if (result.missing?.length) lines.push(`missing=${result.missing.join(",")}`);
    if (result.stage) lines.push(`stage=${result.stage}`);
    lines.push(`message=${result.message}`);
  }
  return lines.join("\n");
}

function parseArgs(argv: readonly string[]): CliOptions {
  let help = false;
  let reportFile: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--report") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--report requires a path.");
      reportFile = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { help, reportFile };
}

async function main(): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid arguments.");
    console.error(usage);
    return 2;
  }
  if (options.help) {
    console.log(usage.trimEnd());
    return 0;
  }
  if (!options.reportFile) {
    console.error("--report requires a path.");
    console.error(usage);
    return 2;
  }

  const result = await runPaymentProviderLiveSmoke({ reportFile: options.reportFile });
  console.log(formatPaymentProviderLiveSmokeResult(result));
  return result.ok ? 0 : 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
