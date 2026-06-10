import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  checkLiveProofStatus,
  formatLiveProofStatusReport,
} from "./check-live-proof-status.js";

test("live proof status reports exact blockers without secret values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    const report = await checkLiveProofStatus({ env: {}, cwd });
    const formatted = formatLiveProofStatusReport(report);

    assert.equal(report.ok, false);
    assert.deepEqual(
      report.checks.map((check) => [check.id, check.status, check.code]),
      [
        ["testnet-readiness", "blocked", "TESTNET_ENV_FILE_MISSING"],
        ["iota-names-live", "blocked", "IOTA_NAMES_LIVE_CONFIG_MISSING"],
        ["iota-identity-live", "blocked", "IOTA_IDENTITY_LIVE_PROOF_UNIMPLEMENTED"],
        ["vc-validation-live", "blocked", "VC_TRUST_POLICY_CONFIG_MISSING"],
      ],
    );
    assert.match(formatted, /IOTA_NAMES_GRAPHQL_URL/);
    assert.match(formatted, /IOTA_IDENTITY_TRUSTED_ISSUER_DIDS/);
    assert.match(formatted, /\.env/);
    assert.doesNotMatch(formatted, /private|mnemonic|bearer|token|secret|iotaprivkey|local-secret/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status validates VC trust policy config without printing values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    const report = await checkLiveProofStatus({
      cwd,
      env: {
        IOTA_IDENTITY_TRUSTED_ISSUER_DIDS: "did:iota:issuer:agent-registry",
        IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS: "#agent-capability-key-1",
        IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES: "VerifiableCredential,AgentCapabilityCredential",
        IOTA_IDENTITY_ACCEPTED_STATUS_TYPES: "RevocationBitmap2022,StatusList2021Entry",
        IOTA_IDENTITY_CACHE_TTL_MS: "60000",
      },
    });
    const formatted = formatLiveProofStatusReport(report);
    const vc = report.checks.find((check) => check.id === "vc-validation-live");

    assert.equal(vc?.status, "ready");
    assert.equal(vc?.code, "VC_TRUST_POLICY_CONFIG_PRESENT");
    assert.doesNotMatch(formatted, /agent-registry|agent-capability-key-1/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status blocks malformed VC trust policy config without printing values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    const report = await checkLiveProofStatus({
      cwd,
      env: {
        IOTA_IDENTITY_TRUSTED_ISSUER_DIDS: "issuer-without-did-prefix",
        IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS: "#agent-capability-key-1",
        IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES: "VerifiableCredential,AgentCapabilityCredential",
        IOTA_IDENTITY_ACCEPTED_STATUS_TYPES: "UnknownStatus2026",
        IOTA_IDENTITY_CACHE_TTL_MS: "-1",
      },
    });
    const formatted = formatLiveProofStatusReport(report);
    const vc = report.checks.find((check) => check.id === "vc-validation-live");

    assert.equal(vc?.status, "blocked");
    assert.equal(vc?.code, "VC_TRUST_POLICY_CONFIG_INVALID");
    assert.doesNotMatch(formatted, /issuer-without-did-prefix|UnknownStatus2026|agent-capability-key-1/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status marks configured names as ready without contacting GraphQL", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    const report = await checkLiveProofStatus({
      cwd,
      env: {
        IOTA_NAMES_GRAPHQL_URL: "https://graphql.testnet.example/iota",
        IOTA_NAMES_NAME: "researcher.demo.iota",
        IOTA_NAMES_EXPECTED_ADDRESS: "0x1111111111111111111111111111111111111111111111111111111111111111",
      },
    });

    const names = report.checks.find((check) => check.id === "iota-names-live");
    assert.equal(names?.status, "ready");
    assert.equal(names?.code, "IOTA_NAMES_LIVE_CONFIG_PRESENT");
    assert.match(names?.next ?? "", /smoke:iota-names-live/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status blocks unsafe names endpoints without printing them", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    const report = await checkLiveProofStatus({
      cwd,
      env: {
        IOTA_NAMES_GRAPHQL_URL: "http://graphql.testnet.example/iota",
        IOTA_NAMES_NAME: "researcher.demo.iota",
        IOTA_NAMES_EXPECTED_ADDRESS: "0x1111111111111111111111111111111111111111111111111111111111111111",
      },
    });
    const formatted = formatLiveProofStatusReport(report);
    const names = report.checks.find((check) => check.id === "iota-names-live");

    assert.equal(names?.status, "blocked");
    assert.equal(names?.code, "IOTA_NAMES_GRAPHQL_URL_UNSAFE");
    assert.doesNotMatch(formatted, /graphql\.testnet\.example/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status reports readiness failures by check id only", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    await writeFile(join(cwd, ".env"), "IOTA_RPC_URL=https://api.testnet.iota.example\n");
    const report = await checkLiveProofStatus({ cwd, env: {} });
    const formatted = formatLiveProofStatusReport(report);
    const readiness = report.checks.find((check) => check.id === "testnet-readiness");

    assert.equal(readiness?.status, "blocked");
    assert.equal(readiness?.code, "TESTNET_READINESS_FAILED");
    assert.ok(readiness?.missing?.includes("GAS_STATION_AUTH.required"));
    assert.doesNotMatch(formatted, /https:\/\/api\.testnet\.iota\.example/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
