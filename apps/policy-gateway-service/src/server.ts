import { randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { evaluateSponsorshipPolicy } from "@vallum/policy-gateway";
import type { PolicyDecision, PolicyReasonCode, SponsorshipPolicy, SponsorshipRequestContext } from "@vallum/shared-types";

import type { GatewayUsageSnapshot } from "./usage.js";

export interface GatewayAppConfig {
  apiKey: string;
  policy: SponsorshipPolicy;
}

export type GatewayOperation = "reserve" | "execute";
export type GatewayEventOutcome = "allowed" | "rejected" | "upstream_failed";

export interface GatewayEvent {
  id: string;
  timestamp: string;
  operation: GatewayOperation;
  outcome: GatewayEventOutcome;
  httpStatus: number;
  appId?: string;
  walletAddress?: string;
  packageId?: string;
  functionName?: string;
  gasBudget?: number;
  agentRailTransactionId?: string;
  upstreamReservationId?: string;
  reasonCode?: PolicyReasonCode;
  upstreamStatus?: number;
}

export interface GatewayOperatorUsageConfig {
  token: string;
  source?: string;
  loadSnapshot: () => GatewayUsageSnapshot | Promise<GatewayUsageSnapshot>;
}

export interface GatewayConfig {
  apps: Record<string, GatewayAppConfig>;
  upstreamBaseUrl?: string;
  upstreamBearerToken?: string;
  fetchImpl?: typeof fetch;
  eventSink?: (event: GatewayEvent) => void | Promise<void>;
  operatorUsage?: GatewayOperatorUsageConfig;
}

type JsonRecord = Record<string, unknown>;

class HttpRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: JsonRecord,
  ) {
    super(typeof body.message === "string" ? body.message : "Request error.");
  }
}

type ReservationStatus = "reserved" | "executed" | "failed";

interface ReservationRecord {
  id: string;
  upstreamReservationId: string;
  upstreamReservationIdForProxy: string | number;
  appId: string;
  walletAddress?: string;
  packageId?: string;
  functionName?: string;
  gasBudget?: number;
  status: ReservationStatus;
}

interface UsageCounters {
  appRequests: Map<string, number>;
  appGasReserved: Map<string, number>;
  walletRequests: Map<string, number>;
}

function emptyCounters(): UsageCounters {
  return {
    appRequests: new Map(),
    appGasReserved: new Map(),
    walletRequests: new Map(),
  };
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function writeNoStoreJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "cache-control": "no-store", "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function requestRecord(value: unknown): JsonRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as JsonRecord;
  throw new HttpRequestError(400, { error: "BadRequest", message: "Request body must be a JSON object." });
}

async function readJson(request: IncomingMessage, maxBytes = 1_048_576): Promise<unknown> {
  let raw = "";
  let bytes = 0;
  for await (const chunk of request) {
    const text = chunk.toString();
    bytes += Buffer.byteLength(text);
    if (bytes > maxBytes) {
      throw new HttpRequestError(413, { error: "PayloadTooLarge", message: "Request body exceeds the local gateway limit." });
    }
    raw += text;
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new HttpRequestError(400, { error: "BadRequest", message: "Request body must be valid JSON." });
  }
}

