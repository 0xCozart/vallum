import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFile } from "../apps/policy-gateway-service/src/readiness.js";

export interface A2ATckConformanceReport {
  readonly schemaVersion: 1;
  readonly kind: "a2a-external-conformance";
  readonly result: "passed";
  readonly observedAt: string;
  readonly publicAgentCardUrl: string;
  readonly publicBaseUrl: string;
  readonly checks: readonly string[];
  readonly runner: "a2a-tck";
  readonly tckCompatibility: {
    readonly summary: Record<string, unknown>;
    readonly per_transport: Record<string, unknown>;
    readonly per_requirement: Record<string, unknown>;
  };
}

export interface WrapA2ATckConformanceOptions {
  readonly cwd?: string;
  readonly compatibilityFile?: string;
  readonly outFile?: string;
  readonly publicAgentCardUrl?: string;
  readonly publicBaseUrl?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly now?: Date;
}

export type WrapA2ATckConformanceResult =
  | { readonly ok: true; readonly report: A2ATckConformanceReport; readonly reportFile: string }
  | {
      readonly ok: false;
      readonly code:
        | "A2A_TCK_WRAPPER_CONFIG_MISSING"
        | "A2A_TCK_WRAPPER_URL_UNSAFE"
        | "A2A_TCK_WRAPPER_INPUT_NOT_FOUND"
        | "A2A_TCK_WRAPPER_INPUT_TOO_LARGE"
        | "A2A_TCK_WRAPPER_INPUT_INVALID_JSON"
        | "A2A_TCK_WRAPPER_INPUT_INVALID_SHAPE"
        | "A2A_TCK_WRAPPER_TCK_SUMMARY_MISSING"
        | "A2A_TCK_WRAPPER_TCK_MUST_COMPATIBILITY_INCOMPLETE"
        | "A2A_TCK_WRAPPER_TCK_HTTP_JSON_TRANSPORT_MISSING"
        | "A2A_TCK_WRAPPER_TCK_HTTP_JSON_FAILURES_PRESENT"
        | "A2A_TCK_WRAPPER_TCK_REQUIREMENTS_MISSING"
        | "A2A_TCK_WRAPPER_TCK_REQUIRED_MUST_NOT_PASSED"
        | "A2A_TCK_WRAPPER_TCK_REQUIRED_HTTP_JSON_NOT_PASSED";
      readonly missing?: readonly string[];
      readonly message: string;
    };

interface CliOptions {
  readonly help: boolean;
  readonly compatibilityFile?: string;
  readonly outFile?: string;
  readonly publicAgentCardUrl?: string;
  readonly publicBaseUrl?: string;
}

type MutableCliOptions = {
  -readonly [Key in keyof CliOptions]: CliOptions[Key];
};

const MAX_INPUT_BYTES = 1024 * 1024;
const REQUIRED_REQUIREMENTS = ["CORE-SEND-001", "CORE-SEND-003"] as const;
const LOCAL_ENV_FILE = ".env";

const usage = `usage: npm exec tsx -- scripts/wrap-a2a-tck-conformance.ts --compatibility <reports/compatibility.json> --out <ignored-report.json> [--public-agent-card-url <url>] [--public-base-url <url>]

Wraps official A2A TCK reports/compatibility.json into Vallum's redacted a2a-external-conformance report shape.

Options may also come from A2A_TCK_COMPATIBILITY_REPORT, A2A_EXTERNAL_CONFORMANCE_REPORT,
A2A_PUBLIC_AGENT_CARD_URL, and A2A_PUBLIC_BASE_URL. This command is non-networked.`;

