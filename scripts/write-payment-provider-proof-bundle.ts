import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkPaymentProviderReadiness,
  type PaymentProviderReadinessCheck,
  type PaymentProviderReadinessOptions,
  writePaymentProviderReadinessArtifact,
} from "./check-payment-provider-readiness.js";
import { writeOperatorReportTemplate } from "./write-operator-report-template.js";
import { writePaymentProviderProofPlan } from "./write-payment-provider-proof-plan.js";

export interface PaymentProviderProofBundleTemplate {
  readonly id: "payment-provider-live";
  readonly path: string;
  readonly acceptedReportEnv: "PAYMENT_PROVIDER_LIVE_REPORT";
}

export interface PaymentProviderProofBundleStep {
  readonly id: string;
  readonly command: string;
  readonly contactsPaymentProvider: boolean;
  readonly requiresOperatorApproval: boolean;
  readonly dependsOn?: readonly string[];
}

export interface PaymentProviderProofBundleCheck {
  readonly id: string;
  readonly status: PaymentProviderReadinessCheck["status"];
  readonly code: string;
  readonly evidence?: string;
  readonly next: string;
}

export interface PaymentProviderProofBundle {
  readonly schemaVersion: 1;
  readonly kind: "agentrail.payment-provider-proof-bundle";
  readonly generatedAt: string;
  readonly status: "blocked" | "ready-for-approval";
  readonly localProofOk: boolean;
  readonly liveReady: boolean;
  readonly templateArtifacts: readonly PaymentProviderProofBundleTemplate[];
  readonly planArtifact: string;
  readonly readinessArtifact: string;
  readonly blockerCodes: readonly string[];
  readonly readyApprovalCodes: readonly string[];
  readonly checks: readonly PaymentProviderProofBundleCheck[];
  readonly requiredOperatorInputs: readonly string[];
  readonly requiredStructuredReportFields: readonly string[];
  readonly requiredStructuredReportCheckIds: readonly string[];
  readonly requiredEvidenceArtifacts: readonly string[];
  readonly steps: readonly PaymentProviderProofBundleStep[];
  readonly boundaries: readonly string[];
}

