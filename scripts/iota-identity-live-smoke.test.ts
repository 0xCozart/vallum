import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatIotaIdentityLiveSmokeResult,
  runIotaIdentityLiveSmoke,
} from "./smoke-iota-identity-live.js";
import { validAgentProfileFixture } from "../packages/registry/src/index.js";

const now = new Date("2026-06-10T12:00:00.000Z");
const issuerDid = "did:iota:issuer:agent-registry";

test("IOTA Identity live smoke reports exact missing configuration without secrets", async () => {
  const result = await runIotaIdentityLiveSmoke({ env: {} });
  const formatted = formatIotaIdentityLiveSmokeResult(result);

  assert.equal(result.ok, false);
  assert.equal(result.kind, "blocked");
  assert.equal(result.code, "IOTA_IDENTITY_LIVE_CONFIG_MISSING");
  assert.deepEqual(result.missing, [
    "IOTA_IDENTITY_PROOF_ENDPOINT",
    "IOTA_IDENTITY_PROFILE_PATH",
    "IOTA_IDENTITY_TRUSTED_ISSUER_DIDS",
    "IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS",
    "IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES",
    "IOTA_IDENTITY_ACCEPTED_STATUS_TYPES",
    "IOTA_IDENTITY_CACHE_TTL_MS",
  ]);
  assert.match(formatted, /IOTA_IDENTITY_PROOF_ENDPOINT/);
  assert.doesNotMatch(formatted, /private|mnemonic|bearer|token|secret|iotaprivkey|local-secret/i);
});

test("IOTA Identity live smoke blocks unsafe proof endpoints without printing them", async () => {
  const result = await runIotaIdentityLiveSmoke({
    env: identityEnv({
      IOTA_IDENTITY_PROOF_ENDPOINT: "http://identity.testnet.example/proof",
    }),
    profile: validAgentProfileFixture(),
    now: () => now,
  });
  const formatted = formatIotaIdentityLiveSmokeResult(result);

  assert.equal(result.ok, false);
  assert.equal(result.kind, "blocked");
  assert.equal(result.code, "IOTA_IDENTITY_PROOF_ENDPOINT_UNSAFE");
  assert.doesNotMatch(formatted, /identity\.testnet\.example/);
});

test("IOTA Identity live smoke verifies profile DIDs and credential evidence through proof endpoint", async () => {
  const profile = validAgentProfileFixture();
  const requests: unknown[] = [];
  const result = await runIotaIdentityLiveSmoke({
    env: identityEnv(),
    profile,
    fetch: mockProofEndpoint(requests),
    now: () => now,
  });
  const formatted = formatIotaIdentityLiveSmokeResult(result);

  assert.deepEqual(result, {
    ok: true,
    profileName: profile.name,
    credentialRefsChecked: 1,
    source: "iota-identity-proof-endpoint",
  });
  assert.equal(requests.length, 3);
  assert.deepEqual(requests.map((request) => (request as { operation: string }).operation), [
    "resolveDid",
    "resolveDid",
    "validateCredentialRef",
  ]);
  assert.doesNotMatch(formatted, new RegExp(`${issuerDid}|credential:research-summary:v1|agent-capability-key-1`));
});

test("IOTA Identity live smoke fails closed when proof endpoint rejects credential evidence", async () => {
  const profile = validAgentProfileFixture();
  const result = await runIotaIdentityLiveSmoke({
    env: identityEnv(),
    profile,
    fetch: mockProofEndpoint([], {
      ok: false,
      code: "CREDENTIAL_REVOKED",
    }),
    now: () => now,
  });

  assert.deepEqual(result, {
    ok: false,
    kind: "failed",
    code: "PROFILE_REVOKED",
    profileName: profile.name,
    message: "IOTA Identity credential proof endpoint rejected credential evidence.",
  });
});

test("IOTA Identity live smoke blocks invalid local profile before contacting proof endpoint", async () => {
  const requests: unknown[] = [];
  const result = await runIotaIdentityLiveSmoke({
    env: identityEnv(),
    profile: {
      ...validAgentProfileFixture(),
      agentDid: "",
    },
    fetch: mockProofEndpoint(requests),
    now: () => now,
  });

  assert.equal(result.ok, false);
  assert.equal(result.kind, "blocked");
  assert.equal(result.code, "IOTA_IDENTITY_PROFILE_INVALID");
  assert.equal(requests.length, 0);
});

test("IOTA Identity live smoke blocks malformed trust policy config without printing values", async () => {
  const result = await runIotaIdentityLiveSmoke({
    env: identityEnv({
      IOTA_IDENTITY_TRUSTED_ISSUER_DIDS: "did:example:issuer",
      IOTA_IDENTITY_CACHE_TTL_MS: "-1",
    }),
    profile: validAgentProfileFixture(),
    now: () => now,
  });
  const formatted = formatIotaIdentityLiveSmokeResult(result);

  assert.equal(result.ok, false);
  assert.equal(result.kind, "blocked");
  assert.equal(result.code, "VC_TRUST_POLICY_CONFIG_INVALID");
  assert.doesNotMatch(formatted, /did:example:issuer|-1/);
});

function identityEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    IOTA_IDENTITY_PROOF_ENDPOINT: "https://identity.testnet.example/proof",
    IOTA_IDENTITY_TRUSTED_ISSUER_DIDS: issuerDid,
    IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS: "#agent-capability-key-1",
    IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES: "VerifiableCredential,AgentCapabilityCredential",
    IOTA_IDENTITY_ACCEPTED_STATUS_TYPES: "RevocationBitmap2022,StatusList2021Entry",
    IOTA_IDENTITY_CACHE_TTL_MS: "604800000",
    ...overrides,
  };
}

function mockProofEndpoint(
  requests: unknown[],
  credentialResponse: unknown = {
    ok: true,
    evidence: {
      issuerDid,
      verificationMethod: `${issuerDid}#agent-capability-key-1`,
      credentialTypes: ["VerifiableCredential", "AgentCapabilityCredential"],
      credentialStatus: { type: "RevocationBitmap2022", revoked: false },
      issuedAt: "2026-06-09T12:00:00.000Z",
      expiresAt: "2026-06-11T12:00:00.000Z",
    },
  },
): typeof fetch {
  return async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { operation: string; did?: string };
    requests.push(body);
    if (body.operation === "resolveDid") {
      return jsonResponse({ ok: true, document: { id: body.did } });
    }
    return jsonResponse(credentialResponse);
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
