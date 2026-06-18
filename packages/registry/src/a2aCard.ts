import {
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyLike,
} from "node:crypto";

import {
  validateAgentProfile,
  type AgentProfile,
  type AgentProfileCapability,
  type AgentProfileEndpoint,
  type AgentProfilePaymentMethod,
  type AgentProfileValidationErrorCode,
} from "./profileSchema.js";

export const A2A_AGENT_CARD_PROTOCOL_VERSION = "1.0" as const;
export const A2A_AGENT_CARD_WELL_KNOWN_PATH = "/.well-known/agent-card.json" as const;
export const AGENTIC_VALLUM_A2A_PROFILE_EXTENSION_URI =
  "https://vallum.dev/a2a/extensions/profile/v1" as const;

export type A2AProtocolBinding = "JSONRPC" | "GRPC" | "HTTP+JSON";

export interface A2AAgentInterface {
  readonly url: string;
  readonly protocolBinding: A2AProtocolBinding | string;
  readonly tenant?: string;
  readonly protocolVersion: typeof A2A_AGENT_CARD_PROTOCOL_VERSION;
}

export interface A2AAgentProvider {
  readonly url: string;
  readonly organization: string;
}

export interface A2AAgentExtension {
  readonly uri: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly params?: Record<string, unknown>;
}

export interface A2AAgentCapabilities {
  readonly streaming?: boolean;
  readonly pushNotifications?: boolean;
  readonly extensions?: readonly A2AAgentExtension[];
  readonly extendedAgentCard?: boolean;
}

export interface A2ASecurityRequirement {
  readonly schemes: Record<string, { readonly list?: readonly string[] }>;
}

export type A2ASecurityScheme =
  | {
      readonly apiKeySecurityScheme: {
        readonly description?: string;
        readonly location: "query" | "header" | "cookie";
        readonly name: string;
      };
    }
  | {
      readonly httpAuthSecurityScheme: {
        readonly description?: string;
        readonly scheme: string;
        readonly bearerFormat?: string;
      };
    }
  | {
      readonly oauth2SecurityScheme: {
        readonly description?: string;
        readonly flows: Record<string, unknown>;
        readonly oauth2MetadataUrl?: string;
      };
    }
  | {
      readonly openIdConnectSecurityScheme: {
        readonly description?: string;
        readonly openIdConnectUrl: string;
      };
    }
  | {
      readonly mtlsSecurityScheme: {
        readonly description?: string;
      };
    };

export interface A2AAgentSkill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly examples?: readonly string[];
  readonly inputModes?: readonly string[];
  readonly outputModes?: readonly string[];
  readonly securityRequirements?: readonly A2ASecurityRequirement[];
}

export type A2AAgentCardSignatureAlgorithm = "EdDSA";

export interface A2AAgentCardSignature {
  readonly protected: string;
  readonly signature: string;
  readonly header?: Record<string, unknown>;
}

export interface A2AAgentCard {
  readonly name: string;
  readonly description: string;
  readonly supportedInterfaces: readonly A2AAgentInterface[];
  readonly provider?: A2AAgentProvider;
  readonly version: string;
  readonly documentationUrl?: string;
  readonly capabilities: A2AAgentCapabilities;
  readonly securitySchemes?: Record<string, A2ASecurityScheme>;
  readonly securityRequirements?: readonly A2ASecurityRequirement[];
  readonly defaultInputModes: readonly string[];
  readonly defaultOutputModes: readonly string[];
  readonly skills: readonly A2AAgentSkill[];
  readonly iconUrl?: string;
  readonly signatures?: readonly A2AAgentCardSignature[];
}

export type SignedA2AAgentCard = A2AAgentCard & {
  readonly signatures: readonly A2AAgentCardSignature[];
};

export type A2AAgentCardErrorCode =
  | AgentProfileValidationErrorCode
  | "A2A_ENDPOINT_MISSING"
  | "A2A_ENDPOINT_INVALID"
  | "UNSUPPORTED_A2A_PROTOCOL_VERSION"
  | "A2A_SECURITY_SCHEME_INVALID"
  | "A2A_SIGNATURE_ALGORITHM_UNSUPPORTED"
  | "A2A_SIGNATURE_INVALID"
  | "A2A_SIGNATURE_KEY_NOT_TRUSTED"
  | "A2A_SIGNATURE_MALFORMED"
  | "A2A_SIGNATURE_MISSING"
  | "A2A_SIGNATURE_EXPIRED"
  | "A2A_SIGNATURE_NOT_YET_VALID"
  | "PRIVATE_PROFILE_FIELD_NOT_ALLOWED";

