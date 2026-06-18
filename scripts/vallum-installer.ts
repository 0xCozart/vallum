import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type VallumInstallMode = "auto-scaffold" | "guided-operator" | "existing-gateway";
export type VallumIntegration = "backend" | "mcp" | "gateway";
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface VallumInstallPlanInput {
  readonly cwd?: string;
  readonly mode: VallumInstallMode;
  readonly integrations?: readonly VallumIntegration[];
  readonly packageManager?: PackageManager;
}

export interface PlannedInstallerFile {
  readonly path: string;
  readonly tracked: boolean;
  readonly containsSecrets: boolean;
  readonly mode?: string;
  readonly purpose: string;
}

export interface VallumInstallPlan {
  readonly schemaVersion: 1;
  readonly kind: "vallum.installer-plan";
  readonly mode: VallumInstallMode;
  readonly integrations: readonly VallumIntegration[];
  readonly packageManager: PackageManager;
  readonly packages: readonly string[];
  readonly packageInstallCommand: string;
  readonly files: readonly PlannedInstallerFile[];
  readonly gitignoreEntries: readonly string[];
  readonly humanSteps: readonly string[];
  readonly verificationCommands: readonly string[];
  readonly blockedCommands: readonly string[];
  readonly requiresHumanSecretEntry: boolean;
  readonly liveCommandsAllowed: false;
  readonly nextApprovalGate: "guided-operator" | "explicit-operator-approval" | "managed-gateway-operator";
}

export interface InstallerOperation {
  readonly path: string;
  readonly kind: "created" | "updated" | "unchanged" | "dry-run";
  readonly tracked: boolean;
}

export interface WriteVallumInstallerScaffoldInput extends VallumInstallPlanInput {
  readonly cwd: string;
  readonly dryRun?: boolean;
  readonly now?: Date;
}

export interface WriteVallumInstallerScaffoldResult {
  readonly plan: VallumInstallPlan;
  readonly operations: readonly InstallerOperation[];
  readonly summary: VallumInstallSummary;
}

export interface InstallSummaryInput {
  readonly plan: VallumInstallPlan;
  readonly now?: Date;
  readonly notes?: readonly string[];
  readonly scaffolded?: boolean;
}

export interface VallumInstallSummary {
  readonly schemaVersion: 1;
  readonly kind: "vallum.install-summary";
  readonly observedAt: string;
  readonly mode: VallumInstallMode;
  readonly integrations: readonly VallumIntegration[];
  readonly packageManager: PackageManager;
  readonly packages: readonly string[];
  readonly localProof: {
    readonly scaffolded: boolean;
    readonly verificationCommands: readonly string[];
  };
  readonly liveProof: {
    readonly proven: false;
    readonly approvalRequired: true;
    readonly blockedCommands: readonly string[];
  };
  readonly productionClaims: {
    readonly made: false;
    readonly reason: string;
  };
  readonly redactedNotes: readonly string[];
}

export const VALLUM_GITIGNORE_BLOCK = `# Vallum local/operator state
.env.vallum.local
.env.vallum.*.local
.vallum/local/
.vallum/reports/
tmp/vallum/
deploy/gas-station/config.local.yaml`;

const DEFAULT_INTEGRATIONS: readonly VallumIntegration[] = ["backend"];

const BLOCKED_LIVE_COMMANDS: readonly string[] = [
  "npm run execute:testnet-demo",
  "npm run sponsor:request-faucet-funds -- --execute",
  "npm run smoke:payment-provider-live -- --report <ignored-json-path>",
  "npm run smoke:a2a-public-discovery -- --report <ignored-json-path>",
  "npm run smoke:a2a-public-push-delivery -- --report <ignored-json-path>",
  "npm run smoke:a2a-external-conformance -- --report <ignored-json-path>",
];

const SECRET_VALUE_RE = /iotaprivkey1[0-9a-z]{16,}|Bearer\s+[A-Za-z0-9._~-]+|(?:api[_-]?key|secret|token|bearer|keypair|private[_-]?key|mnemonic|signature)\s*[:=]\s*["']?[^\s"',}]+["']?/gi;

