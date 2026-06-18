import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { containsUnsafeReportContent } from "./structured-report-safety.js";

export type DeviceAccessSafetyReadinessStatus =
  | "proven-local"
  | "blocked-local"
  | "blocked-config"
  | "ready-approval";

export interface DeviceAccessSafetyReadinessCheck {
  readonly id: string;
  readonly status: DeviceAccessSafetyReadinessStatus;
  readonly code: string;
  readonly message: string;
  readonly evidence?: string;
  readonly next: string;
}

export interface DeviceAccessSafetyReadinessReport {
  readonly localProofOk: boolean;
  readonly safetyReady: boolean;
  readonly checks: readonly DeviceAccessSafetyReadinessCheck[];
}

export interface DeviceAccessSafetyReadinessArtifact {
  readonly schemaVersion: 1;
  readonly kind: "vallum.device-access-safety-readiness-report";
  readonly generatedAt: string;
  readonly localProofOk: boolean;
  readonly safetyReady: boolean;
  readonly provenLocalCheckIds: readonly string[];
  readonly readyApprovalCheckIds: readonly string[];
  readonly blockedCheckIds: readonly string[];
  readonly blockerCodes: readonly string[];
  readonly checks: readonly DeviceAccessSafetyReadinessCheck[];
  readonly boundaries: readonly string[];
}

export interface DeviceAccessSafetyReadinessOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly now?: Date;
  readonly scripts?: Record<string, string | undefined>;
}

export interface WriteDeviceAccessSafetyReadinessArtifactOptions extends DeviceAccessSafetyReadinessOptions {
  readonly outFile?: string;
}

interface StructuredDeviceAccessSafetyReport {
  readonly schemaVersion?: unknown;
  readonly kind?: unknown;
  readonly result?: unknown;
  readonly observedAt?: unknown;
  readonly deviceAccessMode?: unknown;
  readonly checks?: unknown;
  readonly hazardReview?: unknown;
  readonly accountabilityReview?: unknown;
  readonly authorizationReview?: unknown;
  readonly revocationReview?: unknown;
  readonly expiryReview?: unknown;
  readonly auditPrivacyReview?: unknown;
  readonly incidentReview?: unknown;
  readonly credentialReview?: unknown;
  readonly proofPathReview?: unknown;
  readonly legalReview?: unknown;
}

interface CliOptions {
  readonly help: boolean;
  readonly json: boolean;
  readonly outFile?: string;
}

const MAX_REPORT_BYTES = 64 * 1024;
const MAX_REPORT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEVICE_ACCESS_TEMPLATE_COMMAND = "npm run operator:write-report-template -- --kind device-access-safety --out tmp/vallum/device-access-safety-report-template.json";
const REQUIRED_SOURCE_PATHS = [
  "docs/vallum/device-access-safety-gate.md",
  "scripts/roadmap-safety.test.ts",
] as const;

export const REQUIRED_DEVICE_ACCESS_SAFETY_CHECKS = [
  "device-class-hazard-analysis",
  "provider-accountability-review",
  "requester-authorization-review",
  "revocation-emergency-stop-review",
  "network-failure-expiry-review",
  "audit-privacy-review",
  "dispute-incident-response-review",
  "credential-storage-rotation-review",
  "no-real-world-motion-test-path-review",
  "legal-regulatory-review",
] as const;

