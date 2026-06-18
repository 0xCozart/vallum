import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkDeviceAccessSafetyReadiness,
  REQUIRED_DEVICE_ACCESS_SAFETY_CHECKS,
  type DeviceAccessSafetyReadinessCheck,
  type DeviceAccessSafetyReadinessOptions,
  writeDeviceAccessSafetyReadinessArtifact,
} from "./check-device-access-safety-readiness.js";
import { writeDeviceAccessSafetyProofPlan } from "./write-device-access-safety-proof-plan.js";
import { writeOperatorReportTemplate } from "./write-operator-report-template.js";

export interface DeviceAccessSafetyProofBundleTemplate {
  readonly id: "device-access-safety";
  readonly path: string;
  readonly acceptedReportEnv: "DEVICE_ACCESS_SAFETY_REPORT";
}

export interface DeviceAccessSafetyProofBundleStep {
  readonly id: string;
  readonly command: string;
  readonly contactsPhysicalDevice: boolean;
  readonly requiresOwnerApproval: boolean;
  readonly dependsOn?: readonly string[];
}

export interface DeviceAccessSafetyProofBundleCheck {
  readonly id: string;
  readonly status: DeviceAccessSafetyReadinessCheck["status"];
  readonly code: string;
  readonly evidence?: string;
  readonly next: string;
}

export interface DeviceAccessSafetyProofBundle {
  readonly schemaVersion: 1;
  readonly kind: "vallum.device-access-safety-proof-bundle";
  readonly generatedAt: string;
  readonly status: "blocked" | "ready-for-approval";
  readonly localProofOk: boolean;
  readonly safetyReady: boolean;
  readonly templateArtifacts: readonly DeviceAccessSafetyProofBundleTemplate[];
  readonly planArtifact: string;
  readonly readinessArtifact: string;
  readonly blockerCodes: readonly string[];
  readonly readyApprovalCodes: readonly string[];
  readonly checks: readonly DeviceAccessSafetyProofBundleCheck[];
  readonly requiredOperatorInputs: readonly string[];
  readonly requiredStructuredReportFields: readonly string[];
  readonly requiredStructuredReportCheckIds: readonly string[];
  readonly requiredEvidenceArtifacts: readonly string[];
  readonly steps: readonly DeviceAccessSafetyProofBundleStep[];
  readonly boundaries: readonly string[];
}

