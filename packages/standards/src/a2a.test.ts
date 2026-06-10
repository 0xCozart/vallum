import assert from "node:assert/strict";
import { test } from "node:test";

import { validAgentProfileFixture } from "@iota-gaskit/registry";

import {
  A2A_AGENT_CARD_MEDIA_TYPE,
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  createA2AAgentCardFromProfile,
  handleA2AAgentCardWellKnownRequest,
} from "./index.js";

test("standards package exposes A2A Agent Card mapping from registry profiles", () => {
  const card = createA2AAgentCardFromProfile({
    ...validAgentProfileFixture(),
    endpoints: [{ type: "a2a", url: "https://agent.example.test/a2a" }],
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.equal(A2A_AGENT_CARD_WELL_KNOWN_PATH, "/.well-known/agent-card.json");
  assert.equal(card.name, "researcher.demo.iota");
  assert.equal(card.supportedInterfaces[0]?.protocolBinding, "HTTP+JSON");
  assert.equal(card.skills[0]?.id, "research.summary");
});

test("standards package exposes A2A well-known serving from registry profiles", () => {
  const response = handleA2AAgentCardWellKnownRequest({
    method: "GET",
    path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
  }, {
    ...validAgentProfileFixture(),
    endpoints: [{ type: "a2a", url: "https://agent.example.test/a2a" }],
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], `${A2A_AGENT_CARD_MEDIA_TYPE}; charset=utf-8`);
  assert.equal(response.body?.skills[0]?.id, "research.summary");
});