const REQUIRED_DEVICE_ACCESS_REVIEW_SECTIONS = [
  {
    key: "hazardReview",
    code: "HAZARD_REVIEW",
    fields: ["deviceClass", "hazardAnalysis", "safetyBoundary"],
  },
  {
    key: "accountabilityReview",
    code: "ACCOUNTABILITY_REVIEW",
    fields: ["providerIdentity", "providerLiability", "operatorOwnership"],
  },
  {
    key: "authorizationReview",
    code: "AUTHORIZATION_REVIEW",
    fields: ["requesterAuthorization", "leastPrivilege", "humanApproval"],
  },
  {
    key: "revocationReview",
    code: "REVOCATION_REVIEW",
    fields: ["revocation", "emergencyStop", "failClosed"],
  },
  {
    key: "expiryReview",
    code: "EXPIRY_REVIEW",
    fields: ["leaseExpiry", "networkFailure", "clockSkew"],
  },
  {
    key: "auditPrivacyReview",
    code: "AUDIT_PRIVACY_REVIEW",
    fields: ["auditRetention", "privacyMinimization", "accessLogs"],
  },
  {
    key: "incidentReview",
    code: "INCIDENT_REVIEW",
    fields: ["disputeProcess", "incidentResponse", "escalationPath"],
  },
  {
    key: "credentialReview",
    code: "CREDENTIAL_REVIEW",
    fields: ["storage", "rotation", "revocation"],
  },
  {
    key: "proofPathReview",
    code: "PROOF_PATH_REVIEW",
    fields: ["simulatedOnly", "noRealWorldMotion", "testIsolation"],
  },
  {
    key: "legalReview",
    code: "LEGAL_REVIEW",
    fields: ["regulatoryOwner", "jurisdiction", "terms"],
  },
] as const;

const SECRET_FIELD_RE = /secret|accessToken|physicalAccessToken|authorizationHeader|signature|payload|header|password|session|cookie|private|raw|doorCode|lockCode|vehicleKey|actuatorCommand|deviceCredential/i;
const SECRET_VALUE_RE = /\b(private key|device credential|door code|lock code|session cookie)\b|bearer\s+\S+/i;

