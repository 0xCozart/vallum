import { POLICY_REASON_CODES } from "@agentrail/shared-types";
import type { PolicyReasonCode } from "@agentrail/shared-types";

import { AgentRailAuthError, AgentRailError, AgentRailPolicyError } from "./errors.js";
import { requestSponsoredAction as requestSponsoredActionThroughGateway } from "./requestSponsoredAction.js";
import type {
  ExecuteSponsoredTransactionRequest,
  ExecuteSponsoredTransactionResponse,
  AgentRailClientOptions,
  PolicySimulationRequest,
  PolicySimulationResponse,
  ReserveGasRequest,
  ReserveGasResponse,
  SponsoredActionRequest,
  SponsoredActionResult,
} from "./types.js";

type JsonRecord = Record<string, unknown>;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? (value as JsonRecord) : {};
}

function requireString(value: unknown, fieldPath: string, raw: unknown): string {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  throw new AgentRailError(`Malformed AgentRail response: missing ${fieldPath}.`, undefined, raw);
}

function isPolicyReasonCode(value: unknown): value is PolicyReasonCode {
  return typeof value === "string" && (POLICY_REASON_CODES as readonly string[]).includes(value);
}

function parsePolicySimulationDecision(value: unknown): PolicySimulationResponse {
  const record = asRecord(value);
  if (record["allowed"] === true) return { allowed: true };
  if (record["allowed"] === false && isPolicyReasonCode(record["reasonCode"]) && typeof record["message"] === "string") {
    return {
      allowed: false,
      reasonCode: record["reasonCode"],
      message: record["message"],
    };
  }
  throw new AgentRailError("Malformed AgentRail response: missing policy simulation decision.", undefined, value);
}

function buildError(status: number, body: unknown): AgentRailError {
  const record = asRecord(body);
  const message =
    typeof record["message"] === "string"
      ? record["message"]
      : typeof record["error"] === "string"
        ? record["error"]
        : `AgentRail request failed with HTTP ${status}`;
  const reasonCode = typeof record["reasonCode"] === "string" ? record["reasonCode"] : undefined;

  if (status === 401 || status === 403) return new AgentRailAuthError(message, status, body);
  if (status === 400 || status === 409 || status === 429) {
    return new AgentRailPolicyError(message, reasonCode, status, body);
  }
  return new AgentRailError(message, status, body);
}

export function createAgentRailClient(options: AgentRailClientOptions) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetchImpl ?? fetch;

  async function post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const json = await parseJson(response);
    if (!response.ok) throw buildError(response.status, json);
    return json as T;
  }

  return {
    async requestSponsoredAction(request: SponsoredActionRequest): Promise<SponsoredActionResult> {
      return requestSponsoredActionThroughGateway({
        baseUrl,
        apiKey: options.apiKey,
        fetchImpl,
        manifest: request.manifest,
      });
    },

    async simulatePolicy(request: PolicySimulationRequest): Promise<PolicySimulationResponse> {
      const json = await post<unknown>("/v1/policy/simulate", {
        gas_budget: request.gasBudget,
        wallet_address: request.walletAddress,
        package_id: request.packageId,
        function_name: request.functionName,
      });

      return parsePolicySimulationDecision(json);
    },

    async reserveGas(request: ReserveGasRequest): Promise<ReserveGasResponse> {
      const json = await post<JsonRecord>("/v1/reserve_gas", {
        gas_budget: request.gasBudget,
        reserve_duration_secs: request.reserveDurationSecs,
        wallet_address: request.walletAddress,
        package_id: request.packageId,
        function_name: request.functionName,
      });

      const result = asRecord(json["result"]);
      return {
        reservationId: requireString(result["reservation_id"], "result.reservation_id", json),
        agentRailTransactionId: requireString(json["agentRailTransactionId"] ?? json["_saas_tx_id"], "agentRailTransactionId", json),
        sponsorAddress: typeof result["sponsor_address"] === "string" ? result["sponsor_address"] : undefined,
        gasCoins: Array.isArray(result["gas_coins"]) ? result["gas_coins"] : undefined,
        raw: json,
      };
    },

    async executeSponsoredTransaction(
      request: ExecuteSponsoredTransactionRequest,
    ): Promise<ExecuteSponsoredTransactionResponse> {
      const json = await post<JsonRecord>("/v1/execute_tx", {
        reservation_id: request.reservationId,
        agentRailTransactionId: request.agentRailTransactionId,
        tx_bytes: request.transactionBytes,
        user_sig: request.userSignature,
      });

      const effects = asRecord(json["effects"]);
      return {
        digest:
          typeof effects["transactionDigest"] === "string"
            ? effects["transactionDigest"]
            : typeof json["digest"] === "string"
              ? json["digest"]
              : undefined,
        raw: json,
      };
    },
  };
}
