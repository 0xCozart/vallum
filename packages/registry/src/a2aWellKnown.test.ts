import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";

import {
  A2A_AGENT_CARD_MEDIA_TYPE,
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  createA2AAgentCardWellKnownResponse,
  handleA2AAgentCardWellKnownRequest,
  validAgentProfileFixture,
  verifyA2AAgentCardSignature,
} from "./index.js";

function activeA2AProfile() {
  return {
    ...validAgentProfileFixture(),
    endpoints: [
      { type: "a2a" as const, url: "https://agent.example.test/a2a" },
      ...validAgentProfileFixture().endpoints,
    ],
  };
}

test("A2A well-known helper serves the canonical Agent Card discovery response", () => {
  const response = handleA2AAgentCardWellKnownRequest({
    method: "GET",
    path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
  }, activeA2AProfile(), {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.equal(response.status, 200);
  assert.equal(response.path, "/.well-known/agent-card.json");
  assert.equal(response.headers["content-type"], `${A2A_AGENT_CARD_MEDIA_TYPE}; charset=utf-8`);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.body?.name, "researcher.demo.iota");
  assert.equal(response.body?.supportedInterfaces[0]?.url, "https://agent.example.test/a2a");

  const parsed = JSON.parse(response.json) as { name?: string; skills?: unknown[] };
  assert.equal(parsed.name, "researcher.demo.iota");
  assert.equal(parsed.skills?.length, 1);
});

test("A2A well-known response JSON omits private profile and wallet fields", () => {
  const response = createA2AAgentCardWellKnownResponse({
    ...activeA2AProfile(),
    metadata: {
      purpose: "fixture",
      privateNote: "do-not-emit",
    },
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.doesNotMatch(response.json, /credential:research-summary:v1/);
  assert.doesNotMatch(response.json, /signer_ref_researcher_demo/);
  assert.doesNotMatch(response.json, /wallet_researcher_demo/);
  assert.doesNotMatch(response.json, /revocation/);
  assert.doesNotMatch(response.json, /privateNote/);
  assert.doesNotMatch(response.json, /0x1111111111111111111111111111111111111111111111111111111111111111/);
});

test("A2A well-known helper can serve a signed Agent Card without leaking private fields", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const response = createA2AAgentCardWellKnownResponse(activeA2AProfile(), {
    now: new Date("2026-06-10T12:00:00.000Z"),
    signature: {
      keyId: "agent-card-key-1",
      privateKey,
    },
  });
  const verification = verifyA2AAgentCardSignature(response.body, {
    trustedKeys: { "agent-card-key-1": publicKey },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.signatures?.length, 1);
  assert.equal(verification.ok, true);
  assert.doesNotMatch(response.json, /private prompt|signer_ref|walletId|credential:|payment-secret/i);
});

test("A2A well-known helper denies non-GET methods and legacy discovery paths", () => {
  const profile = activeA2AProfile();

  const postResponse = handleA2AAgentCardWellKnownRequest({
    method: "POST",
    path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
  }, profile, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });
  assert.equal(postResponse.status, 405);
  assert.equal(postResponse.headers.allow, "GET");
  assert.equal(postResponse.body, undefined);
  assert.doesNotMatch(postResponse.json, /research\.summary/);

  const legacyResponse = handleA2AAgentCardWellKnownRequest({
    method: "GET",
    path: "/.well-known/agent.json",
  }, profile, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });
  assert.equal(legacyResponse.status, 404);
  assert.equal(legacyResponse.body, undefined);
  assert.doesNotMatch(legacyResponse.json, /research\.summary/);
});

test("A2A well-known helper fails closed for revoked and expired profiles", () => {
  const revoked = handleA2AAgentCardWellKnownRequest({
    method: "GET",
    path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
  }, {
    ...activeA2AProfile(),
    status: "revoked" as const,
    revocation: {
      revoked: true,
      reason: "owner_revoked",
      revokedAt: "2026-06-10T12:30:00.000Z",
    },
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });
  assert.equal(revoked.status, 410);
  assert.equal(revoked.body, undefined);
  assert.doesNotMatch(revoked.json, /research\.summary/);

  const expired = handleA2AAgentCardWellKnownRequest({
    method: "GET",
    path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
  }, {
    ...activeA2AProfile(),
    expiresAt: "2026-06-10T11:59:59.999Z",
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });
  assert.equal(expired.status, 410);
  assert.equal(expired.body, undefined);
  assert.doesNotMatch(expired.json, /research\.summary/);
});
