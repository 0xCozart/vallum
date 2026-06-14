import { readFile } from "node:fs/promises";

import type { IotaIdentityLiveSmokeResult } from "./smoke-iota-identity-live.js";

export const IOTA_IDENTITY_LIVE_REPORT_KIND = "agentic-gaskit.iota-identity-live-smoke-report" as const;
export const IOTA_IDENTITY_LIVE_REPORT_SCHEMA_VERSION = 1 as const;

export type IotaIdentityLiveReportCode =
  | "IOTA_IDENTITY_LIVE_SMOKE_PASSED"
  | "IOTA_IDENTITY_LIVE_CONFIG_MISSING"
  | "IOTA_IDENTITY_PROOF_ENDPOINT_UNSAFE"
  | "IOTA_IDENTITY_PROFILE_UNREADABLE"
  | "IOTA_IDENTITY_PROFILE_INVALID"
  | "VC_TRUST_POLICY_CONFIG_MISSING"
  | "VC_TRUST_POLICY_CONFIG_INVALID"
  | "PROFILE_UNVERIFIABLE"
  | "PROFILE_REVOKED"
  | "PROFILE_EXPIRED";

export interface IotaIdentityLiveSmokeReport {
  readonly schemaVersion: typeof IOTA_IDENTITY_LIVE_REPORT_SCHEMA_VERSION;
  readonly kind: typeof IOTA_IDENTITY_LIVE_REPORT_KIND;
  readonly observedAt: string;
  readonly result: "passed" | "blocked" | "failed";
  readonly code: IotaIdentityLiveReportCode;
  readonly message: string;
  readonly contactsLiveService: boolean;
  readonly endpointConfigured: boolean;
  readonly profilePathConfigured: boolean;
  readonly trustPolicyConfigured: boolean;
  readonly identityVerified?: boolean;
  readonly credentialRefsChecked?: number;
}

export interface IotaIdentityLiveReportValidation {
  readonly ok: boolean;
  readonly code:
    | "IOTA_IDENTITY_LIVE_REPORT_VALID"
    | "IOTA_IDENTITY_LIVE_REPORT_MISSING"
    | "IOTA_IDENTITY_LIVE_REPORT_STALE"
    | "IOTA_IDENTITY_LIVE_REPORT_INVALID"
    | IotaIdentityLiveReportCode;
  readonly message: string;
}

const MAX_REPORT_AGE_MS = 24 * 60 * 60 * 1000;
const TRUST_POLICY_ENV = [
  "IOTA_IDENTITY_TRUSTED_ISSUER_DIDS",
  "IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS",
  "IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES",
  "IOTA_IDENTITY_ACCEPTED_STATUS_TYPES",
  "IOTA_IDENTITY_CACHE_TTL_MS",
] as const;
const ALLOWED_REPORT_KEYS = new Set([
  "schemaVersion",
  "kind",
  "observedAt",
  "result",
  "code",
  "message",
  "contactsLiveService",
  "endpointConfigured",
  "profilePathConfigured",
  "trustPolicyConfigured",
  "identityVerified",
  "credentialRefsChecked",
]);

export async function loadIotaIdentityLiveReport(path: string): Promise<IotaIdentityLiveSmokeReport> {
  const value = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!isReportShape(value)) {
    throw new Error("IOTA Identity live smoke report has an invalid shape.");
  }
  return value;
}

