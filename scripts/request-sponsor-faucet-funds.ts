import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { FaucetRateLimitError } from "@iota/iota-sdk/faucet";

import { loadEnvFile } from "../apps/policy-gateway-service/src/readiness.js";
import { sponsorAddressFromGasStationKeypair } from "./check-sponsor-funding.js";

export type SponsorFaucetRequestCode =
  | "SPONSOR_FAUCET_APPROVAL_REQUIRED"
  | "SPONSOR_FAUCET_CONFIG_MISSING"
  | "SPONSOR_FAUCET_URL_UNSAFE"
  | "SPONSOR_FAUCET_REQUESTED"
  | "SPONSOR_FAUCET_RATE_LIMITED"
  | "SPONSOR_FAUCET_FAILED";

export interface SponsorFaucetRequestReport {
  readonly schemaVersion: 1;
  readonly kind: "agentic-gaskit.sponsor-faucet-request";
  readonly result: "blocked" | "passed" | "failed";
  readonly code: SponsorFaucetRequestCode;
  readonly observedAt: string;
  readonly network: "iota-testnet";
  readonly message: string;
  readonly approvalRequired: boolean;
  readonly contactsLiveService: boolean;
  readonly spendsGas: false;
  readonly signsTransactions: false;
  readonly sponsorAddressRedacted?: string;
  readonly faucetUrlConfigured: boolean;
  readonly faucetApiVersion?: "v1-batch" | "v0-documented";
  readonly faucetHttpStatus?: number;
  readonly faucetFailureKind?: "http-status" | "invalid-json" | "faucet-error" | "network-error" | "discarded" | "poll-timeout";
  readonly amountMist?: string;
  readonly reportPath?: string;
  readonly nextCommands: readonly string[];
}

export interface SponsorFaucetRequestReportValidation {
  readonly ok: boolean;
  readonly code: "SPONSOR_FAUCET_REPORT_VALID" | "SPONSOR_FAUCET_REPORT_INVALID";
  readonly message: string;
}

export type SponsorFaucetApiVersion = NonNullable<SponsorFaucetRequestReport["faucetApiVersion"]>;

export interface RequestSponsorFaucetFundsOptions {
  readonly env?: Record<string, string | undefined>;
  readonly envFile?: string;
  readonly execute?: boolean;
  readonly faucetApiVersion?: SponsorFaucetApiVersion;
  readonly faucetUrl?: string;
  readonly now?: Date;
  readonly outFile?: string;
  readonly requestFunds?: SponsorFaucetRequester;
}

export type SponsorFaucetRequester = (input: {
  readonly host: string;
  readonly recipient: string;
}) => Promise<number | undefined>;

interface CliOptions {
  readonly envFile: string;
  readonly execute: boolean;
  readonly faucetApiVersion?: SponsorFaucetApiVersion;
  readonly faucetUrl?: string;
  readonly help: boolean;
  readonly outFile: string;
}

type MutableCliOptions = {
  -readonly [Key in keyof CliOptions]: CliOptions[Key];
};

const DEFAULT_OUT_FILE = "tmp/gaskit/sponsor-faucet-request.json";

const usage = `usage: npm exec tsx -- scripts/request-sponsor-faucet-funds.ts [--execute] [--api-version v1-batch|v0-documented] [--faucet-url <url>] [--env-file <path>] [--out <path>]

Requests IOTA testnet faucet funds for the configured sponsor address only when --execute is supplied.
Requires IOTA_FAUCET_URL or --faucet-url. Stdout stays redacted; the report is written to an ignored local path.`;

