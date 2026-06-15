import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { IotaClient } from "@iota/iota-sdk/client";

import {
  buildTestnetDigestEvidenceReport,
  formatTestnetDigestEvidenceReport,
} from "./testnet-digest-report.js";

export const DOCUMENTED_TESTNET_DIGEST = "BF7BvoqLmw3AwtYtpPNSoP8JinKbZ67NyP6f7xQMYHYX";
export const DEFAULT_TESTNET_RPC_URL = "https://api.testnet.iota.cafe";

export interface TestnetDigestProofReport {
  readonly digest: string;
  readonly rpcUrl: string;
  readonly documented: boolean;
  readonly liveChecked: boolean;
  readonly verified: boolean;
  readonly status: "documented-local" | "verified-testnet" | "blocked-live";
  readonly effectsStatus?: string;
  readonly checkpoint?: string;
  readonly timestampMs?: string;
  readonly blocker?: string;
  readonly next: string;
}

export interface TestnetDigestProofOptions {
  readonly cwd?: string;
  readonly digest?: string;
  readonly rpcUrl?: string;
  readonly live?: boolean;
  readonly timeoutMs?: number;
  readonly client?: Pick<IotaClient, "getTransactionBlock">;
}

interface CliOptions {
  readonly digest: string;
  readonly rpcUrl: string;
  readonly live: boolean;
  readonly timeoutMs: number;
  readonly help: boolean;
  readonly reportFile?: string;
}

const REQUIRED_DOCS = [
  "docs/testnet-attempts.md",
  "docs/agentic-gaskit/testnet-digest-proof.md",
  "docs/reviewer-walkthrough.md",
] as const;

const usage = `usage: npm exec tsx -- scripts/check-testnet-digest-proof.ts [--live] [--digest <digest>] [--rpc-url <url>] [--timeout-ms <ms>] [--report <path>]

Default mode is non-networked: it checks that the documented public IOTA testnet digest evidence is still present in repo docs.
--live performs a read-only IOTA testnet transaction lookup. It does not spend gas, sign transactions, or use sponsor credentials.
--report writes a sanitized local JSON report with mode 0600 for product-status gates.`;

export async function checkTestnetDigestProof(
  options: TestnetDigestProofOptions = {},
): Promise<TestnetDigestProofReport> {
  const cwd = options.cwd ?? process.cwd();
  const digest = options.digest ?? DOCUMENTED_TESTNET_DIGEST;
  const rpcUrl = options.rpcUrl ?? DEFAULT_TESTNET_RPC_URL;
  const documented = await isDigestDocumented(cwd, digest);

  if (!options.live) {
    return {
      digest,
      rpcUrl,
      documented,
      liveChecked: false,
      verified: false,
      status: documented ? "documented-local" : "blocked-live",
      blocker: documented ? undefined : "TESTNET_DIGEST_DOCS_MISSING",
      next: documented
        ? "Run npm run proof:testnet-digest:live for an opt-in read-only IOTA testnet lookup."
        : "Restore the documented public digest evidence before accepting testnet proof docs.",
    };
  }

  if (!documented) {
    return {
      digest,
      rpcUrl,
      documented,
      liveChecked: false,
      verified: false,
      status: "blocked-live",
      blocker: "TESTNET_DIGEST_DOCS_MISSING",
      next: "Restore the documented public digest evidence before running live digest verification.",
    };
  }

  try {
    const client = options.client ?? new IotaClient({ url: rpcUrl });
    const signal = AbortSignal.timeout(options.timeoutMs ?? 10_000);
    const transaction = await client.getTransactionBlock({
      digest,
      options: { showEffects: true },
      signal,
    });
    const effectsStatus = transaction.effects?.status.status;
    const verified = transaction.digest === digest && effectsStatus === "success";

    return {
      digest,
      rpcUrl,
      documented,
      liveChecked: true,
      verified,
      status: verified ? "verified-testnet" : "blocked-live",
      effectsStatus,
      checkpoint: transaction.checkpoint ?? undefined,
      timestampMs: transaction.timestampMs ?? undefined,
      blocker: verified ? undefined : "TESTNET_DIGEST_NOT_SUCCESSFUL",
      next: verified
        ? "The documented public digest is retrievable from the configured IOTA testnet RPC."
        : "Inspect the public transaction status before accepting this digest as current testnet proof.",
    };
  } catch {
    return {
      digest,
      rpcUrl,
      documented,
      liveChecked: true,
      verified: false,
      status: "blocked-live",
      blocker: "TESTNET_DIGEST_LOOKUP_FAILED",
      next: "Retry with a reachable IOTA testnet RPC endpoint or record the exact read-only lookup blocker.",
    };
  }
}

export function formatTestnetDigestProofReport(report: TestnetDigestProofReport): string {
  const lines = [
    `Agentic GasKit testnet digest proof ${report.status}`,
    `digest=${report.digest}`,
    `rpcUrl=${report.rpcUrl}`,
    `documented=${report.documented}`,
    `liveChecked=${report.liveChecked}`,
    `verified=${report.verified}`,
  ];
  if (report.effectsStatus) lines.push(`effectsStatus=${report.effectsStatus}`);
  if (report.checkpoint) lines.push(`checkpoint=${report.checkpoint}`);
  if (report.timestampMs) lines.push(`timestampMs=${report.timestampMs}`);
  if (report.blocker) lines.push(`blocker=${report.blocker}`);
  lines.push(`next=${report.next}`);
  return lines.join("\n");
}

async function isDigestDocumented(cwd: string, digest: string): Promise<boolean> {
  for (const path of REQUIRED_DOCS) {
    let content: string;
    try {
      content = await readFile(resolve(cwd, path), "utf8");
    } catch {
      return false;
    }
    if (!content.includes(digest)) return false;
  }
  return true;
}

function parseArgs(argv: string[]): CliOptions {
  const options: {
    digest: string;
    rpcUrl: string;
    live: boolean;
    timeoutMs: number;
    help: boolean;
    reportFile?: string;
  } = {
    digest: DOCUMENTED_TESTNET_DIGEST,
    rpcUrl: DEFAULT_TESTNET_RPC_URL,
    live: false,
    timeoutMs: 10_000,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--live") {
      options.live = true;
      continue;
    }
    if (arg === "--digest") {
      const value = argv[index + 1];
      if (!value) throw new Error("--digest requires a value.");
      options.digest = value;
      index += 1;
      continue;
    }
    if (arg === "--rpc-url") {
      const value = argv[index + 1];
      if (!value) throw new Error("--rpc-url requires a URL.");
      options.rpcUrl = value;
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      const value = Number(argv[index + 1]);
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error("--timeout-ms requires a positive integer.");
      options.timeoutMs = value;
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

  const report = await checkTestnetDigestProof(options);
  console.log(formatTestnetDigestProofReport(report));
  if (options.reportFile) {
    await writeTestnetDigestReportFile(options.reportFile, report);
    console.log(`report=${options.reportFile}`);
  }
  return report.status === "blocked-live" ? 1 : 0;
}

async function writeTestnetDigestReportFile(path: string, report: TestnetDigestProofReport): Promise<void> {
  const outFile = isAbsolute(path) ? path : resolve(process.cwd(), path);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${formatTestnetDigestEvidenceReport(buildTestnetDigestEvidenceReport(report))}\n`, {
    mode: 0o600,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
