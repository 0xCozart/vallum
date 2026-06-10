import type { AgentProfile } from "./profileSchema.js";
import type { AgentResolver, ResolveAgentErrorCode } from "./resolveAgent.js";

export type IotaIdentityVerificationErrorCode =
  | "PROFILE_UNVERIFIABLE"
  | "PROFILE_REVOKED"
  | "PROFILE_EXPIRED";

export interface IotaIdentityVerificationError {
  readonly code: IotaIdentityVerificationErrorCode;
  readonly message: string;
}

export type IotaIdentityVerificationResult =
  | {
      readonly ok: true;
      readonly agentDidDocument: unknown;
      readonly ownerDidDocument: unknown;
      readonly credentialRefsChecked: readonly string[];
    }
  | {
      readonly ok: false;
      readonly error: IotaIdentityVerificationError;
    };

export type IotaIdentityVerificationCacheEntry = Extract<IotaIdentityVerificationResult, { ok: true }> & {
  readonly cachedAt: string;
  readonly expiresAt: string;
};

export interface IotaIdentityVerificationCache {
  readonly get: (key: string) => IotaIdentityVerificationCacheEntry | undefined;
  readonly set: (key: string, entry: IotaIdentityVerificationCacheEntry) => void;
  readonly delete?: (key: string) => void;
}

export function createInMemoryIotaIdentityVerificationCache(): IotaIdentityVerificationCache {
  const entries = new Map<string, IotaIdentityVerificationCacheEntry>();
  return {
    get(key) {
      return entries.get(key);
    },
    set(key, entry) {
      entries.set(key, entry);
    },
    delete(key) {
      entries.delete(key);
    },
  };
}

export interface IotaIdentityDidResolver {
  /**
   * Matches the current IOTA Identity read surfaces:
   * IdentityClientReadOnly/IdentityClient expose resolveDid, while Resolver exposes
   * resolve. Keep both dependency-injected so tests do not require live IOTA.
   */
  readonly resolveDid?: (did: string) => Promise<unknown>;
  readonly resolve?: (did: string) => Promise<unknown>;
}

export interface IotaIdentityCredentialValidationContext {
  readonly profile: AgentProfile;
  readonly agentDidDocument: unknown;
  readonly ownerDidDocument: unknown;
}

export type IotaIdentityCredentialValidationResult =
  | {
      readonly ok: true;
      readonly evidence?: IotaIdentityCredentialEvidence;
    }
  | {
      readonly ok: false;
      readonly code: "CREDENTIAL_REVOKED" | "CREDENTIAL_EXPIRED" | "CREDENTIAL_UNVERIFIABLE";
      readonly message: string;
    };

export interface IotaIdentityCredentialEvidence {
  readonly issuerDid: string;
  readonly verificationMethod: string;
  readonly credentialTypes?: readonly string[];
  readonly credentialStatus?: IotaIdentityCredentialStatusEvidence;
  readonly issuedAt?: string;
  readonly expiresAt?: string;
}

export interface IotaIdentityCredentialStatusEvidence {
  readonly id?: string;
  readonly type: string;
  readonly revoked?: boolean;
}

export interface IotaIdentityVcTrustPolicy {
  readonly trustedIssuerDids: readonly string[];
  readonly allowedVerificationMethods: readonly string[];
  readonly requiredCredentialTypes?: readonly string[];
  readonly acceptedCredentialStatusTypes?: readonly string[];
  readonly requireCredentialStatus?: boolean;
  readonly maxCredentialAgeMs?: number;
}

export interface IotaIdentityCredentialValidator {
  /**
   * Adapter boundary for the current IOTA Identity JWT credential validator.
   * Concrete live implementations should resolve the issuer DID Document and use
   * the official validator; local tests only need this deterministic interface.
   */
  readonly validateCredentialRef: (
    credentialRef: string,
    context: IotaIdentityCredentialValidationContext,
  ) => Promise<IotaIdentityCredentialValidationResult>;
}

export interface IotaIdentityVerificationOptions {
  readonly didResolver: IotaIdentityDidResolver;
  readonly credentialValidator?: IotaIdentityCredentialValidator;
  readonly trustPolicy?: IotaIdentityVcTrustPolicy;
  readonly verificationCache?: IotaIdentityVerificationCache;
  readonly cacheTtlMs?: number;
  readonly forceRefresh?: boolean;
  readonly now?: () => Date;
}