export class A2AAgentCardError extends Error {
  readonly code: A2AAgentCardErrorCode;
  readonly path: string;

  constructor(code: A2AAgentCardErrorCode, message: string, path = "$") {
    super(message);
    this.name = "A2AAgentCardError";
    this.code = code;
    this.path = path;
  }
}

export interface CreateA2AAgentCardOptions {
  readonly now?: Date;
  readonly description?: string;
  readonly agentVersion?: string;
  readonly provider?: A2AAgentProvider;
  readonly documentationUrl?: string;
  readonly iconUrl?: string;
  readonly defaultInputModes?: readonly string[];
  readonly defaultOutputModes?: readonly string[];
  readonly protocolBinding?: A2AProtocolBinding | string;
  readonly protocolVersion?: string;
  readonly endpointUrl?: string;
  readonly tenant?: string;
  readonly securitySchemeName?: string;
  readonly securitySchemes?: Record<string, A2ASecurityScheme>;
  readonly securityRequirements?: readonly A2ASecurityRequirement[];
  readonly capabilities?: Partial<Omit<A2AAgentCapabilities, "extensions">> & {
    readonly extensions?: readonly A2AAgentExtension[];
  };
  readonly signature?: SignA2AAgentCardOptions;
}

export interface SignA2AAgentCardOptions {
  readonly keyId: string;
  readonly privateKey: KeyLike;
  readonly algorithm?: A2AAgentCardSignatureAlgorithm;
  readonly jwksUrl?: string;
  readonly signedAt?: Date;
  readonly notBefore?: Date;
  readonly expiresAt?: Date;
}

export interface VerifyA2AAgentCardSignatureOptions {
  readonly trustedKeys: Record<string, KeyLike | undefined>;
  readonly now?: Date;
  readonly requiredKeyId?: string;
}

export type A2AAgentCardSignatureVerification =
  | {
      readonly ok: true;
      readonly keyId: string;
      readonly algorithm: A2AAgentCardSignatureAlgorithm;
    }
  | {
      readonly ok: false;
      readonly code: Extract<
        A2AAgentCardErrorCode,
        | "A2A_SIGNATURE_ALGORITHM_UNSUPPORTED"
        | "A2A_SIGNATURE_INVALID"
        | "A2A_SIGNATURE_KEY_NOT_TRUSTED"
        | "A2A_SIGNATURE_MALFORMED"
        | "A2A_SIGNATURE_MISSING"
        | "A2A_SIGNATURE_EXPIRED"
        | "A2A_SIGNATURE_NOT_YET_VALID"
      >;
      readonly message: string;
    };

