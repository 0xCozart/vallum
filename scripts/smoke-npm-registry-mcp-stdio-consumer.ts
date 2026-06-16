import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { buildMcpStdioConsumerSmokeSource } from "./smoke-package-mcp-stdio-consumer.js";
import { buildNpmRegistryInstallArgs } from "./smoke-npm-registry-paid-mcp-consumer.js";

type Runner = (command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv) => SpawnSyncReturns<string>;

export interface NpmRegistryMcpStdioConsumerSmokeOptions {
  readonly cwd?: string;
  readonly outFile?: string;
  readonly run?: Runner;
  readonly now?: Date;
}

interface RegistryMcpStdioConsumerProof {
  readonly schemaVersion: 1;
  readonly kind: "agentrail.npm-registry-mcp-stdio-consumer-proof";
  readonly result: "passed" | "failed";
  readonly observedAt: string;
  readonly registry: "npm";
  readonly installSource: "npm-registry";
  readonly mcpPackageName: "@sacredlabs/agentrail-mcp-server";
  readonly mcpVersion: string;
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

const DEFAULT_OUT_FILE = "tmp/agentrail/npm-registry-mcp-stdio-consumer-proof.json";
const MCP_PACKAGE_NAME = "@sacredlabs/agentrail-mcp-server";
const SUPPORT_PACKAGE_DIRS = [
  "packages/manifest",
  "packages/policy-gateway",
] as const;

const REQUIRED_MARKERS = [
  "Package MCP stdio consumer smoke passed",
  "mode=package-consumer",
  "install=npm-registry",
  "bin=node_modules/.bin/agentrail-mcp",
  "boundary.liveNetwork=false",
  "boundary.route=MCP-stdio->SDK->mock-policy-gateway",
  "approval.approved=true",
  "denial.reason=GAS_BUDGET_TOO_HIGH",
  "invalid.reason=INVALID_TOOL_INPUT",
  "redaction.apiKey=redacted",
] as const;

const SECRET_OUTPUT_RE = /local-package-mcp-stdio-secret-key|signerRef|transactionBytes|userSignature|raw upstream|private key|mnemonic|seed|Bearer|_authToken/i;

const usage = `usage: npm exec tsx -- scripts/smoke-npm-registry-mcp-stdio-consumer.ts [--out <path>]

Installs the published AgentRail MCP server package from npm into a fresh
temporary consumer, starts node_modules/.bin/agentrail-mcp, calls the stdio MCP
tools against a loopback mock policy gateway, and writes a redacted proof
packet. Uses NPM_CONFIG_MIN_RELEASE_AGE=0 because this machine can hide newly
published packages behind a local release-age gate.

Options:
  --out <path>  Write the redacted proof packet. Defaults to ${DEFAULT_OUT_FILE}.
  --help        Show this help text.
`;

export function buildRegistryMcpStdioConsumerPackageJson(input: {
  readonly mcpVersion: string;
  readonly supportPackages: readonly { readonly name: string; readonly version: string }[];
}): string {
  const dependencies = Object.fromEntries([
    [MCP_PACKAGE_NAME, input.mcpVersion],
    ...input.supportPackages.map((packageInfo) => [packageInfo.name, packageInfo.version] as const),
  ]);
  return `${JSON.stringify({
    name: "agentrail-npm-registry-mcp-stdio-consumer-proof",
    private: true,
    type: "module",
    dependencies,
  }, null, 2)}\n`;
}

export function buildRegistryMcpStdioConsumerSmokeSource(): string {
  return buildMcpStdioConsumerSmokeSource().replace("install=local-tarballs", "install=npm-registry");
}

export async function runNpmRegistryMcpStdioConsumerSmoke(
  options: NpmRegistryMcpStdioConsumerSmokeOptions = {},
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const outFile = options.outFile ?? DEFAULT_OUT_FILE;
  const now = options.now ?? new Date();
  const mcpPackage = await readPackage(cwd, "packages/mcp-server");
  const supportPackages = await Promise.all(SUPPORT_PACKAGE_DIRS.map((dir) => readPackage(cwd, dir)));
  const packageNames = [mcpPackage.name, ...supportPackages.map((packageInfo) => packageInfo.name)];
  const observedAt = now.toISOString();
  const tempRoot = await mkdtemp(join(tmpdir(), "agentrail-npm-registry-mcp-stdio-consumer-"));
  const consumerDir = join(tempRoot, "consumer");
  const run =
    options.run ??
    ((command: string, args: readonly string[], runCwd: string, runEnv: NodeJS.ProcessEnv) =>
      spawnSync(command, args, { cwd: runCwd, encoding: "utf8", env: runEnv, stdio: "pipe" }));

  let report: RegistryMcpStdioConsumerProof;
  try {
    await mkdir(consumerDir, { recursive: true });
    await writeFile(
      join(consumerDir, "package.json"),
      buildRegistryMcpStdioConsumerPackageJson({
        mcpVersion: mcpPackage.version,
        supportPackages,
      }),
      "utf8",
    );
    await writeFile(join(consumerDir, "index.mjs"), buildRegistryMcpStdioConsumerSmokeSource(), "utf8");

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

    report = passedReport({ observedAt, mcpVersion: mcpPackage.version, packageNames });
    process.stdout.write(smoke.stdout);
    console.log(`Npm registry MCP stdio consumer smoke passed packages=${packageNames.length}`);
  } catch (error) {
    report = failedReport({
      observedAt,
      mcpVersion: mcpPackage.version,
      packageNames,
      error: error instanceof Error ? error.message : String(error),
      tempRoot,
      cwd,
    });
    console.error(`Npm registry MCP stdio consumer smoke failed: ${report.error}`);
    await writeReport(cwd, outFile, report);
    return 1;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }

  await writeReport(cwd, outFile, report);
  console.log(`Npm registry MCP stdio proof wrote ${redactPath(outFile)}`);
  return 0;
}

function passedReport(input: {
  readonly observedAt: string;
  readonly mcpVersion: string;
  readonly packageNames: readonly string[];
}): RegistryMcpStdioConsumerProof {
  return {
    schemaVersion: 1,
    kind: "agentrail.npm-registry-mcp-stdio-consumer-proof",
    result: "passed",
    observedAt: input.observedAt,
    registry: "npm",
    installSource: "npm-registry",
    mcpPackageName: MCP_PACKAGE_NAME,
    mcpVersion: input.mcpVersion,
    packageNames: input.packageNames,
    npmConfig: {
      minReleaseAgeOverride: "0",
      reason: "freshly published prerelease packages are hidden by this machine default release-age gate without the override",
    },
    checks: [
      "fresh-temp-consumer-project",
      "registry-install-mcp-stdio-package",
      "package-bin-present",
      "mcp-initialize",
      "mcp-tools-list",
      "mcp-approval-path",
      "mcp-policy-denial-path",
      "mcp-invalid-input-path",
      "stdin-close-shutdown",
      "redaction-markers",
    ],
    outputMarkers: REQUIRED_MARKERS,
    boundaries: [
      "No live IOTA RPC, IOTA Gas Station, payment provider, custody provider, marketplace service, or public A2A endpoint was contacted.",
      "Temporary consumer paths, npm cache paths, and local auth/token paths are intentionally omitted.",
      "This proves npm registry install plus local MCP stdio execution against a mock policy gateway only.",
    ],
  };
}

function failedReport(input: {
  readonly observedAt: string;
  readonly mcpVersion: string;
  readonly packageNames: readonly string[];
  readonly error: string;
  readonly tempRoot: string;
  readonly cwd: string;
}): RegistryMcpStdioConsumerProof {
  return {
    schemaVersion: 1,
    kind: "agentrail.npm-registry-mcp-stdio-consumer-proof",
    result: "failed",
    observedAt: input.observedAt,
    registry: "npm",
    installSource: "npm-registry",
    mcpPackageName: MCP_PACKAGE_NAME,
    mcpVersion: input.mcpVersion,
    packageNames: input.packageNames,
    error: redactOutput(input.error, input.tempRoot, input.cwd),
  };
}

async function readPackage(cwd: string, packageDir: string): Promise<{ readonly name: string; readonly version: string }> {
  const packageJson = JSON.parse(await readFile(resolve(cwd, packageDir, "package.json"), "utf8")) as {
    name?: string;
    version?: string;
  };
  if (!packageJson.name || !packageJson.version) throw new Error(`${packageDir}/package.json is missing name or version.`);
  return { name: packageJson.name, version: packageJson.version };
}

async function writeReport(cwd: string, outFile: string, report: RegistryMcpStdioConsumerProof): Promise<void> {
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

  return runNpmRegistryMcpStdioConsumerSmoke({ outFile: options.outFile });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await main();
}
