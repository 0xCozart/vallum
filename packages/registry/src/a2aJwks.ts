import type { JsonWebKey, KeyObject } from "node:crypto";

export const A2A_JWKS_WELL_KNOWN_PATH = "/.well-known/jwks.json" as const;
export const A2A_JWKS_MEDIA_TYPE = "application/jwk-set+json" as const;

export interface A2APublicJwksKeyInput {
  readonly keyId: string;
  readonly publicKey?: KeyObject;
  readonly jwk?: JsonWebKey;
}

export interface A2APublicJwksOptions {
  readonly keys: readonly A2APublicJwksKeyInput[];
  readonly cacheControl?: string;
}

export interface A2APublicJwksResponse {
  readonly path: typeof A2A_JWKS_WELL_KNOWN_PATH;
  readonly status: 200;
  readonly headers: Record<string, string>;
  readonly body: { readonly keys: readonly JsonWebKey[] };
  readonly json: string;
}

export type A2APublicJwksErrorCode =
  | "A2A_JWKS_NOT_FOUND"
  | "A2A_JWKS_METHOD_NOT_ALLOWED"
  | "A2A_JWKS_UNAVAILABLE";

export interface A2APublicJwksErrorResponse {
  readonly path: string;
  readonly status: 404 | 405;
  readonly headers: Record<string, string>;
  readonly body?: undefined;
  readonly json: string;
}

export type A2APublicJwksHandlerResponse = A2APublicJwksResponse | A2APublicJwksErrorResponse;

export interface A2APublicJwksRequest {
  readonly method?: string;
  readonly path?: string;
}

const PRIVATE_JWK_FIELDS = new Set(["d", "p", "q", "dp", "dq", "qi", "oth"]);

export function createA2APublicJwksResponse(options: A2APublicJwksOptions): A2APublicJwksResponse {
  if (options.keys.length === 0) {
    throw new Error("A2A JWKS requires at least one public key.");
  }

  const keys = options.keys.map(sanitizePublicJwk);
  const body = { keys };
  return {
    path: A2A_JWKS_WELL_KNOWN_PATH,
    status: 200,
    headers: successHeaders(options.cacheControl),
    body,
    json: `${JSON.stringify(body, null, 2)}\n`,
  };
}

export function handleA2APublicJwksRequest(
  request: A2APublicJwksRequest,
  options: A2APublicJwksOptions,
): A2APublicJwksHandlerResponse {
  const path = normalizePath(request.path ?? A2A_JWKS_WELL_KNOWN_PATH);
  if (path !== A2A_JWKS_WELL_KNOWN_PATH) {
    return errorResponse(path, 404, "A2A_JWKS_NOT_FOUND", "A2A JWKS is not served at this path.");
  }

  const method = (request.method ?? "GET").trim().toUpperCase();
  if (method !== "GET") {
    return errorResponse(
      path,
      405,
      "A2A_JWKS_METHOD_NOT_ALLOWED",
      "A2A JWKS only supports GET.",
      { allow: "GET" },
    );
  }

  try {
    return createA2APublicJwksResponse(options);
  } catch {
    return errorResponse(path, 404, "A2A_JWKS_UNAVAILABLE", "A2A JWKS is unavailable.");
  }
}

function sanitizePublicJwk(input: A2APublicJwksKeyInput): JsonWebKey {
  const keyId = input.keyId.trim();
  if (keyId === "") throw new Error("A2A JWKS key id is required.");
  if (input.publicKey && input.jwk) {
    throw new Error("A2A JWKS key input must provide either publicKey or jwk.");
  }
  if (!input.publicKey && !input.jwk) {
    throw new Error("A2A JWKS key input requires public key material.");
  }
  if (input.publicKey && input.publicKey.type !== "public") {
    throw new Error("A2A JWKS requires public key material.");
  }

  const jwk = input.publicKey
    ? input.publicKey.export({ format: "jwk" })
    : { ...input.jwk };
  assertPublicJwk(jwk);

  return {
    ...jwk,
    kid: keyId,
    use: "sig",
    alg: "EdDSA",
  };
}

function assertPublicJwk(jwk: JsonWebKey): void {
  if (typeof jwk.kty !== "string" || jwk.kty.trim() === "") {
    throw new Error("A2A JWKS key is missing public key metadata.");
  }
  for (const field of Object.keys(jwk)) {
    if (field in jwk) {
      const normalized = field.toLowerCase();
      if (
        PRIVATE_JWK_FIELDS.has(field)
        || normalized.includes("private")
        || normalized.includes("secret")
        || normalized.includes("token")
        || normalized.includes("mnemonic")
        || normalized.includes("seed")
      ) {
        throw new Error("A2A JWKS must not contain private key material.");
      }
    }
  }
}

function successHeaders(cacheControl = "no-store"): Record<string, string> {
  return {
    "content-type": `${A2A_JWKS_MEDIA_TYPE}; charset=utf-8`,
    "cache-control": cacheControl,
  };
}

function errorResponse(
  path: string,
  status: 404 | 405,
  code: A2APublicJwksErrorCode,
  message: string,
  headers: Record<string, string> = {},
): A2APublicJwksErrorResponse {
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
