import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { containsUnsafeReportContent } from "./structured-report-safety.js";

export type CustodyReadinessStatus =
  | "proven-local"
  | "blocked-local"
  | "blocked-config"
  | "ready-approval";

export interface CustodyReadinessCheck {
  readonly id: string;
  readonly status: CustodyReadinessStatus;
  readonly code: string;
  readonly message: string;
  readonly evidence?: string;
  readonly next: string;
}

export interface CustodyReadinessReport {
  readonly localProofOk: boolean;
  readonly productionReady: boolean;
  readonly checks: readonly CustodyReadinessCheck[];
}

export interface CustodyReadinessArtifact {
  readonly schemaVersion: 1;
  readonly kind: "agentic-gaskit.custody-readiness-report";
  readonly generatedAt: string;
  readonly localProofOk: boolean;
  readonly productionReady: boolean;
  readonly provenLocalCheckIds: readonly string[];
  readonly readyApprovalCheckIds: readonly string[];
  readonly blockedCheckIds: readonly string[];
  readonly blockerCodes: readonly string[];
  readonly checks: readonly CustodyReadinessCheck[];
  readonly boundaries: readonly string[];
}

export interface CustodyReadinessOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly now?: Date;
  readonly scripts?: Record<string, string | undefined>;
}

export interface WriteCustodyReadinessArtifactOptions extends CustodyReadinessOptions {
  readonly outFile?: string;
}

interface CliOptions {
  readonly help: boolean;
  readonly json: boolean;
  readonly outFile?: string;
}

interface StructuredCustodyReport {
  readonly schemaVersion?: unknown;
  readonly kind?: unknown;
  readonly result?: unknown;
  readonly observedAt?: unknown;
  readonly custodyMode?: unknown;
  readonly checks?: unknown;
}

const MAX_REPORT_BYTES = 64 * 1024;
const MAX_REPORT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CUSTODY_PRODUCTION_TEMPLATE_COMMAND = "npm run operator:write-report-template -- --kind custody-production --out tmp/gaskit/custody-production-report-template.json";
const REQUIRED_SOURCE_PATHS = [
  "packages/accounts/src/index.ts",
  "packages/accounts/src/accounts.test.ts",
  "packages/accounts/README.md",
  "docs/agentic-gaskit/account-wallet-safety.md",
  "docs/agentic-gaskit/verification-hardening.md",
] as const;

const REQUIRED_PRODUCTION_CHECKS = [
  "signer-reference-contract-review",
  "no-agent-secret-exposure-review",
  "kms-external-signer-review",
  "recovery-export-review",
  "rotation-revocation-review",
  "audit-logging-review",
  "legal-security-review",
  "incident-response-review",
] as const;

const SECRET_FIELD_RE = /seed|mnemonic|private|rawKeypair|raw_keypair|secret|token|credential|authorization|signature|payload|header|password|session|cookie|keyMaterial|exportedKey/i;
const SECRET_VALUE_RE = /\b(seed phrase|mnemonic|private key|raw keypair|key material|exported key|token|credential|authorization|signature)\b|bearer\s+\S+/i;

