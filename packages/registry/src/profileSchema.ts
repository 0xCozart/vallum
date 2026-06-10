export const AGENT_PROFILE_VERSION = "agent-profile/v1" as const;

export type AgentProfileStatus = "active" | "revoked" | "expired";
export type AgentWalletStatus = "active" | "disabled" | "revoked" | "rotated";

export interface AgentProfileWallet {
  readonly walletId: string;
  readonly address: string;
  readonly signerRef: string;
  readonly creationSource: "agent_created" | "operator_provisioned" | "imported_reference";
  readonly status: AgentWalletStatus;
  readonly rotatedToWalletId?: string;
}

export interface AgentProfileEndpoint {
  readonly type: "mcp" | "a2a" | "agent_card" | "https";
  readonly url: string;
}

export interface AgentProfileCapability {
  readonly id: string;
  readonly displayName?: string;
  readonly contracts?: readonly string[];
  readonly scopes?: readonly string[];
  readonly credentialRefs?: readonly string[];
}

export interface AgentProfileContractTemplate {
  readonly id: string;
  readonly packageId?: string;
  readonly module?: string;
  readonly functionName?: string;
}

export interface AgentProfilePaymentMethod {
  readonly type: "iota" | "x402" | "external";
  readonly asset: string;
  readonly address?: string;
}

export interface AgentProfileRevocation {
  readonly revoked: boolean;
  readonly reason?: string;
  readonly revokedAt?: string;
}

export interface AgentProfile {
  readonly version: typeof AGENT_PROFILE_VERSION;
  readonly name: string;
  readonly agentDid: string;
  readonly ownerDid: string;
  readonly wallet: AgentProfileWallet;
  readonly capabilities: readonly AgentProfileCapability[];
  readonly endpoints: readonly AgentProfileEndpoint[];
  readonly credentialRefs?: readonly string[];
  readonly supportedContracts?: readonly AgentProfileContractTemplate[];
  readonly paymentMethods?: readonly AgentProfilePaymentMethod[];
  readonly spendPolicyRef?: string;
  readonly reputationRef?: string;
  readonly expiresAt: string;
  readonly status: AgentProfileStatus;
  readonly revocation: AgentProfileRevocation;
  readonly metadata?: Record<string, string>;
}

export type AgentProfileValidationErrorCode =
  | "PROFILE_NOT_OBJECT"
  | "UNSUPPORTED_VERSION"
  | "REQUIRED_FIELD_MISSING"
  | "FIELD_INVALID"
  | "PROFILE_REVOKED"
  | "PROFILE_EXPIRED"
  | "SECRET_FIELD_NOT_ALLOWED";

export interface AgentProfileValidationError {
  readonly code: AgentProfileValidationErrorCode;
  readonly path: string;
  readonly message: string;
}

export type AgentProfileValidationResult =
  | {
      readonly ok: true;
      readonly profile: AgentProfile;
    }
  | {
      readonly ok: false;
      readonly errors: readonly AgentProfileValidationError[];
      readonly status?: AgentProfileStatus;
    };

export interface AgentProfileValidationOptions {
  readonly now?: Date;
}

export function validAgentProfileFixture(): AgentProfile {
  return {
    version: AGENT_PROFILE_VERSION,
    name: "researcher.demo.iota",
    agentDid: "did:iota:agent:researcher-demo",
    ownerDid: "did:iota:owner:research-team",
    wallet: {
      walletId: "wallet_researcher_demo",
      address: "0x1111111111111111111111111111111111111111111111111111111111111111",
      signerRef: "signer_ref_researcher_demo",
      creationSource: "agent_created",
      status: "active",
    },
    capabilities: [{
      id: "research.summary",
      displayName: "Research summary",
      contracts: ["escrow:v1"],
      scopes: ["contract:escrow", "action:open_escrow"],
      credentialRefs: ["credential:research-summary:v1"],
    }],
    endpoints: [
      { type: "mcp", url: "https://agent.example.test/mcp" },
      { type: "agent_card", url: "https://agent.example.test/.well-known/agent-card.json" },
    ],
    credentialRefs: ["credential:research-summary:v1"],
    supportedContracts: [{
      id: "escrow:v1",
      packageId: "0x2222222222222222222222222222222222222222222222222222222222222222",
      module: "escrow",
      functionName: "open_escrow",
    }],
    paymentMethods: [{
      type: "iota",
      asset: "IOTA",
      address: "0x1111111111111111111111111111111111111111111111111111111111111111",
    }],
    spendPolicyRef: "policy:researcher-demo",
    reputationRef: "reputation:researcher-demo",
    expiresAt: "2026-06-10T13:00:00.000Z",
    status: "active",
    revocation: {
      revoked: false,
    },
    metadata: {
      purpose: "profile-schema-fixture",
    },
  };
}