function numberField(record: JsonRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringField(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function hasOwn(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function requestPositiveNumberField(record: JsonRecord, key: string): number | undefined {
  if (!hasOwn(record, key)) return undefined;
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  throw new HttpRequestError(400, { error: "BadRequest", message: `${key} must be a positive finite number when provided.` });
}

function requestStringField(record: JsonRecord, key: string): string | undefined {
  if (!hasOwn(record, key)) return undefined;
  const value = record[key];
  if (typeof value === "string" && value.trim().length > 0) return value;
  throw new HttpRequestError(400, { error: "BadRequest", message: `${key} must be a non-empty string when provided.` });
}

function parseBearer(value: string | string[] | undefined): string | undefined {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1];
}

function apiKeysEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function validateGatewayConfig(config: GatewayConfig): void {
  const seenKeys = new Map<string, string>();
  for (const [appId, app] of Object.entries(config.apps)) {
    if (!app.apiKey.trim()) {
      throw new Error(`Gateway app ${appId} must define a non-empty app API key.`);
    }
    const existingAppId = seenKeys.get(app.apiKey);
    if (existingAppId) {
      throw new Error(`Gateway config has duplicate app API key for ${existingAppId} and ${appId}.`);
    }
    seenKeys.set(app.apiKey, appId);
  }
  if (config.operatorUsage) {
    if (!config.operatorUsage.token.trim()) {
      throw new Error("Gateway operator usage token must be non-empty when configured.");
    }
    for (const [appId, app] of Object.entries(config.apps)) {
      if (config.operatorUsage.token === app.apiKey) {
        throw new Error(`Gateway operator usage token must be distinct from app API key for ${appId}.`);
      }
    }
    if (config.upstreamBearerToken && config.operatorUsage.token === config.upstreamBearerToken) {
      throw new Error("Gateway operator usage token must be distinct from the upstream bearer token.");
    }
  }
}

function findAppByApiKey(config: GatewayConfig, apiKey: string | undefined): { appId: string; app: GatewayAppConfig } | undefined {
  if (!apiKey) return undefined;
  for (const [appId, app] of Object.entries(config.apps)) {
    if (apiKeysEqual(app.apiKey, apiKey)) return { appId, app };
  }
  return undefined;
}

function operatorTokensEqual(configuredToken: string, providedToken: string): boolean {
  return apiKeysEqual(configuredToken, providedToken);
}

function walletKey(appId: string, walletAddress?: string): string {
  return `${appId}:${walletAddress ?? "unknown"}`;
}

function httpStatusForDecision(decision: Exclude<PolicyDecision, { allowed: true }>): number {
  switch (decision.reasonCode) {
    case "AUTH_MISSING":
      return 401;
    case "AUTH_INVALID":
    case "APP_DISABLED":
      return 403;
    case "PACKAGE_NOT_ALLOWED":
    case "FUNCTION_NOT_ALLOWED":
    case "WALLET_DENIED":
      return 400;
    case "APP_DAILY_BUDGET_EXCEEDED":
    case "APP_DAILY_REQUEST_LIMIT_EXCEEDED":
    case "WALLET_DAILY_LIMIT_EXCEEDED":
    case "GAS_BUDGET_TOO_HIGH":
      return 429;
    case "POLICY_CONFIG_INVALID":
      return 500;
    case "GAS_STATION_UNAVAILABLE":
    case "EXECUTION_FAILED":
      return 502;
  }
}

function rejectionBody(reasonCode: PolicyReasonCode, message: string): JsonRecord {
  return { error: "PolicyRejected", reasonCode, message };
}

function rejectDecision(response: ServerResponse, decision: Exclude<PolicyDecision, { allowed: true }>): void {
  writeJson(response, httpStatusForDecision(decision), rejectionBody(decision.reasonCode, decision.message));
}

const EVENT_STRING_MAX_LENGTH = 256;

function sanitizeEventString(value: string): string {
  const withoutControlCharacters = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, "�");
  return withoutControlCharacters.length > EVENT_STRING_MAX_LENGTH ? withoutControlCharacters.slice(0, EVENT_STRING_MAX_LENGTH) : withoutControlCharacters;
}

function setEventString(event: GatewayEvent, key: keyof GatewayEvent, value: string | undefined): void {
  if (value !== undefined) {
    (event as unknown as Record<string, unknown>)[key] = sanitizeEventString(value);
  }
}

function setEventNumber(event: GatewayEvent, key: keyof GatewayEvent, value: number | undefined): void {
  if (value !== undefined) {
    (event as unknown as Record<string, unknown>)[key] = value;
  }
}

function hasThen(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function";
}

function sanitizeGatewayEvent(event: Omit<GatewayEvent, "id" | "timestamp">): GatewayEvent {
  const sanitized: GatewayEvent = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    operation: event.operation,
    outcome: event.outcome,
    httpStatus: event.httpStatus,
  };

  setEventString(sanitized, "appId", event.appId);
  setEventString(sanitized, "walletAddress", event.walletAddress);
  setEventString(sanitized, "packageId", event.packageId);
  setEventString(sanitized, "functionName", event.functionName);
  setEventNumber(sanitized, "gasBudget", event.gasBudget);
  setEventString(sanitized, "agentRailTransactionId", event.agentRailTransactionId);
  setEventString(sanitized, "upstreamReservationId", event.upstreamReservationId);
  setEventString(sanitized, "reasonCode", event.reasonCode);
  setEventNumber(sanitized, "upstreamStatus", event.upstreamStatus);

  return sanitized;
}

