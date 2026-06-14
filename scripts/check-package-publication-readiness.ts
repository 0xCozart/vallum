import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { collectPublishablePackages, type PublishablePackage } from "./package-publish-dry-run.js";

export type PackagePublicationReadinessStatus =
  | "proven-local"
  | "blocked-local"
  | "blocked-config"
  | "ready-approval";

export interface PackagePublicationReadinessCheck {
  readonly id: string;
  readonly status: PackagePublicationReadinessStatus;
  readonly code: string;
  readonly message: string;
  readonly evidence?: string;
  readonly next: string;
}

export interface PackagePublicationReadinessReport {
  readonly localProofOk: boolean;
  readonly liveReady: boolean;
  readonly packageNames: readonly string[];
  readonly checks: readonly PackagePublicationReadinessCheck[];
}

export interface PackagePublicationReadinessArtifact {
  readonly schemaVersion: 1;
  readonly kind: "agentic-gaskit.package-publication-readiness-report";
  readonly generatedAt: string;
  readonly localProofOk: boolean;
  readonly liveReady: boolean;
  readonly packageNames: readonly string[];
  readonly provenLocalCheckIds: readonly string[];
  readonly readyApprovalCheckIds: readonly string[];
  readonly blockedCheckIds: readonly string[];
  readonly blockerCodes: readonly string[];
  readonly checks: readonly PackagePublicationReadinessCheck[];
  readonly boundaries: readonly string[];
}

export interface PackagePublicationReadinessOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly now?: Date;
  readonly scripts?: Record<string, string | undefined>;
}

export interface WritePackagePublicationReadinessArtifactOptions extends PackagePublicationReadinessOptions {
  readonly outFile?: string;
}

interface CliOptions {
  readonly help: boolean;
  readonly json: boolean;
  readonly outFile?: string;
}

interface StructuredPackagePublicationReport {
  readonly schemaVersion?: unknown;
  readonly kind?: unknown;
  readonly result?: unknown;
  readonly observedAt?: unknown;
  readonly registry?: unknown;
  readonly packageNames?: unknown;
  readonly checks?: unknown;
}

const MAX_REPORT_BYTES = 64 * 1024;
const MAX_REPORT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const REQUIRED_SOURCE_PATHS = [
  "docs/agentic-gaskit/package-release-strategy.md",
  "scripts/package-publish-dry-run.ts",
  "scripts/smoke-package-install.ts",
  "scripts/package-publish.test.ts",
  "scripts/package-publish-dry-run.test.ts",
  "scripts/package-install-smoke.test.ts",
  "scripts/package-scripts.test.ts",
] as const;

const REQUIRED_REGISTRY_CHECKS = [
  "npm-pack-dry-run",
  "local-tarball-install",
  "npm-publish-dry-run",
  "registry-install",
  "provenance-review",
  "rollback-review",
] as const;

const SECRET_FIELD_RE = /secret|token|private|credential|authorization|otp|password|session|cookie|npmrc|signature|payload|header/i;