export async function requestSponsorFaucetFunds(
  options: RequestSponsorFaucetFundsOptions = {},
): Promise<SponsorFaucetRequestReport> {
  const env = options.env ?? await loadEnvFile(options.envFile ?? ".env");
  const observedAt = (options.now ?? new Date()).toISOString();
  const faucetUrl = options.faucetUrl ?? readEnv(env, "IOTA_FAUCET_URL");
  const outFile = options.outFile ?? DEFAULT_OUT_FILE;
  const reportPath = resolve(process.cwd(), outFile);
  const nextCommands = [
    "npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json",
    "npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json",
    "npm run proof:live-status",
  ];

  const base = {
    schemaVersion: 1 as const,
    kind: "agentic-gaskit.sponsor-faucet-request" as const,
    observedAt,
    network: "iota-testnet" as const,
    approvalRequired: true,
    spendsGas: false as const,
    signsTransactions: false as const,
    faucetUrlConfigured: Boolean(faucetUrl),
    reportPath: redactPath(outFile),
    nextCommands,
  };

  let sponsorAddress: string;
  try {
    sponsorAddress = sponsorAddressFromGasStationKeypair(requiredEnv(env.GAS_STATION_KEYPAIR, "GAS_STATION_KEYPAIR"));
  } catch {
    return writeReport(reportPath, {
      ...base,
      result: "blocked",
      code: "SPONSOR_FAUCET_CONFIG_MISSING",
      message: "Sponsor faucet request requires a readable local sponsor signer configuration.",
      contactsLiveService: false,
    });
  }

  const sponsorAddressRedacted = redactAddress(sponsorAddress);
  if (!options.execute) {
    return writeReport(reportPath, {
      ...base,
      result: "blocked",
      code: "SPONSOR_FAUCET_APPROVAL_REQUIRED",
      message: "Sponsor faucet request requires explicit --execute before contacting a faucet service.",
      contactsLiveService: false,
      sponsorAddressRedacted,
    });
  }

  if (!faucetUrl) {
    return writeReport(reportPath, {
      ...base,
      result: "blocked",
      code: "SPONSOR_FAUCET_CONFIG_MISSING",
      message: "Sponsor faucet request requires IOTA_FAUCET_URL or --faucet-url outside tracked files.",
      contactsLiveService: false,
      sponsorAddressRedacted,
    });
  }

  if (!isSafeFaucetUrl(faucetUrl)) {
    return writeReport(reportPath, {
      ...base,
      result: "blocked",
      code: "SPONSOR_FAUCET_URL_UNSAFE",
      message: "Sponsor faucet URL must be HTTPS or loopback HTTP.",
      contactsLiveService: false,
      sponsorAddressRedacted,
    });
  }

  const selectedApiVersion = options.faucetApiVersion ?? "v1-batch";
  try {
    const requester = options.requestFunds ?? requesterForApiVersion(selectedApiVersion);
    const amount = await requester({
      host: faucetUrl,
      recipient: sponsorAddress,
    });
    return writeReport(reportPath, {
      ...base,
      result: "passed",
      code: "SPONSOR_FAUCET_REQUESTED",
      message: "Sponsor faucet request completed; rerun the funding diagnostic to verify readable coin balance.",
      contactsLiveService: true,
      sponsorAddressRedacted,
      faucetApiVersion: options.requestFunds === undefined ? selectedApiVersion : options.faucetApiVersion,
      amountMist: amount === undefined ? undefined : String(amount),
    });
  } catch (error) {
    const sanitized = sanitizedFaucetError(error);
    return writeReport(reportPath, {
      ...base,
      result: "failed",
      code: sanitized.rateLimited ? "SPONSOR_FAUCET_RATE_LIMITED" : "SPONSOR_FAUCET_FAILED",
      message: sanitized.rateLimited
        ? "Sponsor faucet request was rate limited; retry later."
        : "Sponsor faucet request failed without exposing raw faucet response details.",
      contactsLiveService: true,
      sponsorAddressRedacted,
      faucetApiVersion: sanitized.apiVersion ?? selectedApiVersion,
      faucetHttpStatus: sanitized.httpStatus,
      faucetFailureKind: sanitized.failureKind,
    });
  }
}

export async function loadSponsorFaucetRequestReport(path: string): Promise<SponsorFaucetRequestReport> {
  return JSON.parse(await readFile(path, "utf8")) as SponsorFaucetRequestReport;
}

