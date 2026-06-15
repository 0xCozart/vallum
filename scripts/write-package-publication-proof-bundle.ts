import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkPackagePublicationReadiness,
  type PackagePublicationReadinessCheck,
  type PackagePublicationReadinessOptions,
  writePackagePublicationReadinessArtifact,
} from "./check-package-publication-readiness.js";
import { writeOperatorReportTemplate } from "./write-operator-report-template.js";
import { writePackagePublicationProofPlan } from "./write-package-publication-proof-plan.js";

export interface PackagePublicationProofBundleTemplate {
  readonly id: "package-publication";
  readonly path: string;
  readonly acceptedReportEnv: "PACKAGE_PUBLICATION_REPORT";
}

export interface PackagePublicationProofBundleStep {
  readonly id: string;
  readonly command: string;
  readonly contactsNpmRegistry: boolean;
  readonly requiresOperatorApproval: boolean;
  readonly dependsOn?: readonly string[];
}

export interface PackagePublicationProofBundleCheck {
  readonly id: string;
  readonly status: PackagePublicationReadinessCheck["status"];
  readonly code: string;
  readonly evidence?: string;
  readonly next: string;
}

export interface PackagePublicationProofBundle {
  readonly schemaVersion: 1;
  readonly kind: "agentrail.package-publication-proof-bundle";
  readonly generatedAt: string;
  readonly status: "blocked" | "ready-for-approval";
  readonly localProofOk: boolean;
  readonly liveReady: boolean;
  readonly packageNames: readonly string[];
  readonly templateArtifacts: readonly PackagePublicationProofBundleTemplate[];
  readonly planArtifact: string;
  readonly readinessArtifact: string;
  readonly blockerCodes: readonly string[];
  readonly readyApprovalCodes: readonly string[];
  readonly checks: readonly PackagePublicationProofBundleCheck[];
  readonly requiredOperatorInputs: readonly string[];
  readonly requiredStructuredReportFields: readonly string[];
  readonly requiredStructuredReportCheckIds: readonly string[];
  readonly requiredEvidenceArtifacts: readonly string[];
  readonly steps: readonly PackagePublicationProofBundleStep[];
  readonly boundaries: readonly string[];
}

export interface WritePackagePublicationProofBundleOptions extends PackagePublicationReadinessOptions {
  readonly now?: Date;
  readonly outFile?: string;
  readonly planOutFile?: string;
  readonly readinessOutFile?: string;
  readonly templateOutFile?: string;
}

interface CliOptions {
  readonly help: boolean;
  readonly outFile: string;
  readonly planOutFile: string;
  readonly readinessOutFile: string;
  readonly templateOutFile: string;
}

type MutableCliOptions = {
  -readonly [Key in keyof CliOptions]: CliOptions[Key];
};

const DEFAULT_OUT_FILE = "tmp/agentrail/package-publication-proof-bundle.json";
const DEFAULT_PLAN_OUT_FILE = "tmp/agentrail/package-publication-proof-plan.json";
const DEFAULT_READINESS_OUT_FILE = "tmp/agentrail/package-publication-readiness.json";
const DEFAULT_TEMPLATE_OUT_FILE = "tmp/agentrail/package-publication-report-template.json";

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

const REQUIRED_EVIDENCE_ARTIFACTS = [
  "sanitized npm publication structured report",
  "registry install verification",
  "provenance review result",
  "rollback review result",
] as const;

