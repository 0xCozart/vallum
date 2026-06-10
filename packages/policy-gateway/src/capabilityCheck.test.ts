import assert from "node:assert/strict";
import { test } from "node:test";
import { validAgentProfileFixture } from "@iota-gaskit/registry";

import { evaluateProfileCapabilityPolicy } from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");

test("profile capability policy allows a matching capability", () => {
  const decision = evaluateProfileCapabilityPolicy(validAgentProfileFixture(), {
    capabilityId: "research.summary",
    scope: "action:open_escrow",
    contract: "escrow:v1",
  }, { now });

  assert.deepEqual(decision, { allowed: true });
});

test("profile capability policy denies capability mismatches", () => {
  const decision = evaluateProfileCapabilityPolicy(validAgentProfileFixture(), {
    capabilityId: "research.translation",
  }, { now });
  const wrongScope = evaluateProfileCapabilityPolicy(validAgentProfileFixture(), {
    capabilityId: "research.summary",
    scope: "action:translate",
  }, { now });
  const wrongContract = evaluateProfileCapabilityPolicy(validAgentProfileFixture(), {
    capabilityId: "research.summary",
    contract: "escrow:v2",
  }, { now });

  const expected = {
    allowed: false,
    reasonCode: "CAPABILITY_NOT_ALLOWED",
    message: "Required agent capability is not present.",
  } as const;
  assert.deepEqual(decision, expected);
  assert.deepEqual(wrongScope, expected);
  assert.deepEqual(wrongContract, expected);
});

test("profile capability policy denies revoked and expired profiles", () => {
  const revoked = evaluateProfileCapabilityPolicy({
    ...validAgentProfileFixture(),
    status: "revoked",
    revocation: { revoked: true, reason: "owner_revoked" },
  }, {
    capabilityId: "research.summary",
  }, { now });

  const expired = evaluateProfileCapabilityPolicy({
    ...validAgentProfileFixture(),
    expiresAt: "2026-06-10T11:59:59.999Z",
    status: "expired",
  }, {
    capabilityId: "research.summary",
  }, { now });

  assert.deepEqual(revoked, {
    allowed: false,
    reasonCode: "PROFILE_REVOKED",
    message: "Agent profile is revoked.",
  });
  assert.deepEqual(expired, {
    allowed: false,
    reasonCode: "PROFILE_EXPIRED",
    message: "Agent profile is expired.",
  });
});
