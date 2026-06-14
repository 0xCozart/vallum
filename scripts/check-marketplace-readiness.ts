import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type MarketplaceReadinessStatus =
  | "proven-local"
  | "blocked-local"
  | "blocked-config"
  | "ready-approval";

export interface MarketplaceReadinessCheck {
  readonly id: string;
  readonly status: MarketplaceReadinessStatus;
  readonly code: string;
  readonly message: string;
  readonly evidence?: string;
  readonly next: string;
}

export interface MarketplaceReadinessReport {
  readonly localProofOk: boolean;
  readonly productionReady: boolean;
  readonly checks: readonly MarketplaceReadinessCheck[];
}

export interface MarketplaceReadinessArtifact {
  readonly schemaVersion: 1;
  readonly kind: "agentic-gaskit.marketplace-readiness-report";
  readonly generatedAt: string;
  readonly localProofOk: boolean;
  readonly productionReady: boolean;
  readonly provenLocalCheckIds: readonly string[];
  readonly readyApprovalCheckIds: readonly string[];
  readonly blockedCheckIds: readonly string[];
  readonly blockerCodes: readonly string[];
  readonly checks: readonly MarketplaceReadinessCheck[];
  readonly boundaries: readonly string[];
}

export interface MarketplaceReadinessOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly now?: Date;
  readonly scripts?: Record<string, string | undefined>;
}

export interface WriteMarketplaceReadinessArtifactOptions extends MarketplaceReadinessOptions {
  readonly outFile?: string;
}

interface CliOptions {
  readonly help: boolean;
  readonly json: boolean;
  readonly outFile?: string;
}

interface StructuredMarketplaceReport {
  readonly schemaVersion?: unknown;
  readonly kind?: unknown;
  readonly result?: unknown;
  readonly observedAt?: unknown;
  readonly environment?: unknown;
  readonly checks?: unknown;
}

const MAX_REPORT_BYTES = 64 * 1024;
const MAX_REPORT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MARKETPLACE_PRODUCTION_TEMPLATE_COMMAND = "npm run operator:write-report-template -- --kind marketplace-production --out tmp/gaskit/marketplace-production-report-template.json";
const REQUIRED_SOURCE_PATHS = [
  "packages/marketplace/src/index.ts",
  "packages/marketplace/src/marketplace.test.ts",
  "packages/marketplace/README.md",
  "scripts/smoke-marketplace-read-model.ts",
  "docs/marketplace-readiness.md",
] as const;

const REQUIRED_PRODUCTION_CHECKS = [
  "provider-onboarding-review",
  "provider-verification-review",
  "moderation-abuse-review",
  "session-auth-review",
  "receipt-access-review",
  "payment-settlement-review",
  "dispute-workflow-review",
  "operations-incident-review",
] as const;

const SECRET_FIELD_RE = /secret|token|private|credential|authorization|signature|mnemonic|seed|payload|header|instrument|session|cookie|password|prompt/i;