const ARTIFACT_BOUNDARIES = [
  "This report is non-networked and does not contact the npm registry or run real npm publish.",
  "liveReady=false means local package proof or operator-approved npm registry publication evidence remains blocked.",
  "ready-approval checks require manual operator review before any npm publication, provenance, registry installability, ownership, 2FA, or rollback claim is accepted.",
  "Do not commit generated reports, publication proof outputs, npm tokens, OTPs, npmrc contents, credentials, authorization headers, raw registry responses, signatures, package-owner account details, or local secret paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/check-package-publication-readiness.ts [--json] [--out <path>]

Reports current Agentic GasKit package publication readiness without contacting npm or publishing packages.

Options:
  --json        Print a redacted machine-readable artifact.
  --out <path>  Write the same JSON artifact to a local file with mode 0600.
  --help        Show this help text.
`;

export async function checkPackagePublicationReadiness(
  options: PackagePublicationReadinessOptions = {},
): Promise<PackagePublicationReadinessReport> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const scripts = options.scripts ?? await loadPackageScripts(cwd);
  const packages = await collectPackagesSafely(cwd);
  const packageNames = packages.map((packageInfo) => packageInfo.name);
  const checks = [
    await checkLocalPackageProof(cwd, scripts, packages),
    await checkRegistryReport(cwd, env.PACKAGE_PUBLICATION_REPORT, packageNames, now),
  ];

  return {
    localProofOk: checks.find((check) => check.id === "local-package-publication-proof")?.status === "proven-local",
    liveReady: checks.every((check) => check.status === "proven-local" || check.status === "ready-approval"),
    packageNames,
    checks,
  };
}

export function formatPackagePublicationReadinessReport(report: PackagePublicationReadinessReport): string {
  const lines = [
    `Agentic GasKit package publication readiness ${report.liveReady ? "ready-for-approval" : "blocked"}`,
    `localProofOk=${report.localProofOk}`,
    `liveReady=${report.liveReady}`,
    `packages=${report.packageNames.join(",")}`,
  ];
  for (const check of report.checks) {
    lines.push(`${check.status}: ${check.id}: code=${check.code}`);
    lines.push(`message=${check.message}`);
    if (check.evidence) lines.push(`evidence=${check.evidence}`);
    lines.push(`next=${check.next}`);
  }
  return lines.join("\n");
}

export function buildPackagePublicationReadinessArtifact(
  report: PackagePublicationReadinessReport,
  now = new Date(),
): PackagePublicationReadinessArtifact {
  const provenLocalChecks = report.checks.filter((check) => check.status === "proven-local");
  const readyApprovalChecks = report.checks.filter((check) => check.status === "ready-approval");
  const blockedChecks = report.checks.filter((check) => check.status !== "proven-local" && check.status !== "ready-approval");

  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.package-publication-readiness-report",
    generatedAt: now.toISOString(),
    localProofOk: report.localProofOk,
    liveReady: report.liveReady,
    packageNames: report.packageNames,
    provenLocalCheckIds: provenLocalChecks.map((check) => check.id),
    readyApprovalCheckIds: readyApprovalChecks.map((check) => check.id),
    blockedCheckIds: blockedChecks.map((check) => check.id),
    blockerCodes: blockedChecks.map((check) => check.code),
    checks: report.checks,
    boundaries: ARTIFACT_BOUNDARIES,
  };
}

export async function writePackagePublicationReadinessArtifact(
  options: WritePackagePublicationReadinessArtifactOptions = {},
): Promise<PackagePublicationReadinessArtifact> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkPackagePublicationReadiness(options);
  const artifact = buildPackagePublicationReadinessArtifact(report, options.now);
  if (options.outFile) {
    const outPath = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, formatPackagePublicationReadinessArtifact(artifact), { mode: 0o600 });
    await chmod(outPath, 0o600);
  }
  return artifact;
}

export function formatPackagePublicationReadinessArtifact(artifact: PackagePublicationReadinessArtifact): string {
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

async function collectPackagesSafely(cwd: string): Promise<PublishablePackage[]> {
  try {
    return await collectPublishablePackages(cwd);
  } catch {
    return [];
  }
}

async function checkLocalPackageProof(
  cwd: string,
  scripts: Record<string, string | undefined>,
  packages: readonly PublishablePackage[],
): Promise<PackagePublicationReadinessCheck> {
  const missing: string[] = [];

  for (const path of REQUIRED_SOURCE_PATHS) {
    try {
      await access(resolve(cwd, path));
    } catch {
      missing.push(path);
    }
  }

  if (packages.length === 0) missing.push("publishable packages");
  const packCheck = scripts["pack:check"] ?? "";
  const installSmoke = scripts["smoke:package-install"] ?? "";
  const publishDryRun = scripts["publish:dry-run"] ?? "";
  const verifyFast = scripts["verify:fast"] ?? "";
  const verifyLocal = scripts["verify:local"] ?? "";
  const grantCheck = scripts["grant:check"] ?? "";

  if (!packCheck.includes("npm pack --dry-run")) missing.push("pack:check npm pack --dry-run");
  if (!installSmoke.includes("scripts/smoke-package-install.ts")) missing.push("smoke:package-install");
  if (!publishDryRun.includes("scripts/package-publish-dry-run.ts")) missing.push("publish:dry-run");
  for (const packageInfo of packages) {
    if (!packCheck.includes(`-w ${packageInfo.name}`)) missing.push(`pack:check ${packageInfo.name}`);
  }
  if (verifyFast.includes("publish:dry-run") || verifyLocal.includes("publish:dry-run") || grantCheck.includes("publish:dry-run")) {
    missing.push("publish:dry-run must stay opt-in");
  }
  if (
    verifyFast.includes("proof:package-publication-readiness")
    || verifyLocal.includes("proof:package-publication-readiness")
    || grantCheck.includes("proof:package-publication-readiness")
  ) {
    missing.push("package publication readiness must stay opt-in");
  }

  if (missing.length > 0) {
    return {
      id: "local-package-publication-proof",
      status: "blocked-local",
      code: "PACKAGE_PUBLICATION_LOCAL_PROOF_INCOMPLETE",
      message: "Local package publication source, script, or package coverage is incomplete.",
      evidence: `missing=${missing.join(",")}`,
      next: "Restore package release docs, pack dry-run, local tarball install smoke, opt-in publish dry-run, and package coverage before registry readiness review.",
    };
  }

  return {
    id: "local-package-publication-proof",
    status: "proven-local",
    code: "PACKAGE_PUBLICATION_LOCAL_PROOF_CONFIGURED",
    message: "Local package metadata, pack dry-run, local tarball install smoke, and opt-in publish dry-run gates are configured.",
    evidence: "npm run pack:check; npm run smoke:package-install; npm run publish:dry-run",
    next: "Keep this as local release proof only until an operator-approved npm registry publication report exists.",
  };
}

async function checkRegistryReport(
  cwd: string,
  value: string | undefined,
  packageNames: readonly string[],
  now: Date,
): Promise<PackagePublicationReadinessCheck> {
  if (!value || value.trim() === "") {
    return {
      id: "npm-registry-publication-report",
      status: "blocked-config",
      code: "PACKAGE_PUBLICATION_REPORT_MISSING",
      message: "Registry publication proof requires an operator-supplied structured report path.",
      evidence: "missing=PACKAGE_PUBLICATION_REPORT",
      next: "Run a dedicated operator-approved npm publication proof and set PACKAGE_PUBLICATION_REPORT to the ignored local structured report path.",
    };
  }

  const reportPath = isAbsolute(value) ? value : resolve(cwd, value);
  let raw: string;
  try {
    const bytes = await readFile(reportPath);
    if (bytes.byteLength > MAX_REPORT_BYTES) {
      return invalidReport(
        "PACKAGE_PUBLICATION_REPORT_TOO_LARGE",
        "Package publication proof report is too large.",
        "configured-report-too-large",
        "Provide a concise status-only structured report without tokens, OTPs, npmrc contents, headers, or response bodies.",
      );
    }
    raw = bytes.toString("utf8");
  } catch {
    return invalidReport(
      "PACKAGE_PUBLICATION_REPORT_NOT_FOUND",
      "Package publication proof report path does not exist.",
      "configured-report-missing",
      "Provide an existing ignored local structured report after an operator-approved registry proof run.",
    );
  }

  let parsed: StructuredPackagePublicationReport;
  try {
    parsed = JSON.parse(raw) as StructuredPackagePublicationReport;
  } catch {
    return invalidReport(
      "PACKAGE_PUBLICATION_REPORT_INVALID_JSON",
      "Package publication proof report is not valid JSON.",
      "configured-report-invalid-json",
      "Provide a JSON structured evidence report generated after an operator-approved registry proof run.",
    );
  }

  const invalid = validateStructuredReport(parsed, packageNames, now);
  if (invalid) return invalid;

  return {
    id: "npm-registry-publication-report",
    status: "ready-approval",
    code: "PACKAGE_PUBLICATION_REPORT_VALID",
    message: "Npm registry publication evidence is a passing structured report for a future approved review.",
    evidence: "local-structured-report-valid-redacted",
    next: "Review the report manually before accepting npm publication and registry installability claims.",
  };
}

function validateStructuredReport(
  report: StructuredPackagePublicationReport,
  packageNames: readonly string[],
  now: Date,
): PackagePublicationReadinessCheck | undefined {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return invalidReport("PACKAGE_PUBLICATION_REPORT_INVALID_SHAPE", "Package publication proof report must be a JSON object.", "configured-report-invalid-shape", "Provide a JSON object structured evidence report.");
  }
  if (containsSecretLikeField(report)) {
    return invalidReport("PACKAGE_PUBLICATION_REPORT_UNSAFE_FIELDS", "Package publication proof report contains unsafe secret-like fields.", "configured-report-unsafe-fields", "Provide status-only evidence without npm tokens, OTPs, npmrc contents, credentials, headers, raw responses, or signatures.");
  }
  if (report.schemaVersion !== 1) {
    return invalidReport("PACKAGE_PUBLICATION_REPORT_UNSUPPORTED_SCHEMA", "Package publication proof report schema is unsupported.", "configured-report-unsupported-schema", "Provide a structured evidence report with schemaVersion=1.");
  }
  if (report.kind !== "agentic-gaskit.package-publication-proof") {
    return invalidReport("PACKAGE_PUBLICATION_REPORT_KIND_MISMATCH", "Package publication proof report has the wrong kind.", "configured-report-kind-mismatch", "Provide an agentic-gaskit.package-publication-proof structured report.");
  }
  if (report.result !== "passed") {
    return invalidReport("PACKAGE_PUBLICATION_REPORT_NOT_PASSED", "Package publication proof report did not pass.", "configured-report-not-passed", "Rerun the approved publication proof after resolving registry failures.");
  }
  if (report.registry !== "npm") {
    return invalidReport("PACKAGE_PUBLICATION_REPORT_REGISTRY_MISMATCH", "Package publication proof report must target npm.", "configured-report-registry-mismatch", "Provide npm registry publication evidence.");
  }
  const reportPackageNames = report.packageNames;
  if (!Array.isArray(reportPackageNames) || !packageNames.every((name) => reportPackageNames.includes(name))) {
    return invalidReport("PACKAGE_PUBLICATION_REPORT_PACKAGES_INCOMPLETE", "Package publication proof report is missing required public package names.", "configured-report-packages-incomplete", "Include every current public workspace package name in the structured report.");
  }
  const checks = report.checks;
  if (!Array.isArray(checks) || !REQUIRED_REGISTRY_CHECKS.every((check) => checks.includes(check))) {
    return invalidReport("PACKAGE_PUBLICATION_REPORT_CHECKS_INCOMPLETE", "Package publication proof report is missing required check ids.", "configured-report-checks-incomplete", "Include pack dry-run, local tarball install, npm publish dry-run, registry install, provenance review, and rollback review checks.");
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

function staleReport(): PackagePublicationReadinessCheck {
  return invalidReport("PACKAGE_PUBLICATION_REPORT_STALE", "Package publication proof report is stale or has an invalid observation time.", "configured-report-stale-or-invalid-time", "Provide a structured package publication report with an observedAt timestamp from the last 30 days.");
}

function invalidReport(
  code: string,
  message: string,
  evidence: string,
  next: string,
): PackagePublicationReadinessCheck {
  return {
    id: "npm-registry-publication-report",
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
    const artifact = await writePackagePublicationReadinessArtifact({ outFile: options.outFile });
    console.log(formatPackagePublicationReadinessArtifact(artifact).trimEnd());
    return 0;
  }

  const report = await checkPackagePublicationReadiness();
  console.log(formatPackagePublicationReadinessReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
