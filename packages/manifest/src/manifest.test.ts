import assert from "node:assert/strict";
import { test } from "node:test";
import { validateAgentTransactionManifest, validManifestFixture } from "./index.js";

test("valid manifest fixture passes validation", () => {
  const result = validateAgentTransactionManifest(validManifestFixture(), {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.deepEqual(result, {
    ok: true,
    manifest: validManifestFixture(),
  });
});

test("missing required manifest fields fail with typed errors", () => {
  const requiredPaths = [
    "$.agent.id",
    "$.counterparty.id",
    "$.expiresAt",
    "$.spend.maxGasBudget",
    "$.action.functionName",
    "$.idempotencyKey",
  ];
  const manifest = validManifestFixture() as unknown as Record<string, unknown>;
  delete (manifest.agent as Record<string, unknown>).id;
  delete (manifest.counterparty as Record<string, unknown>).id;
  delete manifest.expiresAt;
  delete (manifest.spend as Record<string, unknown>).maxGasBudget;
  delete (manifest.action as Record<string, unknown>).functionName;
  delete manifest.idempotencyKey;

  const result = validateAgentTransactionManifest(manifest, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  assert.deepEqual([...validationErrorPaths(result)].sort(), [...requiredPaths].sort());
  assert.deepEqual(validationErrorCodes(result), requiredPaths.map(() => "REQUIRED_FIELD_MISSING"));
});

test("expired manifest fails closed", () => {
  const manifest = { ...validManifestFixture(), expiresAt: "2026-06-10T11:59:59.999Z" };

  const result = validateAgentTransactionManifest(manifest, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(validationErrorCodes(result), ["MANIFEST_EXPIRED"]);
  assert.deepEqual(validationErrorPaths(result), ["$.expiresAt"]);
});

test("unsupported manifest version fails closed", () => {
  const manifest = { ...validManifestFixture(), version: "agent-tx-manifest/v999" };

  const result = validateAgentTransactionManifest(manifest);

  assert.deepEqual(result, {
    ok: false,
    errors: [{
      code: "UNSUPPORTED_VERSION",
      path: "$.version",
      message: "Manifest version is unsupported.",
    }],
  });
});

test("malformed and overlarge manifests fail with typed errors", () => {
  assert.deepEqual(validateAgentTransactionManifest(null), {
    ok: false,
    errors: [{
      code: "MANIFEST_NOT_OBJECT",
      path: "$",
      message: "Manifest must be a JSON object.",
    }],
  });

  const overlarge = {
    ...validManifestFixture(),
    metadata: { blob: "x".repeat(32) },
  };

  assert.deepEqual(validateAgentTransactionManifest(overlarge, { maxBytes: 16 }), {
    ok: false,
    errors: [{
      code: "MANIFEST_TOO_LARGE",
      path: "$",
      message: "Manifest exceeds 16 bytes.",
    }],
  });
});

test("secret-bearing manifest fields fail validation", () => {
  const manifest = {
    ...validManifestFixture(),
    privateKey: "do-not-accept",
    rawTransactionBytes: "AAEC",
    userSignature: "signature",
    bearerToken: "token",
    appApiKey: "api-key",
    metadata: {
      privateKey: "nested-secret",
    },
  };

  const result = validateAgentTransactionManifest(manifest, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(validationErrorCodes(result), [
    "SECRET_FIELD_NOT_ALLOWED",
    "SECRET_FIELD_NOT_ALLOWED",
    "SECRET_FIELD_NOT_ALLOWED",
    "SECRET_FIELD_NOT_ALLOWED",
    "SECRET_FIELD_NOT_ALLOWED",
    "SECRET_FIELD_NOT_ALLOWED",
  ]);
  assert.deepEqual([...validationErrorPaths(result)].sort(), [
    "$.privateKey",
    "$.rawTransactionBytes",
    "$.userSignature",
    "$.bearerToken",
    "$.appApiKey",
    "$.metadata.privateKey",
  ].sort());
});

test("simulation and receipt requirements are explicit", () => {
  const manifest = {
    ...validManifestFixture(),
    simulation: {},
    receipt: {},
  };

  const result = validateAgentTransactionManifest(manifest, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(validationErrorPaths(result), ["$.simulation.required", "$.receipt.required"]);
  assert.deepEqual(validationErrorCodes(result), ["REQUIRED_FIELD_MISSING", "REQUIRED_FIELD_MISSING"]);
});

function validationErrorCodes(result: ReturnType<typeof validateAgentTransactionManifest>): readonly string[] {
  assert.equal(result.ok, false);
  return result.errors.map((error) => error.code);
}

function validationErrorPaths(result: ReturnType<typeof validateAgentTransactionManifest>): readonly string[] {
  assert.equal(result.ok, false);
  return result.errors.map((error) => error.path);
}
