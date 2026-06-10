import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createIotaIdentityVerifiedResolver,
  createInMemoryIotaIdentityVerificationCache,
  createLocalAgentResolver,
  evaluateIotaIdentityCredentialTrustPolicy,
  verifyAgentProfileIdentity,
  validAgentProfileFixture,
  type IotaIdentityCredentialValidator,
  type IotaIdentityCredentialEvidence,
  type IotaIdentityDidResolver,
  type IotaIdentityVcTrustPolicy,
} from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");
const trustedIssuerDid = "did:iota:issuer:agent-registry";
const trustedVerificationMethod = `${trustedIssuerDid}#agent-capability-key-1`;
const trustPolicy: IotaIdentityVcTrustPolicy = {
  trustedIssuerDids: [trustedIssuerDid],
  allowedVerificationMethods: ["#agent-capability-key-1"],
  requiredCredentialTypes: ["VerifiableCredential", "AgentCapabilityCredential"],
  acceptedCredentialStatusTypes: ["RevocationBitmap2022", "StatusList2021"],
  requireCredentialStatus: true,
  maxCredentialAgeMs: 7 * 24 * 60 * 60 * 1000,
};

test("verifyAgentProfileIdentity resolves agent and owner DIDs and validates credential refs", async () => {
  const profile = validAgentProfileFixture();
  const resolvedDids: string[] = [];
  const checkedCredentialRefs: string[] = [];

  const result = await verifyAgentProfileIdentity(profile, {
    didResolver: didResolverFor(profile.agentDid, profile.ownerDid, resolvedDids),
    credentialValidator: credentialValidator(checkedCredentialRefs),
  });

  assert.deepEqual(result, {
    ok: true,
    agentDidDocument: { id: profile.agentDid },
    ownerDidDocument: { id: profile.ownerDid },
    credentialRefsChecked: ["credential:research-summary:v1"],
  });
  assert.deepEqual(resolvedDids, [profile.agentDid, profile.ownerDid]);
  assert.deepEqual(checkedCredentialRefs, ["credential:research-summary:v1"]);
});

test("verifyAgentProfileIdentity fails closed when a resolved DID document does not match the profile", async () => {
  const profile = validAgentProfileFixture();

  const result = await verifyAgentProfileIdentity(profile, {
    didResolver: {
      async resolveDid(did) {
        return { id: did === profile.agentDid ? "did:iota:agent:impostor" : did };
      },
    },
  });

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "PROFILE_UNVERIFIABLE",
      message: "Resolved agent DID document does not match the profile.",
    },
  });
});

test("IOTA Identity verified resolver maps revoked credentials to revoked profile errors", async () => {
  const profile = validAgentProfileFixture();
  const baseResolver = createLocalAgentResolver({ profiles: [profile], now: () => now });
  const resolver = createIotaIdentityVerifiedResolver(baseResolver, {
    didResolver: didResolverFor(profile.agentDid, profile.ownerDid),
    credentialValidator: {
      async validateCredentialRef() {
        return {
          ok: false,
          code: "CREDENTIAL_REVOKED",
          message: "Capability credential is revoked.",
        };
      },
    },
  });

  const result = await resolver.resolve(profile.name);

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "PROFILE_REVOKED",
      message: "Capability credential is revoked.",
      name: profile.name,
    },
  });
});

test("IOTA Identity verified resolver fails closed when credential validation throws", async () => {
  const profile = validAgentProfileFixture();
  const baseResolver = createLocalAgentResolver({ profiles: [profile], now: () => now });
  const resolver = createIotaIdentityVerifiedResolver(baseResolver, {
    didResolver: didResolverFor(profile.agentDid, profile.ownerDid),
    credentialValidator: {
      async validateCredentialRef() {
        throw new Error("validator unavailable");
      },
    },
  });

  const result = await resolver.resolve(profile.name);

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "PROFILE_UNVERIFIABLE",
      message: "IOTA Identity credential validation failed.",
      name: profile.name,
    },
  });
});

