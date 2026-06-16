import { readFile } from "node:fs/promises";

import type { IotaNamesLiveSmokeResult } from "./smoke-iota-names-live.js";

export const IOTA_NAMES_LIVE_REPORT_KIND = "vallum.iota-names-live-smoke-report" as const;
export const IOTA_NAMES_LIVE_REPORT_SCHEMA_VERSION = 1 as const;

export type IotaNamesLiveReportCode =
  | "IOTA_NAMES_LIVE_SMOKE_PASSED"
  | "IOTA_NAMES_LIVE_CONFIG_MISSING"
  | "IOTA_NAMES_GRAPHQL_URL_UNSAFE"
  | "IOTA_NAMES_RESOLUTION_FAILED"
  | "IOTA_NAMES_ADDRESS_MISMATCH";

export interface IotaNamesLiveSmokeReport {
  readonly schemaVersion: typeof IOTA_NAMES_LIVE_REPORT_SCHEMA_VERSION;
  readonly kind: typeof IOTA_NAMES_LIVE_REPORT_KIND;
  readonly observedAt: string;
  readonly result: "passed" | "blocked" | "failed";
  readonly code: IotaNamesLiveReportCode;
  readonly message: string;
  readonly contactsLiveService: boolean;
  readonly endpointConfigured: boolean;
  readonly nameConfigured: boolean;
  readonly expectedAddressConfigured: boolean;
  readonly addressMatched?: boolean;
  readonly resolvedAddressRedacted?: string;
}

export interface IotaNamesLiveReportValidation {
  readonly ok: boolean;
  readonly code:
    | "IOTA_NAMES_LIVE_REPORT_VALID"
    | "IOTA_NAMES_LIVE_REPORT_MISSING"
    | "IOTA_NAMES_LIVE_REPORT_STALE"
    | "IOTA_NAMES_LIVE_REPORT_INVALID"
    | IotaNamesLiveReportCode;
  readonly message: string;
}

const MAX_REPORT_AGE_MS = 24 * 60 * 60 * 1000;
const ALLOWED_REPORT_KEYS = new Set([
  "schemaVersion",
  "kind",
  "observedAt",
  "result",
  "code",
  "message",
  "contactsLiveService",
  "endpointConfigured",
  "nameConfigured",
  "expectedAddressConfigured",
  "addressMatched",
  "resolvedAddressRedacted",
]);

export async function loadIotaNamesLiveReport(path: string): Promise<IotaNamesLiveSmokeReport> {
  const value = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!isReportShape(value)) {
    throw new Error("IOTA Names live smoke report has an invalid shape.");
  }
  return value;
}

export function buildIotaNamesLiveReport(input: {
  readonly result: IotaNamesLiveSmokeResult;
  readonly observedAt?: Date;
  readonly env?: Record<string, string | undefined> | NodeJS.ProcessEnv;
}): IotaNamesLiveSmokeReport {
  const env = input.env ?? process.env;
  const observedAt = (input.observedAt ?? new Date()).toISOString();
  const contactsLiveService = input.result.ok || input.result.kind === "failed";
  const base = {
    schemaVersion: IOTA_NAMES_LIVE_REPORT_SCHEMA_VERSION,
    kind: IOTA_NAMES_LIVE_REPORT_KIND,
    observedAt,
    contactsLiveService,
    endpointConfigured: Boolean(readEnv(env, "IOTA_NAMES_GRAPHQL_URL")),
    nameConfigured: Boolean(readEnv(env, "IOTA_NAMES_NAME")),
    expectedAddressConfigured: Boolean(readEnv(env, "IOTA_NAMES_EXPECTED_ADDRESS")),
  } as const;

  if (input.result.ok) {
    return {
      ...base,
      result: "passed",
      code: "IOTA_NAMES_LIVE_SMOKE_PASSED",
      message: "IOTA Names live smoke resolved the configured name to the expected address.",
      contactsLiveService: true,
      addressMatched: true,
      resolvedAddressRedacted: redactAddress(input.result.address),
    };
  }

  return {
    ...base,
    result: input.result.kind,
    code: input.result.code,
    message: input.result.message,
    contactsLiveService: input.result.kind === "failed",
    addressMatched: input.result.code === "IOTA_NAMES_ADDRESS_MISMATCH" ? false : undefined,
  };
}

export function validateIotaNamesLiveReport(
  report: IotaNamesLiveSmokeReport,
  now = new Date(),
): IotaNamesLiveReportValidation {
  const observedAtMs = Date.parse(report.observedAt);
  if (!Number.isFinite(observedAtMs)) {
    return {
      ok: false,
      code: "IOTA_NAMES_LIVE_REPORT_INVALID",
      message: "IOTA Names live smoke report has an invalid observation timestamp.",
    };
  }
  if (now.getTime() - observedAtMs > MAX_REPORT_AGE_MS) {
    return {
      ok: false,
      code: "IOTA_NAMES_LIVE_REPORT_STALE",
      message: "IOTA Names live smoke report is older than 24 hours.",
    };
  }
  if (report.result !== "passed" || report.code !== "IOTA_NAMES_LIVE_SMOKE_PASSED" || report.addressMatched !== true) {
    return {
      ok: false,
      code: report.code,
      message: report.message,
    };
  }
  return {
    ok: true,
    code: "IOTA_NAMES_LIVE_REPORT_VALID",
    message: "IOTA Names live smoke report proves the configured name/address binding.",
  };
}

export function formatIotaNamesLiveReport(report: IotaNamesLiveSmokeReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function isReportShape(value: unknown): value is IotaNamesLiveSmokeReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const report = value as Record<string, unknown>;
  if (!Object.keys(report).every((key) => ALLOWED_REPORT_KEYS.has(key))) return false;
  return report.schemaVersion === IOTA_NAMES_LIVE_REPORT_SCHEMA_VERSION
    && report.kind === IOTA_NAMES_LIVE_REPORT_KIND
    && typeof report.observedAt === "string"
    && isResult(report.result)
    && isReportCode(report.code)
    && typeof report.message === "string"
    && typeof report.contactsLiveService === "boolean"
    && typeof report.endpointConfigured === "boolean"
    && typeof report.nameConfigured === "boolean"
    && typeof report.expectedAddressConfigured === "boolean"
    && (report.addressMatched === undefined || typeof report.addressMatched === "boolean")
    && (report.resolvedAddressRedacted === undefined || isRedactedAddress(report.resolvedAddressRedacted));
}

function isResult(value: unknown): value is IotaNamesLiveSmokeReport["result"] {
  return value === "passed" || value === "blocked" || value === "failed";
}

function isReportCode(value: unknown): value is IotaNamesLiveReportCode {
  return value === "IOTA_NAMES_LIVE_SMOKE_PASSED"
    || value === "IOTA_NAMES_LIVE_CONFIG_MISSING"
    || value === "IOTA_NAMES_GRAPHQL_URL_UNSAFE"
    || value === "IOTA_NAMES_RESOLUTION_FAILED"
    || value === "IOTA_NAMES_ADDRESS_MISMATCH";
}

function readEnv(env: Record<string, string | undefined> | NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function redactAddress(value: string): string {
  if (value.length <= 18) return "<redacted-address>";
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function isRedactedAddress(value: unknown): value is string {
  return typeof value === "string"
    && (value === "<redacted-address>" || /^0x[0-9a-fA-F]{8}\.\.\.[0-9a-fA-F]{8}$/.test(value));
}
