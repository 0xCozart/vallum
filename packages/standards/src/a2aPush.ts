import { isIP } from "node:net";

import {
  A2A_TASK_MEDIA_TYPE,
  A2A_TASK_PROTOCOL_VERSION,
  redactA2ATaskForLog,
  type A2ATask,
} from "./a2aTask.js";

export interface A2APushNotificationAuthenticationInfo {
  readonly schemes: readonly string[];
}

export interface A2ATaskPushNotificationConfig {
  readonly id: string;
  readonly taskId: string;
  readonly url: string;
  readonly createdAt: string;
  readonly tenant?: string;
  readonly authentication?: A2APushNotificationAuthenticationInfo;
}

export interface ListA2APushNotificationConfigsResult {
  readonly configs: readonly A2ATaskPushNotificationConfig[];
  readonly nextPageToken?: string;
}

export interface A2APushNotificationPayload {
  readonly kind: "task";
  readonly task: A2ATask;
}

export interface A2APushNotificationDeliveryRequest {
  readonly method: "POST";
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: A2APushNotificationPayload;
  readonly json: string;
  readonly config: A2ATaskPushNotificationConfig;
}

export interface A2APushNotificationTransportResponse {
  readonly status: number;
}

export type A2APushNotificationTransport = (
  request: A2APushNotificationDeliveryRequest,
) => A2APushNotificationTransportResponse | Promise<A2APushNotificationTransportResponse>;

export interface A2APushHttpTransportOptions {
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

export interface A2APushNotificationDeliveryAttempt {
  readonly configId: string;
  readonly taskId: string;
  readonly url: string;
  readonly attemptNumber?: number;
  readonly observedAt?: string;
  readonly nextRetryAt?: string;
  readonly status: "delivered" | "failed" | "skipped";
  readonly httpStatus?: number;
  readonly errorCode?: "A2A_PUSH_TRANSPORT_UNCONFIGURED" | "A2A_PUSH_TRANSPORT_FAILED";
}

export interface A2APushNotificationDeliveryResult {
  readonly attempts: readonly A2APushNotificationDeliveryAttempt[];
}

export interface A2APushNotificationAttemptStore {
  record(attempt: A2APushNotificationDeliveryAttempt): void;
}

export type A2APushNotificationErrorCode =
  | "A2A_PUSH_CONFIG_INVALID"
  | "A2A_PUSH_CONFIG_NOT_FOUND"
  | "A2A_PUSH_URL_UNSAFE"
  | "A2A_PUSH_CREDENTIAL_STORAGE_UNSUPPORTED";

export class A2APushNotificationError extends Error {
  readonly code: A2APushNotificationErrorCode;
  readonly status: 400 | 404;

  constructor(code: A2APushNotificationErrorCode, message: string, status: 400 | 404 = 400) {
    super(message);
    this.name = "A2APushNotificationError";
    this.code = code;
    this.status = status;
  }
}

export class LocalA2APushNotificationStore {
  readonly #configs = new Map<string, Map<string, A2ATaskPushNotificationConfig>>();

  put(config: A2ATaskPushNotificationConfig): A2ATaskPushNotificationConfig {
    const taskConfigs = this.#configs.get(config.taskId) ?? new Map<string, A2ATaskPushNotificationConfig>();
    taskConfigs.set(config.id, clone(config));
    this.#configs.set(config.taskId, taskConfigs);
    return clone(config);
  }

  get(taskId: string, id: string): A2ATaskPushNotificationConfig | undefined {
    const config = this.#configs.get(taskId)?.get(id);
    return config ? clone(config) : undefined;
  }

