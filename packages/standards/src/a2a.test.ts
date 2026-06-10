import assert from "node:assert/strict";
import { test } from "node:test";

import { validAgentProfileFixture } from "@iota-gaskit/registry";

import {
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  createA2AAgentCardFromProfile,
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
