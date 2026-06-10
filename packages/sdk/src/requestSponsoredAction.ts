import { GasKitAuthError, GasKitError, GasKitPolicyError } from "./errors.js";
import type {
  RequestSponsoredActionOptions,
  SponsoredActionRequest,
  SponsoredActionResult,
} from "./types.js";

type JsonRecord = Record<string, unknown>;

export async function requestSponsoredAction(
  options: RequestSponsoredActionOptions,
): Promise<SponsoredActionResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${normalizeBaseUrl(options.baseUrl)}/v1/agent/sponsorships`, {
    method: "POST",
    headers: requestHeaders(options.apiKey),
    body: JSON.stringify({
      manifest: options.manifest,
    } satisfies SponsoredActionRequest),
  });

  const json = await parseJson(response);
  const result = parseSponsoredActionResult(json);
  if (result) return result;
  if (!response.ok) throw buildError(response.status, json);
  throw new GasKitError("Malformed GasKit response: missing sponsored action result.", undefined, json);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function requestHeaders(apiKey: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

function parseSponsoredActionResult(value: unknown): SponsoredActionResult | undefined {
  const record = asRecord(value);
  const decision = asRecord(record.decision);
  if (
    record.approved === true &&
    decision.allowed === true &&
    typeof record.mockSponsorshipId === "string" &&
    record.mockSponsorshipId.length > 0
  ) {
    return {
      approved: true,
      decision: { allowed: true },
      mockSponsorshipId: record.mockSponsorshipId,
    };
  }
  if (
    record.approved === false &&
    decision.allowed === false &&
    typeof decision.reasonCode === "string" &&
    decision.reasonCode.length > 0 &&
    typeof decision.message === "string"
  ) {
    return {
      approved: false,
      decision: {
        allowed: false,
        reasonCode: decision.reasonCode,
        message: decision.message,
      },
    };
  }
  return undefined;
}

function buildError(status: number, body: unknown): GasKitError {
  const record = asRecord(body);
  const message =
    typeof record.message === "string"
      ? record.message
      : typeof record.error === "string"
        ? record.error
        : `GasKit request failed with HTTP ${status}`;
  const reasonCode = typeof record.reasonCode === "string" ? record.reasonCode : undefined;

  if (status === 401) return new GasKitAuthError(message, status, body);
  if (status === 400 || status === 403 || status === 409 || status === 429) {
    return new GasKitPolicyError(message, reasonCode, status, body);
  }
  return new GasKitError(message, status, body);
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
}
