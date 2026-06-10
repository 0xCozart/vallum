import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createLocalAgentResolver,
  resolveAgent,
  validAgentProfileFixture,
} from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");

test("resolveAgent returns a validated local fixture profile", async () => {
  const profile = validAgentProfileFixture();
  const resolver = createLocalAgentResolver({ profiles: [profile], now: () => now });

  const result = await resolveAgent("researcher.demo.iota", resolver);

  assert.deepEqual(result, {
    ok: true,
    profile,
  });
});

test("resolveAgent returns typed not-found errors", async () => {
  const resolver = createLocalAgentResolver({ profiles: [validAgentProfileFixture()], now: () => now });

  const result = await resolveAgent("missing.demo.iota", resolver);

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "PROFILE_NOT_FOUND",
      message: "Agent profile was not found.",
      name: "missing.demo.iota",
    },
  });
});

test("resolveAgent rejects malformed and unsupported local profiles", async () => {
  const malformed = { ...validAgentProfileFixture(), name: "malformed.demo.iota", capabilities: [] };
  const unsupported = { ...validAgentProfileFixture(), name: "unsupported.demo.iota", version: "agent-profile/v999" };
  const resolver = createLocalAgentResolver({ profiles: [malformed, unsupported], now: () => now });

  const malformedResult = await resolveAgent("malformed.demo.iota", resolver);
  const unsupportedResult = await resolveAgent("unsupported.demo.iota", resolver);

  assert.equal(malformedResult.ok, false);
  assert.equal(malformedResult.error.code, "PROFILE_MALFORMED");
  assert.deepEqual(malformedResult.error.validationErrors?.map((error) => error.path), ["$.capabilities"]);

  assert.equal(unsupportedResult.ok, false);
  assert.equal(unsupportedResult.error.code, "PROFILE_UNSUPPORTED_SCHEMA");
  assert.deepEqual(unsupportedResult.error.validationErrors?.map((error) => error.path), ["$.version"]);
});

test("resolveAgent rejects revoked and expired profiles", async () => {
  const revoked = {
    ...validAgentProfileFixture(),
    name: "revoked.demo.iota",
    status: "revoked",
    revocation: { revoked: true, reason: "owner_revoked" },
  };
  const expired = {
    ...validAgentProfileFixture(),
    name: "expired.demo.iota",
    expiresAt: "2026-06-10T11:59:59.999Z",
    status: "expired",
  };
  const resolver = createLocalAgentResolver({ profiles: [revoked, expired], now: () => now });

  const revokedResult = await resolveAgent("revoked.demo.iota", resolver);
  const expiredResult = await resolveAgent("expired.demo.iota", resolver);

  assert.equal(revokedResult.ok, false);
  assert.equal(revokedResult.error.code, "PROFILE_REVOKED");

  assert.equal(expiredResult.ok, false);
  assert.equal(expiredResult.error.code, "PROFILE_EXPIRED");
});

test("resolveAgent rejects profiles with revoked wallet state", async () => {
  const profile = {
    ...validAgentProfileFixture(),
    name: "revoked-wallet.demo.iota",
    wallet: {
      ...validAgentProfileFixture().wallet,
      status: "revoked",
    },
  };
  const resolver = createLocalAgentResolver({ profiles: [profile], now: () => now });

  const result = await resolveAgent("revoked-wallet.demo.iota", resolver);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PROFILE_REVOKED");
  assert.deepEqual(result.error.validationErrors?.map((error) => error.path), ["$.wallet.status"]);
});