export function createA2AAgentCardFromProfile(
  value: unknown,
  options: CreateA2AAgentCardOptions = {},
): A2AAgentCard {
  const validation = validateAgentProfile(value, { now: options.now });
  if (!validation.ok) {
    const first = validation.errors[0];
    throw new A2AAgentCardError(
      first?.code ?? "FIELD_INVALID",
      first?.message ?? "Agent profile cannot be exposed as an A2A Agent Card.",
      first?.path,
    );
  }

  const protocolVersion = options.protocolVersion ?? A2A_AGENT_CARD_PROTOCOL_VERSION;
  if (protocolVersion !== A2A_AGENT_CARD_PROTOCOL_VERSION) {
    throw new A2AAgentCardError(
      "UNSUPPORTED_A2A_PROTOCOL_VERSION",
      "A2A Agent Card protocol version is unsupported.",
      "$.protocolVersion",
    );
  }

  const defaultInputModes = nonEmptyList(options.defaultInputModes ?? ["text/plain", "application/json"]);
  const defaultOutputModes = nonEmptyList(options.defaultOutputModes ?? ["text/plain", "application/json"]);
  const securitySchemeName = nonEmptyString(options.securitySchemeName ?? "vallumBearer", "$.securitySchemeName");
  const securitySchemes = options.securitySchemes ?? defaultSecuritySchemes(securitySchemeName);
  assertValidSecuritySchemes(securitySchemes);
  const securityRequirements = options.securityRequirements ?? [{ schemes: { [securitySchemeName]: { list: [] } } }];
  assertValidSecurityRequirements(securityRequirements, securitySchemes);
  const profile = validation.profile;

  const card: A2AAgentCard = {
    name: profile.name,
    description: options.description ?? `Vallum agent ${profile.name}.`,
    supportedInterfaces: [{
      url: resolveA2AEndpoint(profile, options.endpointUrl),
      protocolBinding: options.protocolBinding ?? "HTTP+JSON",
      ...(options.tenant ? { tenant: options.tenant } : {}),
      protocolVersion: A2A_AGENT_CARD_PROTOCOL_VERSION,
    }],
    ...(options.provider ? { provider: options.provider } : {}),
    version: options.agentVersion ?? profile.version,
    ...(options.documentationUrl ? { documentationUrl: options.documentationUrl } : {}),
    capabilities: {
      streaming: options.capabilities?.streaming ?? false,
      pushNotifications: options.capabilities?.pushNotifications ?? false,
      extendedAgentCard: options.capabilities?.extendedAgentCard ?? false,
      extensions: [
        publicProfileExtension(profile),
        ...(options.capabilities?.extensions ?? []),
      ],
    },
    securitySchemes,
    securityRequirements,
    defaultInputModes,
    defaultOutputModes,
    skills: profile.capabilities.map((capability) => capabilityToSkill(
      capability,
      defaultInputModes,
      defaultOutputModes,
      securityRequirements,
    )),
    ...(options.iconUrl ? { iconUrl: options.iconUrl } : {}),
  };
  assertNoPrivateProfileFields(card);
  return options.signature ? signA2AAgentCard(card, options.signature) : card;
}

export function signA2AAgentCard(
  card: A2AAgentCard,
  options: SignA2AAgentCardOptions,
): SignedA2AAgentCard {
  const algorithm = options.algorithm ?? "EdDSA";
  if (algorithm !== "EdDSA") {
    throw new A2AAgentCardError(
      "A2A_SIGNATURE_ALGORITHM_UNSUPPORTED",
      "A2A Agent Card signature algorithm is unsupported.",
      "$.signatures",
    );
  }
  const keyId = options.keyId.trim();
  if (keyId === "") {
    throw new A2AAgentCardError("A2A_SIGNATURE_INVALID", "A2A Agent Card signature key id is required.", "$.signatures");
  }
  if (options.jwksUrl && !isHttpsUrl(options.jwksUrl)) {
    throw new A2AAgentCardError("A2A_SIGNATURE_INVALID", "A2A Agent Card JWKS URL must be HTTPS.", "$.signatures");
  }

  assertNoPrivateProfileFields(card);
  const protectedHeader = {
    alg: algorithm,
    typ: "JOSE",
    kid: keyId,
    ...(options.jwksUrl ? { jku: options.jwksUrl } : {}),
    ...(options.signedAt ? { iat: isoDate(options.signedAt, "$.signatures.iat") } : {}),
    ...(options.notBefore ? { nbf: isoDate(options.notBefore, "$.signatures.nbf") } : {}),
    ...(options.expiresAt ? { exp: isoDate(options.expiresAt, "$.signatures.exp") } : {}),
  };
  const protectedHeaderEncoded = base64UrlJson(protectedHeader);
  const payloadEncoded = base64Url(canonicalizeA2AAgentCard(card));
  const signingInput = Buffer.from(`${protectedHeaderEncoded}.${payloadEncoded}`, "ascii");
  const signature = cryptoSign(null, signingInput, options.privateKey);

  return {
    ...card,
    signatures: [
      ...(card.signatures ?? []),
      {
        protected: protectedHeaderEncoded,
        signature: signature.toString("base64url"),
      },
    ],
  };
}