  list(taskId: string, pageSize?: number): ListA2APushNotificationConfigsResult {
    const configs = [...(this.#configs.get(taskId)?.values() ?? [])]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(0, pageSize ?? Number.POSITIVE_INFINITY)
      .map((config) => clone(config));
    return { configs };
  }

  delete(taskId: string, id: string): boolean {
    const taskConfigs = this.#configs.get(taskId);
    if (!taskConfigs) return false;
    const deleted = taskConfigs.delete(id);
    if (taskConfigs.size === 0) this.#configs.delete(taskId);
    return deleted;
  }
}

export class LocalA2APushNotificationAttemptStore implements A2APushNotificationAttemptStore {
  readonly #attempts: A2APushNotificationDeliveryAttempt[] = [];

  record(attempt: A2APushNotificationDeliveryAttempt): void {
    this.#attempts.push(clone(attempt));
  }

  list(): readonly A2APushNotificationDeliveryAttempt[] {
    return this.#attempts.map((attempt) => clone(attempt));
  }
}

export function createA2APushNotificationConfig(options: {
  readonly store: LocalA2APushNotificationStore;
  readonly taskId: string;
  readonly value: unknown;
  readonly now?: Date;
}): A2ATaskPushNotificationConfig {
  const config = parsePushNotificationConfig(options.taskId, options.value);
  return options.store.put({
    ...config,
    id: config.id ?? `push_${crypto.randomUUID()}`,
    taskId: options.taskId,
    createdAt: (options.now ?? new Date()).toISOString(),
  });
}

export function getA2APushNotificationConfig(options: {
  readonly store: LocalA2APushNotificationStore;
  readonly taskId: string;
  readonly id: string;
}): A2ATaskPushNotificationConfig {
  const config = options.store.get(options.taskId, options.id);
  if (!config) {
    throw new A2APushNotificationError("A2A_PUSH_CONFIG_NOT_FOUND", "A2A push notification config was not found.", 404);
  }
  return config;
}

export function listA2APushNotificationConfigs(options: {
  readonly store: LocalA2APushNotificationStore;
  readonly taskId: string;
  readonly pageSize?: number;
}): ListA2APushNotificationConfigsResult {
  return options.store.list(options.taskId, options.pageSize);
}

export function deleteA2APushNotificationConfig(options: {
  readonly store: LocalA2APushNotificationStore;
  readonly taskId: string;
  readonly id: string;
}): { readonly taskId: string; readonly id: string; readonly deleted: boolean } {
  return {
    taskId: options.taskId,
    id: options.id,
    deleted: options.store.delete(options.taskId, options.id),
  };
}

export async function deliverA2APushNotifications(options: {
  readonly store: LocalA2APushNotificationStore;
  readonly task: A2ATask;
  readonly transport?: A2APushNotificationTransport;
  readonly attemptStore?: A2APushNotificationAttemptStore;
  readonly maxAttempts?: number;
  readonly retryDelayMs?: number;
  readonly now?: () => Date;
}): Promise<A2APushNotificationDeliveryResult> {
  const configs = options.store.list(options.task.id).configs;
  const attempts: A2APushNotificationDeliveryAttempt[] = [];
  const maxAttempts = normalizeMaxAttempts(options.maxAttempts);
  const retryDelayMs = normalizeRetryDelayMs(options.retryDelayMs);
  const now = options.now ?? (() => new Date());
  for (const config of configs) {
    const request = buildA2APushNotificationDeliveryRequest(config, options.task);
    if (!options.transport) {
      const attempt = {
        configId: config.id,
        taskId: config.taskId,
        url: config.url,
        attemptNumber: 1,
        observedAt: now().toISOString(),
        status: "skipped",
        errorCode: "A2A_PUSH_TRANSPORT_UNCONFIGURED",
      } satisfies A2APushNotificationDeliveryAttempt;
      recordPushAttempt(attempt, attempts, options.attemptStore);
      continue;
    }

    for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
      try {
        const response = await options.transport(request);
        const delivered = response.status >= 200 && response.status <= 299;
        const observedAt = now();
        const attempt = {
          configId: config.id,
          taskId: config.taskId,
          url: config.url,
          attemptNumber,
          observedAt: observedAt.toISOString(),
          status: delivered ? "delivered" : "failed",
          httpStatus: response.status,
          ...(delivered ? {} : {
            errorCode: "A2A_PUSH_TRANSPORT_FAILED",
            ...(attemptNumber < maxAttempts ? { nextRetryAt: addMilliseconds(observedAt, retryDelayMs).toISOString() } : {}),
          }),
        } satisfies A2APushNotificationDeliveryAttempt;
        recordPushAttempt(attempt, attempts, options.attemptStore);
        if (delivered) break;
      } catch {
        const observedAt = now();
        const attempt = {
          configId: config.id,
          taskId: config.taskId,
          url: config.url,
          attemptNumber,
          observedAt: observedAt.toISOString(),
          status: "failed",
          errorCode: "A2A_PUSH_TRANSPORT_FAILED",
          ...(attemptNumber < maxAttempts ? { nextRetryAt: addMilliseconds(observedAt, retryDelayMs).toISOString() } : {}),
        } satisfies A2APushNotificationDeliveryAttempt;
        recordPushAttempt(attempt, attempts, options.attemptStore);
      }
    }
  }
  return { attempts };
}

export function buildA2APushNotificationDeliveryRequest(
  config: A2ATaskPushNotificationConfig,
  task: A2ATask,
): A2APushNotificationDeliveryRequest {
  const body: A2APushNotificationPayload = {
    kind: "task",
    task: redactA2ATaskForLog(task) as A2ATask,
  };
  return {
    method: "POST",
    url: config.url,
    headers: {
      "content-type": `${A2A_TASK_MEDIA_TYPE}; charset=utf-8`,
      "a2a-version": A2A_TASK_PROTOCOL_VERSION,
    },
    body,
    json: `${JSON.stringify(body)}\n`,
    config: clone(config),
  };
}

export function createA2APushHttpTransport(
  options: A2APushHttpTransportOptions = {},
): A2APushNotificationTransport {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new A2APushNotificationError("A2A_PUSH_CONFIG_INVALID", "A2A push HTTP transport requires fetch support.");
  }
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);

  return async (request) => {
    const url = safeWebhookUrl(request.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: request.method,
        headers: publicDeliveryHeaders(request.headers),
        body: request.json,
        redirect: "manual",
        signal: controller.signal,
      });
      return { status: response.status };
    } finally {
      clearTimeout(timeout);
    }
  };
}

