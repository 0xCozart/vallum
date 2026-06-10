import {
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  handleA2AAgentCardWellKnownRequest,
  type A2AAgentCardWellKnownOptions,
} from "@iota-gaskit/registry";
import type { AgentActionPolicy } from "@iota-gaskit/policy-gateway";

import {
  A2A_TASK_MEDIA_TYPE,
  A2A_TASK_PROTOCOL_VERSION,
  A2ATaskError,
  cancelA2ATask,
  getA2ATask,
  listA2ATasks,
  sendA2AMessage,
  type A2ATask,
  type A2AMessage,
  type A2AProcessMessageContext,
  type A2AProcessMessageResult,
  type LocalA2ATaskStore,
} from "./a2aTask.js";

export interface A2AHttpRequest {
  readonly method?: string;
  readonly path?: string;
  readonly headers?: Record<string, string | undefined>;
  readonly body?: unknown;
}

export type A2AHttpResponseBody =
  | {
      readonly kind: "agent-card";
      readonly [key: string]: unknown;
    }
  | {
      readonly kind: "task";
      readonly task: A2ATask;
      readonly policyDecision?: unknown;
    }
  | {
      readonly kind: "task-list";
      readonly tasks: readonly A2ATask[];
    }
  | {
      readonly error: {
        readonly code: A2AHttpErrorCode | string;
        readonly message: string;
      };
    };

export interface A2AHttpResponse {
  readonly status: 200 | 400 | 401 | 404 | 405 | 409 | 410 | 415 | 501 | 503;
  readonly headers: Record<string, string>;
  readonly body: A2AHttpResponseBody;
  readonly json: string;
}

export type A2AHttpErrorCode =
  | "A2A_AUTH_NOT_CONFIGURED"
  | "A2A_AUTH_REQUIRED"
  | "A2A_BODY_INVALID"
  | "A2A_ROUTE_NOT_FOUND"
  | "A2A_METHOD_NOT_ALLOWED"
  | "A2A_VERSION_NOT_SUPPORTED"
  | "A2A_OPERATION_UNSUPPORTED"
  | "A2A_POLICY_NOT_CONFIGURED"
  | "A2A_INTERNAL_ERROR";

export interface LocalA2AHttpHandlerOptions {
  readonly store: LocalA2ATaskStore;
  readonly agentCardProfile?: unknown;
  readonly agentCardOptions?: A2AAgentCardWellKnownOptions;
  readonly taskAuthToken?: string;
  readonly taskPolicy?: AgentActionPolicy;
  readonly now?: () => Date;
  readonly processMessage?: (
    context: A2AProcessMessageContext,
  ) => Promise<A2AProcessMessageResult> | A2AProcessMessageResult;
}

interface SendMessageBody {
  readonly message: A2AMessage;
  readonly manifest?: unknown;
  readonly protocolVersion?: string;
  readonly contextId?: string;
}

export const A2A_HTTP_SEND_MESSAGE_PATH = "/message:send" as const;
export const A2A_HTTP_STREAM_MESSAGE_PATH = "/message:stream" as const;
export const A2A_HTTP_TASKS_PATH = "/tasks" as const;