export async function wrapA2ATckConformance(
  options: WrapA2ATckConformanceOptions = {},
): Promise<WrapA2ATckConformanceResult> {
  const cwd = options.cwd ?? process.cwd();
  const env = await resolveA2ATckConformanceEnv(cwd, options.env);
  const compatibilityFile = options.compatibilityFile ?? readEnv(env, "A2A_TCK_COMPATIBILITY_REPORT");
  const outFile = options.outFile ?? readEnv(env, "A2A_EXTERNAL_CONFORMANCE_REPORT");
  const publicAgentCardUrl = options.publicAgentCardUrl ?? readEnv(env, "A2A_PUBLIC_AGENT_CARD_URL");
  const publicBaseUrl = options.publicBaseUrl ?? readEnv(env, "A2A_PUBLIC_BASE_URL");
  const missing = [
    !compatibilityFile ? "A2A_TCK_COMPATIBILITY_REPORT" : undefined,
    !outFile ? "A2A_EXTERNAL_CONFORMANCE_REPORT" : undefined,
    !publicAgentCardUrl ? "A2A_PUBLIC_AGENT_CARD_URL" : undefined,
    !publicBaseUrl ? "A2A_PUBLIC_BASE_URL" : undefined,
  ].filter((value): value is string => value !== undefined);
  if (missing.length > 0) {
    return blocked("A2A_TCK_WRAPPER_CONFIG_MISSING", "A2A TCK wrapper requires compatibility input, output report, public Agent Card URL, and public base URL.", missing);
  }
  if (!compatibilityFile || !outFile || !publicAgentCardUrl || !publicBaseUrl) {
    throw new Error("A2A TCK wrapper missing-config invariant failed.");
  }
  if (
    !isSafePublicHttpsUrl(publicAgentCardUrl)
    || !isSafePublicHttpsUrl(publicBaseUrl)
    || !publicAgentCardUrl.endsWith("/.well-known/agent-card.json")
  ) {
    return blocked("A2A_TCK_WRAPPER_URL_UNSAFE", "A2A TCK wrapper requires public HTTPS URLs and canonical Agent Card path.");
  }

  const input = await readTckCompatibilityJson(cwd, compatibilityFile);
  if (!input.ok) return input;
  const sanitized = sanitizeTckCompatibility(input.value);
  if (!sanitized.ok) return sanitized;

  const report: A2ATckConformanceReport = {
    schemaVersion: 1,
    kind: "a2a-external-conformance",
    result: "passed",
    observedAt: (options.now ?? new Date()).toISOString(),
    publicAgentCardUrl,
    publicBaseUrl,
    checks: ["agent-card", "official-a2a-tck", "http-json-must", "redaction-review"],
    runner: "a2a-tck",
    tckCompatibility: sanitized.value,
  };
  const reportFile = isAbsolute(outFile) ? outFile : resolve(cwd, outFile);
  await mkdir(dirname(reportFile), { recursive: true });
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await chmod(reportFile, 0o600);
  return { ok: true, report, reportFile };
}

