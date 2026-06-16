import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { collectPublishablePackages, type PublishablePackage } from "./package-publish-dry-run.js";
import { buildPaidMcpConsumerSmokeSource } from "./smoke-package-paid-mcp-consumer.js";

type Runner = (command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv) => SpawnSyncReturns<string>;

export interface NpmRegistryPaidMcpConsumerSmokeOptions {
  readonly cwd?: string;
  readonly outFile?: string;
  readonly run?: Runner;
  readonly now?: Date;
}

interface RegistryConsumerProof {
  readonly schemaVersion: 1;
  readonly kind: "vallum.npm-registry-consumer-proof";
  readonly result: "passed" | "failed";
  readonly observedAt: string;
  readonly registry: "npm";
  readonly installSource: "npm-registry";
  readonly version: string;
  readonly packageNames: readonly string[];
  readonly npmConfig?: {
    readonly minReleaseAgeOverride: "0";
    readonly reason: string;
  };
  readonly checks?: readonly string[];
  readonly outputMarkers?: readonly string[];
  readonly boundaries?: readonly string[];
  readonly error?: string;
}

interface CliOptions {
  readonly help: boolean;
  readonly outFile?: string;
}

const DEFAULT_OUT_FILE = "tmp/vallum/npm-registry-consumer-proof.json";
const REQUIRED_MARKERS = [
  "Package paid MCP consumer smoke passed",
  "install=npm-registry",
  "boundary.liveNetwork=false",
  "boundary.route=SDK->mock-policy-gateway",
  "imports.rootOnly=true",
  "approval.status=completed",
  "approval.paid=true",
  "denial.status=denied",
  "denial.reason=GAS_BUDGET_TOO_HIGH",
  "failedPayment.status=failed",
  "failedPayment.reason=mock-payment-failed",
  "redaction.apiKey=redacted",
  "redaction.signerReference=redacted",
] as const;

const SECRET_OUTPUT_RE = /consumer-demo-api-key|signer_ref_package_consumer_paid_mcp|Bearer|privateKey|mnemonic|seed|rawTransactionBytes=|userSignature=/i;

const usage = `usage: npm exec tsx -- scripts/smoke-npm-registry-paid-mcp-consumer.ts [--out <path>]

Installs published Vallum packages from npm into a fresh temporary consumer,
runs the canonical paid MCP-style local mock flow, and writes a redacted proof
packet. Uses NPM_CONFIG_MIN_RELEASE_AGE=0 because this machine can hide newly
published packages behind a local release-age gate.

Options:
  --out <path>  Write the redacted proof packet. Defaults to ${DEFAULT_OUT_FILE}.
  --help        Show this help text.
`;

export function buildRegistryConsumerPackageJson(
  packages: readonly PublishablePackage[],
  version: string,
): string {
  const dependencies = Object.fromEntries(packages.map((packageInfo) => [packageInfo.name, packageInfo.version ?? version]));
  return `${JSON.stringify({
    name: "vallum-npm-registry-consumer-proof",
    private: true,
    type: "module",
    dependencies,
  }, null, 2)}\n`;
}

export function buildRegistryPaidMcpConsumerSmokeSource(): string {
  return buildPaidMcpConsumerSmokeSource().replace("install=local-tarballs", "install=npm-registry");
}

export function buildNpmRegistryInstallArgs(): string[] {
  return [
    "install",
    "--ignore-scripts",
    "--audit=false",
    "--fund=false",
    "--package-lock=false",
    "--registry=https://registry.npmjs.org/",
  ];
}

