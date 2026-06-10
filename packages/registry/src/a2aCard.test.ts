import assert from "node:assert/strict";
import { test } from "node:test";

import {
  A2A_AGENT_CARD_PROTOCOL_VERSION,
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  A2AAgentCardError,
  createA2AAgentCardFromProfile,
  validAgentProfileFixture,
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