export function verifyA2AAgentCardSignature(
  card: A2AAgentCard,
  options: VerifyA2AAgentCardSignatureOptions,
): A2AAgentCardSignatureVerification {
  if (!card.signatures || card.signatures.length === 0) {
    return signatureFailure("A2A_SIGNATURE_MISSING", "A2A Agent Card does not include a signature.");
  }

  let firstFailure: A2AAgentCardSignatureVerification | undefined;
  for (const signature of card.signatures) {
    const protectedHeader = parseProtectedHeader(signature.protected);
    if (!protectedHeader) {
      firstFailure ??= signatureFailure("A2A_SIGNATURE_MALFORMED", "A2A Agent Card signature is malformed.");
      continue;
    }
    if (protectedHeader.alg !== "EdDSA") {
      firstFailure ??= signatureFailure(
        "A2A_SIGNATURE_ALGORITHM_UNSUPPORTED",
        "A2A Agent Card signature algorithm is unsupported.",
      );
      continue;
    }
    if (protectedHeader.typ !== undefined && protectedHeader.typ !== "JOSE") {
      firstFailure ??= signatureFailure("A2A_SIGNATURE_MALFORMED", "A2A Agent Card signature is malformed.");
      continue;
    }
    if (typeof protectedHeader.kid !== "string" || protectedHeader.kid.trim() === "") {
      firstFailure ??= signatureFailure("A2A_SIGNATURE_MALFORMED", "A2A Agent Card signature is malformed.");
      continue;
    }
    if (options.requiredKeyId && protectedHeader.kid !== options.requiredKeyId) {
      firstFailure ??= signatureFailure("A2A_SIGNATURE_KEY_NOT_TRUSTED", "A2A Agent Card signing key is not trusted.");
      continue;
    }
    const temporalFailure = validateSignatureTime(protectedHeader, options.now ?? new Date());
    if (temporalFailure) {
      firstFailure ??= temporalFailure;
      continue;
    }
    const trustedKey = options.trustedKeys[protectedHeader.kid];
    if (!trustedKey) {
      firstFailure ??= signatureFailure("A2A_SIGNATURE_KEY_NOT_TRUSTED", "A2A Agent Card signing key is not trusted.");
      continue;
    }
    if (!isBase64Url(signature.signature)) {
      firstFailure ??= signatureFailure("A2A_SIGNATURE_MALFORMED", "A2A Agent Card signature is malformed.");
      continue;
    }

    const payloadEncoded = base64Url(canonicalizeA2AAgentCard(card));
    const signingInput = Buffer.from(`${signature.protected}.${payloadEncoded}`, "ascii");
    const verified = cryptoVerify(
      null,
      signingInput,
      trustedKey,
      Buffer.from(signature.signature, "base64url"),
    );
    if (verified) {
      return {
        ok: true,
        keyId: protectedHeader.kid,
        algorithm: protectedHeader.alg,
      };
    }
    firstFailure ??= signatureFailure("A2A_SIGNATURE_INVALID", "A2A Agent Card signature verification failed.");
  }

  return firstFailure ?? signatureFailure("A2A_SIGNATURE_INVALID", "A2A Agent Card signature verification failed.");
}

export function canonicalizeA2AAgentCard(card: A2AAgentCard): string {
  return JSON.stringify(canonicalizeValue(card, "$", true));
}

function resolveA2AEndpoint(profile: AgentProfile, optionEndpointUrl?: string): string {
  const endpointUrl = optionEndpointUrl ?? profile.endpoints.find((endpoint) => endpoint.type === "a2a")?.url;
  if (!endpointUrl) {
    throw new A2AAgentCardError(
      "A2A_ENDPOINT_MISSING",
      "An A2A endpoint is required to generate an Agent Card.",
      "$.endpoints",
    );
  }
  if (!isHttpUrl(endpointUrl)) {
    throw new A2AAgentCardError("A2A_ENDPOINT_INVALID", "A2A endpoint must be an absolute HTTP(S) URL.", "$.endpoints");
  }
  return endpointUrl;
}

function capabilityToSkill(
  capability: AgentProfileCapability,
  inputModes: readonly string[],
  outputModes: readonly string[],
  securityRequirements: readonly A2ASecurityRequirement[],
): A2AAgentSkill {
  return {
    id: capability.id,
    name: capability.displayName ?? capability.id,
    description: `Vallum capability ${capability.id}.`,
    tags: unique(["vallum", ...(capability.scopes ?? []), ...(capability.contracts ?? [])]),
    inputModes,
    outputModes,
    securityRequirements,
  };
}

