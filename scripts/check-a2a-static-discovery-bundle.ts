import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateA2APublicDiscoveryBundleArtifacts } from "../packages/registry/src/index.js";

interface CliOptions {
  readonly expectedPublicBaseUrl?: string;
  readonly expectedPublicJwksUrl?: string;
  readonly help: boolean;
  readonly outDir?: string;
}

export interface CheckA2AStaticDiscoveryBundleOptions {
  readonly outDir: string;
  readonly expectedPublicBaseUrl?: string;
  readonly expectedPublicJwksUrl?: string;
}

export interface CheckA2AStaticDiscoveryBundleResult {
  readonly ok: true;
  readonly files: number;
  readonly manifestPath: string;
  readonly publicBaseUrl: string;
  readonly publicHostingProven: false;
}

const usage = `usage: npm exec tsx -- scripts/check-a2a-static-discovery-bundle.ts --out-dir <dir> [--expected-public-base-url <url>] [--expected-public-jwks-url <url>]

Validates local A2A static discovery artifacts before public hosting review.
The command reads only local files, does not fetch public URLs, and does not prove public hosting.`;

function parseArgs(argv: string[]): CliOptions {
  const options: {
    expectedPublicBaseUrl?: string;
    expectedPublicJwksUrl?: string;
    help: boolean;
    outDir?: string;
  } = { help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out-dir") {
      options.outDir = requiredArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--expected-public-base-url") {
      options.expectedPublicBaseUrl = requiredArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--expected-public-jwks-url") {
      options.expectedPublicJwksUrl = requiredArg(argv, index, arg);
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

export async function checkA2AStaticDiscoveryBundle(
  options: CheckA2AStaticDiscoveryBundleOptions,
): Promise<CheckA2AStaticDiscoveryBundleResult> {
  const validated = await validateA2APublicDiscoveryBundleArtifacts({
    outDir: options.outDir,
    expectedPublicBaseUrl: options.expectedPublicBaseUrl,
    expectedPublicJwksUrl: options.expectedPublicJwksUrl,
  });

  return {
    ok: true,
    files: validated.files.length,
    manifestPath: validated.manifestPath,
    publicBaseUrl: validated.publicBaseUrl,
    publicHostingProven: false,
  };
}

export function formatA2AStaticDiscoveryBundleCheckResult(
  result: CheckA2AStaticDiscoveryBundleResult,
): string {
  return [
    "A2A static discovery bundle artifacts valid",
    `ok=${result.ok}`,
    `files=${result.files}`,
    `manifest=${result.manifestPath}`,
    "publicHostingProven=false",
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
  if (!options.outDir) {
    console.error("Missing required arguments: --out-dir");
    return 2;
  }

  try {
    const result = await checkA2AStaticDiscoveryBundle({
      outDir: resolve(process.cwd(), options.outDir),
      expectedPublicBaseUrl: options.expectedPublicBaseUrl,
      expectedPublicJwksUrl: options.expectedPublicJwksUrl,
    });
    console.log(formatA2AStaticDiscoveryBundleCheckResult(result));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "A2A static discovery bundle artifact check failed.");
    return 1;
  }
}

function requiredArg(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value) throw new Error(`${flag} requires a value.`);
  return value;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
