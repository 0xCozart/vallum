import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkPaymentProviderReadiness,
  type PaymentProviderReadinessCheck,
  type PaymentProviderReadinessReport,
} from "./check-payment-provider-readiness.js";

export interface PaymentProviderProofPlanCommand {
  readonly id: string;
  readonly command: string;
  readonly contactsPaymentProvider: boolean;
  readonly requiresOperatorApproval: boolean;
}

export interface PaymentProviderProofPlanCheck {
  readonly id: string;
  readonly status: PaymentProviderReadinessCheck["status"];
  readonly code: string;
  readonly next: string;
}

export interface PaymentProviderProofPlan {
  readonly schemaVersion: 1;
  readonly kind: "vallum.payment-provider-proof-plan";
  readonly generatedAt: string;
  readonly localProofOk: boolean;
  readonly liveReady: boolean;
  readonly status: "blocked" | "ready-for-approval";
  readonly commands: readonly PaymentProviderProofPlanCommand[];
  readonly blockerCodes: readonly string[];
  readonly readyApprovalCodes: readonly string[];
  readonly checks: readonly PaymentProviderProofPlanCheck[];
  readonly boundaries: readonly string[];
  readonly requiredOperatorInputs: readonly string[];
  readonly requiredStructuredReportFields: readonly string[];
  readonly requiredStructuredReportCheckIds: readonly string[];
}

export interface WritePaymentProviderProofPlanOptions {
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

const PLAN_COMMANDS: readonly PaymentProviderProofPlanCommand[] = [
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
  },
  {
    id: "run-approved-ap2-provider-proof",
    command: "operator-approved AP2 checkout and payment receipt proof",
    contactsPaymentProvider: true,
    requiresOperatorApproval: true,
  },
  {
    id: "write-structured-live-report",
    command: "write status-only JSON report to an ignored local path",
    contactsPaymentProvider: false,
    requiresOperatorApproval: true,
  },
  {
    id: "check-payment-provider-readiness",
    command: "npm run proof:payment-provider-readiness",
    contactsPaymentProvider: false,
    requiresOperatorApproval: false,
  },
] as const;

const BOUNDARIES = [
  "This plan is non-networked and does not prove live payment/provider settlement.",
  "Only the operator-approved provider proof steps contact payment providers, and they require explicit operator approval.",
  "Do not commit reports, provider endpoints, payment credentials, authorization headers, payment instruments, raw payloads, response bodies, settlement ids, private keys, bearer tokens, or local secret paths.",
  "ready-for-approval means a redacted structured report is reviewable; it is not production payment processing approval by itself.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-payment-provider-proof-plan.ts [--out <path>]

Writes a redacted non-networked payment-provider proof plan from current readiness gates.
The plan prints command names, blocker codes, required report fields, and operator input names only.`;

export async function writePaymentProviderProofPlan(
  options: WritePaymentProviderProofPlanOptions = {},
): Promise<PaymentProviderProofPlan> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkPaymentProviderReadiness({
    cwd,
    env: options.env,
    now: options.now,
  });
  const plan = buildPaymentProviderProofPlan(report, options.now ?? new Date());
  if (options.outFile) {
    const outFile = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, `${formatPaymentProviderProofPlan(plan)}\n`, { mode: 0o600 });
  }
  return plan;
}

export function buildPaymentProviderProofPlan(
  report: PaymentProviderReadinessReport,
  now: Date = new Date(),
): PaymentProviderProofPlan {
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
    kind: "vallum.payment-provider-proof-plan",
    generatedAt: now.toISOString(),
    localProofOk: report.localProofOk,
    liveReady: report.liveReady,
    status: report.liveReady ? "ready-for-approval" : "blocked",
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

export function formatPaymentProviderProofPlan(plan: PaymentProviderProofPlan): string {
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

  const plan = await writePaymentProviderProofPlan({ outFile: options.outFile });
  console.log(formatPaymentProviderProofPlan(plan));
  if (options.outFile) {
    console.log("wrotePlan=true");
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