function parsePushNotificationConfig(
  taskId: string,
  value: unknown,
): Omit<A2ATaskPushNotificationConfig, "createdAt" | "id" | "taskId"> & { readonly id?: string } {
  if (!isRecord(value)) {
    throw new A2APushNotificationError("A2A_PUSH_CONFIG_INVALID", "A2A push notification config must be an object.");
  }
  const bodyTaskId = optionalString(value.taskId, "$.taskId");
  if (bodyTaskId !== undefined && bodyTaskId !== taskId) {
    throw new A2APushNotificationError("A2A_PUSH_CONFIG_INVALID", "A2A push notification task id must match the route.");
  }
  if (typeof value.token === "string" && value.token.trim() !== "") {
    throw new A2APushNotificationError(
      "A2A_PUSH_CREDENTIAL_STORAGE_UNSUPPORTED",
      "A2A local push notification config does not store webhook tokens.",
    );
  }
  const authentication = parseAuthentication(value.authentication);
  const id = optionalString(value.id, "$.id");
  const tenant = optionalString(value.tenant, "$.tenant");
  return {
    ...(id ? { id } : {}),
    url: safeWebhookUrl(value.url),
    ...(tenant ? { tenant } : {}),
    ...(authentication ? { authentication } : {}),
  };
}

function parseAuthentication(value: unknown): A2APushNotificationAuthenticationInfo | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new A2APushNotificationError("A2A_PUSH_CONFIG_INVALID", "A2A push notification authentication must be an object.");
  }
  if (typeof value.credentials === "string" && value.credentials.trim() !== "") {
    throw new A2APushNotificationError(
      "A2A_PUSH_CREDENTIAL_STORAGE_UNSUPPORTED",
      "A2A local push notification config does not store webhook credentials.",
    );
  }
  const schemes = Array.isArray(value.schemes)
    ? value.schemes
    : typeof value.scheme === "string"
      ? [value.scheme]
      : [];
  if (schemes.length === 0) {
    throw new A2APushNotificationError("A2A_PUSH_CONFIG_INVALID", "A2A push notification authentication schemes are required when authentication is present.");
  }
  const normalized = schemes.map((scheme, index) => {
    if (typeof scheme !== "string" || scheme.trim() === "") {
      throw new A2APushNotificationError("A2A_PUSH_CONFIG_INVALID", `A2A push notification authentication scheme ${index} is invalid.`);
    }
    return scheme.trim();
  });
  return { schemes: normalized };
}

function safeWebhookUrl(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new A2APushNotificationError("A2A_PUSH_CONFIG_INVALID", "A2A push notification URL is required.");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new A2APushNotificationError("A2A_PUSH_URL_UNSAFE", "A2A push notification URL must be a valid HTTPS URL.");
  }
  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || isUnsafeWebhookHost(parsed.hostname)
  ) {
    throw new A2APushNotificationError("A2A_PUSH_URL_UNSAFE", "A2A push notification URL must be public HTTPS without credentials, query strings, or fragments.");
  }
  return parsed.toString();
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new A2APushNotificationError("A2A_PUSH_CONFIG_INVALID", `${path} must be a non-empty string when present.`);
  }
  return value.trim();
}

function normalizeTimeoutMs(value: number | undefined): number {
  if (value === undefined) return 5000;
  if (!Number.isFinite(value) || value <= 0) {
    throw new A2APushNotificationError("A2A_PUSH_CONFIG_INVALID", "A2A push HTTP transport timeout must be positive.");
  }
  return Math.floor(value);
}

function normalizeMaxAttempts(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isFinite(value) || value <= 0) {
    throw new A2APushNotificationError("A2A_PUSH_CONFIG_INVALID", "A2A push delivery max attempts must be positive.");
  }
  return Math.floor(value);
}

function normalizeRetryDelayMs(value: number | undefined): number {
  if (value === undefined) return 1000;
  if (!Number.isFinite(value) || value < 0) {
    throw new A2APushNotificationError("A2A_PUSH_CONFIG_INVALID", "A2A push delivery retry delay must be zero or positive.");
  }
  return Math.floor(value);
}

function addMilliseconds(value: Date, milliseconds: number): Date {
  return new Date(value.getTime() + milliseconds);
}

function recordPushAttempt(
  attempt: A2APushNotificationDeliveryAttempt,
  attempts: A2APushNotificationDeliveryAttempt[],
  store: A2APushNotificationAttemptStore | undefined,
): void {
  attempts.push(attempt);
  store?.record(attempt);
}

function publicDeliveryHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const normalized = name.trim().toLowerCase();
    if (
      normalized === "authorization"
      || normalized === "proxy-authorization"
      || normalized === "cookie"
      || normalized === "set-cookie"
    ) {
      continue;
    }
    result[normalized] = value;
  }
  return result;
}

function isUnsafeWebhookHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    const [first = 0, second = 0] = normalized.split(".").map((octet) => Number.parseInt(octet, 10));
    return first === 0
      || first === 10
      || first === 127
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 198 && (second === 18 || second === 19))
      || first >= 224;
  }
  if (ipVersion === 6) {
    return normalized === "::"
      || normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || normalized.startsWith("fe80:");
  }
  return false;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
