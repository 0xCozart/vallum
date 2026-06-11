import { isIP } from "node:net";

import {
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  type A2AAgentCard,
  type A2AAgentCardSignature,
} from "./a2aCard.js";
import {
  A2A_JWKS_WELL_KNOWN_PATH,
  type A2APublicJwksResponse,
} from "./a2aJwks.js";

export interface A2APublicDiscoveryBundleOptions {
  readonly agentCard: A2AAgentCard;
  readonly jwks: A2APublicJwksResponse;
  readonly publicBaseUrl: string;
  readonly publicJwksUrl: string;
  readonly cacheControl?: string;
}

export interface A2APublicDiscoveryBundleFile {
  readonly path: typeof A2A_AGENT_CARD_WELL_KNOWN_PATH | typeof A2A_JWKS_WELL_KNOWN_PATH;
  readonly headers: Record<string, string>;
  readonly json: string;
}

export interface A2APublicDiscoveryBundle {
  readonly publicBaseUrl: string;
  readonly publicJwksUrl: string;
  readonly files: readonly [A2APublicDiscoveryBundleFile, A2APublicDiscoveryBundleFile];
}

export function createA2APublicDiscoveryBundle(
  options: A2APublicDiscoveryBundleOptions,
): A2APublicDiscoveryBundle {
  const publicBaseUrl = publicHttpsUrl(options.publicBaseUrl, "A2A public base URL");
  const publicJwksUrl = publicHttpsUrl(options.publicJwksUrl, "A2A public JWKS URL");
  const agentCard = sanitizeAgentCard(options.agentCard, publicBaseUrl, publicJwksUrl);
  const jwks = sanitizeJwks(options.jwks);
  const signingKeyIds = signatureKeyIds(agentCard.signatures);
  const jwksKeyIds = new Set(jwks.body.keys.map((key) => key.kid).filter((kid): kid is string => typeof kid === "string"));

  for (const keyId of signingKeyIds) {
    if (!jwksKeyIds.has(keyId)) {
      throw new Error("A2A public discovery bundle signing key is missing from JWKS.");
    }
  }

  const cacheControl = options.cacheControl ?? "no-store";
  return {
    publicBaseUrl,
    publicJwksUrl,
    files: [
      {
        path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
        headers: {
          "content-type": "application/a2a+json; charset=utf-8",
          "cache-control": cacheControl,
        },
        json: `${JSON.stringify(agentCard, null, 2)}\n`,
      },
      {
        path: A2A_JWKS_WELL_KNOWN_PATH,
        headers: {
          "content-type": "application/jwk-set+json; charset=utf-8",
          "cache-control": cacheControl,
        },
        json: jwks.json.endsWith("\n") ? jwks.json : `${jwks.json}\n`,
      },
    ],
  };
}

function sanitizeAgentCard(
  card: A2AAgentCard,
  publicBaseUrl: string,
  publicJwksUrl: string,
): A2AAgentCard {
  if (containsSecretLikeField(card)) {
    throw new Error("A2A public discovery bundle must not contain private Agent Card fields.");
  }
  if (!card.signatures || card.signatures.length === 0) {
    throw new Error("A2A public discovery bundle requires a signed Agent Card.");
  }
  if (!card.supportedInterfaces.some((entry) => entry.url === publicBaseUrl && entry.protocolBinding === "HTTP+JSON")) {
    throw new Error("A2A public discovery bundle Agent Card does not match the public base URL.");
  }
  for (const signature of card.signatures) {
    const protectedHeader = protectedHeaderJson(signature);
    if (protectedHeader.jku !== publicJwksUrl) {
      throw new Error("A2A public discovery bundle Agent Card signature JWKS URL does not match.");
    }
  }
  return JSON.parse(JSON.stringify(card)) as A2AAgentCard;
}

function sanitizeJwks(jwks: A2APublicJwksResponse): A2APublicJwksResponse {
  if (jwks.path !== A2A_JWKS_WELL_KNOWN_PATH) {
    throw new Error("A2A public discovery bundle JWKS path must be canonical.");
  }
  if (jwks.status !== 200 || !Array.isArray(jwks.body.keys) || jwks.body.keys.length === 0) {
    throw new Error("A2A public discovery bundle JWKS is invalid.");
  }
  if (containsSecretLikeField(jwks.body)) {
    throw new Error("A2A public discovery bundle JWKS must not contain private key material.");
  }
  return jwks;
}

function signatureKeyIds(signatures: readonly A2AAgentCardSignature[] | undefined): readonly string[] {
  if (!signatures || signatures.length === 0) {
    throw new Error("A2A public discovery bundle requires a signed Agent Card.");
  }
  return signatures.map((signature) => {
    const kid = protectedHeaderJson(signature).kid;
    if (typeof kid !== "string" || kid.trim() === "") {
      throw new Error("A2A public discovery bundle signature key id is invalid.");
    }
    return kid;
  });
}

function protectedHeaderJson(signature: A2AAgentCardSignature): Record<string, unknown> {
  try {
    const parsed = JSON.parse(Buffer.from(signature.protected, "base64url").toString("utf8")) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // handled below
  }
  throw new Error("A2A public discovery bundle signature is malformed.");
}

function publicHttpsUrl(value: string, label: string): string {
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:"
      && url.hostname
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
      && !isUnsafePublicHost(url.hostname)
    ) return url.toString();
  } catch {
    // handled below
  }
  throw new Error(`${label} must be public HTTPS without credentials, query strings, or fragments.`);
}

function containsSecretLikeField(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    for (const [key, nested] of Object.entries(current)) {
      const normalized = key.toLowerCase();
      if (
        normalized.includes("private")
        || normalized.includes("secret")
        || normalized.includes("token")
        || normalized.includes("credential")
        || normalized.includes("signer")
        || normalized.includes("mnemonic")
        || normalized.includes("seed")
        || normalized === "d"
        || normalized === "p"
        || normalized === "q"
        || normalized === "dp"
        || normalized === "dq"
        || normalized === "qi"
        || normalized === "oth"
      ) {
        return true;
      }
      if (nested && typeof nested === "object") stack.push(nested);
    }
  }
  return false;
}

function isUnsafePublicHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local")) return true;

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