export async function handleLocalA2AHttpRequest(
  request: A2AHttpRequest,
  options: LocalA2AHttpHandlerOptions,
): Promise<A2AHttpResponse> {
  const method = normalizeMethod(request.method);
  const url = parsePath(request.path);

  if (url.pathname === A2A_AGENT_CARD_WELL_KNOWN_PATH) {
    return handleAgentCardRequest(method, url.pathname, options.agentCardProfile, {
      ...options.agentCardOptions,
      now: options.agentCardOptions?.now ?? options.now?.(),
    });
  }

  const auth = authorizeTaskRequest(request, options);
  if (auth) return auth;

  const versionError = validateProtocolVersion(request);
  if (versionError) return versionError;

  if (url.pathname === A2A_HTTP_STREAM_MESSAGE_PATH || isPushNotificationPath(url.pathname)) {
    return errorResponse(
      501,
      "A2A_OPERATION_UNSUPPORTED",
      "A2A streaming and push notification operations are not supported by this local Agentic GasKit server.",
    );
  }

  try {
    if (url.pathname === A2A_HTTP_SEND_MESSAGE_PATH) {
      if (method !== "POST") return methodNotAllowed(["POST"]);
      return await handleSendMessage(request, options);
    }

    if (url.pathname === A2A_HTTP_TASKS_PATH) {
      if (method !== "GET") return methodNotAllowed(["GET"]);
      return ok({
        kind: "task-list",
        ...listA2ATasks({
          store: options.store,
          contextId: optionalQuery(url, "contextId"),
          state: optionalQuery(url, "state") as never,
          includeArtifacts: booleanQuery(url, "includeArtifacts"),
          historyLength: numberQuery(url, "historyLength"),
          pageSize: numberQuery(url, "pageSize"),
        }),
      });
    }

    const taskRoute = matchTaskRoute(url.pathname);
    if (taskRoute) {
      if (taskRoute.action === "get") {
        if (method !== "GET") return methodNotAllowed(["GET"]);
        return ok({
          kind: "task",
          ...getA2ATask({
            store: options.store,
            id: taskRoute.taskId,
            includeArtifacts: booleanQuery(url, "includeArtifacts"),
            historyLength: numberQuery(url, "historyLength"),
          }),
        });
      }
      if (method !== "POST") return methodNotAllowed(["POST"]);
      return ok({
        kind: "task",
        ...cancelA2ATask({
          store: options.store,
          id: taskRoute.taskId,
          now: options.now?.(),
          includeArtifacts: booleanQuery(url, "includeArtifacts"),
        }),
      });
    }

    return errorResponse(404, "A2A_ROUTE_NOT_FOUND", "A2A route was not found.");
  } catch (error) {
    if (error instanceof A2ATaskError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(400, "A2A_BODY_INVALID", "A2A request body is invalid.");
  }
}

function handleAgentCardRequest(
  method: string,
  path: string,
  profile: unknown,
  options: A2AAgentCardWellKnownOptions = {},
): A2AHttpResponse {
  const response = handleA2AAgentCardWellKnownRequest({ method, path }, profile, options);
  if (response.status === 200) {
    return {
      status: 200,
      headers: response.headers,
      body: {
        kind: "agent-card",
        ...response.body,
      },
      json: response.json,
    };
  }
  return {
    status: response.status,
    headers: response.headers,
    body: JSON.parse(response.json) as A2AHttpResponseBody,
    json: response.json,
  };
}

async function handleSendMessage(
  request: A2AHttpRequest,
  options: LocalA2AHttpHandlerOptions,
): Promise<A2AHttpResponse> {
  if (!options.taskPolicy) {
    return errorResponse(503, "A2A_POLICY_NOT_CONFIGURED", "A2A task endpoint policy is not configured.");
  }
  const body = parseBody(request.body);
  if (!isSendMessageBody(body)) {
    return errorResponse(400, "A2A_BODY_INVALID", "A2A request body is invalid.");
  }
  return ok({
    kind: "task",
    ...await sendA2AMessage({
      store: options.store,
      protocolVersion: body.protocolVersion ?? A2A_TASK_PROTOCOL_VERSION,
      message: body.message,
      manifest: body.manifest,
      policy: body.message.taskId ? undefined : options.taskPolicy,
      now: options.now?.(),
      contextId: body.contextId,
      processMessage: options.processMessage,
    }),
  });
}

function authorizeTaskRequest(
  request: A2AHttpRequest,
  options: LocalA2AHttpHandlerOptions,
): A2AHttpResponse | undefined {
  if (!options.taskAuthToken || options.taskAuthToken.trim() === "") {
    return errorResponse(503, "A2A_AUTH_NOT_CONFIGURED", "A2A task endpoint authentication is not configured.");
  }
  const authorization = header(request.headers, "authorization");
  if (authorization !== `Bearer ${options.taskAuthToken}`) {
    return errorResponse(401, "A2A_AUTH_REQUIRED", "A2A task endpoints require bearer authentication.");
  }
  return undefined;
}

function validateProtocolVersion(request: A2AHttpRequest): A2AHttpResponse | undefined {
  const version = header(request.headers, "a2a-version");
  if (version !== undefined && version !== A2A_TASK_PROTOCOL_VERSION) {
    return errorResponse(400, "A2A_VERSION_NOT_SUPPORTED", "A2A protocol version is unsupported.");
  }
  return undefined;
}

function ok(body: Exclude<A2AHttpResponseBody, { error: unknown }>): A2AHttpResponse {
  return {
    status: 200,
    headers: {
      "content-type": `${A2A_TASK_MEDIA_TYPE}; charset=utf-8`,
      "cache-control": "no-store",
    },
    body,
    json: `${JSON.stringify(body)}\n`,
  };
}

function errorResponse(
  status: A2AHttpResponse["status"],
  code: A2AHttpErrorCode | string,
  message: string,
  headers: Record<string, string> = {},
): A2AHttpResponse {
  const body = { error: { code, message } };
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
    body,
    json: `${JSON.stringify(body)}\n`,
  };
}

function methodNotAllowed(allowed: readonly string[]): A2AHttpResponse {
  return errorResponse(
    405,
    "A2A_METHOD_NOT_ALLOWED",
    "A2A route does not support this method.",
    { allow: allowed.join(", ") },
  );
}

function parseBody(body: unknown): unknown {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    throw new A2ATaskError("A2A_MESSAGE_INVALID", "A2A request body is invalid.");
  }
}

function isSendMessageBody(value: unknown): value is SendMessageBody {
  if (!isRecord(value)) return false;
  return isRecord(value.message);
}

function matchTaskRoute(pathname: string): { readonly taskId: string; readonly action: "get" | "cancel" } | undefined {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "tasks") return undefined;
  const taskPart = parts[1] ?? "";
  if (taskPart.endsWith(":cancel")) {
    return { taskId: decodeURIComponent(taskPart.slice(0, -":cancel".length)), action: "cancel" };
  }
  return { taskId: decodeURIComponent(taskPart), action: "get" };
}

function isPushNotificationPath(pathname: string): boolean {
  return /^\/tasks\/[^/]+\/pushNotificationConfigs(?:\/[^/]+)?$/.test(pathname);
}

function parsePath(path = "/"): URL {
  try {
    return new URL(path, "https://agent.local");
  } catch {
    return new URL("/", "https://agent.local");
  }
}

function normalizeMethod(method = "GET"): string {
  return method.trim().toUpperCase();
}

function header(headers: Record<string, string | undefined> | undefined, name: string): string | undefined {
  const found = Object.entries(headers ?? {})
    .find(([key]) => key.toLowerCase() === name.toLowerCase());
  return found?.[1];
}

function booleanQuery(url: URL, name: string): boolean | undefined {
  const value = url.searchParams.get(name);
  if (value === null) return undefined;
  return value === "true";
}

function numberQuery(url: URL, name: string): number | undefined {
  const value = url.searchParams.get(name);
  if (value === null || value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function optionalQuery(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name);
  return value === null || value.trim() === "" ? undefined : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