export function defaultInstallModePrompt(): string {
  return [
    "How do you want Vallum installed?",
    "",
    "1. Safe local auto-scaffold - install package instructions, placeholders, gitignore, and local/mock checks. No real keys.",
    "2. Guided operator config - the agent guides local secret configuration and shape validation. Live/testnet remains approval-gated.",
    "3. Existing gateway/client only - wire SDK or MCP host to an already managed Vallum gateway.",
    "",
    "Default: Safe local auto-scaffold.",
  ].join("\n");
}

export function planVallumInstall(input: VallumInstallPlanInput): VallumInstallPlan {
  const cwd = input.cwd ?? process.cwd();
  const mode = input.mode;
  const integrations = normalizeIntegrations(input.integrations ?? DEFAULT_INTEGRATIONS);
  const packageManager = input.packageManager ?? detectPackageManager(cwd);
  const packages = packagesForIntegrations(integrations);
  const installCommand = packageInstallCommand(packageManager, packages);

  return {
    schemaVersion: 1,
    kind: "vallum.installer-plan",
    mode,
    integrations,
    packageManager,
    packages,
    packageInstallCommand: installCommand,
    files: plannedFilesForMode(mode),
    gitignoreEntries: VALLUM_GITIGNORE_BLOCK.split("\n"),
    humanSteps: humanStepsForMode(mode),
    verificationCommands: verificationCommandsForMode(mode),
    blockedCommands: BLOCKED_LIVE_COMMANDS,
    requiresHumanSecretEntry: mode === "guided-operator",
    liveCommandsAllowed: false,
    nextApprovalGate: approvalGateForMode(mode),
  };
}

export async function writeVallumInstallerScaffold(input: WriteVallumInstallerScaffoldInput): Promise<WriteVallumInstallerScaffoldResult> {
  const cwd = resolve(input.cwd);
  const plan = planVallumInstall(input);
  const dryRun = input.dryRun ?? true;
  const operations: InstallerOperation[] = [];
  const summary = buildInstallSummary({ plan, now: input.now, scaffolded: !dryRun });

  operations.push(await ensureGitignore(cwd, dryRun));

  const fileWrites: Array<{ path: string; content: string; tracked: boolean; mode?: number }> = [
    { path: ".env.vallum.example", content: renderEnvExample(plan), tracked: true },
    { path: "vallum.config.example.json", content: renderConfigExample(plan), tracked: true },
    { path: "docs/vallum-setup.md", content: renderSetupDoc(plan), tracked: true },
    {
      path: ".vallum/reports/install-summary.json",
      content: `${JSON.stringify(summary, null, 2)}\n`,
      tracked: false,
      mode: 0o600,
    },
  ];

  for (const file of fileWrites) {
    operations.push(await writeInstallerFile(cwd, file.path, file.content, file.tracked, dryRun, file.mode));
  }

  return { plan, operations, summary };
}

export function buildInstallSummary(input: InstallSummaryInput): VallumInstallSummary {
  const now = input.now ?? new Date();
  return {
    schemaVersion: 1,
    kind: "vallum.install-summary",
    observedAt: now.toISOString(),
    mode: input.plan.mode,
    integrations: input.plan.integrations,
    packageManager: input.plan.packageManager,
    packages: input.plan.packages,
    localProof: {
      scaffolded: input.scaffolded ?? true,
      verificationCommands: input.plan.verificationCommands,
    },
    liveProof: {
      proven: false,
      approvalRequired: true,
      blockedCommands: input.plan.blockedCommands,
    },
    productionClaims: {
      made: false,
      reason: "Installer scaffold is local setup evidence only; live IOTA, payment, custody, marketplace, and production claims require separate operator proof.",
    },
    redactedNotes: (input.notes ?? []).map(redactSecretLikeText),
  };
}

