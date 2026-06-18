import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkDeviceAccessSafetyReadiness,
  REQUIRED_DEVICE_ACCESS_SAFETY_CHECKS,
  type DeviceAccessSafetyReadinessCheck,
  type DeviceAccessSafetyReadinessReport,
} from "./check-device-access-safety-readiness.js";

export interface DeviceAccessSafetyProofPlanCommand {
  readonly id: string;
  readonly command: string;
  readonly contactsPhysicalDevice: boolean;
  readonly requiresOwnerApproval: boolean;
}

export interface DeviceAccessSafetyProofPlanCheck {
  readonly id: string;
  readonly status: DeviceAccessSafetyReadinessCheck["status"];
  readonly code: string;
  readonly next: string;
}

export interface DeviceAccessSafetyProofPlan {
  readonly schemaVersion: 1;
  readonly kind: "vallum.device-access-safety-proof-plan";
  readonly generatedAt: string;
  readonly localProofOk: boolean;
  readonly safetyReady: boolean;
  readonly status: "blocked" | "ready-for-approval";
  readonly commands: readonly DeviceAccessSafetyProofPlanCommand[];
  readonly blockerCodes: readonly string[];
  readonly readyApprovalCodes: readonly string[];
  readonly checks: readonly DeviceAccessSafetyProofPlanCheck[];
  readonly boundaries: readonly string[];
  readonly requiredOperatorInputs: readonly string[];
  readonly requiredStructuredReportFields: readonly string[];
  readonly requiredStructuredReportCheckIds: readonly string[];
}

export interface WriteDeviceAccessSafetyProofPlanOptions {
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
  "DEVICE_ACCESS_SAFETY_REPORT",
] as const;

const REQUIRED_STRUCTURED_REPORT_FIELDS = [
  "schemaVersion",
  "kind",
  "result",
  "observedAt",
  "deviceAccessMode",
  "checks",
  "hazardReview",
  "accountabilityReview",
  "authorizationReview",
  "revocationReview",
  "expiryReview",
  "auditPrivacyReview",
  "incidentReview",
  "credentialReview",
  "proofPathReview",
  "legalReview",
] as const;

const PLAN_COMMANDS: readonly DeviceAccessSafetyProofPlanCommand[] = [
  {
    id: "run-local-safety-gate-tests",
    command: "node --import tsx --test scripts/roadmap-safety.test.ts scripts/device-access-safety-readiness.test.ts",
    contactsPhysicalDevice: false,
    requiresOwnerApproval: false,
  },
  {
    id: "run-approved-physical-device-safety-review",
    command: "owner-approved hazard, provider accountability, authorization, revocation, emergency-stop, privacy, incident-response, credential, safe proof-path, and legal review",
    contactsPhysicalDevice: false,
    requiresOwnerApproval: true,
  },
  {
    id: "write-structured-device-access-safety-report",
    command: "write status-only JSON report to an ignored local path",
    contactsPhysicalDevice: false,
    requiresOwnerApproval: true,
  },
  {
    id: "check-device-access-safety-readiness",
    command: "npm run proof:device-access-safety-readiness",
    contactsPhysicalDevice: false,
    requiresOwnerApproval: false,
  },
] as const;

const BOUNDARIES = [
  "This plan is non-networked and does not prove physical-device, actuator, access-control, vehicle, medical, industrial, lock, or safety-critical readiness.",
  "No step in this plan may contact or operate a physical device; physical-device proof requires a separate owner-approved design and report first.",
  "Do not commit reports, device credentials, access tokens, authorization headers, raw payloads, response bodies, incident private data, or local secret paths.",
  "ready-for-approval means a redacted structured report is reviewable; it is not physical-device operation approval by itself.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-device-access-safety-proof-plan.ts [--out <path>]

Writes a redacted non-networked physical-device safety proof plan from current readiness gates.`;

export async function writeDeviceAccessSafetyProofPlan(
  options: WriteDeviceAccessSafetyProofPlanOptions = {},
): Promise<DeviceAccessSafetyProofPlan> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkDeviceAccessSafetyReadiness({
    cwd,
    env: options.env,
    now: options.now,
  });
  const plan = buildDeviceAccessSafetyProofPlan(report, options.now ?? new Date());
  if (options.outFile) {
    const outFile = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, `${formatDeviceAccessSafetyProofPlan(plan)}\n`, { mode: 0o600 });
  }
  return plan;
}

export function buildDeviceAccessSafetyProofPlan(
  report: DeviceAccessSafetyReadinessReport,
  now: Date = new Date(),
): DeviceAccessSafetyProofPlan {
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
    kind: "vallum.device-access-safety-proof-plan",
    generatedAt: now.toISOString(),
    localProofOk: report.localProofOk,
    safetyReady: report.safetyReady,
    status: report.safetyReady ? "ready-for-approval" : "blocked",
    commands: PLAN_COMMANDS,
    blockerCodes: blockers.map((check) => check.code),
    readyApprovalCodes: readyApproval.map((check) => check.code),
    checks,
    boundaries: BOUNDARIES,
    requiredOperatorInputs: REQUIRED_OPERATOR_INPUTS,
    requiredStructuredReportFields: REQUIRED_STRUCTURED_REPORT_FIELDS,
    requiredStructuredReportCheckIds: REQUIRED_DEVICE_ACCESS_SAFETY_CHECKS,
  };
}

export function formatDeviceAccessSafetyProofPlan(plan: DeviceAccessSafetyProofPlan): string {
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

  const plan = await writeDeviceAccessSafetyProofPlan({ outFile: options.outFile });
  console.log(formatDeviceAccessSafetyProofPlan(plan));
  if (options.outFile) console.log("wrotePlan=true");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