export function validateAgentProfile(
  value: unknown,
  options: AgentProfileValidationOptions = {},
): AgentProfileValidationResult {
  if (!isRecord(value)) {
    return fail("PROFILE_NOT_OBJECT", "$", "Agent profile must be a JSON object.");
  }
  if (value.version !== AGENT_PROFILE_VERSION) {
    return fail("UNSUPPORTED_VERSION", "$.version", "Agent profile version is unsupported.");
  }

  const profile = value as unknown as AgentProfile;
  const errors: AgentProfileValidationError[] = [];

  rejectSecretFields(errors, value);
  requireNonEmptyString(errors, profile.name, "$.name");
  requireNonEmptyString(errors, profile.agentDid, "$.agentDid");
  requireNonEmptyString(errors, profile.ownerDid, "$.ownerDid");
  requireWallet(errors, profile.wallet, "$.wallet");
  requireCapabilities(errors, profile.capabilities, "$.capabilities");
  requireEndpoints(errors, profile.endpoints, "$.endpoints");
  requireNonEmptyString(errors, profile.expiresAt, "$.expiresAt");
  requireRevocation(errors, profile.revocation, "$.revocation");

  const explicitStatus = normalizeStatus(profile.status);
  if (!explicitStatus) {
    push(errors, "FIELD_INVALID", "$.status", "Profile status must be active, revoked, or expired.");
  }

  if (typeof profile.expiresAt === "string" && profile.expiresAt.trim() !== "") {
    const expiresAt = Date.parse(profile.expiresAt);
    if (Number.isNaN(expiresAt)) {
      push(errors, "FIELD_INVALID", "$.expiresAt", "Profile expiry must be an ISO timestamp.");
    } else if (expiresAt <= (options.now ?? new Date()).getTime()) {
      push(errors, "PROFILE_EXPIRED", "$.expiresAt", "Agent profile is expired.");
    }
  }

  if (profile.revocation?.revoked || profile.status === "revoked") {
    push(errors, "PROFILE_REVOKED", "$.revocation.revoked", "Agent profile is revoked.");
  }
  if (profile.status === "expired") {
    push(errors, "PROFILE_EXPIRED", "$.status", "Agent profile status is expired.");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      ...(explicitStatus ? { status: explicitStatus } : {}),
    };
  }

  return { ok: true, profile };
}

function requireWallet(errors: AgentProfileValidationError[], value: unknown, path: string): void {
  if (!isRecord(value)) {
    push(errors, "REQUIRED_FIELD_MISSING", path, "Wallet object is required.");
    return;
  }
  requireNonEmptyString(errors, value.walletId, `${path}.walletId`);
  requireNonEmptyString(errors, value.address, `${path}.address`);
  requireNonEmptyString(errors, value.signerRef, `${path}.signerRef`);
  requireNonEmptyString(errors, value.creationSource, `${path}.creationSource`);
  if (!["active", "disabled", "revoked", "rotated"].includes(String(value.status))) {
    push(errors, "FIELD_INVALID", `${path}.status`, "Wallet status is invalid.");
  }
}

function requireCapabilities(errors: AgentProfileValidationError[], value: unknown, path: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    push(errors, "REQUIRED_FIELD_MISSING", path, "At least one capability is required.");
    return;
  }
  value.forEach((capability, index) => {
    if (!isRecord(capability)) {
      push(errors, "FIELD_INVALID", `${path}[${index}]`, "Capability must be an object.");
      return;
    }
    requireNonEmptyString(errors, capability.id, `${path}[${index}].id`);
  });
}

function requireEndpoints(errors: AgentProfileValidationError[], value: unknown, path: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    push(errors, "REQUIRED_FIELD_MISSING", path, "At least one endpoint is required.");
    return;
  }
  value.forEach((endpoint, index) => {
    if (!isRecord(endpoint)) {
      push(errors, "FIELD_INVALID", `${path}[${index}]`, "Endpoint must be an object.");
      return;
    }
    if (!["mcp", "a2a", "agent_card", "https"].includes(String(endpoint.type))) {
      push(errors, "FIELD_INVALID", `${path}[${index}].type`, "Endpoint type is invalid.");
    }
    requireNonEmptyString(errors, endpoint.url, `${path}[${index}].url`);
  });
}

function requireRevocation(errors: AgentProfileValidationError[], value: unknown, path: string): void {
  if (!isRecord(value)) {
    push(errors, "REQUIRED_FIELD_MISSING", path, "Revocation object is required.");
    return;
  }
  if (typeof value.revoked !== "boolean") {
    push(errors, "REQUIRED_FIELD_MISSING", `${path}.revoked`, "Revocation state is required.");
  }
}

function requireNonEmptyString(errors: AgentProfileValidationError[], value: unknown, path: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    push(errors, "REQUIRED_FIELD_MISSING", path, "Required string field is missing.");
  }
}

function rejectSecretFields(errors: AgentProfileValidationError[], value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      rejectSecretFields(errors, child, `${path}[${index}]`);
    });
    return;
  }
  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (isSecretField(key)) {
      push(errors, "SECRET_FIELD_NOT_ALLOWED", childPath, "Agent profile must not contain secret material.");
    }
    rejectSecretFields(errors, child, childPath);
  }
}

function normalizeStatus(value: unknown): AgentProfileStatus | undefined {
  return value === "active" || value === "revoked" || value === "expired" ? value : undefined;
}

function fail(
  code: AgentProfileValidationErrorCode,
  path: string,
  message: string,
): AgentProfileValidationResult {
  return { ok: false, errors: [{ code, path, message }] };
}

function push(
  errors: AgentProfileValidationError[],
  code: AgentProfileValidationErrorCode,
  path: string,
  message: string,
): void {
  errors.push({ code, path, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSecretField(key: string): boolean {
  return /^(seed|mnemonic|privateKey|private_key|rawKeypair|raw_keypair|rawTransactionBytes|raw_transaction_bytes|userSignature|user_signature|sponsorKey|sponsor_key|appApiKey|app_api_key|bearerToken|bearer_token|paymentCredential|payment_credential|signerSecret|signer_secret)$/i.test(key);
}
