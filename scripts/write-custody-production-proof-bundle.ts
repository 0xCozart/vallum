import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkCustodyReadiness,
  type CustodyReadinessCheck,
  type CustodyReadinessOptions,
  writeCustodyReadinessArtifact,
} from "./check-custody-readiness.js";
import { writeCustodyProductionProofPlan } from "./write-custody-production-proof-plan.js";
import { writeOperatorReportTemplate } from "./write-operator-report-template.js";

export interface CustodyProductionProofBundleTemplate {
  readonly id: "custody-production";
  readonly path: string;
  readonly acceptedReportEnv: "CUSTODY_PRODUCTION_REPORT";
}

export interface CustodyProductionProofBundleStep {
  readonly id: string;
  readonly command: string;
  readonly contactsCustodySystem: boolean;
  readonly requiresOperatorApproval: boolean;
  readonly dependsOn?: readonly string[];
}

export interface CustodyProductionProofBundleCheck {
  readonly id: string;
  readonly status: CustodyReadinessCheck["status"];
  readonly code: string;
  readonly evidence?: string;
  readonly next: string;
}

export interface CustodyProductionProofBundle {
  readonly schemaVersion: 1;
  readonly kind: "vallum.custody-production-proof-bundle";
  readonly generatedAt: string;
  readonly status: "blocked" | "ready-for-approval";
  readonly localProofOk: boolean;
  readonly productionReady: boolean;
  readonly templateArtifacts: readonly CustodyProductionProofBundleTemplate[];
  readonly planArtifact: string;
  readonly readinessArtifact: string;
  readonly blockerCodes: readonly string[];
  readonly readyApprovalCodes: readonly string[];
  readonly checks: readonly CustodyProductionProofBundleCheck[];
  readonly requiredOperatorInputs: readonly string[];
  readonly requiredStructuredReportFields: readonly string[];
  readonly requiredStructuredReportCheckIds: readonly string[];
  readonly requiredEvidenceArtifacts: readonly string[];
  readonly steps: readonly CustodyProductionProofBundleStep[];
  readonly boundaries: readonly string[];
}

