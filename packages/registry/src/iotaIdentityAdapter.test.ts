import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createIotaIdentityVerifiedResolver,
  createInMemoryIotaIdentityVerificationCache,
  createLocalAgentResolver,
  verifyAgentProfileIdentity,
  validAgentProfileFixture,
  type IotaIdentityCredentialValidator,
  type IotaIdentityDidResolver,
} from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");

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
