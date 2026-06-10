import assert from "node:assert/strict";
import { test } from "node:test";

import { validateAgentProfile, validAgentProfileFixture } from "./index.js";

test("valid agent profile fixture passes validation", () => {
  const result = validateAgentProfile(validAgentProfileFixture(), {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.deepEqual(result, {
    ok: true,
    profile: validAgentProfileFixture(),
  });
});

test("missing required profile fields fail with typed errors", () => {
  const requiredPaths = [
    "$.name",
    "$.agentDid",
    "$.ownerDid",
    "$.wallet.address",
    "$.capabilities",
    "$.endpoints",
  ];
  const profile = validAgentProfileFixture() as unknown as Record<string, unknown>;
  delete profile.name;
  delete profile.agentDid;
  delete profile.ownerDid;
  delete (profile.wallet as Record<string, unknown>).address;
  profile.capabilities = [];
  profile.endpoints = [];

  const result = validateAgentProfile(profile, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  assert.deepEqual([...validationErrorPaths(result)].sort(), [...requiredPaths].sort());
  assert.deepEqual(validationErrorCodes(result), requiredPaths.map(() => "REQUIRED_FIELD_MISSING"));
});

test("revoked and expired profiles have explicit states", () => {
  const revoked = validateAgentProfile({
    ...validAgentProfileFixture(),
    status: "revoked",
    revocation: {
      revoked: true,
      reason: "owner_revoked",
      revokedAt: "2026-06-10T12:30:00.000Z",
    },
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.equal(revoked.ok, false);
  assert.equal(revoked.status, "revoked");
  assert.deepEqual(validationErrorCodes(revoked), ["PROFILE_REVOKED"]);

  const expired = validateAgentProfile({
    ...validAgentProfileFixture(),
    expiresAt: "2026-06-10T11:59:59.999Z",
    status: "expired",
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.equal(expired.ok, false);
  assert.equal(expired.status, "expired");
  assert.deepEqual(validationErrorCodes(expired), ["PROFILE_EXPIRED", "PROFILE_EXPIRED"]);
  assert.deepEqual(validationErrorPaths(expired), ["$.expiresAt", "$.status"]);
});

test("unsupported and malformed profiles fail closed", () => {
  assert.deepEqual(validateAgentProfile(null), {
    ok: false,
    errors: [{
      code: "PROFILE_NOT_OBJECT",
      path: "$",
      message: "Agent profile must be a JSON object.",
    }],
  });

  const unsupported = {
    ...validAgentProfileFixture(),
    version: "agent-profile/v999",
  };

  assert.deepEqual(validateAgentProfile(unsupported), {
    ok: false,
    errors: [{
      code: "UNSUPPORTED_VERSION",
      path: "$.version",
      message: "Agent profile version is unsupported.",
    }],
  });
});

test("secret-bearing profile fields fail validation", () => {
  const profile = {
    ...validAgentProfileFixture(),
    privateKey: "fixture-secret",
    signerSecret: "fixture-secret",
    capabilities: [{
      ...validAgentProfileFixture().capabilities[0],
      rawKeypair: "fixture-secret",
    }],
    wallet: {
      ...validAgentProfileFixture().wallet,
      mnemonic: "fixture-secret",
    },
    metadata: {
      bearerToken: "fixture-secret",
    },
  };

  const result = validateAgentProfile(profile, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(validationErrorCodes(result), [
    "SECRET_FIELD_NOT_ALLOWED",
    "SECRET_FIELD_NOT_ALLOWED",
    "SECRET_FIELD_NOT_ALLOWED",
    "SECRET_FIELD_NOT_ALLOWED",
    "SECRET_FIELD_NOT_ALLOWED",
  ]);
  assert.deepEqual([...validationErrorPaths(result)].sort(), [
    "$.privateKey",
    "$.signerSecret",
    "$.capabilities[0].rawKeypair",
    "$.wallet.mnemonic",
    "$.metadata.bearerToken",
  ].sort());
});

function validationErrorCodes(result: ReturnType<typeof validateAgentProfile>): readonly string[] {
  assert.equal(result.ok, false);
  return result.errors.map((error) => error.code);
}

function validationErrorPaths(result: ReturnType<typeof validateAgentProfile>): readonly string[] {
  assert.equal(result.ok, false);
  return result.errors.map((error) => error.path);
}
