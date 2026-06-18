import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { evaluateSponsorshipPolicy } from "@vallum/policy-gateway";
import type { PolicyDecision, PolicyReasonCode, SponsorshipPolicy, SponsorshipRequestContext } from "@vallum/shared-types";

import { createInMemoryGatewayQuotaStore, type GatewayQuotaSnapshot, type GatewayQuotaStore } from "./quota-store.js";
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

export interface VerifiedTransactionIntent {
  transactionDigest: string;
  walletAddress?: string;
  packageId?: string;
  functionName?: string;
  gasBudget?: number;
  manifestDigest?: string;
  simulationDigest?: string;
}

export interface TransactionIntentVerifierInput {
  txBytes: string;
  userSignature?: string;
  reservation: Readonly<ReservationRecord>;
  appId: string;
  policy: SponsorshipPolicy;
}

export interface TransactionIntentVerifier {
  name: string;
  authority: "authoritative" | "local-test";
  verify(input: TransactionIntentVerifierInput): VerifiedTransactionIntent | Promise<VerifiedTransactionIntent>;
}

export interface GatewayConfig {
  apps: Record<string, GatewayAppConfig>;
  runtimeMode?: "local" | "production";
  upstreamBaseUrl?: string;
  upstreamBearerToken?: string;
  fetchImpl?: typeof fetch;
  transactionIntentVerifier?: TransactionIntentVerifier;
  quotaStore?: GatewayQuotaStore;
  now?: () => Date;
  reservationLimits?: {
    defaultTtlMs?: number;
    maxTtlMs?: number;
    terminalRetentionMs?: number;
    maxActivePerApp?: number;
  };
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

type ReservationStatus = "reserved" | "executing" | "executed" | "failed";

export interface ReservationRecord {
  id: string;
  upstreamReservationId: string;
  upstreamReservationIdForProxy: string | number;
  appId: string;
  walletAddress?: string;
  packageId?: string;
  functionName?: string;
  gasBudget?: number;
  createdAt: number;
  expiresAt: number;
  terminalRetainUntil?: number;
  verifiedIntent?: VerifiedTransactionIntent;
  status: ReservationStatus;
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

function positiveNumberFromUnknown(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function decodeBase64JsonRecord(value: string): JsonRecord | undefined {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) return undefined;
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return asRecord(JSON.parse(decoded));
  } catch {
    return undefined;
  }
}

function intentFromRecord(record: JsonRecord, txBytes: string): VerifiedTransactionIntent {
  return {
    transactionDigest: stringField(record, "transactionDigest") ?? stringField(record, "transaction_digest") ?? `sha256:${sha256Hex(txBytes)}`,
    walletAddress: stringField(record, "walletAddress") ?? stringField(record, "wallet_address"),
    packageId: stringField(record, "packageId") ?? stringField(record, "package_id"),
    functionName: stringField(record, "functionName") ?? stringField(record, "function_name"),
    gasBudget: positiveNumberFromUnknown(record["gasBudget"]) ?? positiveNumberFromUnknown(record["gas_budget"]),
    manifestDigest: stringField(record, "manifestDigest") ?? stringField(record, "manifest_digest"),
    simulationDigest: stringField(record, "simulationDigest") ?? stringField(record, "simulation_digest"),
  };
}

export function createLocalTransactionIntentVerifier(): TransactionIntentVerifier {
  return {
    name: "local-deterministic-transaction-intent-verifier",
    authority: "local-test",
    verify({ txBytes, reservation }) {
      const parsed = decodeBase64JsonRecord(txBytes);
      if (parsed) return intentFromRecord(parsed, txBytes);
      return {
        transactionDigest: `sha256:${sha256Hex(txBytes)}`,
        walletAddress: reservation.walletAddress,
        packageId: reservation.packageId,
        functionName: reservation.functionName,
        gasBudget: reservation.gasBudget,
      };
    },
  };
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

function policyRequiresDurableQuota(policy: SponsorshipPolicy): boolean {
  return (
    typeof policy.dailyRequestLimit === "number" ||
    typeof policy.dailyBudgetNanos === "number" ||
    typeof policy.maxRequestsPerWalletPerDay === "number"
  );
}

function validateReservationLimits(config: GatewayConfig): void {
  const limits = config.reservationLimits;
  if (!limits) return;
  for (const [key, value] of Object.entries(limits)) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
      throw new Error(`Gateway reservation limit ${key} must be a positive finite number when configured.`);
    }
  }
}