function emitGatewayEvent(config: GatewayConfig, event: Omit<GatewayEvent, "id" | "timestamp">): void {
  if (!config.eventSink) return;
  try {
    const maybePromise = config.eventSink(sanitizeGatewayEvent(event));
    if (hasThen(maybePromise)) {
      maybePromise.then(undefined, () => undefined);
    }
  } catch {
    // Event sinks are observational only; never fail sponsorship request handling.
  }
}

function emitDecisionRejection(
  config: GatewayConfig,
  operation: GatewayOperation,
  decision: Exclude<PolicyDecision, { allowed: true }>,
  context: Partial<GatewayEvent> = {},
): void {
  emitGatewayEvent(config, {
    operation,
    outcome: "rejected",
    httpStatus: httpStatusForDecision(decision),
    reasonCode: decision.reasonCode,
    ...context,
  });
}

function missingAuthDecision(): Exclude<PolicyDecision, { allowed: true }> {
  return { allowed: false, reasonCode: "AUTH_MISSING", message: "A valid app API key is required." };
}

function invalidAuthDecision(): Exclude<PolicyDecision, { allowed: true }> {
  return { allowed: false, reasonCode: "AUTH_INVALID", message: "The app credentials do not match a configured app." };
}

function unavailableDecision(message = "The configured IOTA Gas Station upstream is unavailable."): Exclude<PolicyDecision, { allowed: true }> {
  return { allowed: false, reasonCode: "GAS_STATION_UNAVAILABLE", message };
}

function normalizeUpstreamFailure(operation: "reserve" | "execute", status: number): { status: number; json: JsonRecord } {
  const label = operation === "reserve" ? "reserve gas" : "execute transaction";
  return {
    status: 502,
    json: rejectionBody("GAS_STATION_UNAVAILABLE", `Gas Station ${label} request failed with HTTP ${status}.`),
  };
}

