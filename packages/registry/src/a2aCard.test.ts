import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";

import {
  A2A_AGENT_CARD_PROTOCOL_VERSION,
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  A2AAgentCardError,
  canonicalizeA2AAgentCard,
  createA2AAgentCardFromProfile,
  signA2AAgentCard,
  validAgentProfileFixture,
  verifyA2AAgentCardSignature,
} from "./index.js";

test("A2A Agent Card generation maps an active Agent Profile to current discovery fields", () => {
  const profile = {
    ...validAgentProfileFixture(),
    endpoints: [
      { type: "a2a" as const, url: "https://agent.example.test/a2a" },
      ...validAgentProfileFixture().endpoints,
    ],
  };

  const card = createA2AAgentCardFromProfile(profile, {
    now: new Date("2026-06-10T12:00:00.000Z"),
    description: "Research agent exposed through Agentic GasKit.",
    agentVersion: "2026.6.10",
    provider: {
      organization: "Agentic GasKit",
      url: "https://agentic-gaskit.example.test",
    },
    documentationUrl: "https://agentic-gaskit.example.test/docs/researcher",
  });

  assert.equal(A2A_AGENT_CARD_WELL_KNOWN_PATH, "/.well-known/agent-card.json");
  assert.equal(card.name, "researcher.demo.iota");
  assert.equal(card.description, "Research agent exposed through Agentic GasKit.");
  assert.equal(card.version, "2026.6.10");
  assert.deepEqual(card.supportedInterfaces, [{
    url: "https://agent.example.test/a2a",
    protocolBinding: "HTTP+JSON",
    protocolVersion: A2A_AGENT_CARD_PROTOCOL_VERSION,
  }]);
  assert.deepEqual(card.provider, {
    organization: "Agentic GasKit",
    url: "https://agentic-gaskit.example.test",
  });
  assert.equal(card.documentationUrl, "https://agentic-gaskit.example.test/docs/researcher");
  assert.deepEqual(card.defaultInputModes, ["text/plain", "application/json"]);
  assert.deepEqual(card.defaultOutputModes, ["text/plain", "application/json"]);
  assert.deepEqual(card.securitySchemes, {
    gaskitBearer: {
      httpAuthSecurityScheme: {
        scheme: "Bearer",
        bearerFormat: "JWT",
        description: "Bearer token accepted by the Agentic GasKit A2A endpoint.",
      },
    },
  });
  assert.deepEqual(card.securityRequirements, [{ schemes: { gaskitBearer: [] } }]);
  assert.deepEqual(card.capabilities, {
    streaming: false,
    pushNotifications: false,
    extendedAgentCard: false,
    extensions: [{
      uri: "https://agentic-gaskit.dev/a2a/extensions/profile/v1",
      description: "Public Agentic GasKit profile context.",
      required: false,
      params: {
        profileVersion: "agent-profile/v1",
        agentDid: "did:iota:agent:researcher-demo",
        ownerDid: "did:iota:owner:research-team",
        supportedContracts: ["escrow:v1"],
        paymentMethods: [{ type: "iota", asset: "IOTA" }],
      },
    }],
  });
  assert.deepEqual(card.skills, [{
    id: "research.summary",
    name: "Research summary",
    description: "Agentic GasKit capability research.summary.",
    tags: ["agentic-gaskit", "contract:escrow", "action:open_escrow", "escrow:v1"],
    inputModes: ["text/plain", "application/json"],
    outputModes: ["text/plain", "application/json"],
    securityRequirements: [{ schemes: { gaskitBearer: [] } }],
  }]);
});

test("A2A Agent Card generation fails closed for revoked and expired profiles", () => {
  const revoked = {
    ...validAgentProfileFixture(),
    endpoints: [{ type: "a2a" as const, url: "https://agent.example.test/a2a" }],
    status: "revoked" as const,
    revocation: {
      revoked: true,
      reason: "owner_revoked",
      revokedAt: "2026-06-10T12:30:00.000Z",
    },
  };
  assert.throws(
    () => createA2AAgentCardFromProfile(revoked, { now: new Date("2026-06-10T12:00:00.000Z") }),
    (error) => error instanceof A2AAgentCardError && error.code === "PROFILE_REVOKED",
  );

  const expired = {
    ...validAgentProfileFixture(),
    endpoints: [{ type: "a2a" as const, url: "https://agent.example.test/a2a" }],
    expiresAt: "2026-06-10T11:59:59.999Z",
  };
  assert.throws(
    () => createA2AAgentCardFromProfile(expired, { now: new Date("2026-06-10T12:00:00.000Z") }),
    (error) => error instanceof A2AAgentCardError && error.code === "PROFILE_EXPIRED",
  );
});

