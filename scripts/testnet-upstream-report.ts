import { readFile } from "node:fs/promises";

export const TESTNET_UPSTREAM_REPORT_KIND = "agentic-gaskit.testnet-upstream-diagnostic" as const;
export const TESTNET_UPSTREAM_REPORT_SCHEMA_VERSION = 1 as const;

export interface TestnetUpstreamEndpointCheck {
  readonly configured: boolean;
  readonly ok: boolean;
  readonly status?: number;
}

export interface TestnetUpstreamReserveCheck {
  readonly skipped: boolean;
  readonly ok: boolean;
  readonly status?: number;
  readonly code?: TestnetUpstreamReserveCode;
  readonly message?: string;
}

export type TestnetUpstreamReserveCode =
  | "RESERVE_GAS_READY"
  | "RESERVE_GAS_SKIPPED"
  | "RESERVE_GAS_AUTH_MISSING"
  | "RESERVE_GAS_SPONSOR_FUNDING_BLOCKED"
  | "RESERVE_GAS_HTTP_STATUS"
  | "RESERVE_GAS_REQUEST_FAILED";

export interface TestnetUpstreamDiagnosticReport {
  readonly schemaVersion: typeof TESTNET_UPSTREAM_REPORT_SCHEMA_VERSION;
  readonly kind: typeof TESTNET_UPSTREAM_REPORT_KIND;
  readonly observedAt: string;
  readonly gasStationRoot: TestnetUpstreamEndpointCheck;
  readonly gasStationV1Health: TestnetUpstreamEndpointCheck;
  readonly iotaRpc: TestnetUpstreamEndpointCheck;
  readonly reserveGas: TestnetUpstreamReserveCheck;
  readonly ok: boolean;
}

export interface TestnetUpstreamReportValidation {
  readonly ok: boolean;
  readonly code:
    | "TESTNET_UPSTREAM_REPORT_VALID"
    | "TESTNET_UPSTREAM_REPORT_FAILED"
    | "TESTNET_UPSTREAM_REPORT_RESERVE_SKIPPED"
    | "TESTNET_UPSTREAM_REPORT_STALE"
    | "TESTNET_UPSTREAM_REPORT_INVALID";
  readonly message: string;
}

const MAX_REPORT_AGE_MS = 24 * 60 * 60 * 1000;

export async function loadTestnetUpstreamReport(path: string): Promise<TestnetUpstreamDiagnosticReport> {
  const value = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!isReportShape(value)) {
    throw new Error("Testnet upstream diagnostic report has an invalid shape.");
  }
  return value;
}

export function validateTestnetUpstreamReport(
  report: TestnetUpstreamDiagnosticReport,
  now = new Date(),
): TestnetUpstreamReportValidation {
  const observedAtMs = Date.parse(report.observedAt);
  if (!Number.isFinite(observedAtMs)) {
    return {
      ok: false,
      code: "TESTNET_UPSTREAM_REPORT_INVALID",
      message: "Testnet upstream diagnostic report has an invalid observation timestamp.",
    };
  }
  if (now.getTime() - observedAtMs > MAX_REPORT_AGE_MS) {
    return {
      ok: false,
      code: "TESTNET_UPSTREAM_REPORT_STALE",
      message: "Testnet upstream diagnostic report is older than 24 hours.",
    };
  }
  if (!report.iotaRpc.ok || (!report.gasStationRoot.ok && !report.gasStationV1Health.ok)) {
    return {
      ok: false,
      code: "TESTNET_UPSTREAM_REPORT_FAILED",
      message: "Testnet upstream diagnostic report did not prove both IOTA RPC and Gas Station reachability.",
    };
  }
  if (report.reserveGas.skipped || !report.reserveGas.ok) {
    return {
      ok: false,
      code: report.reserveGas.skipped ? "TESTNET_UPSTREAM_REPORT_RESERVE_SKIPPED" : "TESTNET_UPSTREAM_REPORT_FAILED",
      message: report.reserveGas.skipped
        ? "Testnet upstream diagnostic report skipped reserve_gas compatibility proof."
        : report.reserveGas.message ?? "Testnet upstream diagnostic report did not prove reserve_gas compatibility.",
    };
  }
  if (!report.ok) {
    return {
      ok: false,
      code: "TESTNET_UPSTREAM_REPORT_FAILED",
      message: "Testnet upstream diagnostic report is not passing.",
    };
  }
  return {
    ok: true,
    code: "TESTNET_UPSTREAM_REPORT_VALID",
    message: "Testnet upstream diagnostic report proves current IOTA RPC, Gas Station, and reserve_gas compatibility.",
  };
}

function isReportShape(value: unknown): value is TestnetUpstreamDiagnosticReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Record<string, unknown>;
  return report.schemaVersion === TESTNET_UPSTREAM_REPORT_SCHEMA_VERSION
    && report.kind === TESTNET_UPSTREAM_REPORT_KIND
    && typeof report.observedAt === "string"
    && isEndpointCheck(report.gasStationRoot)
    && isEndpointCheck(report.gasStationV1Health)
    && isEndpointCheck(report.iotaRpc)
    && isReserveCheck(report.reserveGas)
    && typeof report.ok === "boolean";
}

function isEndpointCheck(value: unknown): value is TestnetUpstreamEndpointCheck {
  if (!value || typeof value !== "object") return false;
  const check = value as Record<string, unknown>;
  return typeof check.configured === "boolean"
    && typeof check.ok === "boolean"
    && (check.status === undefined || Number.isInteger(check.status));
}

function isReserveCheck(value: unknown): value is TestnetUpstreamReserveCheck {
  if (!value || typeof value !== "object") return false;
  const check = value as Record<string, unknown>;
  return typeof check.skipped === "boolean"
    && typeof check.ok === "boolean"
    && (check.status === undefined || Number.isInteger(check.status))
    && (check.code === undefined || isReserveCode(check.code))
    && (check.message === undefined || typeof check.message === "string");
}

function isReserveCode(value: unknown): value is TestnetUpstreamReserveCode {
  return value === "RESERVE_GAS_READY"
    || value === "RESERVE_GAS_SKIPPED"
    || value === "RESERVE_GAS_AUTH_MISSING"
    || value === "RESERVE_GAS_SPONSOR_FUNDING_BLOCKED"
    || value === "RESERVE_GAS_HTTP_STATUS"
    || value === "RESERVE_GAS_REQUEST_FAILED";
}