export interface WriteCustodyProductionProofBundleOptions extends CustodyReadinessOptions {
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

const DEFAULT_OUT_FILE = "tmp/vallum/custody-production-proof-bundle.json";
const DEFAULT_PLAN_OUT_FILE = "tmp/vallum/custody-production-proof-plan.json";
const DEFAULT_READINESS_OUT_FILE = "tmp/vallum/custody-readiness.json";
const DEFAULT_TEMPLATE_OUT_FILE = "tmp/vallum/custody-production-report-template.json";

const REQUIRED_OPERATOR_INPUTS = [
  "CUSTODY_PRODUCTION_REPORT",
] as const;

const REQUIRED_STRUCTURED_REPORT_FIELDS = [
  "schemaVersion",
  "kind",
  "result",
  "observedAt",
  "custodyMode",
  "checks",
  "signerReferenceReview",
  "custodyControlReview",
  "lifecycleReview",
  "recoveryReview",
  "auditReview",
  "incidentReview",
  "complianceReview",
] as const;

const REQUIRED_STRUCTURED_REPORT_CHECK_IDS = [
  "signer-reference-contract-review",
  "no-agent-secret-exposure-review",
  "kms-external-signer-review",
  "cryptographic-module-validation-review",
  "operator-access-review",
  "key-lifecycle-review",
  "recovery-export-review",
  "backup-restore-review",
  "rotation-revocation-review",
  "audit-logging-review",
  "legal-security-review",
  "incident-response-review",
  "redaction-review",
] as const;

const REQUIRED_EVIDENCE_ARTIFACTS = [
  "sanitized custody production structured report",
  "signer-reference contract review result",
  "no agent secret exposure review result",
  "KMS or external signer review result",
  "cryptographic module validation review result",
  "operator access review result",
  "key lifecycle review result",
  "recovery and export review result",
  "backup and restore review result",
  "rotation and revocation review result",
  "audit logging review result",
  "legal and security review result",
  "incident response review result",
  "redaction review result",
] as const;

const BOUNDARIES = [
  "This bundle writer is non-networked and only writes an ignored local report template, custody production proof plan, readiness artifact, and bundle summary.",
  "The generated template is a pending-operator-proof artifact; it does not clear custody readiness by itself.",
  "Only a dedicated operator-approved production custody review may contact KMS providers, external signers, custody providers, IOTA services, Gas Station endpoints, or live wallet infrastructure.",
  "Do not commit generated bundle artifacts, seeds, mnemonics, private keys, raw keypairs, signer material, credentials, authorization headers, payloads, signatures, exported keys, report paths, or local secret paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-custody-production-proof-bundle.ts [--out <path>]

Writes a non-networked ignored local bundle for production custody proof gates.
The command writes a report template plus a proof plan and readiness artifact, then summarizes only blocker codes, command order, required report fields, and safety boundaries.`;

export async function writeCustodyProductionProofBundle(
  options: WriteCustodyProductionProofBundleOptions = {},
): Promise<CustodyProductionProofBundle> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const outFile = options.outFile ?? DEFAULT_OUT_FILE;
  const planOutFile = options.planOutFile ?? DEFAULT_PLAN_OUT_FILE;
  const readinessOutFile = options.readinessOutFile ?? DEFAULT_READINESS_OUT_FILE;
  const templateOutFile = options.templateOutFile ?? DEFAULT_TEMPLATE_OUT_FILE;

  await writeOperatorReportTemplate({
    cwd,
    kind: "custody-production",
    now,
    outFile: templateOutFile,
  });
  await writeCustodyProductionProofPlan({
    cwd,
    env: options.env,
    now,
    outFile: planOutFile,
  });
  await writeCustodyReadinessArtifact({
    cwd,
    env: options.env,
    now,
    outFile: readinessOutFile,
    scripts: options.scripts,
  });

  const readiness = await checkCustodyReadiness({
    cwd,
    env: options.env,
    now,
    scripts: options.scripts,
  });
  const checks = readiness.checks.map((check) => stripCheck(check));
  const blockers = checks.filter((check) => check.status !== "proven-local" && check.status !== "ready-approval");
  const readyApproval = checks.filter((check) => check.status === "ready-approval");

  const bundle: CustodyProductionProofBundle = {
    schemaVersion: 1,
    kind: "vallum.custody-production-proof-bundle",
    generatedAt: now.toISOString(),
    status: readiness.productionReady ? "ready-for-approval" : "blocked",
    localProofOk: readiness.localProofOk,
    productionReady: readiness.productionReady,
    templateArtifacts: [
      {
        id: "custody-production",
        path: templateOutFile,
        acceptedReportEnv: "CUSTODY_PRODUCTION_REPORT",
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

function stripCheck(check: CustodyReadinessCheck): CustodyProductionProofBundleCheck {
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
}): readonly CustodyProductionProofBundleStep[] {
  return [
    {
      id: "write-custody-template",
      command: `npm run operator:write-report-template -- --kind custody-production --out ${input.templateOutFile}`,
      contactsCustodySystem: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-custody-production-proof-plan",
      command: `npm run custody:write-production-proof-plan -- --out ${input.planOutFile}`,
      contactsCustodySystem: false,
      requiresOperatorApproval: false,
      dependsOn: ["write-custody-template"],
    },
    {
      id: "write-custody-readiness-artifact",
      command: `npm run proof:custody-readiness -- --out ${input.readinessOutFile}`,
      contactsCustodySystem: false,
      requiresOperatorApproval: false,
      dependsOn: ["write-custody-production-proof-plan"],
    },
    {
      id: "run-local-account-signer-reference-tests",
      command: "node --import tsx --test packages/accounts/src/accounts.test.ts",
      contactsCustodySystem: false,
      requiresOperatorApproval: false,
    },
    {
      id: "run-approved-production-custody-review",
      command: "operator-approved signer-reference, KMS/external signer, module validation, operator access, lifecycle, recovery/export, backup/restore, rotation/revocation, audit, legal/security, and incident-response review",
      contactsCustodySystem: true,
      requiresOperatorApproval: true,
      dependsOn: ["run-local-account-signer-reference-tests", "write-custody-template"],
    },
    {
      id: "check-custody-readiness",
      command: `npm run proof:custody-readiness -- --out ${input.readinessOutFile}`,
      contactsCustodySystem: false,
      requiresOperatorApproval: false,
      dependsOn: ["run-approved-production-custody-review"],
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

  const bundle = await writeCustodyProductionProofBundle({
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
