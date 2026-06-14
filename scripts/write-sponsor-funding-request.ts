import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { IOTA_TYPE_ARG } from "@iota/iota-sdk/utils";

import { loadEnvFile } from "../apps/policy-gateway-service/src/readiness.js";
import { sponsorAddressFromGasStationKeypair } from "./check-sponsor-funding.js";

export interface SponsorFundingRequest {
  readonly schemaVersion: 1;
  readonly kind: "agentic-gaskit.sponsor-funding-request";
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
  readonly notes: readonly string[];
  readonly nextCommands: readonly string[];
}

export interface WriteSponsorFundingRequestOptions {
  readonly cwd?: string;
  readonly env?: Record<string, string | undefined>;
  readonly envFile?: string;
  readonly minBalanceMist?: string;
  readonly now?: Date;
  readonly outFile?: string;
}

interface CliOptions {
  readonly envFile: string;
  readonly help: boolean;
  readonly minBalanceMist: string;
  readonly outFile: string;
}

type MutableCliOptions = {
  -readonly [Key in keyof CliOptions]: CliOptions[Key];
};

const DEFAULT_MIN_BALANCE_MIST = "50000000";
const DEFAULT_OUT_FILE = "tmp/gaskit/sponsor-funding-request.json";

const usage = `usage: npm exec tsx -- scripts/write-sponsor-funding-request.ts [--out <path>] [--env-file <path>] [--min-balance-mist <mist>]

Writes an ignored local JSON funding request containing the public sponsor address.
The command does not print the full address, contact live services, reserve gas, sign transactions, or execute transactions.`;

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

  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.sponsor-funding-request",
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
    notes: [
      "This artifact contains the public sponsor address only. Keep it in an ignored local path and do not add signer material.",
      "Funding this address does not prove reserve_gas compatibility or sponsored execution by itself.",
      "After funding, rerun the read-only funding diagnostic before retrying the upstream diagnostic.",
    ],
    nextCommands: [
      "npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json",
      "npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json",
      "npm run proof:live-status",
    ],
  };
}

export function formatSponsorFundingRequest(request: SponsorFundingRequest): string {
  return JSON.stringify(request, null, 2);
}

export function formatSponsorFundingRequestSummary(request: SponsorFundingRequest): string {
  return [
    "Agentic GasKit sponsor funding request",
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
    "next=Fund the public sponsor address from the ignored artifact, then run npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json.",
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