test("IOTA Identity trust policy accepts trusted issuer verification method type status and freshness", () => {
  const decision = evaluateIotaIdentityCredentialTrustPolicy({
    issuerDid: trustedIssuerDid,
    verificationMethod: trustedVerificationMethod,
    credentialTypes: ["VerifiableCredential", "AgentCapabilityCredential"],
    credentialStatus: {
      id: `${trustedIssuerDid}#revocation-bitmap?index=42`,
      type: "RevocationBitmap2022",
      revoked: false,
    },
    issuedAt: "2026-06-09T12:00:00.000Z",
    expiresAt: "2026-06-11T12:00:00.000Z",
  }, trustPolicy, now);

  assert.deepEqual(decision, { ok: true });
});

test("IOTA Identity trust policy fails closed on untrusted or uncontrolled verification methods", () => {
  const untrustedIssuer = evaluateIotaIdentityCredentialTrustPolicy({
    issuerDid: "did:iota:issuer:unknown",
    verificationMethod: "did:iota:issuer:unknown#agent-capability-key-1",
    credentialTypes: ["VerifiableCredential", "AgentCapabilityCredential"],
    credentialStatus: { type: "RevocationBitmap2022", revoked: false },
    issuedAt: "2026-06-09T12:00:00.000Z",
  }, trustPolicy, now);

  const wrongMethod = evaluateIotaIdentityCredentialTrustPolicy({
    issuerDid: trustedIssuerDid,
    verificationMethod: `${trustedIssuerDid}#other-key`,
    credentialTypes: ["VerifiableCredential", "AgentCapabilityCredential"],
    credentialStatus: { type: "RevocationBitmap2022", revoked: false },
    issuedAt: "2026-06-09T12:00:00.000Z",
  }, trustPolicy, now);

  const uncontrolledMethod = evaluateIotaIdentityCredentialTrustPolicy({
    issuerDid: trustedIssuerDid,
    verificationMethod: "did:iota:issuer:other#agent-capability-key-1",
    credentialTypes: ["VerifiableCredential", "AgentCapabilityCredential"],
    credentialStatus: { type: "RevocationBitmap2022", revoked: false },
    issuedAt: "2026-06-09T12:00:00.000Z",
  }, trustPolicy, now);

  assert.deepEqual(untrustedIssuer, {
    ok: false,
    code: "CREDENTIAL_UNVERIFIABLE",
    message: "Credential evidence was not issued by a trusted DID.",
  });
  assert.deepEqual(wrongMethod, {
    ok: false,
    code: "CREDENTIAL_UNVERIFIABLE",
    message: "Credential evidence was not signed with an allowed verification method.",
  });
  assert.deepEqual(uncontrolledMethod, wrongMethod);
});

test("IOTA Identity trust policy fails closed on missing type and unsupported status", () => {
  const missingType = evaluateIotaIdentityCredentialTrustPolicy({
    issuerDid: trustedIssuerDid,
    verificationMethod: trustedVerificationMethod,
    credentialTypes: ["VerifiableCredential"],
    credentialStatus: { type: "RevocationBitmap2022", revoked: false },
    issuedAt: "2026-06-09T12:00:00.000Z",
  }, trustPolicy, now);

  const unsupportedStatus = evaluateIotaIdentityCredentialTrustPolicy({
    issuerDid: trustedIssuerDid,
    verificationMethod: trustedVerificationMethod,
    credentialTypes: ["VerifiableCredential", "AgentCapabilityCredential"],
    credentialStatus: { type: "UnknownStatus2026", revoked: false },
    issuedAt: "2026-06-09T12:00:00.000Z",
  }, trustPolicy, now);

  const missingStatus = evaluateIotaIdentityCredentialTrustPolicy({
    issuerDid: trustedIssuerDid,
    verificationMethod: trustedVerificationMethod,
    credentialTypes: ["VerifiableCredential", "AgentCapabilityCredential"],
    issuedAt: "2026-06-09T12:00:00.000Z",
  }, trustPolicy, now);

  assert.deepEqual(missingType, {
    ok: false,
    code: "CREDENTIAL_UNVERIFIABLE",
    message: "Credential evidence is missing a required credential type.",
  });
  assert.deepEqual(unsupportedStatus, {
    ok: false,
    code: "CREDENTIAL_UNVERIFIABLE",
    message: "Credential evidence uses an unsupported credential status type.",
  });
  assert.deepEqual(missingStatus, {
    ok: false,
    code: "CREDENTIAL_UNVERIFIABLE",
    message: "Credential evidence is missing required revocation status evidence.",
  });
});

