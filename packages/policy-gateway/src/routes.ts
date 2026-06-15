import type { IncomingMessage, ServerResponse } from "node:http";

import {
  validateAgentTransactionManifest,
  type AgentTransactionManifest,
} from "@agentrail/manifest";
import { evaluateAgentActionPolicy } from "./evaluatePolicy.js";
import type { MockGasStationAdapter } from "./mockGasStationAdapter.js";
import type { AgentActionPolicy, AgentPolicyDecision } from "./policySchema.js";

export type AgentGatewayEventOutcome = "approved" | "denied" | "bad_request" | "not_found";

export interface AgentGatewayEvent {
  readonly timestamp: string;
  readonly route: "/v1/agent/sponsorships";
  readonly outcome: AgentGatewayEventOutcome;
  readonly httpStatus: number;
  readonly reasonCode?: Exclude<AgentPolicyDecision, { allowed: true }>["reasonCode"];
  readonly mockSponsorshipId?: string;
  readonly manifest: RedactedAgentManifestEvent;
}

export interface RedactedAgentManifestEvent {
  readonly version?: string;
  readonly agentId?: string;
  readonly ownerId?: string;
  readonly walletId?: string;
  readonly action?: {
    readonly packageId?: string;
    readonly module?: string;
    readonly functionName?: string;
  };
  readonly counterpartyId?: string;
  readonly maxGasBudget?: number;
  readonly intentLength?: number;
  readonly hasMetadata?: boolean;
}

export interface AgentGatewayRouteConfig {
  readonly policy: AgentActionPolicy;
  readonly mockGasStation: MockGasStationAdapter;
  readonly now?: () => Date;
  readonly eventSink?: (event: AgentGatewayEvent) => void | Promise<void>;
  readonly maxBodyBytes?: number;
}

type JsonRecord = Record<string, unknown>;

class AgentGatewayRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: JsonRecord,
  ) {
    super(typeof body.message === "string" ? body.message : "Request error.");
  }
}

export async function handleAgentGatewayRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: AgentGatewayRouteConfig,
): Promise<void> {
  if (request.url !== "/v1/agent/sponsorships") {
    writeJson(response, 404, { error: "NotFound", message: "Route not found." });
    return;
  }

  if (request.method !== "POST") {
    writeJson(response, 405, { error: "MethodNotAllowed", message: "Use POST for agent sponsorship requests." });
    return;
  }

  try {
    const body = requestRecord(await readJson(request, config.maxBodyBytes));
    const manifest = body.manifest;
    const decision = evaluateAgentActionPolicy(config.policy, manifest, { now: config.now?.() });
    if (!decision.allowed) {
      await emitEvent(config, {
        outcome: "denied",
        httpStatus: 403,
        reasonCode: decision.reasonCode,
        manifest: redactManifestForEvent(manifest),
      });
      writeJson(response, 403, { approved: false, decision });
      return;
    }

    const manifestResult = validateAgentTransactionManifest(manifest, { now: config.now?.() });
    if (!manifestResult.ok) {
      await emitEvent(config, {
        outcome: "denied",
        httpStatus: 403,
        reasonCode: "MANIFEST_INVALID",
        manifest: redactManifestForEvent(manifest),
      });
      writeJson(response, 403, {
        approved: false,
        decision: {
          allowed: false,
          reasonCode: "MANIFEST_INVALID",
          message: "Manifest failed validation.",
        },
      });
      return;
    }

    const reservation = await config.mockGasStation.reserve({
      manifest: manifestResult.manifest,
      decision,
    });
    await emitEvent(config, {
      outcome: "approved",
      httpStatus: 200,
      mockSponsorshipId: reservation.sponsorshipId,
      manifest: redactManifestForEvent(manifestResult.manifest),
    });
    writeJson(response, 200, {
      approved: true,
      decision,
      mockSponsorshipId: reservation.sponsorshipId,
    });
  } catch (error) {
    if (error instanceof AgentGatewayRequestError) {
      await emitEvent(config, {
        outcome: "bad_request",
        httpStatus: error.status,
        manifest: {},
      });
      writeJson(response, error.status, error.body);
      return;
    }
    writeJson(response, 500, { error: "InternalError", message: "Agent gateway request failed." });
  }
}

async function emitEvent(
  config: AgentGatewayRouteConfig,
  event: Omit<AgentGatewayEvent, "timestamp" | "route">,
): Promise<void> {
  if (!config.eventSink) return;
  try {
    await config.eventSink({
      timestamp: (config.now?.() ?? new Date()).toISOString(),
      route: "/v1/agent/sponsorships",
      ...event,
    });
  } catch {
    // Observability failures must not alter local sponsorship decisions.
  }
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "cache-control": "no-store", "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage, maxBytes = 1_048_576): Promise<unknown> {
  let raw = "";
  let bytes = 0;
  for await (const chunk of request) {
    const text = chunk.toString();
    bytes += Buffer.byteLength(text);
    if (bytes > maxBytes) {
      throw new AgentGatewayRequestError(413, {
        error: "PayloadTooLarge",
        message: "Request body exceeds the local agent gateway limit.",
      });
    }
    raw += text;
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AgentGatewayRequestError(400, {
      error: "BadRequest",
      message: "Request body must be valid JSON.",
    });
  }
}

function requestRecord(value: unknown): JsonRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as JsonRecord;
  throw new AgentGatewayRequestError(400, {
    error: "BadRequest",
    message: "Request body must be a JSON object.",
  });
}

function redactManifestForEvent(manifest: unknown): RedactedAgentManifestEvent {
  const record = asRecord(manifest);
  const wallet = asRecord(record.wallet);
  const action = asRecord(record.action);
  const spend = asRecord(record.spend);
  const agent = asRecord(record.agent);
  const owner = asRecord(record.owner);
  const counterparty = asRecord(record.counterparty);

  return {
    version: stringField(record.version),
    agentId: stringField(agent.id),
    ownerId: stringField(owner.id),
    walletId: stringField(wallet.walletId),
    action: {
      packageId: stringField(action.packageId),
      module: stringField(action.module),
      functionName: stringField(action.functionName),
    },
    counterpartyId: stringField(counterparty.id),
    maxGasBudget: numberField(spend.maxGasBudget),
    intentLength: typeof record.intent === "string" ? record.intent.length : undefined,
    hasMetadata: typeof record.metadata === "object" && record.metadata !== null,
  };
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
