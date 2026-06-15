import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { writeIdentityProofBundle } from "./write-identity-proof-bundle.js";

test("identity proof bundle writes templates, plan, and blocked summary without secret values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-identity-bundle-"));
  try {
    const bundle = await writeIdentityProofBundle({
      cwd,
      now: new Date("2026-06-14T12:00:00.000Z"),
      env: configuredIdentityEnv(),
      gasStationRuntimeReport: readyGasStationRuntime(),
    });
    const bundleRaw = await readFile(join(cwd, "tmp/gaskit/identity-proof-bundle.json"), "utf8");
    const planRaw = await readFile(join(cwd, "tmp/gaskit/live-proof-plan.json"), "utf8");

    assert.equal(bundle.kind, "agentic-gaskit.identity-proof-bundle");
    assert.equal(bundle.status, "blocked");
    assert.equal(bundle.ready, false);
    assert.deepEqual(bundle.templateArtifacts.map((template) => template.id), [
      "iota-names-live",
      "iota-identity-live",
      "vc-validation-live",
    ]);
    assert.equal(bundle.planArtifact, "tmp/gaskit/live-proof-plan.json");
    assert.deepEqual(bundle.checks.map((check) => [check.id, check.status, check.code]), [
      ["iota-names-live", "blocked", "IOTA_NAMES_LIVE_REPORT_MISSING"],
      ["iota-identity-live", "blocked", "IOTA_IDENTITY_LIVE_REPORT_MISSING"],
      ["vc-validation-live", "blocked", "VC_VALIDATION_LIVE_REPORT_MISSING"],
    ]);
    assert.deepEqual(bundle.blockerCodes, [
      "IOTA_NAMES_LIVE_REPORT_MISSING",
      "IOTA_IDENTITY_LIVE_REPORT_MISSING",
      "VC_VALIDATION_LIVE_REPORT_MISSING",
    ]);
    assert.deepEqual(bundle.readyCodes, []);
    assert.ok(bundle.requiredOperatorInputs.includes("IOTA_NAMES_GRAPHQL_URL"));
    assert.ok(bundle.requiredOperatorInputs.includes("IOTA_IDENTITY_TRUSTED_ISSUER_DIDS"));
    assert.ok(bundle.requiredEvidenceArtifacts.includes("sanitized IOTA Identity live smoke report with credential evidence"));
    assert.equal(bundle.steps.find((step) => step.id === "run-iota-names-smoke")?.contactsLiveService, true);
    assert.equal(bundle.steps.find((step) => step.id === "write-live-proof-plan")?.contactsLiveService, false);

    await assertMode(join(cwd, "tmp/gaskit/identity-proof-bundle.json"), 0o600);
    await assertMode(join(cwd, "tmp/gaskit/live-proof-plan.json"), 0o600);
    await assertMode(join(cwd, "tmp/gaskit/iota-names-live-report-template.json"), 0o600);
    await assertMode(join(cwd, "tmp/gaskit/iota-identity-live-report-template.json"), 0o600);
    await assertMode(join(cwd, "tmp/gaskit/vc-validation-live-report-template.json"), 0o600);

    const allOutput = `${JSON.stringify(bundle)}\n${bundleRaw}\n${planRaw}`;
    assert.doesNotMatch(allOutput, /graphql\.testnet\.example/);
    assert.doesNotMatch(allOutput, /researcher\.demo\.iota/);
    assert.doesNotMatch(allOutput, /1111111111111111111111111111111111111111111111111111111111111111/);
    assert.doesNotMatch(allOutput, /identity\.testnet\.example/);
    assert.doesNotMatch(allOutput, /profiles\/researcher\.json/);
    assert.doesNotMatch(allOutput, /agent-registry/);
    assert.doesNotMatch(allOutput, /agent-capability-key-1/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("identity proof bundle is ready when names, identity, and VC gates are ready", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-identity-bundle-"));
  try {
    await mkdir(cwd, { recursive: true });
    await writeFile(join(cwd, "iota-names-report.json"), JSON.stringify(readyIotaNamesReport()));
    await writeFile(join(cwd, "iota-identity-report.json"), JSON.stringify(readyIotaIdentityReport()));

    const bundle = await writeIdentityProofBundle({
      cwd,
      now: new Date("2026-06-14T12:00:00.000Z"),
      env: {
        ...configuredIdentityEnv(),
        IOTA_NAMES_LIVE_REPORT: "iota-names-report.json",
        IOTA_IDENTITY_LIVE_REPORT: "iota-identity-report.json",
      },
      gasStationRuntimeReport: readyGasStationRuntime(),
    });
    const bundleRaw = await readFile(join(cwd, "tmp/gaskit/identity-proof-bundle.json"), "utf8");

    assert.equal(bundle.status, "ready");
    assert.equal(bundle.ready, true);
    assert.deepEqual(bundle.blockerCodes, []);
    assert.deepEqual(bundle.readyCodes, [
      "IOTA_NAMES_LIVE_REPORT_VALID",
      "IOTA_IDENTITY_LIVE_REPORT_VALID",
      "VC_VALIDATION_LIVE_REPORT_VALID",
    ]);
    assert.deepEqual(bundle.checks.map((check) => [check.id, check.status, check.code]), [
      ["iota-names-live", "ready", "IOTA_NAMES_LIVE_REPORT_VALID"],
      ["iota-identity-live", "ready", "IOTA_IDENTITY_LIVE_REPORT_VALID"],
      ["vc-validation-live", "ready", "VC_VALIDATION_LIVE_REPORT_VALID"],
    ]);
    assert.doesNotMatch(bundleRaw, /iota-names-report\.json|iota-identity-report\.json/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

function configuredIdentityEnv(): Record<string, string> {
  return {
    IOTA_NAMES_GRAPHQL_URL: "https://graphql.testnet.example/iota",
    IOTA_NAMES_NAME: "researcher.demo.iota",
    IOTA_NAMES_EXPECTED_ADDRESS: "0x1111111111111111111111111111111111111111111111111111111111111111",
    IOTA_IDENTITY_PROOF_ENDPOINT: "https://identity.testnet.example/proof",
    IOTA_IDENTITY_PROFILE_PATH: "profiles/researcher.json",
    IOTA_IDENTITY_TRUSTED_ISSUER_DIDS: "did:iota:issuer:agent-registry",
    IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS: "#agent-capability-key-1",
    IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES: "VerifiableCredential,AgentCapabilityCredential",
    IOTA_IDENTITY_ACCEPTED_STATUS_TYPES: "RevocationBitmap2022,StatusList2021Entry",
    IOTA_IDENTITY_CACHE_TTL_MS: "60000",
  };
}

function readyGasStationRuntime() {
  return {
    ready: true,
    code: "GAS_STATION_RUNTIME_READY" as const,
    message: "Gas Station runtime is reachable.",
    checks: [],
  };
}

function readyIotaNamesReport() {
  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.iota-names-live-smoke-report",
    observedAt: new Date().toISOString(),
    result: "passed",
    code: "IOTA_NAMES_LIVE_SMOKE_PASSED",
    message: "IOTA Names live smoke resolved the configured name to the expected address.",
    contactsLiveService: true,
    endpointConfigured: true,
    nameConfigured: true,
    expectedAddressConfigured: true,
    addressMatched: true,
    resolvedAddressRedacted: "0x11111111...11111111",
  };
}

function readyIotaIdentityReport() {
  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.iota-identity-live-smoke-report",
    observedAt: new Date().toISOString(),
    result: "passed",
    code: "IOTA_IDENTITY_LIVE_SMOKE_PASSED",
    message: "IOTA Identity live smoke verified profile DID and credential evidence.",
    contactsLiveService: true,
    endpointConfigured: true,
    profilePathConfigured: true,
    trustPolicyConfigured: true,
    identityVerified: true,
    credentialRefsChecked: 1,
  };
}

async function assertMode(path: string, expected: number): Promise<void> {
  const mode = (await stat(path)).mode & 0o777;
  assert.equal(mode, expected);
}
