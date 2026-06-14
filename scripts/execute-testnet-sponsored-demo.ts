import { IotaClient } from "@iota/iota-sdk/client";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction } from "@iota/iota-sdk/transactions";
import { toBase64 } from "@iota/bcs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkTestnetReadiness,
  loadEnvFile,
} from "../apps/policy-gateway-service/src/readiness.js";
import { createGasKitClient } from "../packages/sdk/src/index.js";
import {
  checkGasStationRuntimePreflight,
  type GasStationRuntimeCommandRunner,
  type GasStationRuntimePreflightReport,
} from "./check-gas-station-runtime-preflight.js";
import {
  loadTestnetUpstreamReport,
  validateTestnetUpstreamReport,
  type TestnetUpstreamDiagnosticReport,
} from "./testnet-upstream-report.js";

const DEMO_PACKAGE_ID = "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0";
const DEMO_MODULE = "demo_badge";
const DEMO_FUNCTION = "mint_badge";
const GAS_BUDGET = 50_000_000;

interface CliOptions {
  envFile: string;
  help: boolean;
}

export interface SponsoredExecutePrerequisiteCheck {
  readonly id: string;
  readonly ok: boolean;
  readonly code: string;
  readonly message: string;
  readonly next?: string;
}

export interface SponsoredExecutePrerequisiteReport {
  readonly ready: boolean;
  readonly checks: readonly SponsoredExecutePrerequisiteCheck[];
}

export interface SponsoredExecutePrerequisiteOptions {
  readonly cwd?: string;
  readonly env?: Record<string, string | undefined>;
  readonly envFile?: string;
  readonly now?: Date;
  readonly gasStationRuntimeReport?: GasStationRuntimePreflightReport;
  readonly gasStationRuntimeRunner?: GasStationRuntimeCommandRunner;
  readonly testnetUpstreamReport?: TestnetUpstreamDiagnosticReport;
}