export function createIotaIdentityVerifiedResolver(
  baseResolver: AgentResolver,
  options: IotaIdentityVerificationOptions,
): AgentResolver {
  return {
    async resolve(name) {
      const resolved = await baseResolver.resolve(name);
      if (!resolved.ok) return resolved;

      const identity = await verifyAgentProfileIdentity(resolved.profile, options);
      if (identity.ok) return resolved;

      return {
        ok: false,
        error: {
          code: identityErrorToResolveCode(identity.error.code),
          message: identity.error.message,
          name: resolved.profile.name,
        },
      };
    },
  };
}

export async function verifyAgentProfileIdentity(
  profile: AgentProfile,
  options: IotaIdentityVerificationOptions,
): Promise<IotaIdentityVerificationResult> {
  const now = options.now?.() ?? new Date();
  const cacheKey = identityVerificationCacheKey(profile, options.trustPolicy);
  if (options.forceRefresh) options.verificationCache?.delete?.(cacheKey);
  const cached = readFreshIdentityCache(options, cacheKey, now);
  if (cached) return withoutCacheMetadata(cached);

  const agentDidDocument = await resolveDidDocument(profile.agentDid, options.didResolver);
  if (!agentDidDocument.ok) return agentDidDocument;
  if (extractDidDocumentId(agentDidDocument.document) !== profile.agentDid) {
    return failIdentity("PROFILE_UNVERIFIABLE", "Resolved agent DID document does not match the profile.");
  }

  const ownerDidDocument = await resolveDidDocument(profile.ownerDid, options.didResolver);
  if (!ownerDidDocument.ok) return ownerDidDocument;
  if (extractDidDocumentId(ownerDidDocument.document) !== profile.ownerDid) {
    return failIdentity("PROFILE_UNVERIFIABLE", "Resolved owner DID document does not match the profile.");
  }

  const credentialRefs = profileCredentialRefs(profile);
  if (options.trustPolicy && !options.credentialValidator && credentialRefs.length > 0) {
    return failIdentity("PROFILE_UNVERIFIABLE", "IOTA Identity credential validator is required by trust policy.");
  }
  if (options.credentialValidator) {
    for (const credentialRef of credentialRefs) {
      let credential: IotaIdentityCredentialValidationResult;
      try {
        credential = await options.credentialValidator.validateCredentialRef(credentialRef, {
          profile,
          agentDidDocument: agentDidDocument.document,
          ownerDidDocument: ownerDidDocument.document,
        });
      } catch {
        return failIdentity("PROFILE_UNVERIFIABLE", "IOTA Identity credential validation failed.");
      }
      if (!credential.ok) {
        return failIdentity(credentialErrorToIdentityCode(credential.code), credential.message);
      }
      const trusted = evaluateIotaIdentityCredentialTrustPolicy(credential.evidence, options.trustPolicy, now);
      if (!trusted.ok) {
        return failIdentity(credentialErrorToIdentityCode(trusted.code), trusted.message);
      }
    }
  }

  const verified: Extract<IotaIdentityVerificationResult, { ok: true }> = {
    ok: true,
    agentDidDocument: agentDidDocument.document,
    ownerDidDocument: ownerDidDocument.document,
    credentialRefsChecked: credentialRefs,
  };
  writeIdentityCache(options, cacheKey, verified, now);
  return verified;
}