test("IOTA Identity trust policy maps revoked expired and stale credentials to profile failures", async () => {
  const profile = validAgentProfileFixture();
  const revoked = await verifyAgentProfileIdentity(profile, {
    didResolver: didResolverFor(profile.agentDid, profile.ownerDid),
    credentialValidator: credentialValidatorWithEvidence({
      credentialStatus: { type: "RevocationBitmap2022", revoked: true },
      issuedAt: "2026-06-09T12:00:00.000Z",
    }),
    trustPolicy,
    now: () => now,
  });
  const expired = await verifyAgentProfileIdentity(profile, {
    didResolver: didResolverFor(profile.agentDid, profile.ownerDid),
    credentialValidator: credentialValidatorWithEvidence({
      issuedAt: "2026-06-09T12:00:00.000Z",
      expiresAt: "2026-06-10T11:59:59.999Z",
    }),
    trustPolicy,
    now: () => now,
  });
  const stale = await verifyAgentProfileIdentity(profile, {
    didResolver: didResolverFor(profile.agentDid, profile.ownerDid),
    credentialValidator: credentialValidatorWithEvidence({
      issuedAt: "2026-06-01T12:00:00.000Z",
    }),
    trustPolicy,
    now: () => now,
  });

  assert.deepEqual(revoked, {
    ok: false,
    error: {
      code: "PROFILE_REVOKED",
      message: "Credential evidence is revoked by trust-policy evidence.",
    },
  });
  assert.deepEqual(expired, {
    ok: false,
    error: {
      code: "PROFILE_EXPIRED",
      message: "Credential evidence is expired.",
    },
  });
  assert.deepEqual(stale, {
    ok: false,
    error: {
      code: "PROFILE_EXPIRED",
      message: "Credential evidence exceeds trust-policy max credential age.",
    },
  });
});

test("IOTA Identity verification fails closed when trust policy lacks validator evidence", async () => {
  const profile = validAgentProfileFixture();
  const noValidator = await verifyAgentProfileIdentity(profile, {
    didResolver: didResolverFor(profile.agentDid, profile.ownerDid),
    trustPolicy,
    now: () => now,
  });
  const missingEvidence = await verifyAgentProfileIdentity(profile, {
    didResolver: didResolverFor(profile.agentDid, profile.ownerDid),
    credentialValidator: credentialValidator([]),
    trustPolicy,
    now: () => now,
  });

  assert.deepEqual(noValidator, {
    ok: false,
    error: {
      code: "PROFILE_UNVERIFIABLE",
      message: "IOTA Identity credential validator is required by trust policy.",
    },
  });
  assert.deepEqual(missingEvidence, {
    ok: false,
    error: {
      code: "PROFILE_UNVERIFIABLE",
      message: "Credential evidence is missing trust-policy evidence.",
    },
  });
});

