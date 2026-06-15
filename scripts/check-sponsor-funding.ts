import { IotaClient } from "@iota/iota-sdk/client";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { IOTA_TYPE_ARG } from "@iota/iota-sdk/utils";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFile } from "../apps/policy-gateway-service/src/readiness.js";
import { gasStationKeypairForConfig } from "./render-gas-station-config.js";
import {
  buildSponsorFundingEvidenceReport,
  formatSponsorFundingEvidenceReport,
} from "./sponsor-funding-report.js";

export type SponsorFundingCode =
  | "SPONSOR_FUNDING_READY"
  | "SPONSOR_FUNDING_TOTAL_INSUFFICIENT"
  | "SPONSOR_FUNDING_COIN_FRAGMENTED"
  | "SPONSOR_FUNDING_UNREADABLE";

export interface SponsorFundingReport {
  readonly ready: boolean;
  readonly code: SponsorFundingCode;
  readonly message: string;
  readonly contactsLiveService: boolean;
  readonly spendsGas: false;
  readonly signsTransactions: false;
  readonly sponsorAddressRedacted?: string;
  readonly coinType: string;
  readonly requiredMist: string;
  readonly totalBalanceMist?: string;
  readonly coinObjectCount?: number;
  readonly sampledCoinCount?: number;
  readonly maxSampledCoinBalanceMist?: string;
  readonly hasNextCoinPage?: boolean;
}

export interface SponsorFundingClient {
  getBalance(input: { owner: string; coinType: string }): Promise<{
    coinType: string;
    coinObjectCount: number;
    totalBalance: string;
  }>;
  getCoins(input: { owner: string; coinType: string; limit: number }): Promise<{
    data: Array<{ balance: string }>;
    hasNextPage: boolean;
  }>;
}

export interface CheckSponsorFundingOptions {
  readonly client?: SponsorFundingClient;
  readonly coinType?: string;
  readonly env?: Record<string, string | undefined>;
  readonly envFile?: string;
  readonly minBalanceMist?: string;
}

interface CliOptions {
  readonly envFile: string;
  readonly help: boolean;
  readonly minBalanceMist: string;
  readonly reportFile?: string;
}

type MutableCliOptions = {
  -readonly [Key in keyof CliOptions]: CliOptions[Key];
};

const DEFAULT_MIN_BALANCE_MIST = "50000000";
const DEFAULT_COIN_LIMIT = 50;
const usage = `usage: npm exec tsx -- scripts/check-sponsor-funding.ts [--env-file <path>] [--min-balance-mist <mist>] [--report <path>]

Checks the configured sponsor wallet funding through IOTA RPC without printing private keys or full addresses.
This is read-only: it derives the public sponsor address locally, queries balance/coins, does not sign, does not reserve gas, and does not execute transactions.
--report writes a sanitized local JSON report with mode 0600 for live proof gates.`;

export async function checkSponsorFunding(
  options: CheckSponsorFundingOptions = {},
): Promise<SponsorFundingReport> {
  const env = options.env ?? await loadEnvFile(options.envFile ?? ".env");
  const coinType = options.coinType ?? IOTA_TYPE_ARG;
  const required = parsePositiveBigInt(options.minBalanceMist ?? env.GAS_STATION_MIN_RESERVE_BALANCE_MIST ?? DEFAULT_MIN_BALANCE_MIST, "minimum balance");
  try {
    const sponsorAddress = sponsorAddressFromGasStationKeypair(requiredEnv(env.GAS_STATION_KEYPAIR, "GAS_STATION_KEYPAIR"));
    const client = options.client ?? new IotaClient({ url: requiredEnv(env.IOTA_RPC_URL, "IOTA_RPC_URL") });
    const [balance, coins] = await Promise.all([
      client.getBalance({ owner: sponsorAddress, coinType }),
      client.getCoins({ owner: sponsorAddress, coinType, limit: DEFAULT_COIN_LIMIT }),
    ]);
    const totalBalance = parseNonNegativeBigInt(balance.totalBalance, "total balance");
    const maxCoinBalance = maxBigInt(coins.data.map((coin) => parseNonNegativeBigInt(coin.balance, "coin balance")));
    const ready = totalBalance >= required && maxCoinBalance >= required;
    const code: SponsorFundingCode = ready
      ? "SPONSOR_FUNDING_READY"
      : totalBalance < required
        ? "SPONSOR_FUNDING_TOTAL_INSUFFICIENT"
        : "SPONSOR_FUNDING_COIN_FRAGMENTED";
    return {
      ready,
      code,
      message: ready
        ? "Sponsor wallet has enough sampled IOTA balance for the requested reserve budget."
        : code === "SPONSOR_FUNDING_TOTAL_INSUFFICIENT"
          ? "Sponsor wallet total IOTA balance is below the requested reserve budget."
          : "Sponsor wallet total balance is sufficient, but sampled coin objects do not include a coin large enough for the requested reserve budget.",
      contactsLiveService: true,
      spendsGas: false,
      signsTransactions: false,
      sponsorAddressRedacted: redactAddress(sponsorAddress),
      coinType,
      requiredMist: required.toString(),
      totalBalanceMist: totalBalance.toString(),
      coinObjectCount: balance.coinObjectCount,
      sampledCoinCount: coins.data.length,
      maxSampledCoinBalanceMist: maxCoinBalance.toString(),
      hasNextCoinPage: coins.hasNextPage,
    };
  } catch {
    return {
      ready: false,
      code: "SPONSOR_FUNDING_UNREADABLE",
      message: "Sponsor funding could not be checked without exposing secret material.",
      contactsLiveService: Boolean(env.IOTA_RPC_URL),
      spendsGas: false,
      signsTransactions: false,
      coinType,
      requiredMist: required.toString(),
    };
  }
}