function plannedFilesForMode(mode: VallumInstallMode): readonly PlannedInstallerFile[] {
  const files: PlannedInstallerFile[] = [
    {
      path: ".gitignore",
      tracked: true,
      containsSecrets: false,
      purpose: "Ignore local Vallum operator state before writing generated local files.",
    },
    {
      path: ".env.vallum.example",
      tracked: true,
      containsSecrets: false,
      purpose: "Document placeholder-only Vallum environment variables.",
    },
    {
      path: "vallum.config.example.json",
      tracked: true,
      containsSecrets: false,
      purpose: "Document non-secret package, mode, and policy shape.",
    },
    {
      path: "docs/vallum-setup.md",
      tracked: true,
      containsSecrets: false,
      purpose: "Record target-repo setup and proof boundary.",
    },
    {
      path: ".vallum/reports/install-summary.json",
      tracked: false,
      containsSecrets: false,
      mode: "0600",
      purpose: "Record redacted local installer result.",
    },
  ];

  if (mode === "guided-operator") {
    files.push({
      path: ".env.vallum.local",
      tracked: false,
      containsSecrets: true,
      mode: "operator-owned",
      purpose: "Human-owned local secret file; the installer does not populate real values.",
    });
  }

  return files;
}

function humanStepsForMode(mode: VallumInstallMode): readonly string[] {
  if (mode === "auto-scaffold") {
    return [
      "Review generated placeholders before copying any values.",
      "Run local/mock verification only.",
      "Switch to guided-operator mode before adding sponsor keys, upstream bearer tokens, or live endpoints.",
    ];
  }
  if (mode === "existing-gateway") {
    return [
      "Ask the gateway operator for env var names, not raw secret values in chat.",
      "Configure VALLUM_GATEWAY_URL and VALLUM_API_KEY in the target backend or MCP host secret store.",
      "Run only package import and local route tests until the managed gateway operator confirms live proof.",
    ];
  }
  return [
    "Create .env.vallum.local locally and never commit it.",
    "Enter sponsor keys, app API keys, upstream bearer tokens, and endpoint values directly on the operator machine.",
    "Run readiness shape checks before any command that contacts IOTA, faucet, payment, public A2A, or custody providers.",
    "Give explicit operator approval before every live/testnet or value-bearing command.",
  ];
}

function verificationCommandsForMode(mode: VallumInstallMode): readonly string[] {
  const base = [
    "node --input-type=module -e 'import(\"@vallum/sdk\").then(() => console.log(\"vallum sdk import ok\"))'",
    "npm exec tsc --noEmit",
    "npm run secrets:scan",
  ];
  if (mode === "guided-operator") {
    return [
      ...base,
      "npm run readiness:testnet",
      "npm run gas-station:runtime-preflight",
      "npm run proof:operator-gates",
    ];
  }
  return base;
}

function approvalGateForMode(mode: VallumInstallMode): VallumInstallPlan["nextApprovalGate"] {
  if (mode === "auto-scaffold") return "guided-operator";
  if (mode === "existing-gateway") return "managed-gateway-operator";
  return "explicit-operator-approval";
}

function normalizeIntegrations(integrations: readonly VallumIntegration[]): readonly VallumIntegration[] {
  const valid = new Set<VallumIntegration>(["backend", "mcp", "gateway"]);
  const normalized: VallumIntegration[] = [];
  for (const integration of integrations) {
    if (!valid.has(integration)) throw new Error(`Unsupported Vallum integration: ${integration}`);
    if (!normalized.includes(integration)) normalized.push(integration);
  }
  return normalized.length > 0 ? normalized : [...DEFAULT_INTEGRATIONS];
}

function packagesForIntegrations(integrations: readonly VallumIntegration[]): readonly string[] {
  const packages: string[] = [];
  if (integrations.includes("backend")) packages.push("@vallum/sdk@next");
  if (integrations.includes("mcp")) packages.push("@vallum/mcp-server@next");
  if (integrations.includes("gateway")) packages.push("@vallum/policy-gateway@next");
  return packages;
}

