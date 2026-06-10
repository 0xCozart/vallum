import { fileURLToPath } from "node:url";

import {
  createFetchIotaNamesGraphQLClient,
  resolveIotaNamesAddress,
  type IotaNamesGraphQLClient,
} from "../packages/registry/src/index.js";

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
      `address=${result.address}`,
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

async function main(): Promise<number> {
  const result = await runIotaNamesLiveSmoke();
  const formatted = formatIotaNamesLiveSmokeResult(result);
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