export interface WritePaymentProviderProofBundleOptions extends PaymentProviderReadinessOptions {
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

const DEFAULT_OUT_FILE = "tmp/agentrail/payment-provider-proof-bundle.json";
const DEFAULT_PLAN_OUT_FILE = "tmp/agentrail/payment-provider-proof-plan.json";
const DEFAULT_READINESS_OUT_FILE = "tmp/agentrail/payment-provider-readiness.json";
const DEFAULT_TEMPLATE_OUT_FILE = "tmp/agentrail/payment-provider-live-report-template.json";

const REQUIRED_OPERATOR_INPUTS = [
  "PAYMENT_PROVIDER_LIVE_REPORT",
] as const;

const REQUIRED_STRUCTURED_REPORT_FIELDS = [
  "schemaVersion",
  "kind",
  "result",
  "observedAt",
  "providerKinds",
  "checks",
] as const;

const REQUIRED_STRUCTURED_REPORT_CHECK_IDS = [
  "x402-verify",
  "x402-settle",
  "ap2-checkout-receipt",
  "ap2-payment-receipt",
  "redaction-review",
] as const;

const REQUIRED_EVIDENCE_ARTIFACTS = [
  "sanitized payment-provider structured report",
  "x402 facilitator verify result",
  "x402 facilitator settle result",
  "AP2 checkout receipt review",
  "AP2 payment receipt review",
  "redaction review result",
] as const;

const BOUNDARIES = [
  "This bundle writer is non-networked and only writes an ignored local report template, payment-provider proof plan, readiness artifact, and bundle summary.",
  "The generated template is a pending-operator-proof artifact; it does not clear payment-provider readiness by itself.",
  "Only dedicated operator-approved proof steps may contact payment providers, facilitators, processors, AP2 participants, settlement systems, or dispute systems.",
  "Do not commit generated bundle artifacts, payment credentials, authorization headers, signatures, payment instruments, raw payloads, response bodies, provider account details, settlement ids, report paths, or local secret paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-payment-provider-proof-bundle.ts [--out <path>]

Writes a non-networked ignored local bundle for live payment-provider proof gates.
The command writes a report template plus a proof plan and readiness artifact, then summarizes only blocker codes, command order, required report fields, and safety boundaries.`;

export async function writePaymentProviderProofBundle(
  options: WritePaymentProviderProofBundleOptions = {},
): Promise<PaymentProviderProofBundle> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const outFile = options.outFile ?? DEFAULT_OUT_FILE;
  const planOutFile = options.planOutFile ?? DEFAULT_PLAN_OUT_FILE;
  const readinessOutFile = options.readinessOutFile ?? DEFAULT_READINESS_OUT_FILE;
  const templateOutFile = options.templateOutFile ?? DEFAULT_TEMPLATE_OUT_FILE;

  await writeOperatorReportTemplate({
    cwd,
    kind: "payment-provider-live",
    now,
    outFile: templateOutFile,
  });
  await writePaymentProviderProofPlan({
    cwd,
    env: options.env,
    now,
    outFile: planOutFile,
  });
  await writePaymentProviderReadinessArtifact({
    cwd,
    env: options.env,
    now,
    outFile: readinessOutFile,
  });

  const readiness = await checkPaymentProviderReadiness({
    cwd,
    env: options.env,
    now,
  });
  const checks = readiness.checks.map((check) => stripCheck(check));
  const blockers = checks.filter((check) => check.status !== "proven-local" && check.status !== "ready-approval");
  const readyApproval = checks.filter((check) => check.status === "ready-approval");

  const bundle: PaymentProviderProofBundle = {
    schemaVersion: 1,
    kind: "agentrail.payment-provider-proof-bundle",
    generatedAt: now.toISOString(),
    status: readiness.liveReady ? "ready-for-approval" : "blocked",
    localProofOk: readiness.localProofOk,
    liveReady: readiness.liveReady,
    templateArtifacts: [
      {
        id: "payment-provider-live",
        path: templateOutFile,
        acceptedReportEnv: "PAYMENT_PROVIDER_LIVE_REPORT",
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

function stripCheck(check: PaymentProviderReadinessCheck): PaymentProviderProofBundleCheck {
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
}): readonly PaymentProviderProofBundleStep[] {
  return [
    {
      id: "write-payment-provider-template",
      command: `npm run operator:write-report-template -- --kind payment-provider-live --out ${input.templateOutFile}`,
      contactsPaymentProvider: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-payment-provider-proof-plan",
      command: `npm run payment:write-provider-proof-plan -- --out ${input.planOutFile}`,
      contactsPaymentProvider: false,
      requiresOperatorApproval: false,
      dependsOn: ["write-payment-provider-template"],
    },
    {
      id: "write-payment-provider-readiness-artifact",
      command: `npm run proof:payment-provider-readiness -- --out ${input.readinessOutFile}`,
      contactsPaymentProvider: false,
      requiresOperatorApproval: false,
      dependsOn: ["write-payment-provider-proof-plan"],
    },
    {
      id: "run-local-standards-proof",
      command: "node --import tsx --test packages/manifest/src/x402Mapping.test.ts packages/manifest/src/ap2Mapping.test.ts packages/receipts/src/x402Receipt.test.ts packages/receipts/src/ap2Receipt.test.ts packages/standards/src/x402.test.ts packages/standards/src/ap2.test.ts",
      contactsPaymentProvider: false,
      requiresOperatorApproval: false,
    },
    {
      id: "run-approved-x402-provider-proof",
      command: "operator-approved x402 facilitator verify and settle proof",
      contactsPaymentProvider: true,
      requiresOperatorApproval: true,
      dependsOn: ["run-local-standards-proof", "write-payment-provider-template"],
    },
    {
      id: "run-approved-ap2-provider-proof",
      command: "operator-approved AP2 checkout and payment receipt proof",
      contactsPaymentProvider: true,
      requiresOperatorApproval: true,
      dependsOn: ["run-local-standards-proof", "write-payment-provider-template"],
    },
    {
      id: "check-payment-provider-readiness",
      command: `npm run proof:payment-provider-readiness -- --out ${input.readinessOutFile}`,
      contactsPaymentProvider: false,
      requiresOperatorApproval: false,
      dependsOn: ["run-approved-x402-provider-proof", "run-approved-ap2-provider-proof"],
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

  const bundle = await writePaymentProviderProofBundle({
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
