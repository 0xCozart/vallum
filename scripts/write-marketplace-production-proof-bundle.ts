import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkMarketplaceReadiness,
  type MarketplaceReadinessCheck,
  type MarketplaceReadinessOptions,
  writeMarketplaceReadinessArtifact,
} from "./check-marketplace-readiness.js";
import { writeMarketplaceProductionProofPlan } from "./write-marketplace-production-proof-plan.js";
import { writeOperatorReportTemplate } from "./write-operator-report-template.js";

export interface MarketplaceProductionProofBundleTemplate {
  readonly id: "marketplace-production";
  readonly path: string;
  readonly acceptedReportEnv: "MARKETPLACE_PRODUCTION_REPORT";
}

export interface MarketplaceProductionProofBundleStep {
  readonly id: string;
  readonly command: string;
  readonly contactsMarketplaceSystem: boolean;
  readonly requiresOperatorApproval: boolean;
  readonly dependsOn?: readonly string[];
}

export interface MarketplaceProductionProofBundleCheck {
  readonly id: string;
  readonly status: MarketplaceReadinessCheck["status"];
  readonly code: string;
  readonly evidence?: string;
  readonly next: string;
}

export interface MarketplaceProductionProofBundle {
  readonly schemaVersion: 1;
  readonly kind: "agentrail.marketplace-production-proof-bundle";
  readonly generatedAt: string;
  readonly status: "blocked" | "ready-for-approval";
  readonly localProofOk: boolean;
  readonly productionReady: boolean;
  readonly templateArtifacts: readonly MarketplaceProductionProofBundleTemplate[];
  readonly planArtifact: string;
  readonly readinessArtifact: string;
  readonly blockerCodes: readonly string[];
  readonly readyApprovalCodes: readonly string[];
  readonly checks: readonly MarketplaceProductionProofBundleCheck[];
  readonly requiredOperatorInputs: readonly string[];
  readonly requiredStructuredReportFields: readonly string[];
  readonly requiredStructuredReportCheckIds: readonly string[];
  readonly requiredEvidenceArtifacts: readonly string[];
  readonly steps: readonly MarketplaceProductionProofBundleStep[];
  readonly boundaries: readonly string[];
}