export function validateSponsorFaucetRequestReport(
  report: SponsorFaucetRequestReport,
  now: Date = new Date(),
): SponsorFaucetRequestReportValidation {
  if (!isRecord(report)) return invalidSponsorFaucetReport("Sponsor faucet report must be a JSON object.");
  const unknown = Object.keys(report).filter((key) => !SPONSOR_FAUCET_REPORT_KEYS.has(key));
  if (unknown.length > 0) return invalidSponsorFaucetReport("Sponsor faucet report contains unsupported fields.");
  if (report.schemaVersion !== 1 || report.kind !== "agentic-gaskit.sponsor-faucet-request") {
    return invalidSponsorFaucetReport("Sponsor faucet report schema or kind is unsupported.");
  }
  const observedAt = Date.parse(report.observedAt);
  if (!Number.isFinite(observedAt)) return invalidSponsorFaucetReport("Sponsor faucet report observedAt is invalid.");
  if (Math.abs(now.getTime() - observedAt) > 24 * 60 * 60 * 1000) {
    return invalidSponsorFaucetReport("Sponsor faucet report is stale.");
  }
  if (!["blocked", "passed", "failed"].includes(report.result)) {
    return invalidSponsorFaucetReport("Sponsor faucet report result is unsupported.");
  }
  if (![
    "SPONSOR_FAUCET_APPROVAL_REQUIRED",
    "SPONSOR_FAUCET_CONFIG_MISSING",
    "SPONSOR_FAUCET_URL_UNSAFE",
    "SPONSOR_FAUCET_REQUESTED",
    "SPONSOR_FAUCET_RATE_LIMITED",
    "SPONSOR_FAUCET_FAILED",
  ].includes(report.code)) {
    return invalidSponsorFaucetReport("Sponsor faucet report code is unsupported.");
  }
  if (report.result === "passed" && report.code !== "SPONSOR_FAUCET_REQUESTED") {
    return invalidSponsorFaucetReport("Sponsor faucet report passed result must use the requested code.");
  }
  if (report.result === "failed" && report.code !== "SPONSOR_FAUCET_FAILED" && report.code !== "SPONSOR_FAUCET_RATE_LIMITED") {
    return invalidSponsorFaucetReport("Sponsor faucet report failed result must use a failure code.");
  }
  if (report.result === "blocked" && ![
    "SPONSOR_FAUCET_APPROVAL_REQUIRED",
    "SPONSOR_FAUCET_CONFIG_MISSING",
    "SPONSOR_FAUCET_URL_UNSAFE",
  ].includes(report.code)) {
    return invalidSponsorFaucetReport("Sponsor faucet report blocked result must use a blocked code.");
  }
  if (report.network !== "iota-testnet") return invalidSponsorFaucetReport("Sponsor faucet report network is unsupported.");
  if (report.spendsGas !== false || report.signsTransactions !== false) {
    return invalidSponsorFaucetReport("Sponsor faucet report cannot claim gas spend or signing.");
  }
  if (typeof report.approvalRequired !== "boolean" || typeof report.contactsLiveService !== "boolean" || typeof report.faucetUrlConfigured !== "boolean") {
    return invalidSponsorFaucetReport("Sponsor faucet report booleans are invalid.");
  }
  if (report.sponsorAddressRedacted && /^0x[0-9a-fA-F]{64}$/.test(report.sponsorAddressRedacted)) {
    return invalidSponsorFaucetReport("Sponsor faucet report must not contain a full sponsor address.");
  }
  if (report.faucetApiVersion && report.faucetApiVersion !== "v1-batch" && report.faucetApiVersion !== "v0-documented") {
    return invalidSponsorFaucetReport("Sponsor faucet report API version is unsupported.");
  }
  if (report.faucetHttpStatus !== undefined && (!Number.isInteger(report.faucetHttpStatus) || report.faucetHttpStatus < 100 || report.faucetHttpStatus > 599)) {
    return invalidSponsorFaucetReport("Sponsor faucet report HTTP status is invalid.");
  }
  if (report.faucetFailureKind && ![
    "http-status",
    "invalid-json",
    "faucet-error",
    "network-error",
    "discarded",
    "poll-timeout",
  ].includes(report.faucetFailureKind)) {
    return invalidSponsorFaucetReport("Sponsor faucet report failure kind is unsupported.");
  }
  if (report.amountMist !== undefined && !/^\d+$/.test(report.amountMist)) {
    return invalidSponsorFaucetReport("Sponsor faucet report amount is invalid.");
  }
  if (!Array.isArray(report.nextCommands) || !report.nextCommands.every((command) => typeof command === "string" && command.trim() !== "")) {
    return invalidSponsorFaucetReport("Sponsor faucet report next commands are invalid.");
  }
  return {
    ok: true,
    code: "SPONSOR_FAUCET_REPORT_VALID",
    message: "Sponsor faucet report is structurally valid sanitized evidence.",
  };
}

export async function requestIotaFromDocumentedFaucet(input: {
  readonly host: string;
  readonly recipient: string;
}): Promise<number | undefined> {
  const endpoint = new URL("/gas", input.host).toString();
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        FixedAmountRequest: {
          recipient: input.recipient,
        },
      }),
    });
  } catch {
    throw new SanitizedFaucetRequestError("network-error");
  }
  if (response.status === 429) {
    throw new SanitizedFaucetRequestError("http-status", 429, "v0-documented", true);
  }
  if (!response.ok) {
    throw new SanitizedFaucetRequestError("http-status", response.status);
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new SanitizedFaucetRequestError("invalid-json", response.status);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new SanitizedFaucetRequestError("invalid-json", response.status);
  }
  const body = parsed as { error?: unknown; transferredGasObjects?: unknown };
  if (body.error) {
    throw new SanitizedFaucetRequestError("faucet-error", response.status);
  }
  if (!Array.isArray(body.transferredGasObjects)) {
    return undefined;
  }
  return body.transferredGasObjects.reduce((total, coin) => {
    if (!coin || typeof coin !== "object") return total;
    const amount = (coin as { amount?: unknown }).amount;
    return typeof amount === "number" && Number.isFinite(amount) ? total + amount : total;
  }, 0);
}

