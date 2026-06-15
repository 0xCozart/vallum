import type {
  ExecuteSponsoredTransactionRequest,
  ReserveGasRequest,
} from "../../packages/sdk/src/index.js";
import {
  createAgentRailBackendHandlers,
  type CreateAgentRailBackendHandlersOptions,
  type AgentRailExampleErrorBody,
  type AgentRailExampleResult,
} from "../node-backend/agentrail-backend.js";

export type CreateAgentRailNextApiRoutesOptions = CreateAgentRailBackendHandlersOptions;

export interface AgentRailNextApiRoutes {
  reserve(request: Request): Promise<Response>;
  execute(request: Request): Promise<Response>;
}

interface BadRequestBody {
  error: "BAD_REQUEST" | "METHOD_NOT_ALLOWED" | "UNSUPPORTED_MEDIA_TYPE";
  message: string;
}

type RouteResponseBody<TBody extends object> = TBody | AgentRailExampleErrorBody | BadRequestBody;

function jsonResponse<TBody extends object>(status: number, body: TBody, headers: HeadersInit = {}): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
}

function methodNotAllowed(): Response {
  return jsonResponse(
    405,
    {
      error: "METHOD_NOT_ALLOWED",
      message: "Use POST for this AgentRail endpoint.",
    },
    { allow: "POST" },
  );
}

function badRequest(message: string): Response {
  return jsonResponse(400, {
    error: "BAD_REQUEST",
    message,
  });
}

function unsupportedMediaType(): Response {
  return jsonResponse(415, {
    error: "UNSUPPORTED_MEDIA_TYPE",
    message: "Request content-type must be application/json.",
  });
}

async function readObjectBody(request: Request): Promise<Record<string, unknown> | Response> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return unsupportedMediaType();
  }

  let value: unknown;

  try {
    value = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return badRequest("Request body must be a JSON object.");
  }

  return value as Record<string, unknown>;
}

function optionalStringField(body: Record<string, unknown>, key: string): string | undefined | Response {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return badRequest(`${key} must be a non-empty string.`);
  }
  return value;
}

function optionalPositiveIntegerField(body: Record<string, unknown>, key: string): number | undefined | Response {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return badRequest(`${key} must be a positive safe integer.`);
  }
  return value;
}

function requiredString(body: Record<string, unknown>, key: string): string | Response {
  const value = optionalStringField(body, key);
  return value === undefined ? badRequest(`${key} must be a non-empty string.`) : value;
}

function requiredPositiveInteger(body: Record<string, unknown>, key: string): number | Response {
  const value = optionalPositiveIntegerField(body, key);
  return value === undefined ? badRequest(`${key} must be a positive safe integer.`) : value;
}

function asResponse<TBody extends object>(result: AgentRailExampleResult<TBody>): Response {
  return jsonResponse<RouteResponseBody<TBody>>(result.status, result.body);
}

function reserveInputFromBody(body: Record<string, unknown>): ReserveGasRequest | Response {
  const gasBudget = requiredPositiveInteger(body, "gasBudget");
  if (gasBudget instanceof Response) {
    return gasBudget;
  }

  const reserveDurationSecs = optionalPositiveIntegerField(body, "reserveDurationSecs");
  if (reserveDurationSecs instanceof Response) {
    return reserveDurationSecs;
  }

  const walletAddress = optionalStringField(body, "walletAddress");
  if (walletAddress instanceof Response) {
    return walletAddress;
  }

  const packageId = optionalStringField(body, "packageId");
  if (packageId instanceof Response) {
    return packageId;
  }

  const functionName = optionalStringField(body, "functionName");
  if (functionName instanceof Response) {
    return functionName;
  }

  return {
    gasBudget,
    reserveDurationSecs,
    walletAddress,
    packageId,
    functionName,
  };
}

function executeInputFromBody(body: Record<string, unknown>): ExecuteSponsoredTransactionRequest | Response {
  const reservationId = requiredString(body, "reservationId");
  if (reservationId instanceof Response) {
    return reservationId;
  }
  const agentRailTransactionId = requiredString(body, "agentRailTransactionId");
  if (agentRailTransactionId instanceof Response) {
    return agentRailTransactionId;
  }
  const transactionBytes = requiredString(body, "transactionBytes");
  if (transactionBytes instanceof Response) {
    return transactionBytes;
  }
  const userSignature = requiredString(body, "userSignature");
  if (userSignature instanceof Response) {
    return userSignature;
  }

  return {
    reservationId,
    agentRailTransactionId,
    transactionBytes,
    userSignature,
  };
}

export function createAgentRailNextApiRoutes(options: CreateAgentRailNextApiRoutesOptions): AgentRailNextApiRoutes {
  const backend = createAgentRailBackendHandlers(options);

  return {
    async reserve(request: Request): Promise<Response> {
      if (request.method !== "POST") {
        return methodNotAllowed();
      }

      const body = await readObjectBody(request);
      if (body instanceof Response) {
        return body;
      }
      const input = reserveInputFromBody(body);
      if (input instanceof Response) {
        return input;
      }

      return asResponse(await backend.reserve(input));
    },

    async execute(request: Request): Promise<Response> {
      if (request.method !== "POST") {
        return methodNotAllowed();
      }

      const body = await readObjectBody(request);
      if (body instanceof Response) {
        return body;
      }
      const input = executeInputFromBody(body);
      if (input instanceof Response) {
        return input;
      }

      return asResponse(await backend.execute(input));
    },
  };
}