function publicProfileExtension(profile: AgentProfile): A2AAgentExtension {
  return {
    uri: AGENTIC_VALLUM_A2A_PROFILE_EXTENSION_URI,
    description: "Public Vallum profile context.",
    required: false,
    params: {
      profileVersion: profile.version,
      agentDid: profile.agentDid,
      ownerDid: profile.ownerDid,
      supportedContracts: profile.supportedContracts?.map((contract) => contract.id) ?? [],
      paymentMethods: publicPaymentMethods(profile.paymentMethods),
    },
  };
}

function publicPaymentMethods(methods: readonly AgentProfilePaymentMethod[] | undefined): readonly Record<string, string>[] {
  return (methods ?? []).map((method) => ({
    type: method.type,
    asset: method.asset,
  }));
}

function defaultSecuritySchemes(schemeName: string): Record<string, A2ASecurityScheme> {
  return {
    [schemeName]: {
      httpAuthSecurityScheme: {
        scheme: "Bearer",
        bearerFormat: "JWT",
        description: "Bearer token accepted by the Vallum A2A endpoint.",
      },
    },
  };
}

function assertValidSecuritySchemes(schemes: Record<string, A2ASecurityScheme>): void {
  for (const [name, scheme] of Object.entries(schemes)) {
    const oneOfKeys = [
      "apiKeySecurityScheme",
      "httpAuthSecurityScheme",
      "oauth2SecurityScheme",
      "openIdConnectSecurityScheme",
      "mtlsSecurityScheme",
    ].filter((key) => key in scheme);
    if (oneOfKeys.length !== 1) {
      throw new A2AAgentCardError(
        "A2A_SECURITY_SCHEME_INVALID",
        "A2A security schemes must contain exactly one scheme variant.",
        `$.securitySchemes.${name}`,
      );
    }
  }
}

function assertValidSecurityRequirements(
  requirements: readonly A2ASecurityRequirement[],
  schemes: Record<string, A2ASecurityScheme>,
): void {
  const knownSchemes = new Set(Object.keys(schemes));
  requirements.forEach((requirement, index) => {
    if (!isRecord(requirement.schemes)) {
      throw new A2AAgentCardError(
        "A2A_SECURITY_SCHEME_INVALID",
        "A2A security requirements must declare scheme scopes.",
        `$.securityRequirements[${index}].schemes`,
      );
    }
    for (const [schemeName, scopes] of Object.entries(requirement.schemes)) {
      if (!knownSchemes.has(schemeName) || !isStringListWrapper(scopes)) {
        throw new A2AAgentCardError(
          "A2A_SECURITY_SCHEME_INVALID",
          "A2A security requirements must reference declared security schemes.",
          `$.securityRequirements[${index}].schemes.${schemeName}`,
        );
      }
    }
  });
}

function isStringListWrapper(value: unknown): value is { readonly list?: readonly string[] } {
  return isRecord(value)
    && Object.keys(value).every((key) => key === "list")
    && isOptionalStringList(value.list);
}

function isOptionalStringList(value: unknown): value is readonly string[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

function assertNoPrivateProfileFields(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoPrivateProfileFields(child, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (isPrivateProfileField(key)) {
      throw new A2AAgentCardError(
        "PRIVATE_PROFILE_FIELD_NOT_ALLOWED",
        "A2A Agent Card must not expose private Agent Profile fields.",
        childPath,
      );
    }
    assertNoPrivateProfileFields(child, childPath);
  }
}

function nonEmptyList(values: readonly string[]): readonly string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (normalized.length === 0) {
    throw new A2AAgentCardError("FIELD_INVALID", "A2A media mode lists cannot be empty.");
  }
  return normalized;
}

