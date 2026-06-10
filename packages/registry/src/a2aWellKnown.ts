import {
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  A2AAgentCardError,
  createA2AAgentCardFromProfile,
  type A2AAgentCard,
  type A2AAgentCardErrorCode,
  type CreateA2AAgentCardOptions,
} from "./a2aCard.js";

export const A2A_AGENT_CARD_MEDIA_TYPE = "application/a2a+json" as const;

export type A2AWellKnownErrorCode =
  | A2AAgentCardErrorCode
  | "A2A_WELL_KNOWN_NOT_FOUND"
  | "A2A_WELL_KNOWN_METHOD_NOT_ALLOWED"
  | "A2A_AGENT_CARD_UNAVAILABLE";

export interface A2AAgentCardWellKnownResponse {
  readonly path: typeof A2A_AGENT_CARD_WELL_KNOWN_PATH;
  readonly status: 200;
  readonly headers: Record<string, string>;
  readonly body: A2AAgentCard;
  readonly json: string;
}

export interface A2AWellKnownErrorResponse {
  readonly path: string;
  readonly status: 404 | 405 | 410;
  readonly headers: Record<string, string>;
  readonly body?: undefined;
  readonly json: string;
}

export type A2AWellKnownResponse = A2AAgentCardWellKnownResponse | A2AWellKnownErrorResponse;

export interface A2AWellKnownRequest {
  readonly method?: string;
  readonly path?: string;
}

export interface A2AAgentCardWellKnownOptions extends CreateA2AAgentCardOptions {
  readonly cacheControl?: string;
}

export function createA2AAgentCardWellKnownResponse(
  profile: unknown,
  options: A2AAgentCardWellKnownOptions = {},
): A2AAgentCardWellKnownResponse {
  const body = createA2AAgentCardFromProfile(profile, options);
  return {
    path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
    status: 200,
    headers: successHeaders(options.cacheControl),
    body,
    json: `${JSON.stringify(body, null, 2)}\n`,
  };
}

export function handleA2AAgentCardWellKnownRequest(
  request: A2AWellKnownRequest,
  profile: unknown,
  options: A2AAgentCardWellKnownOptions = {},
): A2AWellKnownResponse {
  const path = normalizePath(request.path ?? A2A_AGENT_CARD_WELL_KNOWN_PATH);
  if (path !== A2A_AGENT_CARD_WELL_KNOWN_PATH) {
    return errorResponse(path, 404, "A2A_WELL_KNOWN_NOT_FOUND", "A2A Agent Card is not served at this path.");
  }

  const method = (request.method ?? "GET").trim().toUpperCase();
  if (method !== "GET") {
    return errorResponse(
      path,
      405,
      "A2A_WELL_KNOWN_METHOD_NOT_ALLOWED",
      "A2A Agent Card discovery only supports GET.",
      { allow: "GET" },
    );
  }

  try {
    return createA2AAgentCardWellKnownResponse(profile, options);
  } catch (error) {
    if (error instanceof A2AAgentCardError) {
      return errorResponse(
        path,
        error.code === "PROFILE_REVOKED" || error.code === "PROFILE_EXPIRED" ? 410 : 404,
        error.code,
        "A2A Agent Card is unavailable.",
      );
    }
    return errorResponse(path, 404, "A2A_AGENT_CARD_UNAVAILABLE", "A2A Agent Card is unavailable.");
  }
}

function successHeaders(cacheControl = "no-store"): Record<string, string> {
  return {
    "content-type": `${A2A_AGENT_CARD_MEDIA_TYPE}; charset=utf-8`,
    "cache-control": cacheControl,
  };
}

function errorResponse(
  path: string,
  status: 404 | 405 | 410,
  code: A2AWellKnownErrorCode,
  message: string,
  headers: Record<string, string> = {},
): A2AWellKnownErrorResponse {
  return {
    path,
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
    json: `${JSON.stringify({ error: { code, message } })}\n`,
  };
}

function normalizePath(path: string): string {
  try {
    return new URL(path, "https://agent.local").pathname;
  } catch {
    return path;
  }
}