function isRetryableUpstreamFailure(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function applyUsageCounters(counters: UsageCounters, appId: string, walletAddress: string | undefined, gasBudget: number | undefined): () => void {
  const wallet = walletKey(appId, walletAddress);
  counters.appRequests.set(appId, (counters.appRequests.get(appId) ?? 0) + 1);
  counters.walletRequests.set(wallet, (counters.walletRequests.get(wallet) ?? 0) + 1);
  if (typeof gasBudget === "number") {
    counters.appGasReserved.set(appId, (counters.appGasReserved.get(appId) ?? 0) + gasBudget);
  }

  return () => {
    counters.appRequests.set(appId, Math.max(0, (counters.appRequests.get(appId) ?? 0) - 1));
    counters.walletRequests.set(wallet, Math.max(0, (counters.walletRequests.get(wallet) ?? 0) - 1));
    if (typeof gasBudget === "number") {
      counters.appGasReserved.set(appId, Math.max(0, (counters.appGasReserved.get(appId) ?? 0) - gasBudget));
    }
  };
}

function policyContextFromBody(appId: string, counters: UsageCounters, body: JsonRecord): SponsorshipRequestContext {
  const gasBudget = requestPositiveNumberField(body, "gas_budget");
  const walletAddress = requestStringField(body, "wallet_address");
  const packageId = requestStringField(body, "package_id");
  const functionName = requestStringField(body, "function_name");

  return {
    appId,
    authenticated: true,
    walletAddress,
    packageId,
    functionName,
    gasBudget,
    appRequestsToday: counters.appRequests.get(appId) ?? 0,
    walletRequestsToday: counters.walletRequests.get(walletKey(appId, walletAddress)) ?? 0,
    appGasReservedToday: counters.appGasReserved.get(appId) ?? 0,
  };
}

async function proxyJson(
  config: GatewayConfig,
  path: string,
  body: unknown,
): Promise<{ status: number; json: unknown }> {
  if (!config.upstreamBaseUrl) {
    return { status: 502, json: rejectionBody("GAS_STATION_UNAVAILABLE", "GAS_STATION_URL is not configured.") };
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${config.upstreamBaseUrl.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(config.upstreamBearerToken ? { authorization: `Bearer ${config.upstreamBearerToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, json };
  } catch {
    return {
      status: 502,
      json: rejectionBody("GAS_STATION_UNAVAILABLE", "The configured IOTA Gas Station upstream is unavailable."),
    };
  }
}

export function createGatewayServer(config: GatewayConfig): Server {
  validateGatewayConfig(config);
  const counters = emptyCounters();
  const reservations = new Map<string, ReservationRecord>();

  async function handleHealth(response: ServerResponse): Promise<void> {
    writeJson(response, 200, {
      status: "ok",
      service: "vallum-policy-gateway",
      upstream: { configured: Boolean(config.upstreamBaseUrl) },
    });
  }

  async function handleOperatorUsage(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const operatorUsage = config.operatorUsage;
    if (!operatorUsage) {
      return writeJson(response, 404, { error: "NotFound", message: "Route not found." });
    }

    const token = parseBearer(request.headers.authorization);
    if (!token) {
      return writeNoStoreJson(response, 401, { error: "Unauthorized", message: "Operator bearer token is required." });
    }
    if (!operatorTokensEqual(operatorUsage.token, token)) {
      return writeNoStoreJson(response, 403, { error: "Forbidden", message: "Operator bearer token is invalid." });
    }

    try {
      const usage = await operatorUsage.loadSnapshot();
      return writeNoStoreJson(response, 200, {
        source: operatorUsage.source ?? "local-usage-snapshot",
        generatedAt: new Date().toISOString(),
        usage,
      });
    } catch {
      return writeNoStoreJson(response, 500, {
        error: "UsageUnavailable",
        message: "Operator usage snapshot is unavailable.",
      });
    }
  }

  async function handlePolicySimulate(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const apiKey = parseBearer(request.headers.authorization);
    if (!apiKey) {
      return rejectDecision(response, missingAuthDecision());
    }
    const appMatch = findAppByApiKey(config, apiKey);
    if (!appMatch) {
      return rejectDecision(response, invalidAuthDecision());
    }

    const body = requestRecord(await readJson(request));
    const decision = evaluateSponsorshipPolicy(appMatch.app.policy, policyContextFromBody(appMatch.appId, counters, body));
    writeJson(response, 200, decision);
  }

  async function handleReserve(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const apiKey = parseBearer(request.headers.authorization);
    if (!apiKey) {
      const decision = missingAuthDecision();
      emitDecisionRejection(config, "reserve", decision);
      return rejectDecision(response, decision);
    }
    const appMatch = findAppByApiKey(config, apiKey);
    if (!appMatch) {
      const decision = invalidAuthDecision();
      emitDecisionRejection(config, "reserve", decision);
      return rejectDecision(response, decision);
    }

    const body = requestRecord(await readJson(request));
    const appId = appMatch.appId;
    const requestContext = policyContextFromBody(appId, counters, body);
    const { gasBudget, walletAddress, packageId, functionName } = requestContext;

    const decision = evaluateSponsorshipPolicy(appMatch.app.policy, requestContext);
    const eventContext = { appId, walletAddress, packageId, functionName, gasBudget };
    if (decision.allowed === false) {
      emitDecisionRejection(config, "reserve", decision, eventContext);
      return rejectDecision(response, decision);
    }

    const rollbackUsageCounters = applyUsageCounters(counters, appId, walletAddress, gasBudget);
    const upstream = await proxyJson(config, "/v1/reserve_gas", body);
    if (upstream.status < 200 || upstream.status >= 300) {
      rollbackUsageCounters();
      const normalized = normalizeUpstreamFailure("reserve", upstream.status);
      emitGatewayEvent(config, {
        operation: "reserve",
        outcome: "upstream_failed",
        httpStatus: normalized.status,
        upstreamStatus: upstream.status,
        reasonCode: "GAS_STATION_UNAVAILABLE",
        ...eventContext,
      });
      return writeJson(response, normalized.status, normalized.json);
    }

    const upstreamBody = asRecord(upstream.json);
    const result = asRecord(upstreamBody.result);
    const upstreamReservationIdRaw = result["reservation_id"];
    const upstreamReservationId = stringField(result, "reservation_id");
    if (!upstreamReservationId) {
      rollbackUsageCounters();
      const decision = unavailableDecision("Gas Station response did not include result.reservation_id.");
      emitGatewayEvent(config, {
        operation: "reserve",
        outcome: "upstream_failed",
        httpStatus: httpStatusForDecision(decision),
        upstreamStatus: upstream.status,
        reasonCode: decision.reasonCode,
        ...eventContext,
      });
      return rejectDecision(response, decision);
    }

    const agentRailTransactionId = `vallum_${randomUUID()}`;
    reservations.set(agentRailTransactionId, {
      id: agentRailTransactionId,
      upstreamReservationId,
      upstreamReservationIdForProxy: typeof upstreamReservationIdRaw === "number" ? upstreamReservationIdRaw : upstreamReservationId,
      appId,
      walletAddress,
      packageId,
      functionName,
      gasBudget,
      status: "reserved",
    });

    emitGatewayEvent(config, {
      operation: "reserve",
      outcome: "allowed",
      httpStatus: 200,
      agentRailTransactionId,
      upstreamReservationId,
      ...eventContext,
    });

    writeJson(response, 200, { ...upstreamBody, agentRailTransactionId });
  }

  async function handleExecute(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const apiKey = parseBearer(request.headers.authorization);
    if (!apiKey) {
      const decision = missingAuthDecision();
      emitDecisionRejection(config, "execute", decision);
      return rejectDecision(response, decision);
    }
    const appMatch = findAppByApiKey(config, apiKey);
    if (!appMatch) {
      const decision = invalidAuthDecision();
      emitDecisionRejection(config, "execute", decision);
      return rejectDecision(response, decision);
    }

    const body = requestRecord(await readJson(request));
    const legacyVallumTransactionId = stringField(body, "_saas_tx_id");
    const publicVallumTransactionId = stringField(body, "agentRailTransactionId");
    if (legacyVallumTransactionId && publicVallumTransactionId && legacyVallumTransactionId !== publicVallumTransactionId) {
      emitGatewayEvent(config, {
        operation: "execute",
        outcome: "rejected",
        httpStatus: 409,
        appId: appMatch.appId,
        reasonCode: "EXECUTION_FAILED",
      });
      writeJson(response, 409, rejectionBody("EXECUTION_FAILED", "Conflicting Vallum transaction id aliases."));
      return;
    }
    const agentRailTransactionId = publicVallumTransactionId ?? legacyVallumTransactionId;
    const reservationId = stringField(body, "reservation_id");
    const reservation = agentRailTransactionId ? reservations.get(agentRailTransactionId) : undefined;

    if (!reservation || reservation.appId !== appMatch.appId || reservation.upstreamReservationId !== reservationId) {
      emitGatewayEvent(config, {
        operation: "execute",
        outcome: "rejected",
        httpStatus: 409,
        appId: appMatch.appId,
        reasonCode: "EXECUTION_FAILED",
      });
      writeJson(response, 409, rejectionBody("EXECUTION_FAILED", "Unknown or mismatched Vallum reservation."));
      return;
    }

    const eventContext = {
      appId: reservation.appId,
      walletAddress: reservation.walletAddress,
      packageId: reservation.packageId,
      functionName: reservation.functionName,
      gasBudget: reservation.gasBudget,
      agentRailTransactionId,
      upstreamReservationId: reservation.upstreamReservationId,
    };

    if (reservation.status !== "reserved") {
      emitGatewayEvent(config, {
        operation: "execute",
        outcome: "rejected",
        httpStatus: 409,
        reasonCode: "EXECUTION_FAILED",
        ...eventContext,
      });
      writeJson(response, 409, rejectionBody("EXECUTION_FAILED", "This Vallum reservation is not executable."));
      return;
    }

    const decision = evaluateSponsorshipPolicy(appMatch.app.policy, {
      appId: reservation.appId,
      authenticated: true,
      walletAddress: reservation.walletAddress,
      packageId: reservation.packageId,
      functionName: reservation.functionName,
      gasBudget: reservation.gasBudget,
      appRequestsToday: 0,
      walletRequestsToday: 0,
      appGasReservedToday: 0,
    });
    if (decision.allowed === false) {
      emitDecisionRejection(config, "execute", decision, eventContext);
      return rejectDecision(response, decision);
    }

    const upstreamBody: JsonRecord = { ...body, reservation_id: reservation.upstreamReservationIdForProxy };
    delete upstreamBody._saas_tx_id;
    delete upstreamBody.agentRailTransactionId;
    const upstream = await proxyJson(config, "/v1/execute_tx", upstreamBody);
    if (upstream.status >= 200 && upstream.status < 300) {
      reservation.status = "executed";
      emitGatewayEvent(config, {
        operation: "execute",
        outcome: "allowed",
        httpStatus: upstream.status,
        ...eventContext,
      });
      writeJson(response, upstream.status, upstream.json);
      return;
    }

    if (!isRetryableUpstreamFailure(upstream.status)) {
      reservation.status = "failed";
    }
    const normalized = normalizeUpstreamFailure("execute", upstream.status);
    emitGatewayEvent(config, {
      operation: "execute",
      outcome: "upstream_failed",
      httpStatus: normalized.status,
      upstreamStatus: upstream.status,
      reasonCode: "GAS_STATION_UNAVAILABLE",
      ...eventContext,
    });
    writeJson(response, normalized.status, normalized.json);
  }

  return createServer((request, response) => {
    void (async () => {
      try {
        if (request.method === "GET" && request.url === "/health") return await handleHealth(response);
        if (request.method === "GET" && request.url === "/operator/usage") return await handleOperatorUsage(request, response);
        if (request.method === "POST" && request.url === "/v1/policy/simulate") return await handlePolicySimulate(request, response);
        if (request.method === "POST" && request.url === "/v1/reserve_gas") return await handleReserve(request, response);
        if (request.method === "POST" && request.url === "/v1/execute_tx") return await handleExecute(request, response);
        writeJson(response, 404, { error: "NotFound", message: "Route not found." });
      } catch (error) {
        if (error instanceof HttpRequestError) {
          writeJson(response, error.status, error.body);
          return;
        }
        writeJson(response, 500, {
          error: "InternalServerError",
          message: "Unexpected gateway error.",
        });
      }
    })();
  });
}
