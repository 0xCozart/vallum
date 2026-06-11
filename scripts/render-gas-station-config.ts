import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { decodeIotaPrivateKey } from "@iota/iota-sdk/cryptography";

import { loadEnvFile } from "../apps/policy-gateway-service/src/readiness.js";

interface CliOptions {
  readonly envFile: string;
  readonly help: boolean;
  readonly outFile: string;
}

interface RenderGasStationConfigInput {
  readonly keypair: string;
  readonly rpcUrl: string;
  readonly redisUrl?: string;
  readonly rpcHostIp?: string;
  readonly rpcPort?: string;
  readonly metricsPort?: string;
  readonly targetInitBalance?: string;
  readonly refreshIntervalSec?: string;
  readonly dailyGasUsageCap?: string;
  readonly maxGasBudget?: string;
  readonly accessPolicy?: string;
}

const DEFAULT_OUTPUT = "deploy/gas-station/config.local.yaml";
const usage = `usage: npm exec tsx -- scripts/render-gas-station-config.ts [--env-file <path>] [--out <path>]

Renders an ignored local IOTA Gas Station config from .env.
The rendered file contains the sponsor signing key and must never be committed or printed.`;

function parseArgs(argv: string[]): CliOptions {
  const options: { envFile: string; help: boolean; outFile: string } = {
    envFile: ".env",
    help: false,
    outFile: DEFAULT_OUTPUT,
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
    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error("--out requires a path.");
      options.outFile = value;
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

export function gasStationKeypairForConfig(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || isPlaceholderValue(trimmed)) {
    throw new Error("GAS_STATION_KEYPAIR must be a non-placeholder local signer key.");
  }
  if (trimmed.startsWith("iotaprivkey")) {
    const decoded = decodeIotaPrivateKey(trimmed);
    if (decoded.schema !== "ED25519") {
      throw new Error("Only ED25519 iotaprivkey values are supported by the local Gas Station config renderer.");
    }
    return Buffer.concat([Buffer.from([0]), Buffer.from(decoded.secretKey)]).toString("base64");
  }

  const bytes = Buffer.from(trimmed, "base64");
  if (bytes.length === 33) return bytes.toString("base64");
  if (bytes.length === 32) return Buffer.concat([Buffer.from([0]), bytes]).toString("base64");
  throw new Error("GAS_STATION_KEYPAIR must be an iotaprivkey or base64-encoded local signer key.");
}

export function renderGasStationConfig(input: RenderGasStationConfigInput): string {
  const keypair = gasStationKeypairForConfig(input.keypair);
  const rpcUrl = requiredValue(input.rpcUrl, "IOTA_RPC_URL");
  const redisUrl = input.redisUrl ?? "redis://redis:6379";
  const rpcHostIp = input.rpcHostIp ?? "0.0.0.0";
  const rpcPort = integerValue(input.rpcPort ?? "9527", "GAS_STATION_RPC_PORT");
  const metricsPort = integerValue(input.metricsPort ?? "9184", "GAS_STATION_METRICS_PORT");
  const targetInitBalance = integerValue(input.targetInitBalance ?? "100000000", "GAS_STATION_TARGET_INIT_BALANCE");
  const refreshIntervalSec = integerValue(input.refreshIntervalSec ?? "86400", "GAS_STATION_REFRESH_INTERVAL_SEC");
  const dailyGasUsageCap = integerValue(input.dailyGasUsageCap ?? "1500000000000", "GAS_STATION_DAILY_GAS_USAGE_CAP");
  const maxGasBudget = integerValue(input.maxGasBudget ?? "2000000000", "GAS_STATION_MAX_GAS_BUDGET");
  const accessPolicy = input.accessPolicy ?? "disabled";

  return [
    "# Generated local IOTA Gas Station config.",
    "# Contains sponsor signer material. Do not commit or print this file.",
    "signer-config:",
    "  local:",
    `    keypair: ${yamlQuote(keypair)}`,
    `rpc-host-ip: ${yamlQuote(rpcHostIp)}`,
    `rpc-port: ${rpcPort}`,
    `metrics-port: ${metricsPort}`,
    "",
    "storage-config:",
    "  redis:",
    `    redis-url: ${yamlQuote(redisUrl)}`,
    "",
    `fullnode-url: ${yamlQuote(rpcUrl)}`,
    "",
    "coin-init-config:",
    `  target-init-balance: ${targetInitBalance}`,
    `  refresh-interval-sec: ${refreshIntervalSec}`,
    "",
    `daily-gas-usage-cap: ${dailyGasUsageCap}`,
    `max-gas-budget: ${maxGasBudget}`,
    "",
    "access-controller:",
    `  access-policy: ${yamlQuote(accessPolicy)}`,
    "",
  ].join("\n");
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
    const config = renderGasStationConfig({
      keypair: requiredValue(env.GAS_STATION_KEYPAIR, "GAS_STATION_KEYPAIR"),
      rpcUrl: requiredValue(env.IOTA_RPC_URL, "IOTA_RPC_URL"),
      redisUrl: env.GAS_STATION_REDIS_URL,
      rpcHostIp: env.GAS_STATION_RPC_HOST_IP,
      rpcPort: env.GAS_STATION_RPC_PORT,
      metricsPort: env.GAS_STATION_METRICS_PORT,
      targetInitBalance: env.GAS_STATION_TARGET_INIT_BALANCE,
      refreshIntervalSec: env.GAS_STATION_REFRESH_INTERVAL_SEC,
      dailyGasUsageCap: env.GAS_STATION_DAILY_GAS_USAGE_CAP,
      maxGasBudget: env.GAS_STATION_MAX_GAS_BUDGET,
      accessPolicy: env.GAS_STATION_ACCESS_POLICY,
    });
    const outFile = resolve(process.cwd(), options.outFile);
    await writeFile(outFile, config, { mode: 0o600 });
    console.log(`gasStationConfig=${options.outFile}`);
    console.log("containsSponsorKey=true");
    console.log("next=docker compose --env-file .env -f deploy/docker-compose/docker-compose.local.yml up");
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Gas Station config render failed.");
    return 1;
  }
}

function requiredValue(value: string | undefined, name: string): string {
  if (!value || value.trim() === "") throw new Error(`${name} is required.`);
  return value.trim();
}

function integerValue(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function yamlQuote(value: string): string {
  return JSON.stringify(value);
}

function isPlaceholderValue(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes("replace") || normalized.includes("placeholder") || normalized.includes("your_") || normalized.includes("your-");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