export async function resolveA2ATckConformanceEnv(
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

export function formatWrapA2ATckConformanceResult(result: WrapA2ATckConformanceResult): string {
  const lines = [
    `A2A TCK conformance wrapper ${result.ok ? "passed" : "blocked"}`,
    `ok=${result.ok}`,
  ];
  if (result.ok) {
    lines.push("reportWritten=true");
    lines.push("source=official-a2a-tck-compatibility-json");
    lines.push(`checks=${result.report.checks.join(",")}`);
  } else {
    lines.push(`code=${result.code}`);
    if (result.missing) lines.push(`missing=${result.missing.join(",")}`);
    lines.push(`message=${result.message}`);
  }
  return lines.join("\n");
}

async function readTckCompatibilityJson(
  cwd: string,
  value: string,
): Promise<{ readonly ok: true; readonly value: Record<string, unknown> } | Extract<WrapA2ATckConformanceResult, { ok: false }>> {
  const inputFile = isAbsolute(value) ? value : resolve(cwd, value);
  let raw: string;
  try {
    const bytes = await readFile(inputFile);
    if (bytes.byteLength > MAX_INPUT_BYTES) {
      return blocked("A2A_TCK_WRAPPER_INPUT_TOO_LARGE", "A2A TCK compatibility input is too large.");
    }
    raw = bytes.toString("utf8");
  } catch {
    return blocked("A2A_TCK_WRAPPER_INPUT_NOT_FOUND", "A2A TCK compatibility input path does not exist.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return blocked("A2A_TCK_WRAPPER_INPUT_INVALID_JSON", "A2A TCK compatibility input is not valid JSON.");
  }
  if (!isRecord(parsed)) {
    return blocked("A2A_TCK_WRAPPER_INPUT_INVALID_SHAPE", "A2A TCK compatibility input must be a JSON object.");
  }
  return { ok: true, value: parsed };
}

function sanitizeTckCompatibility(
  value: Record<string, unknown>,
): { readonly ok: true; readonly value: A2ATckConformanceReport["tckCompatibility"] } | Extract<WrapA2ATckConformanceResult, { ok: false }> {
  const summary = isRecord(value.summary) ? value.summary : undefined;
  if (!summary) {
    return blocked("A2A_TCK_WRAPPER_TCK_SUMMARY_MISSING", "A2A TCK compatibility summary is missing.");
  }
  if (parsePercent(summary.must_compatibility) !== 100) {
    return blocked("A2A_TCK_WRAPPER_TCK_MUST_COMPATIBILITY_INCOMPLETE", "A2A TCK MUST compatibility must be 100.0%.");
  }

  const perTransport = isRecord(value.per_transport) ? value.per_transport : undefined;
  const httpJson = perTransport && isRecord(perTransport["HTTP+JSON"]) ? perTransport["HTTP+JSON"] : undefined;
  if (!httpJson || readNonNegativeNumber(httpJson.total) <= 0) {
    return blocked("A2A_TCK_WRAPPER_TCK_HTTP_JSON_TRANSPORT_MISSING", "A2A TCK HTTP+JSON transport evidence is missing.");
  }
  if (readNonNegativeNumber(httpJson.failed) !== 0) {
    return blocked("A2A_TCK_WRAPPER_TCK_HTTP_JSON_FAILURES_PRESENT", "A2A TCK HTTP+JSON transport must have zero failed tests.");
  }

  const perRequirement = isRecord(value.per_requirement) ? value.per_requirement : undefined;
  if (!perRequirement) {
    return blocked("A2A_TCK_WRAPPER_TCK_REQUIREMENTS_MISSING", "A2A TCK per-requirement results are missing.");
  }

  const sanitizedRequirements: Record<string, unknown> = {};
  for (const requirementId of REQUIRED_REQUIREMENTS) {
    const requirement = isRecord(perRequirement[requirementId]) ? perRequirement[requirementId] : undefined;
    if (!requirement || requirement.level !== "MUST" || requirement.status !== "PASS") {
      return blocked("A2A_TCK_WRAPPER_TCK_REQUIRED_MUST_NOT_PASSED", "A2A TCK required MUST requirements must pass.");
    }
    const transports = isRecord(requirement.transports) ? requirement.transports : {};
    if (transports["HTTP+JSON"] !== "PASS") {
      return blocked("A2A_TCK_WRAPPER_TCK_REQUIRED_HTTP_JSON_NOT_PASSED", "A2A TCK required HTTP+JSON requirements must pass.");
    }
    sanitizedRequirements[requirementId] = {
      level: "MUST",
      status: "PASS",
      transports: { "HTTP+JSON": "PASS" },
      test_ids: sanitizeStringArray(requirement.test_ids),
    };
  }

  return {
    ok: true,
    value: {
      summary: {
        timestamp: typeof summary.timestamp === "string" ? summary.timestamp : undefined,
        spec_version: typeof summary.spec_version === "string" ? summary.spec_version : undefined,
        overall_compatibility: summary.overall_compatibility,
        must_compatibility: summary.must_compatibility,
        should_compatibility: summary.should_compatibility,
        may_compatibility: summary.may_compatibility,
      },
      per_transport: {
        "HTTP+JSON": {
          total: readNonNegativeNumber(httpJson.total),
          passed: readNonNegativeNumber(httpJson.passed),
          failed: readNonNegativeNumber(httpJson.failed),
          skipped: readNonNegativeNumber(httpJson.skipped),
        },
      },
      per_requirement: sanitizedRequirements,
    },
  };
}

function sanitizeStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => (
    typeof entry === "string"
    && /^[A-Za-z0-9_.:-]{1,120}$/.test(entry)
  ));
}

function blocked(
  code: Extract<WrapA2ATckConformanceResult, { ok: false }>["code"],
  message: string,
  missing?: readonly string[],
): Extract<WrapA2ATckConformanceResult, { ok: false }> {
  return { ok: false, code, message, missing };
}

function readEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key]?.trim();
  return value === "" ? undefined : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePercent(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = /^(\d+(?:\.\d+)?)%$/.exec(value.trim());
  if (!match) return undefined;
  return Number(match[1]);
}

function readNonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : -1;
}

function isSafePublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password || url.search || url.hash) return false;
    if (isUnsafeHostname(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function isUnsafeHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    const [first = 0, second = 0] = normalized.split(".").map((part) => Number(part));
    return first === 10
      || first === 127
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 169 && second === 254);
  }
  if (ipVersion === 6) {
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80");
  }
  return false;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: MutableCliOptions = { help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--compatibility") {
      options.compatibilityFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--out") {
      options.outFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--public-agent-card-url") {
      options.publicAgentCardUrl = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--public-base-url") {
      options.publicBaseUrl = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function readArg(argv: readonly string[], index: number, name: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

async function main(): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid arguments.");
    return 2;
  }
  if (options.help) {
    console.log(usage);
    return 0;
  }
  const result = await wrapA2ATckConformance({
    compatibilityFile: options.compatibilityFile,
    outFile: options.outFile,
    publicAgentCardUrl: options.publicAgentCardUrl,
    publicBaseUrl: options.publicBaseUrl,
  });
  console.log(formatWrapA2ATckConformanceResult(result));
  return result.ok ? 0 : 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
