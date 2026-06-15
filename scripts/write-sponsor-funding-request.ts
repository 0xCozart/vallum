import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { IOTA_TYPE_ARG } from "@iota/iota-sdk/utils";

import { loadEnvFile } from "../apps/policy-gateway-service/src/readiness.js";
import { sponsorAddressFromGasStationKeypair } from "./check-sponsor-funding.js";
import {
  loadSponsorFaucetRequestReport,
  validateSponsorFaucetRequestReport,
  type SponsorFaucetApiVersion,
  type SponsorFaucetErrorCode,
  type SponsorFaucetRequestCode,
  type SponsorFaucetRequestReport,
} from "./request-sponsor-faucet-funds.js";

export interface SponsorFundingFaucetAttemptContext {
  readonly configured: boolean;
  readonly valid: boolean;
  readonly result?: SponsorFaucetRequestReport["result"];
  readonly code?: SponsorFaucetRequestCode | "SPONSOR_FAUCET_REPORT_INVALID" | "SPONSOR_FAUCET_REPORT_UNREADABLE";
  readonly faucetApiVersion?: SponsorFaucetApiVersion;
  readonly faucetHttpStatus?: number;
  readonly faucetFailureKind?: SponsorFaucetRequestReport["faucetFailureKind"];
  readonly faucetErrorCode?: SponsorFaucetErrorCode;
  readonly guidance: string;
}

export interface SponsorFundingRequest {
  readonly schemaVersion: 1;
  readonly kind: "agentrail.sponsor-funding-request";
  readonly result: "pending-funding";
  readonly generatedAt: string;
  readonly network: "iota-testnet";
  readonly sponsorAddress: string;
  readonly sponsorAddressRedacted: string;
  readonly coinType: string;
  readonly minimumBalanceMist: string;
  readonly contactsLiveService: false;
  readonly spendsGas: false;
  readonly signsTransactions: false;
  readonly faucetAttemptContext: SponsorFundingFaucetAttemptContext;
  readonly operatorFundingOptions: readonly string[];
  readonly notes: readonly string[];
  readonly nextCommands: readonly string[];
}

export interface WriteSponsorFundingRequestOptions {
  readonly cwd?: string;
  readonly env?: Record<string, string | undefined>;
  readonly envFile?: string;
  readonly faucetReportPath?: string;
  readonly minBalanceMist?: string;
  readonly now?: Date;
  readonly outFile?: string;
}

interface CliOptions {
  readonly envFile: string;
  readonly faucetReportPath?: string;
  readonly help: boolean;
  readonly minBalanceMist: string;
  readonly outFile: string;
}

type MutableCliOptions = {
  -readonly [Key in keyof CliOptions]: CliOptions[Key];
};

const DEFAULT_MIN_BALANCE_MIST = "50000000";
const DEFAULT_OUT_FILE = "tmp/agentrail/sponsor-funding-request.json";

const FAUCET_REPORT_ENV = "AGENTRAIL_SPONSOR_FAUCET_REPORT";

const usage = `usage: npm exec tsx -- scripts/write-sponsor-funding-request.ts [--out <path>] [--env-file <path>] [--faucet-report <path>] [--min-balance-mist <mist>]

Writes an ignored local JSON funding request containing the public sponsor address.
The command does not print the full address, contact live services, reserve gas, sign transactions, or execute transactions.
If --faucet-report or AGENTRAIL_SPONSOR_FAUCET_REPORT is set, only bounded sanitized faucet attempt metadata is copied into the ignored artifact.`;

