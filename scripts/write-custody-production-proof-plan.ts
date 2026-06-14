import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkCustodyReadiness,
  type CustodyReadinessCheck,
  type CustodyReadinessReport,
} from "./check-custody-readiness.js";

export interface CustodyProductionProofPlanCommand {
  readonly id: string;
  readonly command: string;
  readonly contactsCustodySystem: boolean;
  readonly requiresOperatorApproval: boolean;
}

export interface CustodyProductionProofPlanCheck {
  readonly id: string;
  readonly status: CustodyReadinessCheck["status"];
  readonly code: string;
  readonly next: string;
}

export interface CustodyProductionProofPlan {
  readonly schemaVersion: 1;
  readonly kind: "agentic-gaskit.custody-production-proof-plan";
  readonly generatedAt: string;
  readonly localProofOk: boolean;
  readonly productionReady: boolean;
  readonly status: "blocked" | "ready-for-approval";
  readonly commands: readonly CustodyProductionProofPlanCommand[];
  readonly blockerCodes: readonly string[];
  readonly readyApprovalCodes: readonly string[];
  readonly checks: readonly CustodyProductionProofPlanCheck[];
  readonly boundaries: readonly string[];
  readonly requiredOperatorInputs: readonly string[];
  readonly requiredStructuredReportFields: readonly string[];
  readonly requiredStructuredReportCheckIds: readonly string[];
}

export interface WriteCustodyProductionProofPlanOptions {
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
  "CUSTODY_PRODUCTION_REPORT",
] as const;

const REQUIRED_STRUCTURED_REPORT_FIELDS = [
  "schemaVersion",
  "kind",
  "result",
  "observedAt",
  "custodyMode",
  "checks",
] as const;

const REQUIRED_STRUCTURED_REPORT_CHECK_IDS = [
  "signer-reference-contract-review",
  "no-agent-secret-exposure-review",
  "kms-external-signer-review",
  "recovery-export-review",
  "rotation-revocation-review",
  "audit-logging-review",
  "legal-security-review",
  "incident-response-review",
] as const;

const PLAN_COMMANDS: readonly CustodyProductionProofPlanCommand[] = [
  {
    id: "run-local-account-signer-reference-tests",
    command: "node --import tsx --test packages/accounts/src/accounts.test.ts",
    contactsCustodySystem: false,
    requiresOperatorApproval: false,
  },
  {
    id: "run-approved-production-custody-review",
    command: "operator-approved signer-reference, KMS/external signer, recovery/export, rotation/revocation, audit, legal/security, and incident-response review",
    contactsCustodySystem: true,
    requiresOperatorApproval: true,
  },
  {
    id: "write-structured-custody-report",
    command: "write status-only JSON report to an ignored local path",
    contactsCustodySystem: false,
    requiresOperatorApproval: true,
  },
  {
    id: "check-custody-readiness",
    command: "npm run proof:custody-readiness",
    contactsCustodySystem: false,
    requiresOperatorApproval: false,
  },
] as const;

const BOUNDARIES = [
  "This plan is non-networked and does not prove production custody, KMS, recovery, staking, bonding, slashing, or signer-operation readiness.",
  "Only the operator-approved custody review may contact KMS, external signer, custody provider, or live wallet infrastructure, and it requires explicit operator approval.",
  "Do not commit reports, seeds, mnemonics, private keys, raw keypairs, signer material, credentials, authorization headers, payloads, signatures, exported keys, or local secret paths.",
  "ready-for-approval means a redacted structured report is reviewable; it is not production custody approval by itself.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-custody-production-proof-plan.ts [--out <path>]

Writes a redacted non-networked custody production proof plan from current readiness gates.
The plan prints command names, blocker codes, required report fields, and operator input names only.`;

export async function writeCustodyProductionProofPlan(
  options: WriteCustodyProductionProofPlanOptions = {},
): Promise<CustodyProductionProofPlan> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkCustodyReadiness({
    cwd,
    env: options.env,
    now: options.now,
  });
  const plan = buildCustodyProductionProofPlan(report, options.now ?? new Date());
  if (options.outFile) {
    const outFile = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, `${formatCustodyProductionProofPlan(plan)}\n`, { mode: 0o600 });
  }
  return plan;
}

export function buildCustodyProductionProofPlan(
  report: CustodyReadinessReport,
  now: Date = new Date(),
): CustodyProductionProofPlan {
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
    kind: "agentic-gaskit.custody-production-proof-plan",
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

export function formatCustodyProductionProofPlan(plan: CustodyProductionProofPlan): string {
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

  const plan = await writeCustodyProductionProofPlan({ outFile: options.outFile });
  console.log(formatCustodyProductionProofPlan(plan));
  if (options.outFile) {
    console.log("wrotePlan=true");
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
