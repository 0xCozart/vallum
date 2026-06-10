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
export const AGENTIC_GASKIT_A2A_PROFILE_EXTENSION_URI =
  "https://agentic-gaskit.dev/a2a/extensions/profile/v1" as const;

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
  readonly schemes: Record<string, readonly string[]>;
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
}

export type A2AAgentCardErrorCode =
  | AgentProfileValidationErrorCode
  | "A2A_ENDPOINT_MISSING"
  | "A2A_ENDPOINT_INVALID"
  | "UNSUPPORTED_A2A_PROTOCOL_VERSION"
  | "A2A_SECURITY_SCHEME_INVALID"
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
}

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
  const securitySchemeName = nonEmptyString(options.securitySchemeName ?? "gaskitBearer", "$.securitySchemeName");
  const securitySchemes = options.securitySchemes ?? defaultSecuritySchemes(securitySchemeName);
  assertValidSecuritySchemes(securitySchemes);
  const securityRequirements = options.securityRequirements ?? [{ schemes: { [securitySchemeName]: [] } }];
  assertValidSecurityRequirements(securityRequirements, securitySchemes);
  const profile = validation.profile;

  const card: A2AAgentCard = {
    name: profile.name,
    description: options.description ?? `Agentic GasKit agent ${profile.name}.`,
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
  return card;
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
    description: `Agentic GasKit capability ${capability.id}.`,
    tags: unique(["agentic-gaskit", ...(capability.scopes ?? []), ...(capability.contracts ?? [])]),
    inputModes,
    outputModes,
    securityRequirements,
  };
}

function publicProfileExtension(profile: AgentProfile): A2AAgentExtension {
  return {
    uri: AGENTIC_GASKIT_A2A_PROFILE_EXTENSION_URI,
    description: "Public Agentic GasKit profile context.",
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
        description: "Bearer token accepted by the Agentic GasKit A2A endpoint.",
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
      if (!knownSchemes.has(schemeName) || !Array.isArray(scopes)) {
        throw new A2AAgentCardError(
          "A2A_SECURITY_SCHEME_INVALID",
          "A2A security requirements must reference declared security schemes.",
          `$.securityRequirements[${index}].schemes.${schemeName}`,
        );
      }
    }
  });
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPrivateProfileField(key: string): boolean {
  return /^(seed|mnemonic|privateKey|private_key|rawKeypair|raw_keypair|rawTransactionBytes|raw_transaction_bytes|userSignature|user_signature|sponsorKey|sponsor_key|appApiKey|app_api_key|bearerToken|bearer_token|paymentCredential|payment_credential|signerSecret|signer_secret|signerRef|signer_ref|walletId|wallet_id|rotatedToWalletId|rotated_to_wallet_id|credentialRefs|credential_refs|revocation|metadata)$/i.test(key);
}