export interface WriteMarketplaceProductionProofBundleOptions extends MarketplaceReadinessOptions {
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

const DEFAULT_OUT_FILE = "tmp/agentrail/marketplace-production-proof-bundle.json";
const DEFAULT_PLAN_OUT_FILE = "tmp/agentrail/marketplace-production-proof-plan.json";
const DEFAULT_READINESS_OUT_FILE = "tmp/agentrail/marketplace-readiness.json";
const DEFAULT_TEMPLATE_OUT_FILE = "tmp/agentrail/marketplace-production-report-template.json";

const REQUIRED_OPERATOR_INPUTS = [
  "MARKETPLACE_PRODUCTION_REPORT",
] as const;

const REQUIRED_STRUCTURED_REPORT_FIELDS = [
  "schemaVersion",
  "kind",
  "result",
  "observedAt",
  "environment",
  "checks",
] as const;

const REQUIRED_STRUCTURED_REPORT_CHECK_IDS = [
  "provider-onboarding-review",
  "provider-verification-review",
  "moderation-abuse-review",
  "session-auth-review",
  "receipt-access-review",
  "payment-settlement-review",
  "dispute-workflow-review",
  "operations-incident-review",
] as const;

const REQUIRED_EVIDENCE_ARTIFACTS = [
  "sanitized marketplace production structured report",
  "provider onboarding review result",
  "provider verification review result",
  "moderation and abuse review result",
  "session auth review result",
  "payment settlement review result",
  "dispute workflow review result",
  "operations and incident review result",
] as const;

const BOUNDARIES = [
  "This bundle writer is non-networked and only writes an ignored local report template, marketplace production proof plan, readiness artifact, and bundle summary.",
  "The generated template is a pending-operator-proof artifact; it does not clear marketplace readiness by itself.",
  "Only a dedicated operator-approved production marketplace review may contact marketplace systems, provider systems, payment systems, public endpoints, IOTA services, or Gas Station endpoints.",
  "Do not commit generated bundle artifacts, provider secrets, session data, payment credentials, authorization headers, raw payloads, response bodies, moderation payloads, private prompts, signatures, report paths, or local secret paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-marketplace-production-proof-bundle.ts [--out <path>]

Writes a non-networked ignored local bundle for production marketplace proof gates.
The command writes a report template plus a proof plan and readiness artifact, then summarizes only blocker codes, command order, required report fields, and safety boundaries.`;

export async function writeMarketplaceProductionProofBundle(
  options: WriteMarketplaceProductionProofBundleOptions = {},
): Promise<MarketplaceProductionProofBundle> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const outFile = options.outFile ?? DEFAULT_OUT_FILE;
  const planOutFile = options.planOutFile ?? DEFAULT_PLAN_OUT_FILE;
  const readinessOutFile = options.readinessOutFile ?? DEFAULT_READINESS_OUT_FILE;
  const templateOutFile = options.templateOutFile ?? DEFAULT_TEMPLATE_OUT_FILE;

  await writeOperatorReportTemplate({
    cwd,
    kind: "marketplace-production",
    now,
    outFile: templateOutFile,
  });
  await writeMarketplaceProductionProofPlan({
    cwd,
    env: options.env,
    now,
    outFile: planOutFile,
  });
  await writeMarketplaceReadinessArtifact({
    cwd,
    env: options.env,
    now,
    outFile: readinessOutFile,
    scripts: options.scripts,
  });

  const readiness = await checkMarketplaceReadiness({
    cwd,
    env: options.env,
    now,
    scripts: options.scripts,
  });
  const checks = readiness.checks.map((check) => stripCheck(check));
  const blockers = checks.filter((check) => check.status !== "proven-local" && check.status !== "ready-approval");
  const readyApproval = checks.filter((check) => check.status === "ready-approval");

  const bundle: MarketplaceProductionProofBundle = {
    schemaVersion: 1,
    kind: "agentrail.marketplace-production-proof-bundle",
    generatedAt: now.toISOString(),
    status: readiness.productionReady ? "ready-for-approval" : "blocked",
    localProofOk: readiness.localProofOk,
    productionReady: readiness.productionReady,
    templateArtifacts: [
      {
        id: "marketplace-production",
        path: templateOutFile,
        acceptedReportEnv: "MARKETPLACE_PRODUCTION_REPORT",
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

function stripCheck(check: MarketplaceReadinessCheck): MarketplaceProductionProofBundleCheck {
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
}): readonly MarketplaceProductionProofBundleStep[] {
  return [
    {
      id: "write-marketplace-template",
      command: `npm run operator:write-report-template -- --kind marketplace-production --out ${input.templateOutFile}`,
      contactsMarketplaceSystem: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-marketplace-production-proof-plan",
      command: `npm run marketplace:write-production-proof-plan -- --out ${input.planOutFile}`,
      contactsMarketplaceSystem: false,
      requiresOperatorApproval: false,
      dependsOn: ["write-marketplace-template"],
    },
    {
      id: "write-marketplace-readiness-artifact",
      command: `npm run proof:marketplace-readiness -- --out ${input.readinessOutFile}`,
      contactsMarketplaceSystem: false,
      requiresOperatorApproval: false,
      dependsOn: ["write-marketplace-production-proof-plan"],
    },
    {
      id: "run-local-marketplace-read-model-tests",
      command: "node --import tsx --test packages/marketplace/src/marketplace.test.ts",
      contactsMarketplaceSystem: false,
      requiresOperatorApproval: false,
    },
    {
      id: "run-local-marketplace-smoke",
      command: "npm run smoke:marketplace-read-model",
      contactsMarketplaceSystem: false,
      requiresOperatorApproval: false,
      dependsOn: ["run-local-marketplace-read-model-tests"],
    },
    {
      id: "run-approved-production-marketplace-review",
      command: "operator-approved provider onboarding, verification, moderation, auth, settlement, dispute, and operations review",
      contactsMarketplaceSystem: true,
      requiresOperatorApproval: true,
      dependsOn: ["run-local-marketplace-smoke", "write-marketplace-template"],
    },
    {
      id: "check-marketplace-readiness",
      command: `npm run proof:marketplace-readiness -- --out ${input.readinessOutFile}`,
      contactsMarketplaceSystem: false,
      requiresOperatorApproval: false,
      dependsOn: ["run-approved-production-marketplace-review"],
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

  const bundle = await writeMarketplaceProductionProofBundle({
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