export async function writeSponsorFundingRequest(
  options: WriteSponsorFundingRequestOptions = {},
): Promise<SponsorFundingRequest> {
  const cwd = options.cwd ?? process.cwd();
  const request = await buildSponsorFundingRequest(options);
  const outFile = resolveOutputPath(cwd, options.outFile ?? DEFAULT_OUT_FILE);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${formatSponsorFundingRequest(request)}\n`, { mode: 0o600 });
  return request;
}

export async function buildSponsorFundingRequest(
  options: WriteSponsorFundingRequestOptions = {},
): Promise<SponsorFundingRequest> {
  const env = options.env ?? await loadEnvFile(options.envFile ?? ".env");
  const generatedAt = (options.now ?? new Date()).toISOString();
  const minimumBalanceMist = parsePositiveBigInt(
    options.minBalanceMist ?? env.GAS_STATION_MIN_RESERVE_BALANCE_MIST ?? DEFAULT_MIN_BALANCE_MIST,
    "minimum balance",
  ).toString();
  const sponsorAddress = sponsorAddressFromGasStationKeypair(requiredEnv(env.GAS_STATION_KEYPAIR, "GAS_STATION_KEYPAIR"));
  const faucetAttemptContext = await buildFaucetAttemptContext({
    cwd: options.cwd ?? process.cwd(),
    env,
    faucetReportPath: options.faucetReportPath,
    now: options.now,
  });

  return {
    schemaVersion: 1,
    kind: "agentrail.sponsor-funding-request",
    result: "pending-funding",
    generatedAt,
    network: "iota-testnet",
    sponsorAddress,
    sponsorAddressRedacted: redactAddress(sponsorAddress),
    coinType: IOTA_TYPE_ARG,
    minimumBalanceMist,
    contactsLiveService: false,
    spendsGas: false,
    signsTransactions: false,
    faucetAttemptContext,
    operatorFundingOptions: operatorFundingOptions(faucetAttemptContext),
    notes: [
      "This artifact contains the public sponsor address only. Keep it in an ignored local path and do not add signer material.",
      "Funding this address does not prove reserve_gas compatibility or sponsored execution by itself.",
      "Faucet context is advisory only and cannot clear sponsor funding readiness.",
      "After funding, rerun the read-only funding diagnostic before retrying the upstream diagnostic.",
    ],
    nextCommands: [
      "npm run sponsor:check-funding -- --report tmp/agentrail/sponsor-funding-report.json",
      "npm run diagnose:gas-station -- --report tmp/agentrail/testnet-upstream-diagnostic.json",
      "npm run proof:live-status",
    ],
  };
}

export function formatSponsorFundingRequest(request: SponsorFundingRequest): string {
  return JSON.stringify(request, null, 2);
}

export function formatSponsorFundingRequestSummary(request: SponsorFundingRequest): string {
  return [
    "AgentRail sponsor funding request",
    `written=true`,
    `kind=${request.kind}`,
    `result=${request.result}`,
    `network=${request.network}`,
    `sponsorAddress=${request.sponsorAddressRedacted}`,
    `containsPublicSponsorAddress=true`,
    `contactsLiveService=${request.contactsLiveService}`,
    `spendsGas=${request.spendsGas}`,
    `signsTransactions=${request.signsTransactions}`,
    `minimumBalanceMist=${request.minimumBalanceMist}`,
    `faucetContext=${request.faucetAttemptContext.code ?? "none"}`,
    "next=Fund the public sponsor address from the ignored artifact, then run npm run sponsor:check-funding -- --report tmp/agentrail/sponsor-funding-report.json.",
  ].join("\n");
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: MutableCliOptions = {
    envFile: ".env",
    help: false,
    minBalanceMist: DEFAULT_MIN_BALANCE_MIST,
    outFile: DEFAULT_OUT_FILE,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--env-file") {
      const value = argv[index + 1];
      if (!value) throw new Error("--env-file requires a path.");
      options.envFile = value;
      index += 1;
      continue;
    }
    if (arg === "--faucet-report") {
      const value = argv[index + 1];
      if (!value) throw new Error("--faucet-report requires a path.");
      options.faucetReportPath = value;
      index += 1;
      continue;
    }
    if (arg === "--min-balance-mist") {
      const value = argv[index + 1];
      if (!value) throw new Error("--min-balance-mist requires a positive integer.");
      parsePositiveBigInt(value, "minimum balance");
      options.minBalanceMist = value;
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

function requiredEnv(value: string | undefined, name: string): string {
  if (!value || value.trim() === "") throw new Error(`${name} is required.`);
  return value.trim();
}

function parsePositiveBigInt(value: string, name: string): bigint {
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new Error(`${name} must be positive.`);
  return parsed;
}

function resolveOutputPath(cwd: string, outFile: string): string {
  return isAbsolute(outFile) ? outFile : resolve(cwd, outFile);
}

function redactAddress(value: string): string {
  if (value.length <= 18) return "<redacted-address>";
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
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
  try {
    const request = await writeSponsorFundingRequest({
      envFile: resolve(process.cwd(), options.envFile),
      faucetReportPath: options.faucetReportPath,
      minBalanceMist: options.minBalanceMist,
      outFile: options.outFile,
    });
    console.log(formatSponsorFundingRequestSummary(request));
    return 0;
  } catch {
    console.error("Unable to write sponsor funding request without exposing secret material.");
    return 1;
  }
}

async function buildFaucetAttemptContext(input: {
  readonly cwd: string;
  readonly env: Record<string, string | undefined>;
  readonly faucetReportPath?: string;
  readonly now?: Date;
}): Promise<SponsorFundingFaucetAttemptContext> {
  const reportPath = input.faucetReportPath ?? readEnv(input.env, FAUCET_REPORT_ENV);
  if (!reportPath) {
    return {
      configured: false,
      valid: false,
      guidance: "No sponsor faucet report was supplied; use the public sponsor address with an approved testnet funding source.",
    };
  }
  try {
    const report = await loadSponsorFaucetRequestReport(resolve(input.cwd, reportPath));
    const validation = validateSponsorFaucetRequestReport(report, input.now);
    if (!validation.ok) {
      return {
        configured: true,
        valid: false,
        code: "SPONSOR_FAUCET_REPORT_INVALID",
        guidance: "The supplied sponsor faucet report is invalid or stale; regenerate it before using it for funding triage.",
      };
    }
    return {
      configured: true,
      valid: true,
      result: report.result,
      code: report.code,
      faucetApiVersion: report.faucetApiVersion,
      faucetHttpStatus: report.faucetHttpStatus,
      faucetFailureKind: report.faucetFailureKind,
      faucetErrorCode: report.faucetErrorCode,
      guidance: guidanceForFaucetAttempt(report),
    };
  } catch {
    return {
      configured: true,
      valid: false,
      code: "SPONSOR_FAUCET_REPORT_UNREADABLE",
      guidance: "The supplied sponsor faucet report could not be read; use another approved funding source or regenerate the report.",
    };
  }
}

function guidanceForFaucetAttempt(report: SponsorFaucetRequestReport): string {
  if (report.result === "passed") {
    return "Latest sponsor faucet request completed; wait for settlement, then rerun the read-only funding diagnostic.";
  }
  if (report.code === "SPONSOR_FAUCET_RATE_LIMITED") {
    return "Latest sponsor faucet request was rate limited; retry later or use another approved testnet funding source.";
  }
  if (report.faucetErrorCode === "REQUEST_UNSUPPORTED") {
    return "Latest sponsor faucet route appears unsupported; avoid repeating the same API version and use a wallet faucet flow, CLI faucet flow, another approved faucet, or manual testnet transfer.";
  }
  if (report.faucetErrorCode === "SERVICE_UNAVAILABLE") {
    return "Latest sponsor faucet request reached an unavailable service; retry later or use another approved testnet funding source.";
  }
  if (report.result === "failed") {
    return "Latest sponsor faucet request failed; use another approved faucet, wallet faucet flow, CLI faucet flow, or manual testnet transfer.";
  }
  return "Latest sponsor faucet request did not contact a faucet; use --execute only with operator approval or use another approved funding source.";
}

function operatorFundingOptions(context: SponsorFundingFaucetAttemptContext): readonly string[] {
  const options = [
    "Use a wallet or faucet UI to send IOTA testnet tokens to sponsorAddress from this ignored artifact.",
    "Use an installed IOTA CLI faucet flow only if the local CLI is trusted and configured for testnet.",
    "Use a manual testnet transfer from another funded account if faucet service is unavailable.",
  ];
  if (context.valid && (context.result === "failed" || context.code === "SPONSOR_FAUCET_RATE_LIMITED")) {
    options.unshift("Avoid repeating the same faucet route until its bounded failure condition changes.");
  }
  return options;
}

function readEnv(env: Record<string, string | undefined>, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
