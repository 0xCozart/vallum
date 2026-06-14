import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { requestIotaFromFaucet, FaucetRateLimitError } from "@iota/iota-sdk/faucet";

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
  readonly amountMist?: string;
  readonly reportPath?: string;
  readonly nextCommands: readonly string[];
}

export interface RequestSponsorFaucetFundsOptions {
  readonly env?: Record<string, string | undefined>;
  readonly envFile?: string;
  readonly execute?: boolean;
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
  readonly faucetUrl?: string;
  readonly help: boolean;
  readonly outFile: string;
}

type MutableCliOptions = {
  -readonly [Key in keyof CliOptions]: CliOptions[Key];
};

const DEFAULT_OUT_FILE = "tmp/gaskit/sponsor-faucet-request.json";

const usage = `usage: npm exec tsx -- scripts/request-sponsor-faucet-funds.ts [--execute] [--faucet-url <url>] [--env-file <path>] [--out <path>]

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

  try {
    const amount = await (options.requestFunds ?? requestIotaFromFaucet)({
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
      amountMist: amount === undefined ? undefined : String(amount),
    });
  } catch (error) {
    return writeReport(reportPath, {
      ...base,
      result: "failed",
      code: error instanceof FaucetRateLimitError ? "SPONSOR_FAUCET_RATE_LIMITED" : "SPONSOR_FAUCET_FAILED",
      message: error instanceof FaucetRateLimitError
        ? "Sponsor faucet request was rate limited; retry later."
        : "Sponsor faucet request failed without exposing raw faucet response details.",
      contactsLiveService: true,
      sponsorAddressRedacted,
    });
  }
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
    ...(report.sponsorAddressRedacted ? [`sponsorAddress=${report.sponsorAddressRedacted}`] : []),
    ...(report.amountMist ? [`amountMist=${report.amountMist}`] : []),
    ...(report.reportPath ? [`report=${report.reportPath}`] : []),
    `next=${report.nextCommands.join(" && ")}`,
  ].join("\n");
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
    faucetUrl: options.faucetUrl,
    outFile: options.outFile,
  });
  console.log(formatSponsorFaucetRequestReport(report));
  return report.result === "passed" ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