export function buildIotaIdentityLiveReport(input: {
  readonly result: IotaIdentityLiveSmokeResult;
  readonly observedAt?: Date;
  readonly env?: Record<string, string | undefined> | NodeJS.ProcessEnv;
}): IotaIdentityLiveSmokeReport {
  const env = input.env ?? process.env;
  const observedAt = (input.observedAt ?? new Date()).toISOString();
  const base = {
    schemaVersion: IOTA_IDENTITY_LIVE_REPORT_SCHEMA_VERSION,
    kind: IOTA_IDENTITY_LIVE_REPORT_KIND,
    observedAt,
    contactsLiveService: input.result.ok || input.result.kind === "failed",
    endpointConfigured: Boolean(readEnv(env, "IOTA_IDENTITY_PROOF_ENDPOINT")),
    profilePathConfigured: Boolean(readEnv(env, "IOTA_IDENTITY_PROFILE_PATH")),
    trustPolicyConfigured: TRUST_POLICY_ENV.every((key) => Boolean(readEnv(env, key))),
  } as const;

  if (input.result.ok) {
    return {
      ...base,
      result: "passed",
      code: "IOTA_IDENTITY_LIVE_SMOKE_PASSED",
      message: "IOTA Identity live smoke verified profile DID and credential evidence.",
      contactsLiveService: true,
      identityVerified: true,
      credentialRefsChecked: input.result.credentialRefsChecked,
    };
  }

  return {
    ...base,
    result: input.result.kind,
    code: input.result.code,
    message: input.result.message,
    contactsLiveService: input.result.kind === "failed",
    identityVerified: input.result.kind === "failed" ? false : undefined,
  };
}

export function validateIotaIdentityLiveReport(
  report: IotaIdentityLiveSmokeReport,
  now = new Date(),
): IotaIdentityLiveReportValidation {
  const observedAtMs = Date.parse(report.observedAt);
  if (!Number.isFinite(observedAtMs)) {
    return {
      ok: false,
      code: "IOTA_IDENTITY_LIVE_REPORT_INVALID",
      message: "IOTA Identity live smoke report has an invalid observation timestamp.",
    };
  }
  if (now.getTime() - observedAtMs > MAX_REPORT_AGE_MS) {
    return {
      ok: false,
      code: "IOTA_IDENTITY_LIVE_REPORT_STALE",
      message: "IOTA Identity live smoke report is older than 24 hours.",
    };
  }
  if (report.result !== "passed" || report.code !== "IOTA_IDENTITY_LIVE_SMOKE_PASSED" || report.identityVerified !== true) {
    return {
      ok: false,
      code: report.code,
      message: report.message,
    };
  }
  return {
    ok: true,
    code: "IOTA_IDENTITY_LIVE_REPORT_VALID",
    message: "IOTA Identity live smoke report proves profile DID and credential evidence.",
  };
}

export function formatIotaIdentityLiveReport(report: IotaIdentityLiveSmokeReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function isReportShape(value: unknown): value is IotaIdentityLiveSmokeReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const report = value as Record<string, unknown>;
  if (!Object.keys(report).every((key) => ALLOWED_REPORT_KEYS.has(key))) return false;
  return report.schemaVersion === IOTA_IDENTITY_LIVE_REPORT_SCHEMA_VERSION
    && report.kind === IOTA_IDENTITY_LIVE_REPORT_KIND
    && typeof report.observedAt === "string"
    && isResult(report.result)
    && isReportCode(report.code)
    && typeof report.message === "string"
    && typeof report.contactsLiveService === "boolean"
    && typeof report.endpointConfigured === "boolean"
    && typeof report.profilePathConfigured === "boolean"
    && typeof report.trustPolicyConfigured === "boolean"
    && (report.identityVerified === undefined || typeof report.identityVerified === "boolean")
    && (report.credentialRefsChecked === undefined || isNonNegativeInteger(report.credentialRefsChecked));
}

function isResult(value: unknown): value is IotaIdentityLiveSmokeReport["result"] {
  return value === "passed" || value === "blocked" || value === "failed";
}

function isReportCode(value: unknown): value is IotaIdentityLiveReportCode {
  return value === "IOTA_IDENTITY_LIVE_SMOKE_PASSED"
    || value === "IOTA_IDENTITY_LIVE_CONFIG_MISSING"
    || value === "IOTA_IDENTITY_PROOF_ENDPOINT_UNSAFE"
    || value === "IOTA_IDENTITY_PROFILE_UNREADABLE"
    || value === "IOTA_IDENTITY_PROFILE_INVALID"
    || value === "VC_TRUST_POLICY_CONFIG_MISSING"
    || value === "VC_TRUST_POLICY_CONFIG_INVALID"
    || value === "PROFILE_UNVERIFIABLE"
    || value === "PROFILE_REVOKED"
    || value === "PROFILE_EXPIRED";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function readEnv(env: Record<string, string | undefined> | NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key];
  return value && value.trim() !== "" ? value.trim() : undefined;
}