export function evaluateIotaIdentityCredentialTrustPolicy(
  evidence: IotaIdentityCredentialEvidence | undefined,
  policy: IotaIdentityVcTrustPolicy | undefined,
  now: Date = new Date(),
): IotaIdentityCredentialValidationResult {
  if (!policy) return { ok: true };
  const policyShape = validateTrustPolicyShape(policy);
  if (!policyShape.ok) return policyShape;
  if (!evidence) {
    return unverifiable("Credential evidence is missing trust-policy evidence.");
  }
  if (!policy.trustedIssuerDids.includes(evidence.issuerDid)) {
    return unverifiable("Credential evidence was not issued by a trusted DID.");
  }
  if (!isVerificationMethodAllowed(evidence.issuerDid, evidence.verificationMethod, policy.allowedVerificationMethods)) {
    return unverifiable("Credential evidence was not signed with an allowed verification method.");
  }
  for (const requiredType of policy.requiredCredentialTypes ?? []) {
    if (!evidence.credentialTypes?.includes(requiredType)) {
      return unverifiable("Credential evidence is missing a required credential type.");
    }
  }

  if (policy.requireCredentialStatus && !evidence.credentialStatus) {
    return unverifiable("Credential evidence is missing required revocation status evidence.");
  }
  if (evidence.credentialStatus) {
    if (evidence.credentialStatus.revoked) {
      return {
        ok: false,
        code: "CREDENTIAL_REVOKED",
        message: "Credential evidence is revoked by trust-policy evidence.",
      };
    }
    if (
      policy.acceptedCredentialStatusTypes
      && !policy.acceptedCredentialStatusTypes.includes(evidence.credentialStatus.type)
    ) {
      return unverifiable("Credential evidence uses an unsupported credential status type.");
    }
  }

  const expiresAt = parseOptionalTimestamp(evidence.expiresAt);
  if (expiresAt === "invalid") return unverifiable("Credential evidence has an invalid expiry timestamp.");
  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    return {
      ok: false,
      code: "CREDENTIAL_EXPIRED",
      message: "Credential evidence is expired.",
    };
  }

  if (policy.maxCredentialAgeMs !== undefined) {
    const issuedAt = parseOptionalTimestamp(evidence.issuedAt);
    if (issuedAt === "invalid" || !issuedAt) {
      return unverifiable("Credential evidence is missing valid issuance evidence required by trust policy.");
    }
    if (issuedAt.getTime() > now.getTime()) {
      return unverifiable("Credential evidence has a future issuance timestamp.");
    }
    if (now.getTime() - issuedAt.getTime() > policy.maxCredentialAgeMs) {
      return {
        ok: false,
        code: "CREDENTIAL_EXPIRED",
        message: "Credential evidence exceeds trust-policy max credential age.",
      };
    }
  }

  return { ok: true };
}

function readFreshIdentityCache(
  options: IotaIdentityVerificationOptions,
  key: string,
  now: Date,
): IotaIdentityVerificationCacheEntry | undefined {
  if (!isCacheEnabled(options)) return undefined;
  const entry = options.verificationCache?.get(key);
  if (!entry) return undefined;
  if (Date.parse(entry.expiresAt) > now.getTime()) return entry;
  options.verificationCache?.delete?.(key);
  return undefined;
}

function writeIdentityCache(
  options: IotaIdentityVerificationOptions,
  key: string,
  result: Extract<IotaIdentityVerificationResult, { ok: true }>,
  now: Date,
): void {
  if (!isCacheEnabled(options)) return;
  const ttlMs = options.cacheTtlMs ?? 0;
  options.verificationCache?.set(key, {
    ...result,
    cachedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  });
}

function withoutCacheMetadata(
  entry: IotaIdentityVerificationCacheEntry,
): Extract<IotaIdentityVerificationResult, { ok: true }> {
  return {
    ok: true,
    agentDidDocument: entry.agentDidDocument,
    ownerDidDocument: entry.ownerDidDocument,
    credentialRefsChecked: entry.credentialRefsChecked,
  };
}

function isCacheEnabled(options: IotaIdentityVerificationOptions): boolean {
  return Boolean(
    options.verificationCache
      && options.cacheTtlMs
      && Number.isFinite(options.cacheTtlMs)
      && options.cacheTtlMs > 0,
  );
}

function identityVerificationCacheKey(profile: AgentProfile, trustPolicy?: IotaIdentityVcTrustPolicy): string {
  return JSON.stringify({
    version: profile.version,
    name: profile.name,
    agentDid: profile.agentDid,
    ownerDid: profile.ownerDid,
    walletStatus: profile.wallet.status,
    expiresAt: profile.expiresAt,
    status: profile.status,
    revocation: {
      revoked: profile.revocation.revoked,
      revokedAt: profile.revocation.revokedAt ?? "",
    },
    credentialRefs: profileCredentialRefs(profile),
    trustPolicy: trustPolicyCacheKey(trustPolicy),
  });
}