export async function requestIotaFromDefaultFaucet(input: {
  readonly host: string;
  readonly recipient: string;
  readonly maxAttempts?: number;
  readonly delayMs?: number;
}): Promise<number | undefined> {
  const maxAttempts = input.maxAttempts ?? 20;
  const delayMs = input.delayMs ?? 1500;
  const initial = await faucetFetchJson({
    apiVersion: "v1-batch",
    host: input.host,
    path: "/v1/gas",
    method: "POST",
    body: {
      FixedAmountRequest: {
        recipient: input.recipient,
      },
    },
  });
  const task = typeof initial.task === "string" && initial.task.trim() !== "" ? initial.task.trim() : undefined;
  if (!task) {
    throw new SanitizedFaucetRequestError("invalid-json", undefined, "v1-batch");
  }

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    const statusResponse = await faucetFetchJson({
      apiVersion: "v1-batch",
      host: input.host,
      path: `/v1/status/${encodeURIComponent(task)}`,
      method: "GET",
    });
    const statusEnvelope = statusResponse.status;
    const status = statusEnvelope && typeof statusEnvelope === "object"
      ? (statusEnvelope as { status?: unknown }).status
      : undefined;
    if (status === "SUCCEEDED") {
      const transferred = (statusEnvelope as { transferred_gas_objects?: { sent?: unknown } }).transferred_gas_objects;
      const sent = transferred && typeof transferred === "object" && Array.isArray(transferred.sent)
        ? transferred.sent
        : [];
      return sent.reduce((total, coin) => {
        if (!coin || typeof coin !== "object") return total;
        const amount = (coin as { amount?: unknown }).amount;
        return typeof amount === "number" && Number.isFinite(amount) ? total + amount : total;
      }, 0);
    }
    if (status === "DISCARDED") {
      throw new SanitizedFaucetRequestError("discarded", undefined, "v1-batch");
    }
    if (status !== "INPROGRESS") {
      throw new SanitizedFaucetRequestError("invalid-json", undefined, "v1-batch");
    }
    if (attempt < maxAttempts) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
  }

  throw new SanitizedFaucetRequestError("poll-timeout", undefined, "v1-batch");
}

export function formatSponsorFaucetRequestReport(report: SponsorFaucetRequestReport): string {
  return [
    "Agentic GasKit sponsor faucet request",
    `result=${report.result}`,
    `code=${report.code}`,
    `message=${report.message}`,
    `approvalRequired=${report.approvalRequired}`,
    `contactsLiveService=${report.contactsLiveService}`,
    `spendsGas=${report.spendsGas}`,
    `signsTransactions=${report.signsTransactions}`,
    `network=${report.network}`,
    `faucetUrlConfigured=${report.faucetUrlConfigured}`,
    ...(report.faucetApiVersion ? [`faucetApiVersion=${report.faucetApiVersion}`] : []),
    ...(report.faucetHttpStatus ? [`faucetHttpStatus=${report.faucetHttpStatus}`] : []),
    ...(report.faucetFailureKind ? [`faucetFailureKind=${report.faucetFailureKind}`] : []),
    ...(report.sponsorAddressRedacted ? [`sponsorAddress=${report.sponsorAddressRedacted}`] : []),
    ...(report.amountMist ? [`amountMist=${report.amountMist}`] : []),
    ...(report.reportPath ? [`report=${report.reportPath}`] : []),
    `next=${report.nextCommands.join(" && ")}`,
  ].join("\n");
}

function requesterForApiVersion(apiVersion: SponsorFaucetApiVersion): SponsorFaucetRequester {
  return apiVersion === "v0-documented"
    ? requestIotaFromDocumentedFaucet
    : requestIotaFromDefaultFaucet;
}