export function sponsorAddressFromGasStationKeypair(value: string): string {
  const normalized = gasStationKeypairForConfig(value);
  const bytes = Buffer.from(normalized, "base64");
  if (bytes.length !== 33 || bytes[0] !== 0) {
    throw new Error("Gas Station keypair must normalize to ED25519 local signer bytes.");
  }
  return Ed25519Keypair.fromSecretKey(bytes.subarray(1)).toIotaAddress();
}

export function formatSponsorFundingReport(report: SponsorFundingReport): string {
  const lines = [
    "AgentRail sponsor funding status",
    `ready=${report.ready}`,
    `code=${report.code}`,
    `message=${report.message}`,
    `contactsLiveService=${report.contactsLiveService}`,
    `spendsGas=${report.spendsGas}`,
    `signsTransactions=${report.signsTransactions}`,
    `coinType=${report.coinType}`,
    `requiredMist=${report.requiredMist}`,
  ];
  if (report.sponsorAddressRedacted) lines.push(`sponsorAddress=${report.sponsorAddressRedacted}`);
  if (report.totalBalanceMist !== undefined) lines.push(`totalBalanceMist=${report.totalBalanceMist}`);
  if (report.coinObjectCount !== undefined) lines.push(`coinObjectCount=${report.coinObjectCount}`);
  if (report.sampledCoinCount !== undefined) lines.push(`sampledCoinCount=${report.sampledCoinCount}`);
  if (report.maxSampledCoinBalanceMist !== undefined) lines.push(`maxSampledCoinBalanceMist=${report.maxSampledCoinBalanceMist}`);
  if (report.hasNextCoinPage !== undefined) lines.push(`hasNextCoinPage=${report.hasNextCoinPage}`);
  lines.push(report.ready
    ? "next=npm run diagnose:gas-station -- --report tmp/agentrail/testnet-upstream-diagnostic.json"
    : "next=Fund or consolidate the configured sponsor wallet on testnet, then rerun npm run sponsor:check-funding -- --report tmp/agentrail/sponsor-funding-report.json.");
  return lines.join("\n");
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: MutableCliOptions = {
    envFile: ".env",
    help: false,
    minBalanceMist: DEFAULT_MIN_BALANCE_MIST,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
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
      options.minBalanceMist = value;
      index += 1;
      continue;
    }
    if (arg === "--report") {
      const value = argv[index + 1];
      if (!value) throw new Error("--report requires a path.");
      options.reportFile = value;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  parsePositiveBigInt(options.minBalanceMist, "minimum balance");
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

function parseNonNegativeBigInt(value: string, name: string): bigint {
  const parsed = BigInt(value);
  if (parsed < 0n) throw new Error(`${name} must be non-negative.`);
  return parsed;
}

function maxBigInt(values: readonly bigint[]): bigint {
  return values.reduce((max, value) => value > max ? value : max, 0n);
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
  const report = await checkSponsorFunding({
    envFile: resolve(process.cwd(), options.envFile),
    minBalanceMist: options.minBalanceMist,
  });
  if (options.reportFile) {
    await writeSponsorFundingReportFile(options.reportFile, report);
  }
  console.log(formatSponsorFundingReport(report));
  if (options.reportFile) {
    console.log(`report=${options.reportFile}`);
  }
  return report.ready ? 0 : 1;
}

async function writeSponsorFundingReportFile(path: string, report: SponsorFundingReport): Promise<void> {
  const outFile = isAbsolute(path) ? path : resolve(process.cwd(), path);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${formatSponsorFundingEvidenceReport(buildSponsorFundingEvidenceReport(report))}\n`, {
    mode: 0o600,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