function packageInstallCommand(packageManager: PackageManager, packages: readonly string[]): string {
  const packageList = packages.join(" ");
  if (packageManager === "yarn") return `yarn add ${packageList}`;
  if (packageManager === "pnpm") return `pnpm add ${packageList}`;
  if (packageManager === "bun") return `bun add ${packageList}`;
  return `npm install ${packageList}`;
}

function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) return "bun";
  return "npm";
}

async function ensureGitignore(cwd: string, dryRun: boolean): Promise<InstallerOperation> {
  const path = ".gitignore";
  const absolutePath = join(cwd, path);
  const existing = existsSync(absolutePath) ? await readFile(absolutePath, "utf8") : "";
  if (existing.includes(VALLUM_GITIGNORE_BLOCK.trim())) {
    return { path, kind: "unchanged", tracked: true };
  }
  if (dryRun) return { path, kind: "dry-run", tracked: true };

  const prefix = existing.trimEnd();
  const content = `${prefix}${prefix ? "\n\n" : ""}${VALLUM_GITIGNORE_BLOCK}\n`;
  await writeFile(absolutePath, content);
  return { path, kind: existing ? "updated" : "created", tracked: true };
}

async function writeInstallerFile(
  cwd: string,
  path: string,
  content: string,
  tracked: boolean,
  dryRun: boolean,
  mode?: number,
): Promise<InstallerOperation> {
  const absolutePath = join(cwd, path);
  const existedBefore = existsSync(absolutePath);
  if (existedBefore) {
    const existing = await readFile(absolutePath, "utf8");
    if (existing === content) return { path, kind: "unchanged", tracked };
  }
  if (dryRun) return { path, kind: "dry-run", tracked };

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, mode ? { mode } : undefined);
  return { path, kind: existedBefore ? "updated" : "created", tracked };
}

function renderEnvExample(plan: VallumInstallPlan): string {
  const lines = [
    "# Vallum installer example.",
    "# Copy to .env.vallum.local and replace locally. Never commit real values.",
    "",
    "VALLUM_GATEWAY_URL=http://127.0.0.1:8787",
    "VALLUM_API_KEY=replace-with-server-side-secret",
  ];
  if (plan.integrations.includes("gateway") || plan.mode === "guided-operator") {
    lines.push(
      "",
      "# Guided/operator values. Keep these in local secret storage only.",
      "IOTA_RPC_URL=https://api.testnet.iota.cafe",
      "GAS_STATION_KEYPAIR=replace-with-local-testnet-sponsor-key",
      "GAS_STATION_AUTH=replace-with-random-token",
      "GAS_STATION_URL=http://127.0.0.1:9527",
      "GAS_STATION_BEARER_TOKEN=replace-with-local-gas-station-token",
      "VALLUM_TESTNET_UPSTREAM_REPORT=tmp/vallum/testnet-upstream-diagnostic.json",
    );
  }
  if (plan.integrations.includes("mcp")) {
    lines.push(
      "",
      "# MCP host process env. Do not paste this value into prompts.",
      "VALLUM_MCP_COMMAND=vallum-mcp",
    );
  }
  return `${lines.join("\n")}\n`;
}

function renderConfigExample(plan: VallumInstallPlan): string {
  return `${JSON.stringify({
    schemaVersion: 1,
    kind: "vallum.installer-config-example",
    mode: plan.mode,
    integrations: plan.integrations,
    packages: plan.packages,
    policy: {
      allowedPackages: ["0xreplace-with-package-id"],
      allowedFunctions: ["replace_with_function"],
      maxGasBudgetMist: 50000000,
      humanApprovalRequiredAboveMist: 100000000,
    },
    proofBoundary: {
      localMockOnly: plan.mode === "auto-scaffold",
      liveCommandsRequireExplicitApproval: true,
    },
  }, null, 2)}\n`;
}