const SPONSOR_FAUCET_REPORT_KEYS = new Set([
  "schemaVersion",
  "kind",
  "result",
  "code",
  "observedAt",
  "network",
  "message",
  "approvalRequired",
  "contactsLiveService",
  "spendsGas",
  "signsTransactions",
  "sponsorAddressRedacted",
  "faucetUrlConfigured",
  "faucetApiVersion",
  "faucetHttpStatus",
  "faucetFailureKind",
  "amountMist",
  "reportPath",
  "nextCommands",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidSponsorFaucetReport(message: string): SponsorFaucetRequestReportValidation {
  return {
    ok: false,
    code: "SPONSOR_FAUCET_REPORT_INVALID",
    message,
  };
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: MutableCliOptions = {
    envFile: ".env",
    execute: false,
    help: false,
    outFile: DEFAULT_OUT_FILE,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--execute") {
      options.execute = true;
      continue;
    }
    if (arg === "--api-version") {
      const value = argv[index + 1];
      if (!value) throw new Error("--api-version requires v1-batch or v0-documented.");
      if (value !== "v1-batch" && value !== "v0-documented") {
        throw new Error("--api-version must be v1-batch or v0-documented.");
      }
      options.faucetApiVersion = value;
      index += 1;
      continue;
    }
    if (arg === "--env-file") {
      const value = argv[index + 1];
      if (!value) throw new Error("--env-file requires a path.");
      options.envFile = value;
      index += 1;
      continue;
    }
    if (arg === "--faucet-url") {
      const value = argv[index + 1];
      if (!value) throw new Error("--faucet-url requires a URL.");
      options.faucetUrl = value;
      index += 1;
      continue;
    }
    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error("--out requires a path.");
      options.outFile = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function writeReport(path: string, report: SponsorFaucetRequestReport): Promise<SponsorFaucetRequestReport> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  return report;
}

function readEnv(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function requiredEnv(value: string | undefined, name: string): string {
  if (!value || value.trim() === "") throw new Error(`${name} is required.`);
  return value.trim();
}

function isSafeFaucetUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    return ["127.0.0.1", "::1", "localhost"].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

class SanitizedFaucetRequestError extends Error {
  constructor(
    readonly failureKind: NonNullable<SponsorFaucetRequestReport["faucetFailureKind"]>,
    readonly httpStatus?: number,
    readonly apiVersion: NonNullable<SponsorFaucetRequestReport["faucetApiVersion"]> = "v0-documented",
    readonly rateLimited: boolean = false,
  ) {
    super("Sanitized sponsor faucet request failure.");
  }
}

async function faucetFetchJson(input: {
  readonly apiVersion: NonNullable<SponsorFaucetRequestReport["faucetApiVersion"]>;
  readonly host: string;
  readonly path: string;
  readonly method: "GET" | "POST";
  readonly body?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(new URL(input.path, input.host), {
      method: input.method,
      headers: { "Content-Type": "application/json" },
      body: input.body ? JSON.stringify(input.body) : undefined,
    });
  } catch {
    throw new SanitizedFaucetRequestError("network-error", undefined, input.apiVersion);
  }
  if (response.status === 429) {
    throw new SanitizedFaucetRequestError("http-status", 429, input.apiVersion, true);
  }
  if (!response.ok) {
    throw new SanitizedFaucetRequestError("http-status", response.status, input.apiVersion);
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new SanitizedFaucetRequestError("invalid-json", response.status, input.apiVersion);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new SanitizedFaucetRequestError("invalid-json", response.status, input.apiVersion);
  }
  const body = parsed as Record<string, unknown>;
  if (body.error) {
    throw new SanitizedFaucetRequestError("faucet-error", response.status, input.apiVersion);
  }
  return body;
}

function sanitizedFaucetError(error: unknown): {
  readonly rateLimited: boolean;
  readonly apiVersion?: SponsorFaucetRequestReport["faucetApiVersion"];
  readonly httpStatus?: number;
  readonly failureKind?: SponsorFaucetRequestReport["faucetFailureKind"];
} {
  if (error instanceof FaucetRateLimitError) {
    return { rateLimited: true, apiVersion: "v0-documented", httpStatus: 429, failureKind: "http-status" };
  }
  if (error instanceof SanitizedFaucetRequestError) {
    return {
      rateLimited: error.rateLimited,
      apiVersion: error.apiVersion,
      httpStatus: error.httpStatus,
      failureKind: error.failureKind,
    };
  }
  return { rateLimited: false };
}

function redactAddress(value: string): string {
  if (value.length <= 18) return "<redacted-address>";
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function redactPath(value: string): string {
  return value.startsWith("tmp/") ? value : "<operator-report-path>";
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
  const report = await requestSponsorFaucetFunds({
    envFile: resolve(process.cwd(), options.envFile),
    execute: options.execute,
    faucetApiVersion: options.faucetApiVersion,
    faucetUrl: options.faucetUrl,
    outFile: options.outFile,
  });
  console.log(formatSponsorFaucetRequestReport(report));
  return report.result === "passed" ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
