import { readFile } from "node:fs/promises";

import type { TestnetDigestProofReport } from "./check-testnet-digest-proof.js";

export const TESTNET_DIGEST_REPORT_KIND = "vallum.testnet-digest-proof-report" as const;
export const TESTNET_DIGEST_REPORT_SCHEMA_VERSION = 1 as const;

export interface TestnetDigestEvidenceReport extends TestnetDigestProofReport {
  readonly schemaVersion: typeof TESTNET_DIGEST_REPORT_SCHEMA_VERSION;
  readonly kind: typeof TESTNET_DIGEST_REPORT_KIND;
  readonly observedAt: string;
}

export interface TestnetDigestReportValidation {
  readonly ok: boolean;
  readonly code:
    | "TESTNET_SPONSORED_EXECUTE_DIGEST_VERIFIED"
    | "TESTNET_DIGEST_REPORT_STALE"
    | "TESTNET_DIGEST_REPORT_INVALID"
    | "TESTNET_DIGEST_NOT_VERIFIED";
  readonly message: string;
}

const MAX_REPORT_AGE_MS = 24 * 60 * 60 * 1000;

export function buildTestnetDigestEvidenceReport(
  report: TestnetDigestProofReport,
  now = new Date(),
): TestnetDigestEvidenceReport {
  return {
    schemaVersion: TESTNET_DIGEST_REPORT_SCHEMA_VERSION,
    kind: TESTNET_DIGEST_REPORT_KIND,
    observedAt: now.toISOString(),
    ...report,
  };
}

export async function loadTestnetDigestReport(path: string): Promise<TestnetDigestEvidenceReport> {
  const value = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!isReportShape(value)) {
    throw new Error("Testnet digest proof report has an invalid shape.");
  }
  return value;
}

export function validateTestnetDigestReport(
  report: TestnetDigestEvidenceReport,
  now = new Date(),
): TestnetDigestReportValidation {
  const observedAtMs = Date.parse(report.observedAt);
  if (!Number.isFinite(observedAtMs)) {
    return {
      ok: false,
      code: "TESTNET_DIGEST_REPORT_INVALID",
      message: "Testnet digest proof report has an invalid observation timestamp.",
    };
  }
  if (now.getTime() - observedAtMs > MAX_REPORT_AGE_MS) {
    return {
      ok: false,
      code: "TESTNET_DIGEST_REPORT_STALE",
      message: "Testnet digest proof report is older than 24 hours.",
    };
  }
  if (report.status !== "verified-testnet" || !report.documented || !report.liveChecked || !report.verified) {
    return {
      ok: false,
      code: "TESTNET_DIGEST_NOT_VERIFIED",
      message: "Testnet digest proof report does not prove a documented successful live lookup.",
    };
  }
  if (report.effectsStatus !== "success") {
    return {
      ok: false,
      code: "TESTNET_DIGEST_NOT_VERIFIED",
      message: "Testnet digest proof report did not prove successful transaction effects.",
    };
  }
  return {
    ok: true,
    code: "TESTNET_SPONSORED_EXECUTE_DIGEST_VERIFIED",
    message: "Documented sponsored IOTA testnet execute digest has a current successful read-only live lookup report.",
  };
}

export function formatTestnetDigestEvidenceReport(report: TestnetDigestEvidenceReport): string {
  return JSON.stringify(report, null, 2);
}

function isReportShape(value: unknown): value is TestnetDigestEvidenceReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Record<string, unknown>;
  return report.schemaVersion === TESTNET_DIGEST_REPORT_SCHEMA_VERSION
    && report.kind === TESTNET_DIGEST_REPORT_KIND
    && typeof report.observedAt === "string"
    && typeof report.digest === "string"
    && typeof report.rpcUrl === "string"
    && typeof report.documented === "boolean"
    && typeof report.liveChecked === "boolean"
    && typeof report.verified === "boolean"
    && isProofStatus(report.status)
    && (report.effectsStatus === undefined || typeof report.effectsStatus === "string")
    && (report.checkpoint === undefined || typeof report.checkpoint === "string")
    && (report.timestampMs === undefined || typeof report.timestampMs === "string")
    && (report.blocker === undefined || typeof report.blocker === "string")
    && typeof report.next === "string";
}

function isProofStatus(value: unknown): value is TestnetDigestProofReport["status"] {
  return value === "documented-local"
    || value === "verified-testnet"
    || value === "blocked-live";
}