const ARTIFACT_BOUNDARIES = [
  "This report is non-networked and does not contact KMS providers, external signers, custody providers, IOTA services, Gas Station endpoints, or live wallet infrastructure.",
  "productionReady=false means local signer-reference proof or operator-approved production custody evidence remains blocked.",
  "ready-approval checks require manual operator review before any production custody, KMS, external signer, recovery export, staking, bonding, slashing, or signer-operation claim is accepted.",
  "Do not commit generated reports, custody proof outputs, seeds, mnemonics, private keys, raw keypairs, signer material, credentials, authorization headers, payloads, signatures, exported keys, or local secret paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/check-custody-readiness.ts [--json] [--out <path>]

Reports current Agentic GasKit custody readiness without contacting custody systems or live signer infrastructure.

Options:
  --json        Print a redacted machine-readable artifact.
  --out <path>  Write the same JSON artifact to a local file with mode 0600.
  --help        Show this help text.
`;

export async function checkCustodyReadiness(
  options: CustodyReadinessOptions = {},
): Promise<CustodyReadinessReport> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const scripts = options.scripts ?? await loadPackageScripts(cwd);
  const checks = [
    await checkLocalCustodyProof(cwd, scripts),
    await checkProductionReport(cwd, env.CUSTODY_PRODUCTION_REPORT, now),
  ];

  return {
    localProofOk: checks.find((check) => check.id === "local-signer-reference-proof")?.status === "proven-local",
    productionReady: checks.every((check) => check.status === "proven-local" || check.status === "ready-approval"),
    checks,
  };
}

export function formatCustodyReadinessReport(report: CustodyReadinessReport): string {
  const lines = [
    `Agentic GasKit custody readiness ${report.productionReady ? "ready-for-approval" : "blocked"}`,
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

export function buildCustodyReadinessArtifact(
  report: CustodyReadinessReport,
  now = new Date(),
): CustodyReadinessArtifact {
  const provenLocalChecks = report.checks.filter((check) => check.status === "proven-local");
  const readyApprovalChecks = report.checks.filter((check) => check.status === "ready-approval");
  const blockedChecks = report.checks.filter((check) => check.status !== "proven-local" && check.status !== "ready-approval");

  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.custody-readiness-report",
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

export async function writeCustodyReadinessArtifact(
  options: WriteCustodyReadinessArtifactOptions = {},
): Promise<CustodyReadinessArtifact> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkCustodyReadiness(options);
  const artifact = buildCustodyReadinessArtifact(report, options.now);
  if (options.outFile) {
    const outPath = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, formatCustodyReadinessArtifact(artifact), { mode: 0o600 });
    await chmod(outPath, 0o600);
  }
  return artifact;
}

export function formatCustodyReadinessArtifact(artifact: CustodyReadinessArtifact): string {
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

async function checkLocalCustodyProof(
  cwd: string,
  scripts: Record<string, string | undefined>,
): Promise<CustodyReadinessCheck> {
  const missing: string[] = [];

  for (const path of REQUIRED_SOURCE_PATHS) {
    try {
      await access(resolve(cwd, path));
    } catch {
      missing.push(path);
    }
  }

  const build = scripts.build ?? "";
  const verifyFast = scripts["verify:fast"] ?? "";
  const verifyLocal = scripts["verify:local"] ?? "";
  const grantCheck = scripts["grant:check"] ?? "";

  if (!build.includes("npm run build -w @iota-gaskit/accounts")) missing.push("build @iota-gaskit/accounts");
  if (!verifyLocal.includes("npm test")) missing.push("verify:local account tests via npm test");
  if (
    verifyFast.includes("proof:custody-readiness")
    || verifyLocal.includes("proof:custody-readiness")
    || grantCheck.includes("proof:custody-readiness")
  ) {
    missing.push("custody readiness must stay opt-in");
  }

  if (missing.length > 0) {
    return {
      id: "local-signer-reference-proof",
      status: "blocked-local",
      code: "CUSTODY_LOCAL_PROOF_INCOMPLETE",
      message: "Local signer-reference account source, docs, tests, or script coverage is incomplete.",
      evidence: `missing=${missing.join(",")}`,
      next: "Restore account signer-reference source, safety docs, tests, and local verification coverage before production custody readiness review.",
    };
  }

  return {
    id: "local-signer-reference-proof",
    status: "proven-local",
    code: "CUSTODY_LOCAL_SIGNER_REFERENCE_PROOF_CONFIGURED",
    message: "Local account proof returns scoped signer references, requires owner and agent context, denies inactive signing, denies recovery export, and redacts secret-like values.",
    evidence: "node --import tsx --test packages/accounts/src/accounts.test.ts",
    next: "Keep this as local signer-reference proof only until an operator-approved production custody report exists.",
  };
}

async function checkProductionReport(
  cwd: string,
  value: string | undefined,
  now: Date,
): Promise<CustodyReadinessCheck> {
  if (!value || value.trim() === "") {
    return {
      id: "production-custody-report",
      status: "blocked-config",
      code: "CUSTODY_PRODUCTION_REPORT_MISSING",
      message: "Production custody proof requires an operator-supplied structured report path.",
      evidence: "missing=CUSTODY_PRODUCTION_REPORT",
      next: `${CUSTODY_PRODUCTION_TEMPLATE_COMMAND}; complete a dedicated operator-approved custody, KMS, recovery, legal, and incident-response review and set CUSTODY_PRODUCTION_REPORT to the ignored local structured report path.`,
    };
  }

  const reportPath = isAbsolute(value) ? value : resolve(cwd, value);
  let raw: string;
  try {
    const bytes = await readFile(reportPath);
    if (bytes.byteLength > MAX_REPORT_BYTES) {
      return invalidReport(
        "CUSTODY_PRODUCTION_REPORT_TOO_LARGE",
        "Production custody proof report is too large.",
        "configured-report-too-large",
        "Provide a concise status-only structured report without keys, signer material, credentials, payloads, headers, or secret local paths.",
      );
    }
    raw = bytes.toString("utf8");
  } catch {
    return invalidReport(
      "CUSTODY_PRODUCTION_REPORT_NOT_FOUND",
      "Production custody proof report path does not exist.",
      "configured-report-missing",
      "Provide an existing ignored local structured report after an operator-approved custody review.",
    );
  }

  let parsed: StructuredCustodyReport;
  try {
    parsed = JSON.parse(raw) as StructuredCustodyReport;
  } catch {
    return invalidReport(
      "CUSTODY_PRODUCTION_REPORT_INVALID_JSON",
      "Production custody proof report is not valid JSON.",
      "configured-report-invalid-json",
      "Provide a JSON structured evidence report generated after an operator-approved custody review.",
    );
  }

  const invalid = validateStructuredReport(parsed, now);
  if (invalid) return invalid;

  return {
    id: "production-custody-report",
    status: "ready-approval",
    code: "CUSTODY_PRODUCTION_REPORT_VALID",
    message: "Production custody evidence is a passing structured report for a future approved review.",
    evidence: "local-structured-report-valid-redacted",
    next: "Review the report manually before accepting production custody, KMS, recovery, staking, bonding, slashing, or signer-operation claims.",
  };
}

function validateStructuredReport(
  report: StructuredCustodyReport,
  now: Date,
): CustodyReadinessCheck | undefined {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return invalidReport("CUSTODY_PRODUCTION_REPORT_INVALID_SHAPE", "Production custody proof report must be a JSON object.", "configured-report-invalid-shape", "Provide a JSON object structured evidence report.");
  }
  if (report.schemaVersion !== 1) {
    return invalidReport("CUSTODY_PRODUCTION_REPORT_UNSUPPORTED_SCHEMA", "Production custody proof report schema is unsupported.", "configured-report-unsupported-schema", "Provide a structured evidence report with schemaVersion=1.");
  }
  if (report.kind !== "agentic-gaskit.custody-production-proof") {
    return invalidReport("CUSTODY_PRODUCTION_REPORT_KIND_MISMATCH", "Production custody proof report has the wrong kind.", "configured-report-kind-mismatch", "Provide an agentic-gaskit.custody-production-proof structured report.");
  }
  if (report.result !== "passed") {
    return invalidReport("CUSTODY_PRODUCTION_REPORT_NOT_PASSED", "Production custody proof report did not pass.", "configured-report-not-passed", "Rerun the approved custody review after resolving production blockers.");
  }
  if (containsUnsafeReportContent(report, { unsafeFieldNameRe: SECRET_FIELD_RE, unsafeStringValueRe: SECRET_VALUE_RE })) {
    return invalidReport("CUSTODY_PRODUCTION_REPORT_UNSAFE_FIELDS", "Production custody proof report contains unsafe secret-like fields.", "configured-report-unsafe-fields", "Provide status-only evidence without seeds, mnemonics, private keys, raw keypairs, signer material, credentials, payloads, headers, or signatures.");
  }
  if (report.custodyMode !== "external-signer" && report.custodyMode !== "kms") {
    return invalidReport("CUSTODY_PRODUCTION_REPORT_MODE_MISSING", "Production custody proof report must identify external-signer or kms custody mode.", "configured-report-mode-missing", "Provide custody review evidence for an external signer or KMS custody mode.");
  }
  const checks = report.checks;
  if (!Array.isArray(checks) || !REQUIRED_PRODUCTION_CHECKS.every((check) => checks.includes(check))) {
    return invalidReport("CUSTODY_PRODUCTION_REPORT_CHECKS_INCOMPLETE", "Production custody proof report is missing required check ids.", "configured-report-checks-incomplete", "Include signer-reference, no secret exposure, KMS/external signer, recovery, rotation/revocation, audit logging, legal/security, and incident-response checks.");
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

function staleReport(): CustodyReadinessCheck {
  return invalidReport("CUSTODY_PRODUCTION_REPORT_STALE", "Production custody proof report is stale or has an invalid observation time.", "configured-report-stale-or-invalid-time", "Provide a structured custody report with an observedAt timestamp from the last 30 days.");
}

function invalidReport(
  code: string,
  message: string,
  evidence: string,
  next: string,
): CustodyReadinessCheck {
  return {
    id: "production-custody-report",
    status: "blocked-config",
    code,
    message,
    evidence,
    next,
  };
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
    const artifact = await writeCustodyReadinessArtifact({ outFile: options.outFile });
    console.log(formatCustodyReadinessArtifact(artifact).trimEnd());
    return 0;
  }

  const report = await checkCustodyReadiness();
  console.log(formatCustodyReadinessReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