test("A2A Agent Card generation fails closed for missing endpoints and unsupported protocol versions", () => {
  const profile = validAgentProfileFixture();

  assert.throws(
    () => createA2AAgentCardFromProfile(profile, { now: new Date("2026-06-10T12:00:00.000Z") }),
    (error) => error instanceof A2AAgentCardError && error.code === "A2A_ENDPOINT_MISSING",
  );

  assert.throws(
    () => createA2AAgentCardFromProfile({
      ...profile,
      endpoints: [{ type: "a2a" as const, url: "https://agent.example.test/a2a" }],
    }, {
      now: new Date("2026-06-10T12:00:00.000Z"),
      protocolVersion: "0.3",
    }),
    (error) => error instanceof A2AAgentCardError && error.code === "UNSUPPORTED_A2A_PROTOCOL_VERSION",
  );
});

test("A2A Agent Card generation fails closed for malformed auth and private extension metadata", () => {
  const profile = {
    ...validAgentProfileFixture(),
    endpoints: [{ type: "a2a" as const, url: "https://agent.example.test/a2a" }],
  };

  assert.throws(
    () => createA2AAgentCardFromProfile(profile, {
      now: new Date("2026-06-10T12:00:00.000Z"),
      securityRequirements: [{ schemes: { missingScheme: [] } }],
    }),
    (error) => error instanceof A2AAgentCardError && error.code === "A2A_SECURITY_SCHEME_INVALID",
  );

  assert.throws(
    () => createA2AAgentCardFromProfile(profile, {
      now: new Date("2026-06-10T12:00:00.000Z"),
      capabilities: {
        extensions: [{
          uri: "https://example.test/private",
          params: {
            signerRef: "signer_ref_researcher_demo",
          },
        }],
      },
    }),
    (error) => error instanceof A2AAgentCardError && error.code === "PRIVATE_PROFILE_FIELD_NOT_ALLOWED",
  );
});