test("IOTA Identity verification cache keys include trust policy inputs", async () => {
  const profile = validAgentProfileFixture();
  const cache = createInMemoryIotaIdentityVerificationCache();
  const permissivePolicy: IotaIdentityVcTrustPolicy = {
    ...trustPolicy,
    requiredCredentialTypes: ["VerifiableCredential"],
  };
  const strictPolicy: IotaIdentityVcTrustPolicy = {
    ...trustPolicy,
    requiredCredentialTypes: ["VerifiableCredential", "AgentCapabilityCredential", "LiveRegistryCredential"],
  };
  const baseOptions = {
    didResolver: didResolverFor(profile.agentDid, profile.ownerDid),
    credentialValidator: credentialValidatorWithEvidence({
      credentialTypes: ["VerifiableCredential", "AgentCapabilityCredential"],
      issuedAt: "2026-06-09T12:00:00.000Z",
    }),
    verificationCache: cache,
    cacheTtlMs: 60_000,
    now: () => now,
  };

  const cachedUnderPermissivePolicy = await verifyAgentProfileIdentity(profile, {
    ...baseOptions,
    trustPolicy: permissivePolicy,
  });
  const strictResult = await verifyAgentProfileIdentity(profile, {
    ...baseOptions,
    trustPolicy: strictPolicy,
  });

  assert.equal(cachedUnderPermissivePolicy.ok, true);
  assert.deepEqual(strictResult, {
    ok: false,
    error: {
      code: "PROFILE_UNVERIFIABLE",
      message: "Credential evidence is missing a required credential type.",
    },
  });
});

test("IOTA Identity verification cache reuses current DID and credential evidence within ttl", async () => {
  const profile = validAgentProfileFixture();
  const baseResolver = createLocalAgentResolver({ profiles: [profile], now: () => now });
  const resolvedDids: string[] = [];
  const checkedCredentialRefs: string[] = [];
  const resolver = createIotaIdentityVerifiedResolver(baseResolver, {
    didResolver: didResolverFor(profile.agentDid, profile.ownerDid, resolvedDids),
    credentialValidator: credentialValidator(checkedCredentialRefs),
    verificationCache: createInMemoryIotaIdentityVerificationCache(),
    cacheTtlMs: 60_000,
    now: () => now,
  });

  const first = await resolver.resolve(profile.name);
  const second = await resolver.resolve(profile.name);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(resolvedDids, [profile.agentDid, profile.ownerDid]);
  assert.deepEqual(checkedCredentialRefs, ["credential:research-summary:v1"]);
});

test("IOTA Identity verification cache revalidates after ttl and fails closed when stale evidence cannot refresh", async () => {
  const profile = validAgentProfileFixture();
  const baseResolver = createLocalAgentResolver({ profiles: [profile], now: () => now });
  let currentTime = now;
  let didResolverAvailable = true;
  const resolver = createIotaIdentityVerifiedResolver(baseResolver, {
    didResolver: {
      async resolveDid(did) {
        if (!didResolverAvailable) throw new Error("identity node unavailable");
        return { id: did };
      },
    },
    credentialValidator: credentialValidator([]),
    verificationCache: createInMemoryIotaIdentityVerificationCache(),
    cacheTtlMs: 60_000,
    now: () => currentTime,
  });

  const first = await resolver.resolve(profile.name);
  currentTime = new Date(now.getTime() + 60_001);
  didResolverAvailable = false;
  const stale = await resolver.resolve(profile.name);

  assert.equal(first.ok, true);
  assert.deepEqual(stale, {
    ok: false,
    error: {
      code: "PROFILE_UNVERIFIABLE",
      message: "IOTA Identity DID resolution failed.",
      name: profile.name,
    },
  });
});