async function resolveDidDocument(
  did: string,
  resolver: IotaIdentityDidResolver,
): Promise<{ readonly ok: true; readonly document: unknown } | { readonly ok: false; readonly error: IotaIdentityVerificationError }> {
  try {
    if (resolver.resolveDid) {
      return { ok: true, document: await resolver.resolveDid(did) };
    }
    if (resolver.resolve) {
      return { ok: true, document: await resolver.resolve(did) };
    }
  } catch {
    return {
      ok: false,
      error: {
        code: "PROFILE_UNVERIFIABLE",
        message: "IOTA Identity DID resolution failed.",
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "PROFILE_UNVERIFIABLE",
      message: "IOTA Identity DID resolver is not configured.",
    },
  };
}

function extractDidDocumentId(document: unknown): string | undefined {
  if (!isRecord(document)) return undefined;
  const id = document.id;
  if (typeof id === "string") return id;
  if (typeof id === "function") return String(id.call(document));
  if (id && typeof id === "object" && "toString" in id && typeof id.toString === "function") {
    return id.toString();
  }
  return undefined;
}

function profileCredentialRefs(profile: AgentProfile): readonly string[] {
  const refs = new Set<string>();
  profile.credentialRefs?.forEach((ref) => refs.add(ref));
  for (const capability of profile.capabilities) {
    capability.credentialRefs?.forEach((ref) => refs.add(ref));
  }
  return [...refs];
}

function credentialErrorToIdentityCode(
  code: Exclude<IotaIdentityCredentialValidationResult, { ok: true }>["code"],
): IotaIdentityVerificationErrorCode {
  if (code === "CREDENTIAL_REVOKED") return "PROFILE_REVOKED";
  if (code === "CREDENTIAL_EXPIRED") return "PROFILE_EXPIRED";
  return "PROFILE_UNVERIFIABLE";
}

function validateTrustPolicyShape(policy: IotaIdentityVcTrustPolicy): IotaIdentityCredentialValidationResult {
  if (
    policy.trustedIssuerDids.length === 0
    || !policy.trustedIssuerDids.every((issuerDid) => issuerDid.startsWith("did:iota:"))
  ) {
    return unverifiable("IOTA Identity trust policy has no trusted issuers.");
  }
  if (
    policy.allowedVerificationMethods.length === 0
    || !policy.allowedVerificationMethods.every((method) => method.startsWith("did:iota:") || method.startsWith("#"))
  ) {
    return unverifiable("IOTA Identity trust policy has no allowed verification methods.");
  }
  if (policy.requiredCredentialTypes?.some((credentialType) => credentialType.trim() === "")) {
    return unverifiable("IOTA Identity trust policy has an invalid credential type requirement.");
  }
  if (policy.acceptedCredentialStatusTypes?.some((statusType) => statusType.trim() === "")) {
    return unverifiable("IOTA Identity trust policy has an invalid credential status type.");
  }
  if (
    policy.maxCredentialAgeMs !== undefined
    && (!Number.isFinite(policy.maxCredentialAgeMs) || policy.maxCredentialAgeMs <= 0)
  ) {
    return unverifiable("IOTA Identity trust policy has an invalid max credential age.");
  }
  return { ok: true };
}

function isVerificationMethodAllowed(
  issuerDid: string,
  verificationMethod: string,
  allowedVerificationMethods: readonly string[],
): boolean {
  if (!verificationMethod.startsWith(`${issuerDid}#`)) return false;
  return allowedVerificationMethods.some((allowed) => {
    if (allowed === verificationMethod) return true;
    return allowed.startsWith("#") && `${issuerDid}${allowed}` === verificationMethod;
  });
}

function parseOptionalTimestamp(value: string | undefined): Date | "invalid" | undefined {
  if (value === undefined) return undefined;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "invalid";
  return new Date(timestamp);
}

function trustPolicyCacheKey(policy: IotaIdentityVcTrustPolicy | undefined): unknown {
  if (!policy) return null;
  return {
    trustedIssuerDids: [...policy.trustedIssuerDids].sort(),
    allowedVerificationMethods: [...policy.allowedVerificationMethods].sort(),
    requiredCredentialTypes: [...(policy.requiredCredentialTypes ?? [])].sort(),
    acceptedCredentialStatusTypes: [...(policy.acceptedCredentialStatusTypes ?? [])].sort(),
    requireCredentialStatus: Boolean(policy.requireCredentialStatus),
    maxCredentialAgeMs: policy.maxCredentialAgeMs ?? null,
  };
}

function unverifiable(message: string): IotaIdentityCredentialValidationResult {
  return {
    ok: false,
    code: "CREDENTIAL_UNVERIFIABLE",
    message,
  };
}

function identityErrorToResolveCode(code: IotaIdentityVerificationErrorCode): ResolveAgentErrorCode {
  return code;
}

function failIdentity(
  code: IotaIdentityVerificationErrorCode,
  message: string,
): IotaIdentityVerificationResult {
  return {
    ok: false,
    error: { code, message },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