export interface WriteDeviceAccessSafetyProofBundleOptions extends DeviceAccessSafetyReadinessOptions {
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

const DEFAULT_OUT_FILE = "tmp/vallum/device-access-safety-proof-bundle.json";
const DEFAULT_PLAN_OUT_FILE = "tmp/vallum/device-access-safety-proof-plan.json";
const DEFAULT_READINESS_OUT_FILE = "tmp/vallum/device-access-safety-readiness.json";
const DEFAULT_TEMPLATE_OUT_FILE = "tmp/vallum/device-access-safety-report-template.json";

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

const REQUIRED_EVIDENCE_ARTIFACTS = [
  "sanitized physical-device safety structured report",
  "device class and hazard analysis result",
  "provider accountability review result",
  "requester authorization review result",
  "revocation and emergency-stop review result",
  "network-failure expiry review result",
  "audit retention and privacy review result",
  "incident response review result",
  "credential storage and rotation review result",
  "safe localnet/testnet proof path review result",
  "legal and regulatory review result",
  "status-only hazard review section",
  "status-only accountability review section",
  "status-only authorization review section",
  "status-only revocation and emergency-stop review section",
  "status-only expiry and network-failure review section",
  "status-only audit and privacy review section",
  "status-only incident response review section",
  "status-only credential storage and rotation review section",
  "status-only safe proof-path review section",
  "status-only legal review section",
] as const;

const BOUNDARIES = [
  "This bundle writer is non-networked and only writes an ignored local report template, physical-device safety proof plan, readiness artifact, and bundle summary.",
  "The generated template is a pending-owner-proof artifact; it does not clear physical-device safety readiness by itself.",
  "No generated command may contact or operate physical devices, provider systems, access-control systems, safety-critical systems, IOTA services, or Gas Station endpoints.",
  "Do not commit generated bundle artifacts, device credentials, access tokens, authorization headers, raw payloads, response bodies, incident private data, report paths, or local secret paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-device-access-safety-proof-bundle.ts [--out <path>]

Writes a non-networked ignored local bundle for physical-device safety proof gates.`;

export async function writeDeviceAccessSafetyProofBundle(
  options: WriteDeviceAccessSafetyProofBundleOptions = {},
): Promise<DeviceAccessSafetyProofBundle> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const outFile = options.outFile ?? DEFAULT_OUT_FILE;
  const planOutFile = options.planOutFile ?? DEFAULT_PLAN_OUT_FILE;
  const readinessOutFile = options.readinessOutFile ?? DEFAULT_READINESS_OUT_FILE;
  const templateOutFile = options.templateOutFile ?? DEFAULT_TEMPLATE_OUT_FILE;

  await writeOperatorReportTemplate({
    cwd,
    kind: "device-access-safety",
    now,
    outFile: templateOutFile,
  });
  await writeDeviceAccessSafetyProofPlan({
    cwd,
    env: options.env,
    now,
    outFile: planOutFile,
  });
  await writeDeviceAccessSafetyReadinessArtifact({
    cwd,
    env: options.env,
    now,
    outFile: readinessOutFile,
    scripts: options.scripts,
  });

  const readiness = await checkDeviceAccessSafetyReadiness({
    cwd,
    env: options.env,
    now,
    scripts: options.scripts,
  });
  const checks = readiness.checks.map((check) => stripCheck(check));
  const blockers = checks.filter((check) => check.status !== "proven-local" && check.status !== "ready-approval");
  const readyApproval = checks.filter((check) => check.status === "ready-approval");

  const bundle: DeviceAccessSafetyProofBundle = {
    schemaVersion: 1,
    kind: "vallum.device-access-safety-proof-bundle",
    generatedAt: now.toISOString(),
    status: readiness.safetyReady ? "ready-for-approval" : "blocked",
    localProofOk: readiness.localProofOk,
    safetyReady: readiness.safetyReady,
    templateArtifacts: [
      {
        id: "device-access-safety",
        path: templateOutFile,
        acceptedReportEnv: "DEVICE_ACCESS_SAFETY_REPORT",
      },
    ],
    planArtifact: planOutFile,
    readinessArtifact: readinessOutFile,
    blockerCodes: blockers.map((check) => check.code),
    readyApprovalCodes: readyApproval.map((check) => check.code),
    checks,
    requiredOperatorInputs: REQUIRED_OPERATOR_INPUTS,
    requiredStructuredReportFields: REQUIRED_STRUCTURED_REPORT_FIELDS,
    requiredStructuredReportCheckIds: REQUIRED_DEVICE_ACCESS_SAFETY_CHECKS,
    requiredEvidenceArtifacts: REQUIRED_EVIDENCE_ARTIFACTS,
    steps: buildSteps({ planOutFile, readinessOutFile, templateOutFile }),
    boundaries: BOUNDARIES,
  };

  await writeJsonFile(cwd, outFile, bundle);
  return bundle;
}

function stripCheck(check: DeviceAccessSafetyReadinessCheck): DeviceAccessSafetyProofBundleCheck {
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
}): readonly DeviceAccessSafetyProofBundleStep[] {
  return [
    {
      id: "write-device-access-safety-template",
      command: `npm run operator:write-report-template -- --kind device-access-safety --out ${input.templateOutFile}`,
      contactsPhysicalDevice: false,
      requiresOwnerApproval: false,
    },
    {
      id: "write-device-access-safety-proof-plan",
      command: `npm run device-access:write-safety-proof-plan -- --out ${input.planOutFile}`,
      contactsPhysicalDevice: false,
      requiresOwnerApproval: false,
      dependsOn: ["write-device-access-safety-template"],
    },
    {
      id: "write-device-access-safety-readiness-artifact",
      command: `npm run proof:device-access-safety-readiness -- --out ${input.readinessOutFile}`,
      contactsPhysicalDevice: false,
      requiresOwnerApproval: false,
      dependsOn: ["write-device-access-safety-proof-plan"],
    },
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
      dependsOn: ["run-local-safety-gate-tests", "write-device-access-safety-template"],
    },
    {
      id: "check-device-access-safety-readiness",
      command: `npm run proof:device-access-safety-readiness -- --out ${input.readinessOutFile}`,
      contactsPhysicalDevice: false,
      requiresOwnerApproval: false,
      dependsOn: ["run-approved-physical-device-safety-review"],
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

  const bundle = await writeDeviceAccessSafetyProofBundle({
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
