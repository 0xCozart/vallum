import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFile } from "../apps/policy-gateway-service/src/readiness.js";
import { containsUnsafeReportContent } from "./structured-report-safety.js";

export type PaymentProviderReadinessStatus =
  | "proven-local"
  | "blocked-local"
  | "blocked-config"
  | "ready-approval";

export interface PaymentProviderReadinessCheck {
  readonly id: string;
  readonly status: PaymentProviderReadinessStatus;
  readonly code: string;
  readonly message: string;
  readonly evidence?: string;
  readonly next: string;
}

export interface PaymentProviderReadinessReport {
  readonly localProofOk: boolean;
  readonly liveReady: boolean;
  readonly checks: readonly PaymentProviderReadinessCheck[];
}

export interface PaymentProviderReadinessArtifact {
  readonly schemaVersion: 1;
  readonly kind: "vallum.payment-provider-readiness-report";
  readonly generatedAt: string;
  readonly localProofOk: boolean;
  readonly liveReady: boolean;
  readonly provenLocalCheckIds: readonly string[];
  readonly readyApprovalCheckIds: readonly string[];
  readonly blockedCheckIds: readonly string[];
  readonly blockerCodes: readonly string[];
  readonly checks: readonly PaymentProviderReadinessCheck[];
  readonly boundaries: readonly string[];
}

export interface PaymentProviderReadinessOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly now?: Date;
}

export interface WritePaymentProviderReadinessArtifactOptions extends PaymentProviderReadinessOptions {
  readonly outFile?: string;
}

interface CliOptions {
  readonly help: boolean;
  readonly json: boolean;
  readonly outFile?: string;
}

interface StructuredPaymentProviderReport {
  readonly schemaVersion?: unknown;
  readonly kind?: unknown;
  readonly result?: unknown;
  readonly observedAt?: unknown;
  readonly environment?: unknown;
  readonly providerKinds?: unknown;
  readonly checks?: unknown;
  readonly x402Proof?: unknown;
  readonly ap2Proof?: unknown;
}

const MAX_REPORT_BYTES = 64 * 1024;
const MAX_REPORT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const LOCAL_ENV_FILE = ".env";
const PAYMENT_PROVIDER_TEMPLATE_COMMAND = "npm run operator:write-report-template -- --kind payment-provider-live --out tmp/vallum/payment-provider-live-report-template.json";
const REQUIRED_SOURCE_PATHS = [
  "packages/manifest/src/x402Mapping.ts",
  "packages/manifest/src/x402Mapping.test.ts",
  "packages/manifest/src/ap2Mapping.ts",
  "packages/manifest/src/ap2Mapping.test.ts",
  "packages/receipts/src/x402Receipt.ts",
  "packages/receipts/src/x402Receipt.test.ts",
  "packages/receipts/src/ap2Receipt.ts",
  "packages/receipts/src/ap2Receipt.test.ts",
  "packages/standards/src/x402.ts",
  "packages/standards/src/x402.test.ts",
  "packages/standards/src/ap2.ts",
  "packages/standards/src/ap2.test.ts",
] as const;

const REQUIRED_LIVE_CHECKS = [
  "x402-verify",
  "x402-settle",
  "x402-payment-response",
  "ap2-mandate-chain",
  "ap2-checkout-receipt",
  "ap2-payment-receipt",
  "ap2-accountability-review",
  "redaction-review",
] as const;

const SECRET_FIELD_RE = /secret|token|private|credential|authorization|signature|mnemonic|seed|payload|header|instrument/i;
const SECRET_VALUE_RE = /\b(secret|token|credential|authorization|signature|mnemonic|seed phrase|payment instrument|raw payload)\b|bearer\s+\S+/i;