function nonEmptyString(value: string, path: string): string {
  const normalized = value.trim();
  if (normalized === "") {
    throw new A2AAgentCardError("A2A_SECURITY_SCHEME_INVALID", "A2A security scheme names cannot be blank.", path);
  }
  return normalized;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))];
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPrivateProfileField(key: string): boolean {
  return /^(seed|mnemonic|privateKey|private_key|rawKeypair|raw_keypair|rawTransactionBytes|raw_transaction_bytes|userSignature|user_signature|sponsorKey|sponsor_key|appApiKey|app_api_key|bearerToken|bearer_token|paymentCredential|payment_credential|signerSecret|signer_secret|signerRef|signer_ref|walletId|wallet_id|rotatedToWalletId|rotated_to_wallet_id|credentialRefs|credential_refs|revocation|metadata)$/i.test(key);
}

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlJson(value: Record<string, unknown>): string {
  return base64Url(JSON.stringify(value));
}

function parseProtectedHeader(value: string): {
  readonly alg: string;
  readonly typ?: string;
  readonly kid?: string;
  readonly iat?: string;
  readonly nbf?: string;
  readonly exp?: string;
} | undefined {
  if (!isBase64Url(value)) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (!isRecord(parsed) || typeof parsed.alg !== "string") return undefined;
    return {
      alg: parsed.alg,
      ...(typeof parsed.typ === "string" ? { typ: parsed.typ } : {}),
      ...(typeof parsed.kid === "string" ? { kid: parsed.kid } : {}),
      ...(typeof parsed.iat === "string" ? { iat: parsed.iat } : {}),
      ...(typeof parsed.nbf === "string" ? { nbf: parsed.nbf } : {}),
      ...(typeof parsed.exp === "string" ? { exp: parsed.exp } : {}),
    };
  } catch {
    return undefined;
  }
}

function validateSignatureTime(
  protectedHeader: { readonly nbf?: string; readonly exp?: string },
  now: Date,
): A2AAgentCardSignatureVerification | undefined {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) {
    return signatureFailure("A2A_SIGNATURE_MALFORMED", "A2A Agent Card signature is malformed.");
  }
  if (protectedHeader.nbf !== undefined) {
    const notBeforeMs = Date.parse(protectedHeader.nbf);
    if (!Number.isFinite(notBeforeMs)) {
      return signatureFailure("A2A_SIGNATURE_MALFORMED", "A2A Agent Card signature is malformed.");
    }
    if (nowMs < notBeforeMs) {
      return signatureFailure("A2A_SIGNATURE_NOT_YET_VALID", "A2A Agent Card signature is not yet valid.");
    }
  }
  if (protectedHeader.exp !== undefined) {
    const expiresMs = Date.parse(protectedHeader.exp);
    if (!Number.isFinite(expiresMs)) {
      return signatureFailure("A2A_SIGNATURE_MALFORMED", "A2A Agent Card signature is malformed.");
    }
    if (nowMs >= expiresMs) {
      return signatureFailure("A2A_SIGNATURE_EXPIRED", "A2A Agent Card signature is expired.");
    }
  }
  return undefined;
}

function isoDate(value: Date, path: string): string {
  const time = value.getTime();
  if (!Number.isFinite(time)) {
    throw new A2AAgentCardError("A2A_SIGNATURE_INVALID", "A2A Agent Card signature time is invalid.", path);
  }
  return value.toISOString();
}

function isBase64Url(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function signatureFailure(
  code: Exclude<A2AAgentCardSignatureVerification, { ok: true }>["code"],
  message: string,
): A2AAgentCardSignatureVerification {
  return { ok: false, code, message };
}

function canonicalizeValue(value: unknown, path: string, isRoot = false): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new A2AAgentCardError("A2A_SIGNATURE_INVALID", "A2A Agent Card contains a non-finite number.", path);
    }
    return value;
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    throw new A2AAgentCardError("A2A_SIGNATURE_INVALID", "A2A Agent Card contains non-JSON data.", path);
  }
  if (Array.isArray(value)) {
    return value.map((child, index) => canonicalizeValue(child, `${path}[${index}]`));
  }
  if (!isRecord(value)) return value;

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((canonical, key) => {
      if (isRoot && key === "signatures") return canonical;
      const child = value[key];
      if (child === undefined) return canonical;
      canonical[key] = canonicalizeValue(child, `${path}.${key}`);
      return canonical;
    }, {});
}