const ARTIFACT_BOUNDARIES = [
  "This report is non-networked and does not contact physical devices, provider systems, access-control systems, safety-critical systems, IOTA services, or Gas Station endpoints.",
  "safetyReady=false means the physical-device safety design, accountability model, emergency-stop semantics, or operator-approved structured report remains blocked.",
  "ready-approval checks require manual owner review before any physical device, actuator, access-control, vehicle, medical, industrial, lock, or safety-critical claim is accepted.",
  "Do not commit generated reports, device credentials, physical access tokens, authorization headers, raw payloads, response bodies, incident details with private data, or local secret paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/check-device-access-safety-readiness.ts [--json] [--out <path>]

Reports current Vallum physical-device access safety readiness without contacting devices or live provider systems.

Options:
  --json        Print a redacted machine-readable artifact.
  --out <path>  Write the same JSON artifact to a local file with mode 0600.
  --help        Show this help text.
`;

export async function checkDeviceAccessSafetyReadiness(
  options: DeviceAccessSafetyReadinessOptions = {},
): Promise<DeviceAccessSafetyReadinessReport> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const scripts = options.scripts ?? await loadPackageScripts(cwd);
  const checks = [
    await checkLocalDeviceAccessSafetyProof(cwd, scripts),
    await checkSafetyReport(cwd, env.DEVICE_ACCESS_SAFETY_REPORT, now),
  ];

  return {
    localProofOk: checks.find((check) => check.id === "local-device-access-safety-gate")?.status === "proven-local",
    safetyReady: checks.every((check) => check.status === "proven-local" || check.status === "ready-approval"),
    checks,
  };
}

export function buildDeviceAccessSafetyReadinessArtifact(
  report: DeviceAccessSafetyReadinessReport,
  now = new Date(),
): DeviceAccessSafetyReadinessArtifact {
  const provenLocalChecks = report.checks.filter((check) => check.status === "proven-local");
  const readyApprovalChecks = report.checks.filter((check) => check.status === "ready-approval");
  const blockedChecks = report.checks.filter((check) => check.status !== "proven-local" && check.status !== "ready-approval");

  return {
    schemaVersion: 1,
    kind: "vallum.device-access-safety-readiness-report",
    generatedAt: now.toISOString(),
    localProofOk: report.localProofOk,
    safetyReady: report.safetyReady,
    provenLocalCheckIds: provenLocalChecks.map((check) => check.id),
    readyApprovalCheckIds: readyApprovalChecks.map((check) => check.id),
    blockedCheckIds: blockedChecks.map((check) => check.id),
    blockerCodes: blockedChecks.map((check) => check.code),
    checks: report.checks,
    boundaries: ARTIFACT_BOUNDARIES,
  };
}

export async function writeDeviceAccessSafetyReadinessArtifact(
  options: WriteDeviceAccessSafetyReadinessArtifactOptions = {},
): Promise<DeviceAccessSafetyReadinessArtifact> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkDeviceAccessSafetyReadiness(options);
  const artifact = buildDeviceAccessSafetyReadinessArtifact(report, options.now);
  if (options.outFile) {
    const outPath = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, formatDeviceAccessSafetyReadinessArtifact(artifact), { mode: 0o600 });
    await chmod(outPath, 0o600);
  }
  return artifact;
}

export function formatDeviceAccessSafetyReadinessReport(report: DeviceAccessSafetyReadinessReport): string {
  const lines = [
    `Vallum device access safety readiness ${report.safetyReady ? "ready-for-approval" : "blocked"}`,
    `localProofOk=${report.localProofOk}`,
    `safetyReady=${report.safetyReady}`,
  ];
  for (const check of report.checks) {
    lines.push(`${check.status}: ${check.id}: code=${check.code}`);
    lines.push(`message=${check.message}`);
    if (check.evidence) lines.push(`evidence=${check.evidence}`);
    lines.push(`next=${check.next}`);
  }
  return lines.join("\n");
}

export function formatDeviceAccessSafetyReadinessArtifact(artifact: DeviceAccessSafetyReadinessArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

async function loadPackageScripts(cwd: string): Promise<Record<string, string | undefined>> {
  try {
    const packageJson = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    return packageJson.scripts ?? {};
  } catch {
    return {};
  }
}

async function checkLocalDeviceAccessSafetyProof(
  cwd: string,
  scripts: Record<string, string | undefined>,
): Promise<DeviceAccessSafetyReadinessCheck> {
  const missing: string[] = [];

  for (const path of REQUIRED_SOURCE_PATHS) {
    try {
      await access(resolve(cwd, path));
    } catch {
      missing.push(path);
    }
  }

  try {
    await access(resolve(cwd, "contracts/device_access_lease_v1"));
    missing.push("physical device contract must remain absent until safety approval");
  } catch {
    // Expected: physical-device contract remains absent.
  }

  const verifyFast = scripts["verify:fast"] ?? "";
  const verifyLocal = scripts["verify:local"] ?? "";
  const grantCheck = scripts["grant:check"] ?? "";

  if (
    verifyFast.includes("proof:device-access-safety-readiness")
    || verifyLocal.includes("proof:device-access-safety-readiness")
    || grantCheck.includes("proof:device-access-safety-readiness")
  ) {
    missing.push("device access safety readiness must stay opt-in");
  }

  if (missing.length > 0) {
    return {
      id: "local-device-access-safety-gate",
      status: "blocked-local",
      code: "DEVICE_ACCESS_SAFETY_LOCAL_PROOF_INCOMPLETE",
      message: "Local physical-device safety gate docs, absence checks, or opt-in script boundaries are incomplete.",
      evidence: `missing=${missing.join(",")}`,
      next: "Restore the virtual-only safety gate, absence checks, and opt-in readiness scripts before any physical-device safety review.",
    };
  }

  return {
    id: "local-device-access-safety-gate",
    status: "proven-local",
    code: "DEVICE_ACCESS_SAFETY_LOCAL_GATE_CONFIGURED",
    message: "Local safety docs and regression tests keep physical-device access out of scope and allow only virtual or simulated future workflows.",
    evidence: "docs/vallum/device-access-safety-gate.md; scripts/roadmap-safety.test.ts",
    next: "Keep this as a fail-closed local safety gate until an owner-approved physical-device safety report exists.",
  };
}

async function checkSafetyReport(
  cwd: string,
  value: string | undefined,
  now: Date,
): Promise<DeviceAccessSafetyReadinessCheck> {
  if (!value || value.trim() === "") {
    return {
      id: "physical-device-safety-report",
      status: "blocked-config",
      code: "DEVICE_ACCESS_SAFETY_REPORT_MISSING",
      message: "Physical-device access requires an owner-approved structured safety report path.",
      evidence: "missing=DEVICE_ACCESS_SAFETY_REPORT",
      next: `${DEVICE_ACCESS_TEMPLATE_COMMAND}; complete a dedicated physical safety, provider accountability, revocation, emergency-stop, privacy, incident-response, and legal review, then set DEVICE_ACCESS_SAFETY_REPORT to the ignored local structured report path.`,
    };
  }

  const reportPath = isAbsolute(value) ? value : resolve(cwd, value);
  let raw: string;
  try {
    const bytes = await readFile(reportPath);
    if (bytes.byteLength > MAX_REPORT_BYTES) {
      return invalidReport(
        "DEVICE_ACCESS_SAFETY_REPORT_TOO_LARGE",
        "Physical-device safety report is too large.",
        "configured-report-too-large",
        "Provide a concise status-only structured report without credentials, raw payloads, incident private data, or secret local paths.",
      );
    }
    raw = bytes.toString("utf8");
  } catch {
    return invalidReport(
      "DEVICE_ACCESS_SAFETY_REPORT_NOT_FOUND",
      "Physical-device safety report path does not exist.",
      "configured-report-missing",
      "Provide an existing ignored local structured report after an owner-approved physical-device safety review.",
    );
  }

  let parsed: StructuredDeviceAccessSafetyReport;
  try {
    parsed = JSON.parse(raw) as StructuredDeviceAccessSafetyReport;
  } catch {
    return invalidReport(
      "DEVICE_ACCESS_SAFETY_REPORT_INVALID_JSON",
      "Physical-device safety report is not valid JSON.",
      "configured-report-invalid-json",
      "Provide a JSON structured evidence report generated after an owner-approved physical-device safety review.",
    );
  }

  const invalid = validateStructuredReport(parsed, now);
  if (invalid) return invalid;

  return {
    id: "physical-device-safety-report",
    status: "ready-approval",
    code: "DEVICE_ACCESS_SAFETY_REPORT_VALID",
    message: "Physical-device safety evidence is a passing structured report for manual owner review.",
    evidence: "local-structured-report-valid-redacted",
    next: "Review the report manually before accepting any physical-device, actuator, access-control, safety-critical, provider-accountability, revocation, or emergency-stop claim.",
  };
}

function validateStructuredReport(
  report: StructuredDeviceAccessSafetyReport,
  now: Date,
): DeviceAccessSafetyReadinessCheck | undefined {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return invalidReport("DEVICE_ACCESS_SAFETY_REPORT_INVALID_SHAPE", "Physical-device safety report must be a JSON object.", "configured-report-invalid-shape", "Provide a JSON object structured evidence report.");
  }
  if (report.schemaVersion !== 1) {
    return invalidReport("DEVICE_ACCESS_SAFETY_REPORT_UNSUPPORTED_SCHEMA", "Physical-device safety report schema is unsupported.", "configured-report-unsupported-schema", "Provide a structured evidence report with schemaVersion=1.");
  }
  if (report.kind !== "vallum.device-access-safety-proof") {
    return invalidReport("DEVICE_ACCESS_SAFETY_REPORT_KIND_MISMATCH", "Physical-device safety report has the wrong kind.", "configured-report-kind-mismatch", "Provide a vallum.device-access-safety-proof structured report.");
  }
  if (report.result !== "passed") {
    return invalidReport("DEVICE_ACCESS_SAFETY_REPORT_NOT_PASSED", "Physical-device safety report did not pass.", "configured-report-not-passed", "Rerun the approved physical-device safety review after resolving blockers.");
  }
  if (containsUnsafeReportContent(report, { unsafeFieldNameRe: SECRET_FIELD_RE, unsafeStringValueRe: SECRET_VALUE_RE })) {
    return invalidReport("DEVICE_ACCESS_SAFETY_REPORT_UNSAFE_FIELDS", "Physical-device safety report contains unsafe secret-like or physical-access fields.", "configured-report-unsafe-fields", "Provide status-only evidence without device credentials, access tokens, raw payloads, private incident details, or authorization material.");
  }
  if (report.deviceAccessMode !== "physical-approved") {
    return invalidReport("DEVICE_ACCESS_SAFETY_REPORT_MODE_MISSING", "Physical-device safety report must explicitly identify physical-approved mode.", "configured-report-mode-missing", "Provide owner-approved safety evidence for physical-approved device access, or keep the gate deferred.");
  }
  const checks = report.checks;
  if (!Array.isArray(checks) || !REQUIRED_DEVICE_ACCESS_SAFETY_CHECKS.every((check) => checks.includes(check))) {
    return invalidReport("DEVICE_ACCESS_SAFETY_REPORT_CHECKS_INCOMPLETE", "Physical-device safety report is missing required check ids.", "configured-report-checks-incomplete", "Include hazard analysis, provider accountability, requester authorization, emergency stop, expiry, audit/privacy, incident response, credential rotation, safe proof path, and legal/regulatory checks.");
  }
  const invalidSection = validateReviewSections(report);
  if (invalidSection) return invalidSection;
  if (typeof report.observedAt !== "string") {
    return staleReport();
  }
  const observedAt = Date.parse(report.observedAt);
  if (Number.isNaN(observedAt) || observedAt > now.getTime() || now.getTime() - observedAt > MAX_REPORT_AGE_MS) {
    return staleReport();
  }
  return undefined;
}

function validateReviewSections(report: StructuredDeviceAccessSafetyReport): DeviceAccessSafetyReadinessCheck | undefined {
  for (const section of REQUIRED_DEVICE_ACCESS_REVIEW_SECTIONS) {
    const value = report[section.key];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return invalidReport(
        `DEVICE_ACCESS_SAFETY_REPORT_${section.code}_MISSING`,
        `Physical-device safety report is missing ${section.key}.`,
        "configured-report-review-section-missing",
        "Provide status-only review sections for hazard, accountability, authorization, revocation, expiry, audit/privacy, incident, credential, safe proof-path, and legal review.",
      );
    }
    const record = value as Record<string, unknown>;
    for (const field of section.fields) {
      if (record[field] !== "passed") {
        return invalidReport(
          `DEVICE_ACCESS_SAFETY_REPORT_${constantCase(field)}_NOT_PASSED`,
          `Physical-device safety report review field ${section.key}.${field} did not pass.`,
          "configured-report-review-field-not-passed",
          "Resolve the failed physical-device safety review field and provide a passing status-only report.",
        );
      }
    }
  }
  return undefined;
}

function staleReport(): DeviceAccessSafetyReadinessCheck {
  return invalidReport("DEVICE_ACCESS_SAFETY_REPORT_STALE", "Physical-device safety report is stale or has an invalid observation time.", "configured-report-stale-or-invalid-time", "Provide a structured safety report with an observedAt timestamp from the last 30 days.");
}

function constantCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function invalidReport(
  code: string,
  message: string,
  evidence: string,
  next: string,
): DeviceAccessSafetyReadinessCheck {
  return {
    id: "physical-device-safety-report",
    status: "blocked-config",
    code,
    message,
    evidence,
    next,
  };
}

function parseArgs(args: readonly string[]): CliOptions {
  let help = false;
  let json = false;
  let outFile: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--out") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--out requires a path.");
      outFile = value;
      index += 1;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }

  return { help, json, outFile };
}

async function main(): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage);
    return 1;
  }

  if (options.help) {
    console.log(usage.trimEnd());
    return 0;
  }

  if (options.json || options.outFile) {
    const artifact = await writeDeviceAccessSafetyReadinessArtifact({ outFile: options.outFile });
    console.log(formatDeviceAccessSafetyReadinessArtifact(artifact).trimEnd());
    return 0;
  }

  const report = await checkDeviceAccessSafetyReadiness();
  console.log(formatDeviceAccessSafetyReadinessReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