const ARTIFACT_BOUNDARIES = [
  "This report is non-networked and does not contact payment providers, facilitators, processors, AP2 participants, settlement systems, public endpoints, IOTA services, or Gas Station endpoints.",
  "liveReady=false means local standards proof or operator-approved live payment-provider evidence remains blocked.",
  "ready-approval checks require manual operator review before any live x402, AP2, processor, facilitator, settlement, dispute, or production payment claim is accepted.",
  "Do not commit generated reports, payment-provider proof outputs, credentials, authorization headers, signatures, payment instruments, raw payloads, response bodies, provider account details, or local secret paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/check-payment-provider-readiness.ts [--json] [--out <path>]

Reports current Vallum payment-provider readiness without contacting live providers or settlement systems.

Options:
  --json        Print a redacted machine-readable artifact.
  --out <path>  Write the same JSON artifact to a local file with mode 0600.
  --help        Show this help text.
`;

export async function checkPaymentProviderReadiness(
  options: PaymentProviderReadinessOptions = {},
): Promise<PaymentProviderReadinessReport> {
  const cwd = options.cwd ?? process.cwd();
  const env = await resolvePaymentProviderReadinessEnv(cwd, options.env);
  const now = options.now ?? new Date();
  const checks = [
    await checkLocalStandardsProof(cwd),
    await checkLiveReport(cwd, env.PAYMENT_PROVIDER_LIVE_REPORT, now),
  ];

  return {
    localProofOk: checks.find((check) => check.id === "local-standards-proof")?.status === "proven-local",
    liveReady: checks.every((check) => check.status === "proven-local" || check.status === "ready-approval"),
    checks,
  };
}

export async function resolvePaymentProviderReadinessEnv(
  cwd: string,
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): Promise<Record<string, string | undefined>> {
  const fileEnv = await loadOptionalLocalEnv(cwd);
  return { ...fileEnv, ...(env ?? process.env) };
}

export function formatPaymentProviderReadinessReport(report: PaymentProviderReadinessReport): string {
  const lines = [
    `Vallum payment provider readiness ${report.liveReady ? "ready-for-approval" : "blocked"}`,
    `localProofOk=${report.localProofOk}`,
    `liveReady=${report.liveReady}`,
  ];
  for (const check of report.checks) {
    lines.push(`${check.status}: ${check.id}: code=${check.code}`);
    lines.push(`message=${check.message}`);
    if (check.evidence) lines.push(`evidence=${check.evidence}`);
    lines.push(`next=${check.next}`);
  }
  return lines.join("\n");
}

export function buildPaymentProviderReadinessArtifact(
  report: PaymentProviderReadinessReport,
  now = new Date(),
): PaymentProviderReadinessArtifact {
  const provenLocalChecks = report.checks.filter((check) => check.status === "proven-local");
  const readyApprovalChecks = report.checks.filter((check) => check.status === "ready-approval");
  const blockedChecks = report.checks.filter((check) => check.status !== "proven-local" && check.status !== "ready-approval");

  return {
    schemaVersion: 1,
    kind: "vallum.payment-provider-readiness-report",
    generatedAt: now.toISOString(),
    localProofOk: report.localProofOk,
    liveReady: report.liveReady,
    provenLocalCheckIds: provenLocalChecks.map((check) => check.id),
    readyApprovalCheckIds: readyApprovalChecks.map((check) => check.id),
    blockedCheckIds: blockedChecks.map((check) => check.id),
    blockerCodes: blockedChecks.map((check) => check.code),
    checks: report.checks,
    boundaries: ARTIFACT_BOUNDARIES,
  };
}

export async function writePaymentProviderReadinessArtifact(
  options: WritePaymentProviderReadinessArtifactOptions = {},
): Promise<PaymentProviderReadinessArtifact> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkPaymentProviderReadiness(options);
  const artifact = buildPaymentProviderReadinessArtifact(report, options.now);
  if (options.outFile) {
    const outPath = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, formatPaymentProviderReadinessArtifact(artifact), { mode: 0o600 });
    await chmod(outPath, 0o600);
  }
  return artifact;
}

export function formatPaymentProviderReadinessArtifact(artifact: PaymentProviderReadinessArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

async function checkLocalStandardsProof(cwd: string): Promise<PaymentProviderReadinessCheck> {
  const missing: string[] = [];
  for (const path of REQUIRED_SOURCE_PATHS) {
    try {
      await access(resolve(cwd, path));
    } catch {
      missing.push(path);
    }
  }

  if (missing.length > 0) {
    return {
      id: "local-standards-proof",
      status: "blocked-local",
      code: "PAYMENT_PROVIDER_LOCAL_PROOF_INCOMPLETE",
      message: "Local x402/AP2 standards bridge source or tests are missing.",
      evidence: `missingPaths=${missing.join(",")}`,
      next: "Restore local x402/AP2 manifest, receipt, standards bridge, and test evidence before accepting payment-provider readiness.",
    };
  }

  return {
    id: "local-standards-proof",
    status: "proven-local",
    code: "PAYMENT_PROVIDER_LOCAL_PROOF_CONFIGURED",
    message: "Local x402 and AP2 mapping, receipt, policy sequencing, failure, and redaction proof exists.",
    evidence: "node --import tsx --test packages/manifest/src/x402Mapping.test.ts packages/manifest/src/ap2Mapping.test.ts packages/receipts/src/x402Receipt.test.ts packages/receipts/src/ap2Receipt.test.ts packages/standards/src/x402.test.ts packages/standards/src/ap2.test.ts",
    next: "Keep this as local/mock standards proof only until an operator-approved live payment-provider report exists.",
  };
}

async function checkLiveReport(
  cwd: string,
  value: string | undefined,
  now: Date,
): Promise<PaymentProviderReadinessCheck> {
  if (!value || value.trim() === "") {
    return {
      id: "live-payment-provider-report",
      status: "blocked-config",
      code: "PAYMENT_PROVIDER_LIVE_REPORT_MISSING",
      message: "Live payment-provider proof requires an operator-supplied structured report path.",
      evidence: "missing=PAYMENT_PROVIDER_LIVE_REPORT",
      next: `${PAYMENT_PROVIDER_TEMPLATE_COMMAND}; run a dedicated operator-approved payment-provider proof and set PAYMENT_PROVIDER_LIVE_REPORT to the ignored local structured report path.`,
    };
  }

  const reportPath = isAbsolute(value) ? value : resolve(cwd, value);
  let raw: string;
  try {
    const bytes = await readFile(reportPath);
    if (bytes.byteLength > MAX_REPORT_BYTES) {
      return invalidReport(
        "PAYMENT_PROVIDER_LIVE_REPORT_TOO_LARGE",
        "Live payment-provider proof report is too large.",
        "configured-report-too-large",
        "Provide a concise structured report without raw payloads, headers, credentials, or response bodies.",
      );
    }
    raw = bytes.toString("utf8");
  } catch {
    return invalidReport(
      "PAYMENT_PROVIDER_LIVE_REPORT_NOT_FOUND",
      "Live payment-provider proof report path does not exist.",
      "configured-report-missing",
      "Provide an existing ignored local structured report after an operator-approved proof run.",
    );
  }

  let parsed: StructuredPaymentProviderReport;
  try {
    parsed = JSON.parse(raw) as StructuredPaymentProviderReport;
  } catch {
    return invalidReport(
      "PAYMENT_PROVIDER_LIVE_REPORT_INVALID_JSON",
      "Live payment-provider proof report is not valid JSON.",
      "configured-report-invalid-json",
      "Provide a JSON structured evidence report generated after an operator-approved proof run.",
    );
  }

  const invalid = validateStructuredReport(parsed, now);
  if (invalid) return invalid;

  return {
    id: "live-payment-provider-report",
    status: "ready-approval",
    code: "PAYMENT_PROVIDER_LIVE_REPORT_VALID",
    message: "Live payment-provider evidence is a passing structured report for a future approved review.",
    evidence: "local-structured-report-valid-redacted",
    next: "Review the report manually before accepting live payment/provider settlement claims.",
  };
}

function validateStructuredReport(
  report: StructuredPaymentProviderReport,
  now: Date,
): PaymentProviderReadinessCheck | undefined {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_INVALID_SHAPE", "Live payment-provider proof report must be a JSON object.", "configured-report-invalid-shape", "Provide a JSON object structured evidence report.");
  }
  if (report.schemaVersion !== 1) {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_UNSUPPORTED_SCHEMA", "Live payment-provider proof report schema is unsupported.", "configured-report-unsupported-schema", "Provide a structured evidence report with schemaVersion=1.");
  }
  if (report.kind !== "vallum.payment-provider-live-proof") {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_KIND_MISMATCH", "Live payment-provider proof report has the wrong kind.", "configured-report-kind-mismatch", "Provide an vallum.payment-provider-live-proof structured report.");
  }
  if (report.result !== "passed") {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_NOT_PASSED", "Live payment-provider proof report did not pass.", "configured-report-not-passed", "Rerun the approved proof after resolving payment-provider failures.");
  }
  if (containsUnsafeReportContent(report, { unsafeFieldNameRe: SECRET_FIELD_RE, unsafeStringValueRe: SECRET_VALUE_RE })) {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_UNSAFE_FIELDS", "Live payment-provider proof report contains unsafe secret-like fields.", "configured-report-unsafe-fields", "Provide status-only evidence without raw payloads, headers, credentials, signatures, or payment instruments.");
  }
  const providerKinds = report.providerKinds;
  if (!Array.isArray(providerKinds) || !providerKinds.includes("x402") || !providerKinds.includes("ap2")) {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_PROVIDER_MISSING", "Live payment-provider proof report must include x402 and AP2 provider kinds.", "configured-report-provider-missing", "Provide evidence for both x402 facilitator verify/settle/payment-response and AP2 mandate/receipt/accountability paths.");
  }
  const checks = report.checks;
  if (!Array.isArray(checks) || !REQUIRED_LIVE_CHECKS.every((check) => checks.includes(check))) {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_CHECKS_INCOMPLETE", "Live payment-provider proof report is missing required check ids.", "configured-report-checks-incomplete", "Include x402 verify, settle, payment-response, AP2 mandate-chain, checkout receipt, payment receipt, accountability review, and redaction-review checks.");
  }
  const x402Invalid = validateX402Proof(report.x402Proof);
  if (x402Invalid) return x402Invalid;
  const ap2Invalid = validateAp2Proof(report.ap2Proof);
  if (ap2Invalid) return ap2Invalid;
  if (typeof report.observedAt !== "string") {
    return staleReport();
  }
  const observedAt = Date.parse(report.observedAt);
  if (Number.isNaN(observedAt) || observedAt > now.getTime() || now.getTime() - observedAt > MAX_REPORT_AGE_MS) {
    return staleReport();
  }
  return undefined;
}

async function loadOptionalLocalEnv(cwd: string): Promise<Record<string, string>> {
  try {
    return await loadEnvFile(LOCAL_ENV_FILE, cwd);
  } catch {
    return {};
  }
}

function validateX402Proof(value: unknown): PaymentProviderReadinessCheck | undefined {
  if (!isRecord(value)) {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_X402_PROOF_MISSING", "Live payment-provider proof report is missing x402 proof details.", "configured-report-x402-proof-missing", "Include status-only x402 verify, settle, and payment response evidence.");
  }
  if (value.verifyResult !== "passed") {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_X402_VERIFY_NOT_PASSED", "Live payment-provider proof report does not prove x402 verification passed.", "configured-report-x402-verify-not-passed", "Rerun the approved x402 verify proof and record only status-level evidence.");
  }
  if (value.settleResult !== "passed") {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_X402_SETTLE_NOT_PASSED", "Live payment-provider proof report does not prove x402 settlement passed.", "configured-report-x402-settle-not-passed", "Rerun the approved x402 settle proof and record only status-level evidence.");
  }
  if (value.paymentResponse !== "present-redacted") {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_X402_PAYMENT_RESPONSE_MISSING", "Live payment-provider proof report does not prove the x402 payment response confirmation was present.", "configured-report-x402-payment-response-missing", "Record that the x402 payment response confirmation was present without storing the raw header or body.");
  }
  return undefined;
}

function validateAp2Proof(value: unknown): PaymentProviderReadinessCheck | undefined {
  if (!isRecord(value)) {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_AP2_PROOF_MISSING", "Live payment-provider proof report is missing AP2 proof details.", "configured-report-ap2-proof-missing", "Include status-only AP2 mandate-chain, checkout receipt, payment receipt, and accountability evidence.");
  }
  if (value.mandateChain !== "validated") {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_AP2_MANDATE_CHAIN_NOT_VALIDATED", "Live payment-provider proof report does not prove AP2 mandate-chain validation.", "configured-report-ap2-mandate-chain-not-validated", "Record status-only AP2 mandate-chain validation evidence after an approved proof run.");
  }
  if (value.checkoutReceipt !== "validated") {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_AP2_CHECKOUT_RECEIPT_NOT_VALIDATED", "Live payment-provider proof report does not prove AP2 checkout receipt validation.", "configured-report-ap2-checkout-receipt-not-validated", "Record status-only AP2 checkout receipt validation evidence after an approved proof run.");
  }
  if (value.paymentReceipt !== "validated") {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_AP2_PAYMENT_RECEIPT_NOT_VALIDATED", "Live payment-provider proof report does not prove AP2 payment receipt validation.", "configured-report-ap2-payment-receipt-not-validated", "Record status-only AP2 payment receipt validation evidence after an approved proof run.");
  }
  if (value.accountabilityReview !== "passed") {
    return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_AP2_ACCOUNTABILITY_REVIEW_MISSING", "Live payment-provider proof report does not prove AP2 accountability review passed.", "configured-report-ap2-accountability-review-missing", "Record status-only AP2 accountability review evidence after an approved proof run.");
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function staleReport(): PaymentProviderReadinessCheck {
  return invalidReport("PAYMENT_PROVIDER_LIVE_REPORT_STALE", "Live payment-provider proof report is stale or has an invalid observation time.", "configured-report-stale-or-invalid-time", "Provide a structured payment-provider report with an observedAt timestamp from the last 30 days.");
}

function invalidReport(
  code: string,
  message: string,
  evidence: string,
  next: string,
): PaymentProviderReadinessCheck {
  return {
    id: "live-payment-provider-report",
    status: "blocked-config",
    code,
    message,
    evidence,
    next,
  };
}

function parseArgs(args: readonly string[]): CliOptions {
  let help = false;
  let json = false;
  let outFile: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--out") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--out requires a path.");
      outFile = value;
      index += 1;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }

  return { help, json, outFile };
}

async function main(): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage);
    return 1;
  }

  if (options.help) {
    console.log(usage.trimEnd());
    return 0;
  }

  if (options.json || options.outFile) {
    const artifact = await writePaymentProviderReadinessArtifact({ outFile: options.outFile });
    console.log(formatPaymentProviderReadinessArtifact(artifact).trimEnd());
    return 0;
  }

  const report = await checkPaymentProviderReadiness();
  console.log(formatPaymentProviderReadinessReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