test("A2A Agent Card omits private credential refs, revocation refs, signer refs, and wallet internals", () => {
  const profile = {
    ...validAgentProfileFixture(),
    endpoints: [{ type: "a2a" as const, url: "https://agent.example.test/a2a" }],
    metadata: {
      purpose: "fixture",
      privateNote: "do-not-emit",
    },
  };

  const card = createA2AAgentCardFromProfile(profile, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  const serialized = JSON.stringify(card);
  assert.doesNotMatch(serialized, /credential:research-summary:v1/);
  assert.doesNotMatch(serialized, /signer_ref_researcher_demo/);
  assert.doesNotMatch(serialized, /wallet_researcher_demo/);
  assert.doesNotMatch(serialized, /revocation/);
  assert.doesNotMatch(serialized, /privateNote/);
  assert.doesNotMatch(serialized, /0x1111111111111111111111111111111111111111111111111111111111111111/);
});

test("A2A Agent Card signing creates verifiable JWS signatures over canonical card payloads", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const card = createA2AAgentCardFromProfile(a2aProfileFixture(), {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  const signed = signA2AAgentCard(card, {
    keyId: "agent-card-key-1",
    privateKey,
  });
  const verification = verifyA2AAgentCardSignature(signed, {
    trustedKeys: { "agent-card-key-1": publicKey },
  });

  assert.equal(signed.signatures.length, 1);
  assert.deepEqual(JSON.parse(Buffer.from(signed.signatures[0]!.protected, "base64url").toString("utf8")), {
    alg: "EdDSA",
    typ: "JOSE",
    kid: "agent-card-key-1",
  });
  assert.equal(verification.ok, true);
  assert.equal(canonicalizeA2AAgentCard(signed), canonicalizeA2AAgentCard(card));
  assert.doesNotMatch(JSON.stringify(signed), /PRIVATE|signer_ref|walletId|credential:|payment-secret/i);
});

test("A2A Agent Card signature verification fails closed for tampering wrong keys and malformed signatures", () => {
  const trusted = generateKeyPairSync("ed25519");
  const wrong = generateKeyPairSync("ed25519");
  const signed = signA2AAgentCard(createA2AAgentCardFromProfile(a2aProfileFixture(), {
    now: new Date("2026-06-10T12:00:00.000Z"),
  }), {
    keyId: "agent-card-key-1",
    privateKey: trusted.privateKey,
  });
  const tampered = {
    ...signed,
    description: "Tampered card.",
  };
  const unsupportedAlg = {
    ...signed,
    signatures: [{
      ...signed.signatures[0]!,
      protected: Buffer.from(JSON.stringify({ alg: "HS256", typ: "JOSE", kid: "agent-card-key-1" })).toString("base64url"),
    }],
  };
  const malformedProtected = {
    ...signed,
    signatures: [{
      ...signed.signatures[0]!,
      protected: "not-base64url-json",
    }],
  };

  assert.deepEqual(verifyA2AAgentCardSignature(tampered, {
    trustedKeys: { "agent-card-key-1": trusted.publicKey },
  }), {
    ok: false,
    code: "A2A_SIGNATURE_INVALID",
    message: "A2A Agent Card signature verification failed.",
  });
  assert.deepEqual(verifyA2AAgentCardSignature(signed, {
    trustedKeys: { "agent-card-key-1": wrong.publicKey },
  }).ok, false);
  assert.deepEqual(verifyA2AAgentCardSignature(unsupportedAlg, {
    trustedKeys: { "agent-card-key-1": trusted.publicKey },
  }), {
    ok: false,
    code: "A2A_SIGNATURE_ALGORITHM_UNSUPPORTED",
    message: "A2A Agent Card signature algorithm is unsupported.",
  });
  assert.deepEqual(verifyA2AAgentCardSignature(malformedProtected, {
    trustedKeys: { "agent-card-key-1": trusted.publicKey },
  }), {
    ok: false,
    code: "A2A_SIGNATURE_MALFORMED",
    message: "A2A Agent Card signature is malformed.",
  });
});

test("A2A Agent Card signature verification fails closed for stale future and required-key mismatches", () => {
  const trusted = generateKeyPairSync("ed25519");
  const signed = signA2AAgentCard(createA2AAgentCardFromProfile(a2aProfileFixture(), {
    now: new Date("2026-06-10T12:00:00.000Z"),
  }), {
    keyId: "agent-card-key-1",
    privateKey: trusted.privateKey,
    signedAt: new Date("2026-06-10T12:01:00.000Z"),
    notBefore: new Date("2026-06-10T12:05:00.000Z"),
    expiresAt: new Date("2026-06-10T13:00:00.000Z"),
  });

  assert.deepEqual(verifyA2AAgentCardSignature(signed, {
    trustedKeys: { "agent-card-key-1": trusted.publicKey },
    now: new Date("2026-06-10T12:04:59.999Z"),
  }), {
    ok: false,
    code: "A2A_SIGNATURE_NOT_YET_VALID",
    message: "A2A Agent Card signature is not yet valid.",
  });

  assert.deepEqual(verifyA2AAgentCardSignature(signed, {
    trustedKeys: { "agent-card-key-1": trusted.publicKey },
    now: new Date("2026-06-10T13:00:00.000Z"),
  }), {
    ok: false,
    code: "A2A_SIGNATURE_EXPIRED",
    message: "A2A Agent Card signature is expired.",
  });

  assert.deepEqual(verifyA2AAgentCardSignature(signed, {
    requiredKeyId: "agent-card-key-2",
    trustedKeys: { "agent-card-key-1": trusted.publicKey },
    now: new Date("2026-06-10T12:05:00.000Z"),
  }), {
    ok: false,
    code: "A2A_SIGNATURE_KEY_NOT_TRUSTED",
    message: "A2A Agent Card signing key is not trusted.",
  });

  assert.deepEqual(verifyA2AAgentCardSignature(signed, {
    requiredKeyId: "agent-card-key-1",
    trustedKeys: { "agent-card-key-1": trusted.publicKey },
    now: new Date("2026-06-10T12:05:00.000Z"),
  }), {
    ok: true,
    keyId: "agent-card-key-1",
    algorithm: "EdDSA",
  });
});

test("A2A Agent Card signing fails closed for blank key ids and private metadata", () => {
  const { privateKey } = generateKeyPairSync("ed25519");

  assert.throws(
    () => signA2AAgentCard(createA2AAgentCardFromProfile(a2aProfileFixture(), {
      now: new Date("2026-06-10T12:00:00.000Z"),
    }), {
      keyId: " ",
      privateKey,
    }),
    (error) => error instanceof A2AAgentCardError && error.code === "A2A_SIGNATURE_INVALID",
  );

  assert.throws(
    () => signA2AAgentCard(createA2AAgentCardFromProfile(a2aProfileFixture(), {
      now: new Date("2026-06-10T12:00:00.000Z"),
    }), {
      keyId: "agent-card-key-1",
      privateKey,
      jwksUrl: "http://agent.example.test/.well-known/jwks.json",
    }),
    (error) => error instanceof A2AAgentCardError && error.code === "A2A_SIGNATURE_INVALID",
  );

  assert.throws(
    () => signA2AAgentCard(createA2AAgentCardFromProfile(a2aProfileFixture(), {
      now: new Date("2026-06-10T12:00:00.000Z"),
    }), {
      keyId: "agent-card-key-1",
      privateKey,
      signedAt: new Date("not-a-date"),
    }),
    (error) => error instanceof A2AAgentCardError && error.code === "A2A_SIGNATURE_INVALID",
  );

  assert.throws(
    () => signA2AAgentCard({
      ...createA2AAgentCardFromProfile(a2aProfileFixture(), {
        now: new Date("2026-06-10T12:00:00.000Z"),
      }),
      capabilities: {
        extensions: [{
          uri: "https://example.test/private",
          params: { signerRef: "signer_ref_secret" },
        }],
      },
    }, {
      keyId: "agent-card-key-1",
      privateKey,
    }),
    (error) => error instanceof A2AAgentCardError && error.code === "PRIVATE_PROFILE_FIELD_NOT_ALLOWED",
  );
});

function a2aProfileFixture() {
  return {
    ...validAgentProfileFixture(),
    endpoints: [
      { type: "a2a" as const, url: "https://agent.example.test/a2a" },
      ...validAgentProfileFixture().endpoints,
    ],
  };
}