const BOUNDARIES = [
  "This bundle writer is non-networked and only writes an ignored local report template, package publication proof plan, readiness artifact, and bundle summary.",
  "The generated template is a pending-operator-proof artifact; it does not clear package publication readiness by itself.",
  "Only a dedicated operator-approved npm publication proof may contact npm for real publication or registry install verification.",
  "Do not commit generated bundle artifacts, npm tokens, OTPs, npmrc contents, credentials, authorization headers, raw registry responses, signatures, package-owner account details, report paths, or local secret paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-package-publication-proof-bundle.ts [--out <path>]

Writes a non-networked ignored local bundle for npm package publication proof gates.
The command writes a report template plus a proof plan and readiness artifact, then summarizes only package names, blocker codes, command order, required report fields, and safety boundaries.`;

export async function writePackagePublicationProofBundle(
  options: WritePackagePublicationProofBundleOptions = {},
): Promise<PackagePublicationProofBundle> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const outFile = options.outFile ?? DEFAULT_OUT_FILE;
  const planOutFile = options.planOutFile ?? DEFAULT_PLAN_OUT_FILE;
  const readinessOutFile = options.readinessOutFile ?? DEFAULT_READINESS_OUT_FILE;
  const templateOutFile = options.templateOutFile ?? DEFAULT_TEMPLATE_OUT_FILE;

  await writeOperatorReportTemplate({
    cwd,
    kind: "package-publication",
    now,
    outFile: templateOutFile,
  });
  await writePackagePublicationProofPlan({
    cwd,
    env: options.env,
    now,
    outFile: planOutFile,
  });
  await writePackagePublicationReadinessArtifact({
    cwd,
    env: options.env,
    now,
    outFile: readinessOutFile,
  });

  const readiness = await checkPackagePublicationReadiness({
    cwd,
    env: options.env,
    now,
    scripts: options.scripts,
  });
  const checks = readiness.checks.map((check) => stripCheck(check));
  const blockers = checks.filter((check) => check.status !== "proven-local" && check.status !== "ready-approval");
  const readyApproval = checks.filter((check) => check.status === "ready-approval");

  const bundle: PackagePublicationProofBundle = {
    schemaVersion: 1,
    kind: "agentrail.package-publication-proof-bundle",
    generatedAt: now.toISOString(),
    status: readiness.liveReady ? "ready-for-approval" : "blocked",
    localProofOk: readiness.localProofOk,
    liveReady: readiness.liveReady,
    packageNames: readiness.packageNames,
    templateArtifacts: [
      {
        id: "package-publication",
        path: templateOutFile,
        acceptedReportEnv: "PACKAGE_PUBLICATION_REPORT",
      },
    ],
    planArtifact: planOutFile,
    readinessArtifact: readinessOutFile,
    blockerCodes: blockers.map((check) => check.code),
    readyApprovalCodes: readyApproval.map((check) => check.code),
    checks,
    requiredOperatorInputs: REQUIRED_OPERATOR_INPUTS,
    requiredStructuredReportFields: REQUIRED_STRUCTURED_REPORT_FIELDS,
    requiredStructuredReportCheckIds: REQUIRED_STRUCTURED_REPORT_CHECK_IDS,
    requiredEvidenceArtifacts: REQUIRED_EVIDENCE_ARTIFACTS,
    steps: buildSteps({
      planOutFile,
      readinessOutFile,
      templateOutFile,
    }),
    boundaries: BOUNDARIES,
  };

  await writeJsonFile(cwd, outFile, bundle);
  return bundle;
}

function stripCheck(check: PackagePublicationReadinessCheck): PackagePublicationProofBundleCheck {
  return {
    id: check.id,
    status: check.status,
    code: check.code,
    evidence: check.evidence,
    next: check.next,
  };
}

function buildSteps(input: {
  readonly planOutFile: string;
  readonly readinessOutFile: string;
  readonly templateOutFile: string;
}): readonly PackagePublicationProofBundleStep[] {
  return [
    {
      id: "write-publication-template",
      command: `npm run operator:write-report-template -- --kind package-publication --out ${input.templateOutFile}`,
      contactsNpmRegistry: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-publication-proof-plan",
      command: `npm run package:write-publication-proof-plan -- --out ${input.planOutFile}`,
      contactsNpmRegistry: false,
      requiresOperatorApproval: false,
      dependsOn: ["write-publication-template"],
    },
    {
      id: "write-publication-readiness-artifact",
      command: `npm run proof:package-publication-readiness -- --out ${input.readinessOutFile}`,
      contactsNpmRegistry: false,
      requiresOperatorApproval: false,
      dependsOn: ["write-publication-proof-plan"],
    },
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
      dependsOn: ["run-local-pack-check"],
    },
    {
      id: "run-local-paid-mcp-consumer-smoke",
      command: "npm run smoke:package-paid-mcp-consumer",
      contactsNpmRegistry: false,
      requiresOperatorApproval: false,
      dependsOn: ["run-local-install-smoke"],
    },
    {
      id: "run-publish-dry-run",
      command: "npm run publish:dry-run",
      contactsNpmRegistry: false,
      requiresOperatorApproval: false,
      dependsOn: ["run-local-paid-mcp-consumer-smoke"],
    },
    {
      id: "run-approved-npm-publication-proof",
      command: "operator-approved npm publication, provenance, registry install, and rollback proof",
      contactsNpmRegistry: true,
      requiresOperatorApproval: true,
      dependsOn: ["run-publish-dry-run", "write-publication-template"],
    },
    {
      id: "check-package-publication-readiness",
      command: `npm run proof:package-publication-readiness -- --out ${input.readinessOutFile}`,
      contactsNpmRegistry: false,
      requiresOperatorApproval: false,
      dependsOn: ["run-approved-npm-publication-proof"],
    },
  ];
}

async function writeJsonFile(cwd: string, path: string, value: unknown): Promise<void> {
  const outFile = isAbsolute(path) ? path : resolve(cwd, path);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(outFile, 0o600);
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: MutableCliOptions = {
    help: false,
    outFile: DEFAULT_OUT_FILE,
    planOutFile: DEFAULT_PLAN_OUT_FILE,
    readinessOutFile: DEFAULT_READINESS_OUT_FILE,
    templateOutFile: DEFAULT_TEMPLATE_OUT_FILE,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--out") {
      options.outFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--plan-out") {
      options.planOutFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--readiness-out") {
      options.readinessOutFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--template-out") {
      options.templateOutFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function readArg(argv: readonly string[], index: number, name: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
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

  const bundle = await writePackagePublicationProofBundle({
    outFile: options.outFile,
    planOutFile: options.planOutFile,
    readinessOutFile: options.readinessOutFile,
    templateOutFile: options.templateOutFile,
  });
  console.log(JSON.stringify(bundle, null, 2));
  console.log("wroteBundle=true");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
