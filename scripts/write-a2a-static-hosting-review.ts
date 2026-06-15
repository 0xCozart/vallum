import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateA2APublicDiscoveryBundleArtifacts } from "../packages/registry/src/index.js";

export interface A2AStaticHostingReviewFile {
  readonly path: string;
  readonly requiredHeaders: Record<string, string>;
}

export interface A2AStaticHostingReviewCommand {
  readonly id: string;
  readonly command: string;
  readonly contactsPublicNetwork: boolean;
  readonly requiresOperatorApproval: boolean;
}

export interface A2AStaticHostingReview {
  readonly schemaVersion: 1;
  readonly kind: "agentrail.a2a-static-hosting-review";
  readonly generatedAt: string;
  readonly status: "ready-for-public-hosting-review";
  readonly localArtifactsValid: true;
  readonly publicHostingProven: false;
  readonly publicDiscoveryProven: false;
  readonly files: readonly A2AStaticHostingReviewFile[];
  readonly commands: readonly A2AStaticHostingReviewCommand[];
  readonly boundaries: readonly string[];
  readonly requiredOperatorInputs: readonly string[];
}

export interface WriteA2AStaticHostingReviewOptions {
  readonly expectedPublicBaseUrl?: string;
  readonly expectedPublicJwksUrl?: string;
  readonly now?: Date;
  readonly outDir: string;
  readonly outFile?: string;
}

interface CliOptions {
  readonly expectedPublicBaseUrl?: string;
  readonly expectedPublicJwksUrl?: string;
  readonly help: boolean;
  readonly outDir?: string;
  readonly outFile?: string;
}

const REVIEW_COMMANDS: readonly A2AStaticHostingReviewCommand[] = [
  {
    id: "check-static-discovery-bundle",
    command: "npm run a2a:check-static-discovery-bundle -- --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url>",
    contactsPublicNetwork: false,
    requiresOperatorApproval: false,
  },
  {
    id: "smoke-static-discovery-local",
    command: "npm run smoke:a2a-static-discovery-local -- --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url>",
    contactsPublicNetwork: false,
    requiresOperatorApproval: false,
  },
  {
    id: "upload-static-discovery-files",
    command: "upload .well-known/agent-card.json and .well-known/jwks.json with the reviewed headers",
    contactsPublicNetwork: true,
    requiresOperatorApproval: true,
  },
  {
    id: "smoke-public-discovery",
    command: "npm run smoke:a2a-public-discovery -- --report <local-report-path>",
    contactsPublicNetwork: true,
    requiresOperatorApproval: true,
  },
  {
    id: "check-public-readiness",
    command: "npm run proof:a2a-public-readiness",
    contactsPublicNetwork: false,
    requiresOperatorApproval: false,
  },
] as const;

const BOUNDARIES = [
  "This review validates local static discovery artifacts only.",
  "This review does not deploy files, fetch public URLs, prove endpoint ownership, or run external A2A conformance.",
  "Only upload-static-discovery-files and smoke-public-discovery contact public infrastructure, and both require operator approval.",
  "Do not commit review outputs, structured reports, credentials, private keys, bearer tokens, webhook secrets, raw payloads, response bodies, or private infrastructure details.",
] as const;

const REQUIRED_OPERATOR_INPUTS = [
  "A2A_PUBLIC_AGENT_CARD_URL",
  "A2A_PUBLIC_BASE_URL",
  "A2A_PUBLIC_JWKS_URL",
  "A2A_PUBLIC_TASK_AUTH_DECISION",
  "A2A_PUBLIC_DISCOVERY_REPORT",
  "A2A_EXTERNAL_CONFORMANCE_REPORT",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-a2a-static-hosting-review.ts --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url> [--out <path>]

Writes a redacted local static-hosting review packet for generated A2A discovery artifacts.
The command validates local files only. It does not fetch public URLs, deploy hosting, or prove public discovery.`;

export async function writeA2AStaticHostingReview(
  options: WriteA2AStaticHostingReviewOptions,
): Promise<A2AStaticHostingReview> {
  const validated = await validateA2APublicDiscoveryBundleArtifacts({
    outDir: options.outDir,
    expectedPublicBaseUrl: options.expectedPublicBaseUrl,
    expectedPublicJwksUrl: options.expectedPublicJwksUrl,
  });
  const review: A2AStaticHostingReview = {
    schemaVersion: 1,
    kind: "agentrail.a2a-static-hosting-review",
    generatedAt: (options.now ?? new Date()).toISOString(),
    status: "ready-for-public-hosting-review",
    localArtifactsValid: true,
    publicHostingProven: false,
    publicDiscoveryProven: false,
    files: validated.files.map((file) => ({
      path: file.sourcePath,
      requiredHeaders: { ...file.headers },
    })),
    commands: REVIEW_COMMANDS,
    boundaries: BOUNDARIES,
    requiredOperatorInputs: REQUIRED_OPERATOR_INPUTS,
  };

  if (options.outFile) {
    const outFile = isAbsolute(options.outFile) ? options.outFile : resolve(process.cwd(), options.outFile);
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, `${formatA2AStaticHostingReview(review)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  return review;
}

export function formatA2AStaticHostingReview(review: A2AStaticHostingReview): string {
  return JSON.stringify(review, null, 2);
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: {
    expectedPublicBaseUrl?: string;
    expectedPublicJwksUrl?: string;
    help: boolean;
    outDir?: string;
    outFile?: string;
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
    if (arg === "--out") {
      options.outFile = requiredArg(argv, index, arg);
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
    ["--out-dir", options.outDir],
    ["--expected-public-base-url", options.expectedPublicBaseUrl],
    ["--expected-public-jwks-url", options.expectedPublicJwksUrl],
  ].filter(([, value]) => !value).map(([flag]) => flag);
  if (missing.length > 0) {
    console.error(`Missing required arguments: ${missing.join(", ")}`);
    return 2;
  }

  try {
    const review = await writeA2AStaticHostingReview({
      outDir: resolve(process.cwd(), options.outDir ?? ""),
      expectedPublicBaseUrl: options.expectedPublicBaseUrl,
      expectedPublicJwksUrl: options.expectedPublicJwksUrl,
      outFile: options.outFile,
    });
    console.log(formatA2AStaticHostingReview(review));
    if (options.outFile) console.log("wroteReview=true");
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "A2A static hosting review write failed.");
    return 1;
  }
}

function requiredArg(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value) throw new Error(`${flag} requires a value.`);
  return value;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
