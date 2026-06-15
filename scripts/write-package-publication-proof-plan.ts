import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkPackagePublicationReadiness,
  type PackagePublicationReadinessCheck,
  type PackagePublicationReadinessReport,
} from "./check-package-publication-readiness.js";

export interface PackagePublicationProofPlanCommand {
  readonly id: string;
  readonly command: string;
  readonly contactsNpmRegistry: boolean;
  readonly requiresOperatorApproval: boolean;
}

export interface PackagePublicationProofPlanCheck {
  readonly id: string;
  readonly status: PackagePublicationReadinessCheck["status"];
  readonly code: string;
  readonly next: string;
}

export interface PackagePublicationProofPlan {
  readonly schemaVersion: 1;
  readonly kind: "agentrail.package-publication-proof-plan";
  readonly generatedAt: string;
  readonly localProofOk: boolean;
  readonly liveReady: boolean;
  readonly status: "blocked" | "ready-for-approval";
  readonly packageNames: readonly string[];
  readonly commands: readonly PackagePublicationProofPlanCommand[];
  readonly blockerCodes: readonly string[];
  readonly readyApprovalCodes: readonly string[];
  readonly checks: readonly PackagePublicationProofPlanCheck[];
  readonly boundaries: readonly string[];
  readonly requiredOperatorInputs: readonly string[];
  readonly requiredStructuredReportFields: readonly string[];
  readonly requiredStructuredReportCheckIds: readonly string[];
}

export interface WritePackagePublicationProofPlanOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly now?: Date;
  readonly outFile?: string;
}

interface CliOptions {
  readonly help: boolean;
  readonly outFile?: string;
}

const REQUIRED_OPERATOR_INPUTS = [
  "PACKAGE_PUBLICATION_REPORT",
] as const;

const REQUIRED_STRUCTURED_REPORT_FIELDS = [
  "schemaVersion",
  "kind",
  "result",
  "observedAt",
  "registry",
  "packageNames",
  "checks",
] as const;

const REQUIRED_STRUCTURED_REPORT_CHECK_IDS = [
  "npm-pack-dry-run",
  "local-tarball-install",
  "npm-publish-dry-run",
  "registry-install",
  "provenance-review",
  "rollback-review",
] as const;

const PLAN_COMMANDS: readonly PackagePublicationProofPlanCommand[] = [
  {
    id: "run-local-pack-check",
    command: "npm run pack:check",
    contactsNpmRegistry: false,
    requiresOperatorApproval: false,
  },
  {
    id: "run-local-install-smoke",
    command: "npm run smoke:package-install",
    contactsNpmRegistry: false,
    requiresOperatorApproval: false,
  },
  {
    id: "run-publish-dry-run",
    command: "npm run publish:dry-run",
    contactsNpmRegistry: false,
    requiresOperatorApproval: false,
  },
  {
    id: "run-approved-npm-publication-proof",
    command: "operator-approved npm publication, provenance, registry install, and rollback proof",
    contactsNpmRegistry: true,
    requiresOperatorApproval: true,
  },
  {
    id: "write-structured-publication-report",
    command: "write status-only JSON report to an ignored local path",
    contactsNpmRegistry: false,
    requiresOperatorApproval: true,
  },
  {
    id: "check-package-publication-readiness",
    command: "npm run proof:package-publication-readiness",
    contactsNpmRegistry: false,
    requiresOperatorApproval: false,
  },
] as const;

const BOUNDARIES = [
  "This plan is non-networked and does not run real npm publication.",
  "Only the operator-approved npm publication proof contacts the npm registry for real publication or registry install verification, and it requires explicit operator approval.",
  "Do not commit reports, npm tokens, OTPs, npmrc contents, credentials, authorization headers, raw registry responses, signatures, provenance secrets, package-owner account details, or local secret paths.",
  "ready-for-approval means a redacted structured report is reviewable; it is not npm publication approval by itself.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-package-publication-proof-plan.ts [--out <path>]

Writes a redacted non-networked package-publication proof plan from current readiness gates.
The plan prints package names, command names, blocker codes, required report fields, and operator input names only.`;

export async function writePackagePublicationProofPlan(
  options: WritePackagePublicationProofPlanOptions = {},
): Promise<PackagePublicationProofPlan> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkPackagePublicationReadiness({
    cwd,
    env: options.env,
    now: options.now,
  });
  const plan = buildPackagePublicationProofPlan(report, options.now ?? new Date());
  if (options.outFile) {
    const outFile = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, `${formatPackagePublicationProofPlan(plan)}\n`, { mode: 0o600 });
  }
  return plan;
}

export function buildPackagePublicationProofPlan(
  report: PackagePublicationReadinessReport,
  now: Date = new Date(),
): PackagePublicationProofPlan {
  const checks = report.checks.map((check) => ({
    id: check.id,
    status: check.status,
    code: check.code,
    next: check.next,
  }));
  const blockers = checks.filter((check) => check.status !== "proven-local" && check.status !== "ready-approval");
  const readyApproval = checks.filter((check) => check.status === "ready-approval");

  return {
    schemaVersion: 1,
    kind: "agentrail.package-publication-proof-plan",
    generatedAt: now.toISOString(),
    localProofOk: report.localProofOk,
    liveReady: report.liveReady,
    status: report.liveReady ? "ready-for-approval" : "blocked",
    packageNames: report.packageNames,
    commands: PLAN_COMMANDS,
    blockerCodes: blockers.map((check) => check.code),
    readyApprovalCodes: readyApproval.map((check) => check.code),
    checks,
    boundaries: BOUNDARIES,
    requiredOperatorInputs: REQUIRED_OPERATOR_INPUTS,
    requiredStructuredReportFields: REQUIRED_STRUCTURED_REPORT_FIELDS,
    requiredStructuredReportCheckIds: REQUIRED_STRUCTURED_REPORT_CHECK_IDS,
  };
}

export function formatPackagePublicationProofPlan(plan: PackagePublicationProofPlan): string {
  return JSON.stringify(plan, null, 2);
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: { help: boolean; outFile?: string } = { help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error("--out requires a path.");
      options.outFile = value;
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

  const plan = await writePackagePublicationProofPlan({ outFile: options.outFile });
  console.log(formatPackagePublicationProofPlan(plan));
  if (options.outFile) {
    console.log("wrotePlan=true");
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