function renderSetupDoc(plan: VallumInstallPlan): string {
  return `${[
    "# Vallum Setup",
    "",
    "This file was generated by the Vallum installer scaffold.",
    "",
    "## Install Mode",
    "",
    `Mode: \`${plan.mode}\``,
    `Integrations: ${plan.integrations.map((integration) => `\`${integration}\``).join(", ")}`,
    "",
    "## Package Install",
    "",
    "Run this command only after reviewing the generated plan:",
    "",
    "```bash",
    plan.packageInstallCommand,
    "```",
    "",
    "## Secret Boundary",
    "",
    "- Keep Vallum app API keys, sponsor keys, upstream bearer tokens, private keys, raw transaction bytes, and user signatures out of browser code and prompts.",
    "- Use `.env.vallum.local` or your platform secret store for real values.",
    "- Commit only placeholder examples.",
    "",
    "## Proof Boundary",
    "",
    "- Auto-scaffold proves local setup shape only.",
    "- Guided operator mode validates local config shape before any live command.",
    "- Live IOTA, payment-provider, custody, marketplace, public A2A, or production claims need separate operator-approved reports.",
  ].join("\n")}\n`;
}

function redactSecretLikeText(value: string): string {
  return value.replace(SECRET_VALUE_RE, "[REDACTED]");
}

interface CliOptions {
  readonly mode: VallumInstallMode;
  readonly integrations: readonly VallumIntegration[];
  readonly cwd: string;
  readonly dryRun: boolean;
  readonly json: boolean;
  readonly help: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const integrations: VallumIntegration[] = [];
  let mode: VallumInstallMode = "auto-scaffold";
  let cwd = process.cwd();
  let dryRun = true;
  let json = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode") {
      mode = parseMode(requiredArg(argv, ++index, "--mode"));
      continue;
    }
    if (arg === "--integration") {
      for (const integration of requiredArg(argv, ++index, "--integration").split(",")) {
        integrations.push(parseIntegration(integration.trim()));
      }
      continue;
    }
    if (arg === "--target") {
      cwd = resolve(requiredArg(argv, ++index, "--target"));
      continue;
    }
    if (arg === "--write" || arg === "--apply") {
      dryRun = false;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    mode,
    integrations: integrations.length > 0 ? integrations : DEFAULT_INTEGRATIONS,
    cwd,
    dryRun,
    json,
    help,
  };
}

function requiredArg(argv: readonly string[], index: number, name: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

function parseMode(value: string): VallumInstallMode {
  if (value === "auto-scaffold" || value === "guided-operator" || value === "existing-gateway") return value;
  throw new Error(`Unsupported install mode: ${value}`);
}

function parseIntegration(value: string): VallumIntegration {
  if (value === "backend" || value === "mcp" || value === "gateway") return value;
  throw new Error(`Unsupported integration: ${value}`);
}

function usage(): string {
  return [
    "usage: npm exec tsx -- scripts/vallum-installer.ts [--mode auto-scaffold|guided-operator|existing-gateway] [--integration backend,mcp,gateway] [--target <repo>] [--write] [--json]",
    "",
    defaultInstallModePrompt(),
    "",
    "Dry-run is the default. --write creates templates, gitignore entries, and a redacted local install summary.",
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
    console.log(usage());
    return 0;
  }

  const result = await writeVallumInstallerScaffold({
    cwd: options.cwd,
    mode: options.mode,
    integrations: options.integrations,
    dryRun: options.dryRun,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  console.log(`Vallum installer ${options.dryRun ? "dry run" : "scaffold written"}`);
  console.log(`mode=${result.plan.mode}`);
  console.log(`install=${result.plan.packageInstallCommand}`);
  for (const operation of result.operations) {
    console.log(`${operation.kind} ${operation.path}`);
  }
  console.log(`liveCommandsAllowed=${result.plan.liveCommandsAllowed}`);
  console.log(`nextApprovalGate=${result.plan.nextApprovalGate}`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