const usage = `usage: npm exec tsx -- scripts/execute-testnet-sponsored-demo.ts [--env-file <path>]

Runs one real IOTA testnet sponsored execute against the configured local policy gateway and Gas Station.
Requires a live policy gateway, live Gas Station, local testnet readiness, local Gas Station runtime readiness, and a passing current sanitized upstream diagnostic report.
The script generates an ephemeral user key for the sender and never prints private keys or bearer tokens.`;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { envFile: ".env", help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env-file") {
      const value = argv[index + 1];
      if (!value) throw new Error("--env-file requires a path.");
      options.envFile = value;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function requireEnv(env: Record<string, string>, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required env value ${key}.`);
  return value;
}

function readEnv(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function gatewayBaseUrl(env: Record<string, string>): string {
  const host = env.GASKIT_GATEWAY_HOST || "127.0.0.1";
  const port = env.GASKIT_GATEWAY_PORT || "8787";
  return `http://${host}:${port}`;
}

export async function checkSponsoredExecutePrerequisites(
  options: SponsoredExecutePrerequisiteOptions = {},
): Promise<SponsoredExecutePrerequisiteReport> {
  const cwd = options.cwd ?? process.cwd();
  const envFile = options.envFile ?? ".env";
  const env = options.env ?? await loadEnvFile(envFile, cwd);
  const checks: SponsoredExecutePrerequisiteCheck[] = [];

  try {
    const readiness = await checkTestnetReadiness({ env: env as NodeJS.ProcessEnv, cwd });
    checks.push({
      id: "testnet-readiness",
      ok: readiness.ok,
      code: readiness.ok ? "TESTNET_READINESS_CONFIG_PRESENT" : "TESTNET_READINESS_FAILED",
      message: readiness.ok
        ? "Local testnet readiness configuration passes non-network validation."
        : "Local testnet readiness configuration failed non-network validation.",
      next: readiness.ok ? undefined : "Fix local testnet readiness failures, then rerun npm run readiness:testnet.",
    });
  } catch {
    checks.push({
      id: "testnet-readiness",
      ok: false,
      code: "TESTNET_READINESS_UNREADABLE",
      message: "Local testnet readiness configuration could not be loaded safely.",
      next: "Validate the local env file syntax and referenced policy path without printing secret values.",
    });
  }

  const runtime = options.gasStationRuntimeReport ?? await checkGasStationRuntimePreflight({
    cwd,
    env,
    runner: options.gasStationRuntimeRunner,
  });
  checks.push({
    id: "gas-station-runtime",
    ok: runtime.ready,
    code: runtime.code,
    message: runtime.message,
    next: runtime.ready
      ? undefined
      : "Run npm run gas-station:render-config, enable Docker runtime access, then rerun npm run gas-station:runtime-preflight.",
  });

  const reportPath = readEnv(env, "GASKIT_TESTNET_UPSTREAM_REPORT");
  if (!reportPath) {
    checks.push({
      id: "testnet-upstream",
      ok: false,
      code: "TESTNET_UPSTREAM_REPORT_MISSING",
      message: "No sanitized testnet upstream diagnostic report is configured.",
      next: "Run npm run diagnose:gas-station -- --report <ignored-json-path> after Gas Station is intentionally online.",
    });
  } else {
    try {
      const report = options.testnetUpstreamReport ?? await loadTestnetUpstreamReport(resolve(cwd, reportPath));
      const validation = validateTestnetUpstreamReport(report, options.now ?? new Date());
      checks.push({
        id: "testnet-upstream",
        ok: validation.ok,
        code: validation.code,
        message: validation.message,
        next: validation.ok
          ? undefined
          : "Regenerate the sanitized upstream report after proving IOTA RPC, Gas Station reachability, and reserve_gas compatibility.",
      });
    } catch {
      checks.push({
        id: "testnet-upstream",
        ok: false,
        code: "TESTNET_UPSTREAM_REPORT_INVALID",
        message: "Configured testnet upstream diagnostic report could not be loaded or validated.",
        next: "Regenerate the report with npm run diagnose:gas-station -- --report <ignored-json-path> without committing or printing secrets.",
      });
    }
  }

  return {
    ready: checks.every((check) => check.ok),
    checks,
  };
}

export function formatSponsoredExecutePrerequisiteReport(
  report: SponsoredExecutePrerequisiteReport,
): string {
  const lines = [`Agentic GasKit sponsored testnet execute prerequisites ${report.ready ? "ready" : "blocked"}`];
  for (const check of report.checks) {
    lines.push(`${check.ok ? "ok" : "blocked"}: ${check.id}: code=${check.code}`);
    lines.push(`message=${check.message}`);
    if (check.next) lines.push(`next=${check.next}`);
  }
  return lines.join("\n");
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
    const env = await loadEnvFile(options.envFile);
    const prerequisites = await checkSponsoredExecutePrerequisites({ env, envFile: options.envFile });
    if (!prerequisites.ready) {
      console.error(formatSponsoredExecutePrerequisiteReport(prerequisites));
      return 1;
    }

    const rpcUrl = requireEnv(env, "IOTA_RPC_URL");
    const appKey = requireEnv(env, "GASKIT_DEMO_APP_KEY");
    const baseUrl = gatewayBaseUrl(env);
    const iota = new IotaClient({ url: rpcUrl });
    const user = Ed25519Keypair.generate();
    const userAddress = user.toIotaAddress();
    const gasKit = createGasKitClient({ baseUrl, apiKey: appKey });

    console.log("gatewayConfigured=true");
    console.log("iotaRpcConfigured=true");
    console.log(`demoTarget=${DEMO_PACKAGE_ID}::${DEMO_MODULE}::${DEMO_FUNCTION}`);
    console.log(`ephemeralUserAddress=${userAddress}`);

    const reservation = await gasKit.reserveGas({
      gasBudget: GAS_BUDGET,
      reserveDurationSecs: 120,
      walletAddress: userAddress,
      packageId: DEMO_PACKAGE_ID,
      functionName: DEMO_FUNCTION,
    });
    const gasCoin = reservation.gasCoins?.[0] as { objectId?: string; version?: string | number; digest?: string } | undefined;
    if (!reservation.sponsorAddress) throw new Error("Gas Station reserve response did not include result.sponsor_address.");
    if (!gasCoin?.objectId || gasCoin.version === undefined || !gasCoin.digest) {
      throw new Error("Gas Station reserve response did not include a usable gas coin reference.");
    }

    console.log(`reservedGas=true`);
    console.log(`reservationId=${reservation.reservationId}`);
    console.log(`gasKitTransactionId=${reservation.gasKitTransactionId}`);
    console.log(`sponsorAddress=${reservation.sponsorAddress}`);

    const tx = new Transaction();
    tx.setSender(userAddress);
    tx.setGasOwner(reservation.sponsorAddress);
    tx.setGasBudget(GAS_BUDGET);
    tx.setGasPayment([{ objectId: gasCoin.objectId, version: gasCoin.version, digest: gasCoin.digest }]);
    tx.moveCall({ target: `${DEMO_PACKAGE_ID}::${DEMO_MODULE}::${DEMO_FUNCTION}` });

    const transactionBytes = await tx.build({ client: iota });
    const { signature } = await user.signTransaction(transactionBytes);
    const executed = await gasKit.executeSponsoredTransaction({
      reservationId: reservation.reservationId,
      gasKitTransactionId: reservation.gasKitTransactionId,
      transactionBytes: toBase64(transactionBytes),
      userSignature: signature,
    });

    if (!executed.digest) throw new Error("Execute response did not include effects.transactionDigest or digest.");
    console.log(`executed=true`);
    console.log(`transactionDigest=${executed.digest}`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Sponsored testnet execute failed unexpectedly.");
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