test("IOTA Identity verification cache refreshes revoked credentials after ttl", async () => {
  const profile = validAgentProfileFixture();
  const baseResolver = createLocalAgentResolver({ profiles: [profile], now: () => now });
  let currentTime = now;
  let revoked = false;
  const resolver = createIotaIdentityVerifiedResolver(baseResolver, {
    didResolver: didResolverFor(profile.agentDid, profile.ownerDid),
    credentialValidator: {
      async validateCredentialRef() {
        if (revoked) {
          return {
            ok: false,
            code: "CREDENTIAL_REVOKED",
            message: "Capability credential is revoked.",
          };
        }
        return { ok: true };
      },
    },
    verificationCache: createInMemoryIotaIdentityVerificationCache(),
    cacheTtlMs: 60_000,
    now: () => currentTime,
  });

  const first = await resolver.resolve(profile.name);
  currentTime = new Date(now.getTime() + 60_001);
  revoked = true;
  const revokedResult = await resolver.resolve(profile.name);

  assert.equal(first.ok, true);
  assert.deepEqual(revokedResult, {
    ok: false,
    error: {
      code: "PROFILE_REVOKED",
      message: "Capability credential is revoked.",
      name: profile.name,
    },
  });
});

test("IOTA Identity verification can force refresh for protected actions within ttl", async () => {
  const profile = validAgentProfileFixture();
  const cache = createInMemoryIotaIdentityVerificationCache();
  let revoked = false;
  const baseResolver = createLocalAgentResolver({ profiles: [profile], now: () => now });
  const cachedResolver = createIotaIdentityVerifiedResolver(baseResolver, {
    didResolver: didResolverFor(profile.agentDid, profile.ownerDid),
    credentialValidator: {
      async validateCredentialRef() {
        return revoked
          ? {
              ok: false,
              code: "CREDENTIAL_REVOKED",
              message: "Capability credential is revoked.",
            }
          : { ok: true };
      },
    },
    verificationCache: cache,
    cacheTtlMs: 60_000,
    now: () => now,
  });
  const protectedResolver = createIotaIdentityVerifiedResolver(baseResolver, {
    didResolver: didResolverFor(profile.agentDid, profile.ownerDid),
    credentialValidator: {
      async validateCredentialRef() {
        return revoked
          ? {
              ok: false,
              code: "CREDENTIAL_REVOKED",
              message: "Capability credential is revoked.",
            }
          : { ok: true };
      },
    },
    verificationCache: cache,
    cacheTtlMs: 60_000,
    forceRefresh: true,
    now: () => now,
  });

  const first = await cachedResolver.resolve(profile.name);
  revoked = true;
  const cached = await cachedResolver.resolve(profile.name);
  const forced = await protectedResolver.resolve(profile.name);

  assert.equal(first.ok, true);
  assert.equal(cached.ok, true);
  assert.deepEqual(forced, {
    ok: false,
    error: {
      code: "PROFILE_REVOKED",
      message: "Capability credential is revoked.",
      name: profile.name,
    },
  });
});

function didResolverFor(
  agentDid: string,
  ownerDid: string,
  observed: string[] = [],
): IotaIdentityDidResolver {
  return {
    async resolveDid(did) {
      observed.push(did);
      if (did !== agentDid && did !== ownerDid) {
        throw new Error(`unexpected DID ${did}`);
      }
      return { id: did };
    },
  };
}

function credentialValidator(observed: string[]): IotaIdentityCredentialValidator {
  return {
    async validateCredentialRef(credentialRef) {
      observed.push(credentialRef);
      return { ok: true };
    },
  };
}

function credentialValidatorWithEvidence(
  overrides: Partial<IotaIdentityCredentialEvidence>,
): IotaIdentityCredentialValidator {
  return {
    async validateCredentialRef() {
      return {
        ok: true,
        evidence: {
          issuerDid: trustedIssuerDid,
          verificationMethod: trustedVerificationMethod,
          credentialTypes: ["VerifiableCredential", "AgentCapabilityCredential"],
          credentialStatus: { type: "RevocationBitmap2022", revoked: false },
          issuedAt: "2026-06-09T12:00:00.000Z",
          expiresAt: "2026-06-11T12:00:00.000Z",
          ...overrides,
        },
      };
    },
  };
}
