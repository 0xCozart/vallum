import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkMarketplaceReadiness,
  type MarketplaceReadinessCheck,
  type MarketplaceReadinessReport,
} from "./check-marketplace-readiness.js";

export interface MarketplaceProductionProofPlanCommand {
  readonly id: string;
  readonly command: string;
  readonly contactsMarketplaceSystem: boolean;
  readonly requiresOperatorApproval: boolean;
}

export interface MarketplaceProductionProofPlanCheck {
  readonly id: string;
  readonly status: MarketplaceReadinessCheck["status"];
  readonly code: string;
  readonly next: string;
}

export interface MarketplaceProductionProofPlan {
  readonly schemaVersion: 1;
  readonly kind: "agentic-gaskit.marketplace-production-proof-plan";
  readonly generatedAt: string;
  readonly localProofOk: boolean;
  readonly productionReady: boolean;
  readonly status: "blocked" | "ready-for-approval";
  readonly commands: readonly MarketplaceProductionProofPlanCommand[];
  readonly blockerCodes: readonly string[];
  readonly readyApprovalCodes: readonly string[];
  readonly checks: readonly MarketplaceProductionProofPlanCheck[];
  readonly boundaries: readonly string[];
  readonly requiredOperatorInputs: readonly string[];
  readonly requiredStructuredReportFields: readonly string[];
  readonly requiredStructuredReportCheckIds: readonly string[];
}

export interface WriteMarketplaceProductionProofPlanOptions {
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

const PLAN_COMMANDS: readonly MarketplaceProductionProofPlanCommand[] = [
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
  },
  {
    id: "run-approved-production-marketplace-review",
    command: "operator-approved provider onboarding, verification, moderation, auth, settlement, dispute, and operations review",
    contactsMarketplaceSystem: true,
    requiresOperatorApproval: true,
  },
  {
    id: "write-structured-marketplace-report",
    command: "write status-only JSON report to an ignored local path",
    contactsMarketplaceSystem: false,
    requiresOperatorApproval: true,
  },
  {
    id: "check-marketplace-readiness",
    command: "npm run proof:marketplace-readiness",
    contactsMarketplaceSystem: false,
    requiresOperatorApproval: false,
  },
] as const;

const BOUNDARIES = [
  "This plan is non-networked and does not prove production marketplace operation.",
  "Only the operator-approved production marketplace review may contact production or testnet marketplace systems, provider systems, payment systems, or public endpoints, and it requires explicit operator approval.",
  "Do not commit reports, provider credentials, session tokens, authorization headers, payment instruments, raw payloads, response bodies, moderation payloads, provider secrets, private prompts, signatures, or local secret paths.",
  "ready-for-approval means a redacted structured report is reviewable; it is not production marketplace approval by itself.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-marketplace-production-proof-plan.ts [--out <path>]

Writes a redacted non-networked marketplace production proof plan from current readiness gates.
The plan prints command names, blocker codes, required report fields, and operator input names only.`;

export async function writeMarketplaceProductionProofPlan(
  options: WriteMarketplaceProductionProofPlanOptions = {},
): Promise<MarketplaceProductionProofPlan> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkMarketplaceReadiness({
    cwd,
    env: options.env,
    now: options.now,
  });
  const plan = buildMarketplaceProductionProofPlan(report, options.now ?? new Date());
  if (options.outFile) {
    const outFile = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, `${formatMarketplaceProductionProofPlan(plan)}\n`, { mode: 0o600 });
  }
  return plan;
}

export function buildMarketplaceProductionProofPlan(
  report: MarketplaceReadinessReport,
  now: Date = new Date(),
): MarketplaceProductionProofPlan {
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
    kind: "agentic-gaskit.marketplace-production-proof-plan",
    generatedAt: now.toISOString(),
    localProofOk: report.localProofOk,
    productionReady: report.productionReady,
    status: report.productionReady ? "ready-for-approval" : "blocked",
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

export function formatMarketplaceProductionProofPlan(plan: MarketplaceProductionProofPlan): string {
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

  const plan = await writeMarketplaceProductionProofPlan({ outFile: options.outFile });
  console.log(formatMarketplaceProductionProofPlan(plan));
  if (options.outFile) {
    console.log("wrotePlan=true");
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
