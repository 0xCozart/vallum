import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  A2A_JWKS_MEDIA_TYPE,
  A2A_JWKS_WELL_KNOWN_PATH,
  createA2APublicDiscoveryBundle,
  type A2AAgentCard,
  type A2APublicJwksResponse,
  writeA2APublicDiscoveryBundle,
} from "../packages/registry/src/index.js";

interface CliOptions {
  readonly agentCardPath?: string;
  readonly cacheControl?: string;
  readonly help: boolean;
  readonly jwksPath?: string;
  readonly outDir?: string;
  readonly publicBaseUrl?: string;
  readonly publicJwksUrl?: string;
}

export interface WriteA2AStaticDiscoveryBundleFromFilesOptions {
  readonly agentCardPath: string;
  readonly jwksPath: string;
  readonly outDir: string;
  readonly publicBaseUrl: string;
  readonly publicJwksUrl: string;
  readonly cacheControl?: string;
}

const usage = `usage: npm exec tsx -- scripts/write-a2a-static-discovery-bundle.ts --agent-card <signed-card.json> --jwks <jwks.json> --public-base-url <url> --public-jwks-url <url> --out-dir <dir> [--cache-control <value>]

Writes deployable local A2A discovery artifacts for static hosting review.
Inputs must already contain a signed public Agent Card and public JWKS JSON.
The command does not sign cards, generate keys, fetch public URLs, or deploy hosting.`;

function parseArgs(argv: string[]): CliOptions {
  const options: {
    agentCardPath?: string;
    cacheControl?: string;
    help: boolean;
    jwksPath?: string;
    outDir?: string;
    publicBaseUrl?: string;
    publicJwksUrl?: string;
  } = { help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--agent-card") {
      options.agentCardPath = requiredArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--jwks") {
      options.jwksPath = requiredArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--public-base-url") {
      options.publicBaseUrl = requiredArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--public-jwks-url") {
      options.publicJwksUrl = requiredArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--out-dir") {
      options.outDir = requiredArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--cache-control") {
      options.cacheControl = requiredArg(argv, index, arg);
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

export async function writeA2AStaticDiscoveryBundleFromFiles(
  options: WriteA2AStaticDiscoveryBundleFromFilesOptions,
) {
  const agentCard = await readJsonFile<A2AAgentCard>(options.agentCardPath);
  const jwksBody = await readJwksBody(options.jwksPath);
  const jwks: A2APublicJwksResponse = {
    path: A2A_JWKS_WELL_KNOWN_PATH,
    status: 200,
    headers: {
      "content-type": `${A2A_JWKS_MEDIA_TYPE}; charset=utf-8`,
      "cache-control": options.cacheControl ?? "no-store",
    },
    body: jwksBody,
    json: `${JSON.stringify(jwksBody, null, 2)}\n`,
  };
  const bundle = createA2APublicDiscoveryBundle({
    agentCard,
    jwks,
    publicBaseUrl: options.publicBaseUrl,
    publicJwksUrl: options.publicJwksUrl,
    cacheControl: options.cacheControl,
  });

  return writeA2APublicDiscoveryBundle({
    bundle,
    outDir: options.outDir,
  });
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

  const missing = [
    ["--agent-card", options.agentCardPath],
    ["--jwks", options.jwksPath],
    ["--public-base-url", options.publicBaseUrl],
    ["--public-jwks-url", options.publicJwksUrl],
    ["--out-dir", options.outDir],
  ].filter(([, value]) => !value).map(([flag]) => flag);
  if (missing.length > 0) {
    console.error(`Missing required arguments: ${missing.join(", ")}`);
    return 2;
  }

  try {
    const written = await writeA2AStaticDiscoveryBundleFromFiles({
      agentCardPath: resolve(process.cwd(), options.agentCardPath ?? ""),
      jwksPath: resolve(process.cwd(), options.jwksPath ?? ""),
      outDir: resolve(process.cwd(), options.outDir ?? ""),
      publicBaseUrl: options.publicBaseUrl ?? "",
      publicJwksUrl: options.publicJwksUrl ?? "",
      cacheControl: options.cacheControl,
    });
    console.log(`a2aDiscoveryBundle=${options.outDir}`);
    console.log(`files=${written.files.length}`);
    console.log(`manifest=${written.manifestPath}`);
    console.log("publicHostingProven=false");
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "A2A static discovery bundle write failed.");
    return 1;
  }
}

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readJwksBody(path: string): Promise<A2APublicJwksResponse["body"]> {
  const parsed = await readJsonFile<unknown>(path);
  if (isRecord(parsed) && isRecord(parsed.body) && Array.isArray(parsed.body.keys)) {
    return { keys: parsed.body.keys as A2APublicJwksResponse["body"]["keys"] };
  }
  if (isRecord(parsed) && Array.isArray(parsed.keys)) {
    return { keys: parsed.keys as A2APublicJwksResponse["body"]["keys"] };
  }
  throw new Error("A2A static discovery JWKS input must contain a public keys array.");
}

function requiredArg(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value) throw new Error(`${flag} requires a value.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