export async function runNpmRegistryPaidMcpConsumerSmoke(
  options: NpmRegistryPaidMcpConsumerSmokeOptions = {},
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const outFile = options.outFile ?? DEFAULT_OUT_FILE;
  const now = options.now ?? new Date();
  const version = await loadRootVersion(cwd);
  const packages = await collectPublishablePackages(cwd);
  const packageNames = packages.map((packageInfo) => packageInfo.name);
  const observedAt = now.toISOString();
  const tempRoot = await mkdtemp(join(tmpdir(), "vallum-npm-registry-consumer-"));
  const consumerDir = join(tempRoot, "consumer");
  const run =
    options.run ??
    ((command: string, args: readonly string[], runCwd: string, runEnv: NodeJS.ProcessEnv) =>
      spawnSync(command, args, { cwd: runCwd, encoding: "utf8", env: runEnv, stdio: "pipe" }));

  let report: RegistryConsumerProof;
  try {
    await mkdir(consumerDir, { recursive: true });
    await writeFile(join(consumerDir, "package.json"), buildRegistryConsumerPackageJson(packages, version), "utf8");
    await writeFile(join(consumerDir, "index.mjs"), buildRegistryPaidMcpConsumerSmokeSource(), "utf8");

    const env = {
      ...process.env,
      NPM_CONFIG_MIN_RELEASE_AGE: "0",
      npm_config_min_release_age: "0",
    };

    const install = run("npm", buildNpmRegistryInstallArgs(), consumerDir, env);
    if (install.status !== 0) {
      throw new Error(`npm install failed status=${install.status ?? "unknown"} stderr=${redactOutput(install.stderr, tempRoot, cwd)}`);
    }

    const smoke = run("node", ["index.mjs"], consumerDir, env);
    if (smoke.status !== 0) {
      throw new Error(`consumer smoke failed status=${smoke.status ?? "unknown"} stderr=${redactOutput(smoke.stderr, tempRoot, cwd)} stdout=${redactOutput(smoke.stdout, tempRoot, cwd)}`);
    }

    const output = smoke.stdout.trim().split("\n");
    const missingMarkers = REQUIRED_MARKERS.filter((marker) => !output.includes(marker));
    if (missingMarkers.length > 0) {
      throw new Error(`consumer smoke missing markers: ${missingMarkers.join(",")}`);
    }
    const joinedOutput = output.join("\n");
    if (SECRET_OUTPUT_RE.test(joinedOutput)) {
      throw new Error("consumer smoke output contained secret-like material");
    }

    report = passedReport({ observedAt, version, packageNames });
    process.stdout.write(smoke.stdout);
    console.log(`Npm registry paid MCP consumer smoke passed packages=${packages.length}`);
  } catch (error) {
    report = failedReport({
      observedAt,
      version,
      packageNames,
      error: error instanceof Error ? error.message : String(error),
      tempRoot,
      cwd,
    });
    console.error(`Npm registry paid MCP consumer smoke failed: ${report.error}`);
    await writeReport(cwd, outFile, report);
    return 1;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }

  await writeReport(cwd, outFile, report);
  console.log(`Npm registry consumer proof wrote ${redactPath(outFile)}`);
  return 0;
}

function passedReport(input: {
  readonly observedAt: string;
  readonly version: string;
  readonly packageNames: readonly string[];
}): RegistryConsumerProof {
  return {
    schemaVersion: 1,
    kind: "vallum.npm-registry-consumer-proof",
    result: "passed",
    observedAt: input.observedAt,
    registry: "npm",
    installSource: "npm-registry",
    version: input.version,
    packageNames: input.packageNames,
    npmConfig: {
      minReleaseAgeOverride: "0",
      reason: "freshly published prerelease packages are hidden by this machine default release-age gate without the override",
    },
    checks: [
      "fresh-temp-consumer-project",
      "registry-install-all-public-packages",
      "root-entrypoint-imports",
      "paid-mcp-approval-path",
      "paid-mcp-policy-denial-path",
      "paid-mcp-failed-payment-path",
      "receipt-event-chains",
      "redaction-markers",
    ],
    outputMarkers: REQUIRED_MARKERS,
    boundaries: [
      "No live IOTA RPC, IOTA Gas Station, payment provider, custody provider, marketplace service, or public A2A endpoint was contacted.",
      "Temporary consumer paths, npm cache paths, and local auth/token paths are intentionally omitted.",
      "This proves npm registry install/import plus local mock execution only.",
    ],
  };
}

function failedReport(input: {
  readonly observedAt: string;
  readonly version: string;
  readonly packageNames: readonly string[];
  readonly error: string;
  readonly tempRoot: string;
  readonly cwd: string;
}): RegistryConsumerProof {
  return {
    schemaVersion: 1,
    kind: "vallum.npm-registry-consumer-proof",
    result: "failed",
    observedAt: input.observedAt,
    registry: "npm",
    installSource: "npm-registry",
    version: input.version,
    packageNames: input.packageNames,
    error: redactOutput(input.error, input.tempRoot, input.cwd),
  };
}

async function loadRootVersion(cwd: string): Promise<string> {
  const rootPackage = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8")) as { version?: string };
  if (!rootPackage.version) throw new Error("Root package.json is missing version.");
  return rootPackage.version;
}

async function writeReport(cwd: string, outFile: string, report: RegistryConsumerProof): Promise<void> {
  const outPath = isAbsolute(outFile) ? outFile : resolve(cwd, outFile);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await chmod(outPath, 0o600);
}

function redactOutput(output: string, tempRoot: string, cwd: string): string {
  return output
    .split("\n")
    .map((line) => line.replaceAll(tempRoot, "<tmp>"))
    .map((line) => line.replaceAll(cwd, "<repo>"))
    .map((line) => line.replaceAll(tmpdir(), "<tmp>"))
    .join("\n");
}

function redactPath(path: string): string {
  return path.startsWith("tmp/") ? path : "<local-report-path>";
}

function parseArgs(args: readonly string[]): CliOptions {
  let help = false;
  let outFile: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--out") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--out requires a path.");
      outFile = value;
      index += 1;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }

  return { help, outFile };
}

async function main(): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage);
    return 1;
  }

  if (options.help) {
    console.log(usage.trimEnd());
    return 0;
  }

  return runNpmRegistryPaidMcpConsumerSmoke({ outFile: options.outFile });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await main();
}
