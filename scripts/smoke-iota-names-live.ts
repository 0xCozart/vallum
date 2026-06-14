import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createFetchIotaNamesGraphQLClient,
  resolveIotaNamesAddress,
  type IotaNamesGraphQLClient,
} from "../packages/registry/src/index.js";
import {
  buildIotaNamesLiveReport,
  formatIotaNamesLiveReport,
} from "./iota-names-live-report.js";

export type IotaNamesLiveSmokeResult =
  | {
      readonly ok: true;
      readonly name: string;
      readonly address: string;
      readonly source: "iota-names-graphql";
    }
  | {
      readonly ok: false;
      readonly kind: "blocked";
      readonly code: "IOTA_NAMES_LIVE_CONFIG_MISSING" | "IOTA_NAMES_GRAPHQL_URL_UNSAFE";
      readonly missing?: readonly string[];
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly kind: "failed";
      readonly code: "IOTA_NAMES_RESOLUTION_FAILED" | "IOTA_NAMES_ADDRESS_MISMATCH";
      readonly name: string;
      readonly message: string;
    };

export interface RunIotaNamesLiveSmokeOptions {
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly graphQL?: IotaNamesGraphQLClient;
  readonly fetch?: typeof fetch;
}

interface CliOptions {
  readonly help: boolean;
  readonly reportPath?: string;
}

const REQUIRED_ENV = [
  "IOTA_NAMES_GRAPHQL_URL",
  "IOTA_NAMES_NAME",
  "IOTA_NAMES_EXPECTED_ADDRESS",
] as const;

export async function runIotaNamesLiveSmoke(
  options: RunIotaNamesLiveSmokeOptions = {},
): Promise<IotaNamesLiveSmokeResult> {
  const env = options.env ?? process.env;
  const missing = REQUIRED_ENV.filter((key) => !readEnv(env, key));
  if (missing.length > 0) {
    return {
      ok: false,
      kind: "blocked",
      code: "IOTA_NAMES_LIVE_CONFIG_MISSING",
      missing,
      message: "IOTA Names live smoke requires operator-provided endpoint, name, and expected address.",
    };
  }

  const endpoint = readEnv(env, "IOTA_NAMES_GRAPHQL_URL");
  const name = readEnv(env, "IOTA_NAMES_NAME");
  const expectedAddress = readEnv(env, "IOTA_NAMES_EXPECTED_ADDRESS");
  if (!endpoint || !name || !expectedAddress) {
    throw new Error("IOTA Names live smoke missing-config invariant failed.");
  }

  if (!isSafeGraphQLEndpoint(endpoint)) {
    return {
      ok: false,
      kind: "blocked",
      code: "IOTA_NAMES_GRAPHQL_URL_UNSAFE",
      message: "IOTA Names GraphQL endpoint must be HTTPS or loopback HTTP.",
    };
  }

  const graphQL = options.graphQL ?? createFetchIotaNamesGraphQLClient({
    endpoint,
    fetch: withTimeout(options.fetch ?? fetch),
  });
  const resolution = await resolveIotaNamesAddress(name, graphQL);
  if (!resolution.ok) {
    return {
      ok: false,
      kind: "failed",
      code: "IOTA_NAMES_RESOLUTION_FAILED",
      name: resolution.name,
      message: resolution.error.message,
    };
  }

  if (normalizeAddress(resolution.address) !== normalizeAddress(expectedAddress)) {
    return {
      ok: false,
      kind: "failed",
      code: "IOTA_NAMES_ADDRESS_MISMATCH",
      name: resolution.name,
      message: "IOTA Names resolved address did not match the expected address.",
    };
  }

  return resolution;
}

export function formatIotaNamesLiveSmokeResult(result: IotaNamesLiveSmokeResult): string {
  if (result.ok) {
    return [
      "IOTA Names live smoke passed",
      `name=${result.name}`,
      `address=${redactAddress(result.address)}`,
      `source=${result.source}`,
    ].join("\n");
  }

  if (result.kind === "blocked") {
    return [
      "IOTA Names live smoke blocked",
      `code=${result.code}`,
      ...(result.missing ? [`missing=${result.missing.join(",")}`] : []),
      `message=${result.message}`,
    ].join("\n");
  }

  return [
    "IOTA Names live smoke failed",
    `code=${result.code}`,
    `name=${result.name}`,
    `message=${result.message}`,
  ].join("\n");
}

function readEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function isSafeGraphQLEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    return ["127.0.0.1", "::1", "localhost"].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function redactAddress(value: string): string {
  if (value.length <= 18) return "<redacted-address>";
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function withTimeout(fetchImpl: typeof fetch): typeof fetch {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      return await fetchImpl(input, {
        ...init,
        signal: init.signal ?? controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: { help: boolean; reportPath?: string } = { help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--report") {
      const value = argv[index + 1];
      if (!value) throw new Error("--report requires a path.");
      options.reportPath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function writeReport(path: string, result: IotaNamesLiveSmokeResult): Promise<void> {
  const reportPath = isAbsolute(path) ? path : resolve(process.cwd(), path);
  const report = buildIotaNamesLiveReport({
    result,
    env: process.env,
  });
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, formatIotaNamesLiveReport(report), { mode: 0o600 });
  console.log(`report=${path}`);
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
    console.log("usage: npm exec tsx -- scripts/smoke-iota-names-live.ts [--report <ignored-json-path>]");
    return 0;
  }

  const result = await runIotaNamesLiveSmoke();
  const formatted = formatIotaNamesLiveSmokeResult(result);
  if (options.reportPath) {
    await writeReport(options.reportPath, result);
  }
  if (result.ok) {
    console.log(formatted);
    return 0;
  }
  console.error(formatted);
  return result.kind === "blocked" ? 2 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