const ARTIFACT_BOUNDARIES = [
  "This report is non-networked and does not contact production marketplace systems, provider systems, payment systems, IOTA services, public A2A endpoints, or Gas Station endpoints.",
  "productionReady=false means local marketplace proof or operator-approved production marketplace evidence remains blocked.",
  "ready-approval checks require manual operator review before any provider onboarding, provider verification, moderation, session auth, settlement, dispute, operations, or production marketplace claim is accepted.",
  "Do not commit generated reports, marketplace proof outputs, provider secrets, session data, payment credentials, authorization headers, raw payloads, response bodies, moderation payloads, private prompts, signatures, or local secret paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/check-marketplace-readiness.ts [--json] [--out <path>]

Reports current Agentic GasKit marketplace readiness without contacting production marketplace systems.

Options:
  --json        Print a redacted machine-readable artifact.
  --out <path>  Write the same JSON artifact to a local file with mode 0600.
  --help        Show this help text.
`;

export async function checkMarketplaceReadiness(
  options: MarketplaceReadinessOptions = {},
): Promise<MarketplaceReadinessReport> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const scripts = options.scripts ?? await loadPackageScripts(cwd);
  const checks = [
    await checkLocalMarketplaceProof(cwd, scripts),
    await checkProductionReport(cwd, env.MARKETPLACE_PRODUCTION_REPORT, now),
  ];

  return {
    localProofOk: checks.find((check) => check.id === "local-marketplace-read-model-proof")?.status === "proven-local",
    productionReady: checks.every((check) => check.status === "proven-local" || check.status === "ready-approval"),
    checks,
  };
}

export function formatMarketplaceReadinessReport(report: MarketplaceReadinessReport): string {
  const lines = [
    `Agentic GasKit marketplace readiness ${report.productionReady ? "ready-for-approval" : "blocked"}`,
    `localProofOk=${report.localProofOk}`,
    `productionReady=${report.productionReady}`,
  ];
  for (const check of report.checks) {
    lines.push(`${check.status}: ${check.id}: code=${check.code}`);
    lines.push(`message=${check.message}`);
    if (check.evidence) lines.push(`evidence=${check.evidence}`);
    lines.push(`next=${check.next}`);
  }
  return lines.join("\n");
}

export function buildMarketplaceReadinessArtifact(
  report: MarketplaceReadinessReport,
  now = new Date(),
): MarketplaceReadinessArtifact {
  const provenLocalChecks = report.checks.filter((check) => check.status === "proven-local");
  const readyApprovalChecks = report.checks.filter((check) => check.status === "ready-approval");
  const blockedChecks = report.checks.filter((check) => check.status !== "proven-local" && check.status !== "ready-approval");

  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.marketplace-readiness-report",
    generatedAt: now.toISOString(),
    localProofOk: report.localProofOk,
    productionReady: report.productionReady,
    provenLocalCheckIds: provenLocalChecks.map((check) => check.id),
    readyApprovalCheckIds: readyApprovalChecks.map((check) => check.id),
    blockedCheckIds: blockedChecks.map((check) => check.id),
    blockerCodes: blockedChecks.map((check) => check.code),
    checks: report.checks,
    boundaries: ARTIFACT_BOUNDARIES,
  };
}

export async function writeMarketplaceReadinessArtifact(
  options: WriteMarketplaceReadinessArtifactOptions = {},
): Promise<MarketplaceReadinessArtifact> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkMarketplaceReadiness(options);
  const artifact = buildMarketplaceReadinessArtifact(report, options.now);
  if (options.outFile) {
    const outPath = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, formatMarketplaceReadinessArtifact(artifact), { mode: 0o600 });
    await chmod(outPath, 0o600);
  }
  return artifact;
}

export function formatMarketplaceReadinessArtifact(artifact: MarketplaceReadinessArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

async function loadPackageScripts(cwd: string): Promise<Record<string, string | undefined>> {
  try {
    const packageJson = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    return packageJson.scripts ?? {};
  } catch {
    return {};
  }
}

async function checkLocalMarketplaceProof(
  cwd: string,
  scripts: Record<string, string | undefined>,
): Promise<MarketplaceReadinessCheck> {
  const missing: string[] = [];

  for (const path of REQUIRED_SOURCE_PATHS) {
    try {
      await access(resolve(cwd, path));
    } catch {
      missing.push(path);
    }
  }

  const build = scripts.build ?? "";
  const smoke = scripts["smoke:marketplace-read-model"] ?? "";
  const verifyLocal = scripts["verify:local"] ?? "";
  const verifyFast = scripts["verify:fast"] ?? "";
  const grantCheck = scripts["grant:check"] ?? "";

  if (!build.includes("npm run build -w @iota-gaskit/marketplace")) missing.push("build @iota-gaskit/marketplace");
  if (!smoke.includes("scripts/smoke-marketplace-read-model.ts")) missing.push("smoke:marketplace-read-model");
  if (!verifyLocal.includes("npm run smoke:marketplace-read-model")) missing.push("verify:local marketplace smoke");
  if (
    verifyFast.includes("proof:marketplace-readiness")
    || verifyLocal.includes("proof:marketplace-readiness")
    || grantCheck.includes("proof:marketplace-readiness")
  ) {
    missing.push("marketplace readiness must stay opt-in");
  }

  if (missing.length > 0) {
    return {
      id: "local-marketplace-read-model-proof",
      status: "blocked-local",
      code: "MARKETPLACE_LOCAL_PROOF_INCOMPLETE",
      message: "Local marketplace read-model source, docs, test, or script coverage is incomplete.",
      evidence: `missing=${missing.join(",")}`,
      next: "Restore marketplace read-model source, docs, tests, smoke wiring, and local verification coverage before production marketplace readiness review.",
    };
  }

  return {
    id: "local-marketplace-read-model-proof",
    status: "proven-local",
    code: "MARKETPLACE_LOCAL_PROOF_CONFIGURED",
    message: "Local marketplace read model proves provider labels, policy compatibility, receipt access control, and redacted dispute evidence without production actions.",
    evidence: "node --import tsx --test packages/marketplace/src/marketplace.test.ts; npm run smoke:marketplace-read-model",
    next: "Keep this as local read-only evidence until an operator-approved production marketplace report exists.",
  };
}

async function checkProductionReport(
  cwd: string,
  value: string | undefined,
  now: Date,
): Promise<MarketplaceReadinessCheck> {
  if (!value || value.trim() === "") {
    return {
      id: "production-marketplace-report",
      status: "blocked-config",
      code: "MARKETPLACE_PRODUCTION_REPORT_MISSING",
      message: "Production marketplace proof requires an operator-supplied structured report path.",
      evidence: "missing=MARKETPLACE_PRODUCTION_REPORT",
      next: `${MARKETPLACE_PRODUCTION_TEMPLATE_COMMAND}; complete a dedicated operator-approved production marketplace review and set MARKETPLACE_PRODUCTION_REPORT to the ignored local structured report path.`,
    };
  }

  const reportPath = isAbsolute(value) ? value : resolve(cwd, value);
  let raw: string;
  try {
    const bytes = await readFile(reportPath);
    if (bytes.byteLength > MAX_REPORT_BYTES) {
      return invalidReport(
        "MARKETPLACE_PRODUCTION_REPORT_TOO_LARGE",
        "Production marketplace proof report is too large.",
        "configured-report-too-large",
        "Provide a concise status-only structured report without provider secrets, session data, payment credentials, raw evidence, or response bodies.",
      );
    }
    raw = bytes.toString("utf8");
  } catch {
    return invalidReport(
      "MARKETPLACE_PRODUCTION_REPORT_NOT_FOUND",
      "Production marketplace proof report path does not exist.",
      "configured-report-missing",
      "Provide an existing ignored local structured report after an operator-approved marketplace review.",
    );
  }

  let parsed: StructuredMarketplaceReport;
  try {
    parsed = JSON.parse(raw) as StructuredMarketplaceReport;
  } catch {
    return invalidReport(
      "MARKETPLACE_PRODUCTION_REPORT_INVALID_JSON",
      "Production marketplace proof report is not valid JSON.",
      "configured-report-invalid-json",
      "Provide a JSON structured evidence report generated after an operator-approved marketplace review.",
    );
  }

  const invalid = validateStructuredReport(parsed, now);
  if (invalid) return invalid;

  return {
    id: "production-marketplace-report",
    status: "ready-approval",
    code: "MARKETPLACE_PRODUCTION_REPORT_VALID",
    message: "Production marketplace evidence is a passing structured report for a future approved review.",
    evidence: "local-structured-report-valid-redacted",
    next: "Review the report manually before accepting production marketplace, provider, moderation, auth, settlement, or operations claims.",
  };
}

function validateStructuredReport(
  report: StructuredMarketplaceReport,
  now: Date,
): MarketplaceReadinessCheck | undefined {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return invalidReport("MARKETPLACE_PRODUCTION_REPORT_INVALID_SHAPE", "Production marketplace proof report must be a JSON object.", "configured-report-invalid-shape", "Provide a JSON object structured evidence report.");
  }
  if (containsSecretLikeField(report)) {
    return invalidReport("MARKETPLACE_PRODUCTION_REPORT_UNSAFE_FIELDS", "Production marketplace proof report contains unsafe secret-like fields.", "configured-report-unsafe-fields", "Provide status-only evidence without provider secrets, credentials, sessions, prompts, payment instruments, raw payloads, headers, or signatures.");
  }
  if (report.schemaVersion !== 1) {
    return invalidReport("MARKETPLACE_PRODUCTION_REPORT_UNSUPPORTED_SCHEMA", "Production marketplace proof report schema is unsupported.", "configured-report-unsupported-schema", "Provide a structured evidence report with schemaVersion=1.");
  }
  if (report.kind !== "agentic-gaskit.marketplace-production-proof") {
    return invalidReport("MARKETPLACE_PRODUCTION_REPORT_KIND_MISMATCH", "Production marketplace proof report has the wrong kind.", "configured-report-kind-mismatch", "Provide an agentic-gaskit.marketplace-production-proof structured report.");
  }
  if (report.result !== "passed") {
    return invalidReport("MARKETPLACE_PRODUCTION_REPORT_NOT_PASSED", "Production marketplace proof report did not pass.", "configured-report-not-passed", "Rerun the approved marketplace review after resolving production blockers.");
  }
  const environment = report.environment;
  if (environment !== "testnet" && environment !== "production") {
    return invalidReport("MARKETPLACE_PRODUCTION_REPORT_ENVIRONMENT_MISSING", "Production marketplace proof report must identify testnet or production environment.", "configured-report-environment-missing", "Provide marketplace review evidence from a named testnet or production environment.");
  }
  const checks = report.checks;
  if (!Array.isArray(checks) || !REQUIRED_PRODUCTION_CHECKS.every((check) => checks.includes(check))) {
    return invalidReport("MARKETPLACE_PRODUCTION_REPORT_CHECKS_INCOMPLETE", "Production marketplace proof report is missing required check ids.", "configured-report-checks-incomplete", "Include provider onboarding, provider verification, moderation, session auth, receipt access, settlement, dispute workflow, and operations review checks.");
  }
  if (typeof report.observedAt !== "string") {
    return staleReport();
  }
  const observedAt = Date.parse(report.observedAt);
  if (Number.isNaN(observedAt) || observedAt > now.getTime() || now.getTime() - observedAt > MAX_REPORT_AGE_MS) {
    return staleReport();
  }
  return undefined;
}

function staleReport(): MarketplaceReadinessCheck {
  return invalidReport("MARKETPLACE_PRODUCTION_REPORT_STALE", "Production marketplace proof report is stale or has an invalid observation time.", "configured-report-stale-or-invalid-time", "Provide a structured marketplace report with an observedAt timestamp from the last 30 days.");
}

function invalidReport(
  code: string,
  message: string,
  evidence: string,
  next: string,
): MarketplaceReadinessCheck {
  return {
    id: "production-marketplace-report",
    status: "blocked-config",
    code,
    message,
    evidence,
    next,
  };
}

function containsSecretLikeField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsSecretLikeField);
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_FIELD_RE.test(key)) return true;
    if (containsSecretLikeField(nested)) return true;
  }
  return false;
}

function parseArgs(args: readonly string[]): CliOptions {
  let help = false;
  let json = false;
  let outFile: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
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

  return { help, json, outFile };
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

  if (options.json || options.outFile) {
    const artifact = await writeMarketplaceReadinessArtifact({ outFile: options.outFile });
    console.log(formatMarketplaceReadinessArtifact(artifact).trimEnd());
    return 0;
  }

  const report = await checkMarketplaceReadiness();
  console.log(formatMarketplaceReadinessReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
