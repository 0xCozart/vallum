import { readFile } from "node:fs/promises";

import type { SponsorFundingCode, SponsorFundingReport } from "./check-sponsor-funding.js";

export const SPONSOR_FUNDING_REPORT_KIND = "vallum.sponsor-funding-report" as const;
export const SPONSOR_FUNDING_REPORT_SCHEMA_VERSION = 1 as const;

export interface SponsorFundingEvidenceReport extends SponsorFundingReport {
  readonly schemaVersion: typeof SPONSOR_FUNDING_REPORT_SCHEMA_VERSION;
  readonly kind: typeof SPONSOR_FUNDING_REPORT_KIND;
  readonly observedAt: string;
}

export interface SponsorFundingReportValidation {
  readonly ok: boolean;
  readonly code:
    | "SPONSOR_FUNDING_REPORT_VALID"
    | "SPONSOR_FUNDING_REPORT_STALE"
    | "SPONSOR_FUNDING_REPORT_INVALID"
    | SponsorFundingCode;
  readonly message: string;
}

const MAX_REPORT_AGE_MS = 24 * 60 * 60 * 1000;

export function buildSponsorFundingEvidenceReport(
  report: SponsorFundingReport,
  now = new Date(),
): SponsorFundingEvidenceReport {
  return {
    schemaVersion: SPONSOR_FUNDING_REPORT_SCHEMA_VERSION,
    kind: SPONSOR_FUNDING_REPORT_KIND,
    observedAt: now.toISOString(),
    ...report,
  };
}

export async function loadSponsorFundingReport(path: string): Promise<SponsorFundingEvidenceReport> {
  const value = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!isReportShape(value)) {
    throw new Error("Sponsor funding report has an invalid shape.");
  }
  return value;
}

export function validateSponsorFundingReport(
  report: SponsorFundingEvidenceReport,
  now = new Date(),
): SponsorFundingReportValidation {
  const observedAtMs = Date.parse(report.observedAt);
  if (!Number.isFinite(observedAtMs)) {
    return {
      ok: false,
      code: "SPONSOR_FUNDING_REPORT_INVALID",
      message: "Sponsor funding report has an invalid observation timestamp.",
    };
  }
  if (now.getTime() - observedAtMs > MAX_REPORT_AGE_MS) {
    return {
      ok: false,
      code: "SPONSOR_FUNDING_REPORT_STALE",
      message: "Sponsor funding report is older than 24 hours.",
    };
  }
  if (!report.contactsLiveService || report.spendsGas !== false || report.signsTransactions !== false) {
    return {
      ok: false,
      code: "SPONSOR_FUNDING_REPORT_INVALID",
      message: "Sponsor funding report does not preserve the expected read-only safety boundaries.",
    };
  }
  if (!report.ready || report.code !== "SPONSOR_FUNDING_READY") {
    return {
      ok: false,
      code: report.code,
      message: report.message,
    };
  }
  return {
    ok: true,
    code: "SPONSOR_FUNDING_REPORT_VALID",
    message: "Sponsor funding report proves enough sampled IOTA balance for the requested reserve budget.",
  };
}

export function formatSponsorFundingEvidenceReport(report: SponsorFundingEvidenceReport): string {
  return JSON.stringify(report, null, 2);
}

function isReportShape(value: unknown): value is SponsorFundingEvidenceReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Record<string, unknown>;
  if ("sponsorAddress" in report) return false;
  return report.schemaVersion === SPONSOR_FUNDING_REPORT_SCHEMA_VERSION
    && report.kind === SPONSOR_FUNDING_REPORT_KIND
    && typeof report.observedAt === "string"
    && typeof report.ready === "boolean"
    && isSponsorFundingCode(report.code)
    && typeof report.message === "string"
    && typeof report.contactsLiveService === "boolean"
    && report.spendsGas === false
    && report.signsTransactions === false
    && (report.sponsorAddressRedacted === undefined || typeof report.sponsorAddressRedacted === "string")
    && typeof report.coinType === "string"
    && typeof report.requiredMist === "string"
    && (report.totalBalanceMist === undefined || typeof report.totalBalanceMist === "string")
    && (report.coinObjectCount === undefined || Number.isInteger(report.coinObjectCount))
    && (report.sampledCoinCount === undefined || Number.isInteger(report.sampledCoinCount))
    && (report.maxSampledCoinBalanceMist === undefined || typeof report.maxSampledCoinBalanceMist === "string")
    && (report.hasNextCoinPage === undefined || typeof report.hasNextCoinPage === "boolean");
}

function isSponsorFundingCode(value: unknown): value is SponsorFundingCode {
  return value === "SPONSOR_FUNDING_READY"
    || value === "SPONSOR_FUNDING_TOTAL_INSUFFICIENT"
    || value === "SPONSOR_FUNDING_COIN_FRAGMENTED"
    || value === "SPONSOR_FUNDING_UNREADABLE";
}
