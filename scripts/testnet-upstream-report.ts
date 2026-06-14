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

export interface TestnetUpstreamReachabilityCheck {
  readonly ok: boolean;
  readonly code: TestnetUpstreamReachabilityCode;
  readonly message: string;
}

export type TestnetUpstreamReachabilityCode =
  | "GAS_STATION_ROOT_READY"
  | "GAS_STATION_V1_HEALTH_READY"
  | "GAS_STATION_UNREACHABLE";

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
  readonly gasStationReachability?: TestnetUpstreamReachabilityCheck;
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
  const reachability = report.gasStationReachability ?? classifyGasStationReachability({
    root: report.gasStationRoot,
    v1Health: report.gasStationV1Health,
  });
  if (!report.iotaRpc.ok || !reachability.ok) {
    return {
      ok: false,
      code: "TESTNET_UPSTREAM_REPORT_FAILED",
      message: !report.iotaRpc.ok
        ? "Testnet upstream diagnostic report did not prove IOTA RPC reachability."
        : reachability.message,
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

export function classifyGasStationReachability(input: {
  readonly root: TestnetUpstreamEndpointCheck;
  readonly v1Health: TestnetUpstreamEndpointCheck;
}): TestnetUpstreamReachabilityCheck {
  if (input.root.ok) {
    return {
      ok: true,
      code: "GAS_STATION_ROOT_READY",
      message: "Gas Station root endpoint is reachable; wrapper /v1/health may be absent on raw upstream containers.",
    };
  }
  if (input.v1Health.ok) {
    return {
      ok: true,
      code: "GAS_STATION_V1_HEALTH_READY",
      message: "Gas Station wrapper health endpoint is reachable.",
    };
  }
  return {
    ok: false,
    code: "GAS_STATION_UNREACHABLE",
    message: "Testnet upstream diagnostic report did not prove Gas Station reachability.",
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
    && (report.gasStationReachability === undefined || isReachabilityCheck(report.gasStationReachability))
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

function isReachabilityCheck(value: unknown): value is TestnetUpstreamReachabilityCheck {
  if (!value || typeof value !== "object") return false;
  const check = value as Record<string, unknown>;
  return typeof check.ok === "boolean"
    && isReachabilityCode(check.code)
    && typeof check.message === "string";
}

function isReachabilityCode(value: unknown): value is TestnetUpstreamReachabilityCode {
  return value === "GAS_STATION_ROOT_READY"
    || value === "GAS_STATION_V1_HEALTH_READY"
    || value === "GAS_STATION_UNREACHABLE";
}

function isReserveCode(value: unknown): value is TestnetUpstreamReserveCode {
  return value === "RESERVE_GAS_READY"
    || value === "RESERVE_GAS_SKIPPED"
    || value === "RESERVE_GAS_AUTH_MISSING"
    || value === "RESERVE_GAS_SPONSOR_FUNDING_BLOCKED"
    || value === "RESERVE_GAS_HTTP_STATUS"
    || value === "RESERVE_GAS_REQUEST_FAILED";
}