function validateGatewayConfig(config: GatewayConfig): void {
  validateReservationLimits(config);
  if (config.runtimeMode === "production") {
    if (!config.transactionIntentVerifier || config.transactionIntentVerifier.authority !== "authoritative") {
      throw new Error("Production gateway config requires an authoritative transaction intent verifier.");
    }
    for (const [appId, app] of Object.entries(config.apps)) {
      if (policyRequiresDurableQuota(app.policy) && config.quotaStore?.kind !== "production") {
        throw new Error(`Production gateway app ${appId} requires a production-safe durable quota store for daily limits.`);
      }
    }
  }
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

const DEFAULT_RESERVATION_TTL_MS = 60_000;
const DEFAULT_MAX_RESERVATION_TTL_MS = 10 * 60_000;
const DEFAULT_TERMINAL_RETENTION_MS = 60_000;
const DEFAULT_MAX_ACTIVE_RESERVATIONS_PER_APP = 1_000;

function reservationLimitConfig(config: GatewayConfig): Required<NonNullable<GatewayConfig["reservationLimits"]>> {
  return {
    defaultTtlMs: config.reservationLimits?.defaultTtlMs ?? DEFAULT_RESERVATION_TTL_MS,
    maxTtlMs: config.reservationLimits?.maxTtlMs ?? DEFAULT_MAX_RESERVATION_TTL_MS,
    terminalRetentionMs: config.reservationLimits?.terminalRetentionMs ?? DEFAULT_TERMINAL_RETENTION_MS,
    maxActivePerApp: config.reservationLimits?.maxActivePerApp ?? DEFAULT_MAX_ACTIVE_RESERVATIONS_PER_APP,
  };
}

function reservationTtlMs(body: JsonRecord, limits: Required<NonNullable<GatewayConfig["reservationLimits"]>>): number {
  const requestedSeconds = requestPositiveNumberField(body, "reserve_duration_secs");
  const requestedMs = requestedSeconds === undefined ? limits.defaultTtlMs : Math.ceil(requestedSeconds * 1_000);
  return Math.max(1, Math.min(requestedMs, limits.maxTtlMs));
}

function markTerminal(reservation: ReservationRecord, status: Extract<ReservationStatus, "executed" | "failed">, nowMs: number, retentionMs: number): void {
  reservation.status = status;
  reservation.terminalRetainUntil = nowMs + retentionMs;
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

interface PolicyRequestFields {
  gasBudget?: number;
  walletAddress?: string;
  packageId?: string;
  functionName?: string;
}

function policyFieldsFromBody(body: JsonRecord): PolicyRequestFields {
  return {
    gasBudget: requestPositiveNumberField(body, "gas_budget"),
    walletAddress: requestStringField(body, "wallet_address"),
    packageId: requestStringField(body, "package_id"),
    functionName: requestStringField(body, "function_name"),
  };
}

function policyContextFromFields(
  appId: string,
  snapshot: GatewayQuotaSnapshot,
  fields: PolicyRequestFields,
): SponsorshipRequestContext {
  return {
    appId,
    authenticated: true,
    walletAddress: fields.walletAddress,
    packageId: fields.packageId,
    functionName: fields.functionName,
    gasBudget: fields.gasBudget,
    appRequestsToday: snapshot.appRequestsToday,
    walletRequestsToday: snapshot.walletRequestsToday,
    appGasReservedToday: snapshot.appGasReservedToday,
  };
}

function policyContextFromVerifiedIntent(
  appId: string,
  reservation: ReservationRecord,
  verifiedIntent: VerifiedTransactionIntent,
  snapshot: GatewayQuotaSnapshot,
): SponsorshipRequestContext {
  return {
    appId,
    authenticated: true,
    walletAddress: verifiedIntent.walletAddress,
    packageId: verifiedIntent.packageId,
    functionName: verifiedIntent.functionName,
    gasBudget: verifiedIntent.gasBudget,
    appRequestsToday: Math.max(0, snapshot.appRequestsToday - 1),
    walletRequestsToday: Math.max(0, snapshot.walletRequestsToday - 1),
    appGasReservedToday: Math.max(0, snapshot.appGasReservedToday - (reservation.gasBudget ?? 0)),
  };
}

function policyNeedsVerifiedWallet(policy: SponsorshipPolicy): boolean {
  return Boolean(policy.deniedWallets?.length) || typeof policy.maxRequestsPerWalletPerDay === "number";
}

function policyNeedsVerifiedGasBudget(policy: SponsorshipPolicy): boolean {
  return typeof policy.dailyBudgetNanos === "number" || typeof policy.maxGasBudgetPerTx === "number";
}

function verifyIntentAgainstReservation(
  policy: SponsorshipPolicy,
  reservation: ReservationRecord,
  intent: VerifiedTransactionIntent,
): Exclude<PolicyDecision, { allowed: true }> | undefined {
  if (policyNeedsVerifiedWallet(policy) && !intent.walletAddress) {
    return { allowed: false, reasonCode: "WALLET_DENIED", message: "Verified wallet evidence is required by sponsorship policy." };
  }
  if (policyNeedsVerifiedGasBudget(policy) && typeof intent.gasBudget !== "number") {
    return { allowed: false, reasonCode: "GAS_BUDGET_TOO_HIGH", message: "Verified gas budget evidence is required by sponsorship policy." };
  }
  if (reservation.walletAddress && intent.walletAddress && reservation.walletAddress !== intent.walletAddress) {
    return { allowed: false, reasonCode: "WALLET_DENIED", message: "Verified wallet does not match the reserved wallet." };
  }
  if (reservation.packageId && intent.packageId && reservation.packageId !== intent.packageId) {
    return { allowed: false, reasonCode: "PACKAGE_NOT_ALLOWED", message: "Verified package does not match the reserved package." };
  }
  if (reservation.functionName && intent.functionName && reservation.functionName !== intent.functionName) {
    return { allowed: false, reasonCode: "FUNCTION_NOT_ALLOWED", message: "Verified function does not match the reserved function." };
  }
  if (typeof reservation.gasBudget === "number" && typeof intent.gasBudget === "number" && intent.gasBudget > reservation.gasBudget) {
    return { allowed: false, reasonCode: "GAS_BUDGET_TOO_HIGH", message: "Verified gas budget exceeds the reserved envelope." };
  }
  return undefined;
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
  const quotaStore = config.quotaStore ?? createInMemoryGatewayQuotaStore();
  const currentTime = () => config.now?.() ?? new Date();
  const limits = reservationLimitConfig(config);
  const reservations = new Map<string, ReservationRecord>();

  function cleanupReservations(nowMs: number): void {
    for (const [id, reservation] of reservations) {
      if ((reservation.status === "reserved" || reservation.status === "executing") && reservation.expiresAt <= nowMs) {
        markTerminal(reservation, "failed", nowMs, limits.terminalRetentionMs);
      }
      if (
        (reservation.status === "executed" || reservation.status === "failed") &&
        reservation.terminalRetainUntil !== undefined &&
        reservation.terminalRetainUntil <= nowMs
      ) {
        reservations.delete(id);
      }
    }
  }

  function activeReservationsForApp(appId: string, nowMs: number): number {
    let count = 0;
    for (const reservation of reservations.values()) {
      if (reservation.appId === appId && (reservation.status === "reserved" || reservation.status === "executing") && reservation.expiresAt > nowMs) {
        count += 1;
      }
    }
    return count;
  }

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
    const fields = policyFieldsFromBody(body);
    const snapshot = await quotaStore.snapshot({ appId: appMatch.appId, policy: appMatch.app.policy, ...fields, now: currentTime() });
    const decision = evaluateSponsorshipPolicy(appMatch.app.policy, policyContextFromFields(appMatch.appId, snapshot, fields));
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
    const now = currentTime();
    const nowMs = now.getTime();
    cleanupReservations(nowMs);
    if (activeReservationsForApp(appId, nowMs) >= limits.maxActivePerApp) {
      emitGatewayEvent(config, {
        operation: "reserve",
        outcome: "rejected",
        httpStatus: 429,
        appId,
        reasonCode: "EXECUTION_FAILED",
      });
      writeJson(response, 429, rejectionBody("EXECUTION_FAILED", "The app has reached its active reservation limit."));
      return;
    }
    const fields = policyFieldsFromBody(body);
    const { gasBudget, walletAddress, packageId, functionName } = fields;
    const agentRailTransactionId = `vallum_${randomUUID()}`;

    const eventContext = { appId, walletAddress, packageId, functionName, gasBudget };
    const quotaReservation = await quotaStore.reserve({
      key: agentRailTransactionId,
      appId,
      policy: appMatch.app.policy,
      ...fields,
      now,
    });
    if (!quotaReservation.reserved) {
      emitDecisionRejection(config, "reserve", quotaReservation.decision, eventContext);
      return rejectDecision(response, quotaReservation.decision);
    }

    const upstream = await proxyJson(config, "/v1/reserve_gas", body);
    if (upstream.status < 200 || upstream.status >= 300) {
      await quotaStore.rollback(agentRailTransactionId);
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
      await quotaStore.rollback(agentRailTransactionId);
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

    reservations.set(agentRailTransactionId, {
      id: agentRailTransactionId,
      upstreamReservationId,
      upstreamReservationIdForProxy: typeof upstreamReservationIdRaw === "number" ? upstreamReservationIdRaw : upstreamReservationId,
      appId,
      walletAddress,
      packageId,
      functionName,
      gasBudget,
      createdAt: nowMs,
      expiresAt: nowMs + reservationTtlMs(body, limits),
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
    const now = currentTime();
    const nowMs = now.getTime();
    cleanupReservations(nowMs);
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
    if (reservation.expiresAt <= nowMs) {
      markTerminal(reservation, "failed", nowMs, limits.terminalRetentionMs);
      emitGatewayEvent(config, {
        operation: "execute",
        outcome: "rejected",
        httpStatus: 409,
        reasonCode: "EXECUTION_FAILED",
        ...eventContext,
      });
      writeJson(response, 409, rejectionBody("EXECUTION_FAILED", "This Vallum reservation has expired."));
      return;
    }

    const txBytes = requestStringField(body, "tx_bytes");
    const userSignature = requestStringField(body, "user_sig");
    if (!txBytes) {
      throw new HttpRequestError(400, { error: "BadRequest", message: "tx_bytes must be a non-empty string." });
    }
    const verifier = config.transactionIntentVerifier;
    if (!verifier) {
      const decision = unavailableDecision("Gateway transaction intent verifier is not configured.");
      emitDecisionRejection(config, "execute", decision, eventContext);
      return rejectDecision(response, decision);
    }

    reservation.status = "executing";
    let verifiedIntent: VerifiedTransactionIntent;
    try {
      verifiedIntent = await verifier.verify({
        txBytes,
        userSignature,
        reservation,
        appId: appMatch.appId,
        policy: appMatch.app.policy,
      });
    } catch {
      reservation.status = "reserved";
      emitGatewayEvent(config, {
        operation: "execute",
        outcome: "rejected",
        httpStatus: 400,
        reasonCode: "EXECUTION_FAILED",
        ...eventContext,
      });
      writeJson(response, 400, rejectionBody("EXECUTION_FAILED", "Transaction intent could not be verified."));
      return;
    }

    const envelopeDecision = verifyIntentAgainstReservation(appMatch.app.policy, reservation, verifiedIntent);
    if (envelopeDecision) {
      reservation.status = "reserved";
      emitDecisionRejection(config, "execute", envelopeDecision, {
        ...eventContext,
        walletAddress: verifiedIntent.walletAddress ?? eventContext.walletAddress,
        packageId: verifiedIntent.packageId ?? eventContext.packageId,
        functionName: verifiedIntent.functionName ?? eventContext.functionName,
        gasBudget: verifiedIntent.gasBudget ?? eventContext.gasBudget,
      });
      return rejectDecision(response, envelopeDecision);
    }

    const decision = evaluateSponsorshipPolicy(
      appMatch.app.policy,
      policyContextFromVerifiedIntent(
        appMatch.appId,
        reservation,
        verifiedIntent,
        await quotaStore.snapshot({
          appId: appMatch.appId,
          policy: appMatch.app.policy,
          walletAddress: verifiedIntent.walletAddress ?? reservation.walletAddress,
          gasBudget: verifiedIntent.gasBudget,
          packageId: verifiedIntent.packageId,
          functionName: verifiedIntent.functionName,
          now,
        }),
      ),
    );
    if (decision.allowed === false) {
      reservation.status = "reserved";
      emitDecisionRejection(config, "execute", decision, {
        ...eventContext,
        walletAddress: verifiedIntent.walletAddress ?? eventContext.walletAddress,
        packageId: verifiedIntent.packageId ?? eventContext.packageId,
        functionName: verifiedIntent.functionName ?? eventContext.functionName,
        gasBudget: verifiedIntent.gasBudget ?? eventContext.gasBudget,
      });
      return rejectDecision(response, decision);
    }

    const upstreamBody: JsonRecord = { ...body, reservation_id: reservation.upstreamReservationIdForProxy };
    delete upstreamBody._saas_tx_id;
    delete upstreamBody.agentRailTransactionId;
    const upstream = await proxyJson(config, "/v1/execute_tx", upstreamBody);
    if (upstream.status >= 200 && upstream.status < 300) {
      reservation.verifiedIntent = verifiedIntent;
      markTerminal(reservation, "executed", nowMs, limits.terminalRetentionMs);
      emitGatewayEvent(config, {
        operation: "execute",
        outcome: "allowed",
        httpStatus: upstream.status,
        ...eventContext,
        walletAddress: verifiedIntent.walletAddress ?? eventContext.walletAddress,
        packageId: verifiedIntent.packageId ?? eventContext.packageId,
        functionName: verifiedIntent.functionName ?? eventContext.functionName,
        gasBudget: verifiedIntent.gasBudget ?? eventContext.gasBudget,
      });
      writeJson(response, upstream.status, upstream.json);
      return;
    }

    if (!isRetryableUpstreamFailure(upstream.status)) {
      markTerminal(reservation, "failed", nowMs, limits.terminalRetentionMs);
    } else {
      reservation.status = "reserved";
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
