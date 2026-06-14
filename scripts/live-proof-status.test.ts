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
    const report = await checkLiveProofStatus({
      env: {},
      cwd,
      gasStationRuntimeReport: blockedGasStationRuntime(),
    });
    const formatted = formatLiveProofStatusReport(report);

    assert.equal(report.ok, false);
    assert.deepEqual(
      report.checks.map((check) => [check.id, check.status, check.code]),
      [
        ["testnet-readiness", "blocked", "TESTNET_ENV_FILE_MISSING"],
        ["gas-station-runtime", "blocked", "GAS_STATION_DOCKER_DAEMON_UNAVAILABLE"],
        ["sponsor-funding", "blocked", "SPONSOR_FUNDING_REPORT_MISSING"],
        ["testnet-upstream", "blocked", "TESTNET_UPSTREAM_REPORT_MISSING"],
        ["iota-names-live", "blocked", "IOTA_NAMES_LIVE_CONFIG_MISSING"],
        ["iota-identity-live", "blocked", "IOTA_IDENTITY_LIVE_CONFIG_MISSING"],
        ["vc-validation-live", "blocked", "VC_TRUST_POLICY_CONFIG_MISSING"],
      ],
    );
    assert.match(formatted, /GASKIT_SPONSOR_FUNDING_REPORT/);
    assert.match(formatted, /GASKIT_TESTNET_UPSTREAM_REPORT/);
    assert.match(formatted, /IOTA_NAMES_GRAPHQL_URL/);
    assert.match(formatted, /IOTA_IDENTITY_PROOF_ENDPOINT/);
    assert.match(formatted, /IOTA_IDENTITY_TRUSTED_ISSUER_DIDS/);
    assert.match(formatted, /\.env/);
    assert.doesNotMatch(formatted, /private|mnemonic|bearer|token|secret|iotaprivkey|local-secret/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status marks a passing testnet upstream diagnostic report as ready without printing its path", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    await writeFile(join(cwd, "sponsor-funding-report.json"), JSON.stringify(readySponsorFundingReport()));
    await writeFile(join(cwd, "upstream-report.json"), JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.testnet-upstream-diagnostic",
      observedAt: new Date().toISOString(),
      gasStationRoot: { configured: true, ok: true, status: 200 },
      gasStationV1Health: { configured: true, ok: false, status: 404 },
      iotaRpc: { configured: true, ok: true, status: 200 },
      reserveGas: { skipped: false, ok: true, status: 200 },
      ok: true,
    }));
    const report = await checkLiveProofStatus({
      cwd,
      gasStationRuntimeReport: readyGasStationRuntime(),
      env: {
        GASKIT_SPONSOR_FUNDING_REPORT: "sponsor-funding-report.json",
        GASKIT_TESTNET_UPSTREAM_REPORT: "upstream-report.json",
      },
    });
    const formatted = formatLiveProofStatusReport(report);
    const upstream = report.checks.find((check) => check.id === "testnet-upstream");

    assert.equal(upstream?.status, "ready");
    assert.equal(upstream?.code, "TESTNET_UPSTREAM_REPORT_VALID");
    assert.doesNotMatch(formatted, /upstream-report\.json/);
    assert.doesNotMatch(formatted, /sponsor-funding-report\.json/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status blocks insufficient sponsor funding reports", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    await writeFile(join(cwd, "sponsor-funding-report.json"), JSON.stringify({
      ...readySponsorFundingReport(),
      ready: false,
      code: "SPONSOR_FUNDING_TOTAL_INSUFFICIENT",
      message: "Sponsor wallet total IOTA balance is below the requested reserve budget.",
      totalBalanceMist: "0",
      coinObjectCount: 0,
      sampledCoinCount: 0,
      maxSampledCoinBalanceMist: "0",
    }));
    const report = await checkLiveProofStatus({
      cwd,
      gasStationRuntimeReport: readyGasStationRuntime(),
      env: {
        GASKIT_SPONSOR_FUNDING_REPORT: "sponsor-funding-report.json",
      },
    });
    const formatted = formatLiveProofStatusReport(report);
    const funding = report.checks.find((check) => check.id === "sponsor-funding");

    assert.equal(funding?.status, "blocked");
    assert.equal(funding?.code, "SPONSOR_FUNDING_TOTAL_INSUFFICIENT");
    assert.doesNotMatch(formatted, /sponsor-funding-report\.json/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status blocks skipped reserve diagnostic reports", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    await writeFile(join(cwd, "sponsor-funding-report.json"), JSON.stringify(readySponsorFundingReport()));
    await writeFile(join(cwd, "upstream-report.json"), JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.testnet-upstream-diagnostic",
      observedAt: new Date().toISOString(),
      gasStationRoot: { configured: true, ok: true, status: 200 },
      gasStationV1Health: { configured: true, ok: false, status: 404 },
      iotaRpc: { configured: true, ok: true, status: 200 },
      reserveGas: { skipped: true, ok: false },
      ok: true,
    }));
    const report = await checkLiveProofStatus({
      cwd,
      gasStationRuntimeReport: readyGasStationRuntime(),
      env: {
        GASKIT_SPONSOR_FUNDING_REPORT: "sponsor-funding-report.json",
        GASKIT_TESTNET_UPSTREAM_REPORT: "upstream-report.json",
      },
    });
    const upstream = report.checks.find((check) => check.id === "testnet-upstream");

    assert.equal(upstream?.status, "blocked");
    assert.equal(upstream?.code, "TESTNET_UPSTREAM_REPORT_RESERVE_SKIPPED");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status marks explicit managed upstream runtime ready without Docker", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    const report = await checkLiveProofStatus({
      cwd,
      env: {
        GASKIT_GAS_STATION_RUNTIME_MODE: "managed-upstream",
        GAS_STATION_URL: "https://gas-station.testnet.example",
      },
      gasStationRuntimeRunner: async () => {
        throw new Error("managed-upstream live status must not inspect Docker");
      },
    });
    const formatted = formatLiveProofStatusReport(report);
    const runtime = report.checks.find((check) => check.id === "gas-station-runtime");

    assert.equal(runtime?.status, "ready");
    assert.equal(runtime?.code, "GAS_STATION_RUNTIME_READY");
    assert.match(runtime?.next ?? "", /diagnose:gas-station/);
    assert.doesNotMatch(formatted, /gas-station\.testnet\.example/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status marks configured identity proof endpoint as ready without contacting it", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    const report = await checkLiveProofStatus({
      cwd,
      gasStationRuntimeReport: readyGasStationRuntime(),
      env: {
        IOTA_IDENTITY_PROOF_ENDPOINT: "https://identity.testnet.example/proof",
        IOTA_IDENTITY_PROFILE_PATH: "profiles/researcher.json",
      },
    });
    const formatted = formatLiveProofStatusReport(report);
    const identity = report.checks.find((check) => check.id === "iota-identity-live");

    assert.equal(identity?.status, "ready");
    assert.equal(identity?.code, "IOTA_IDENTITY_LIVE_CONFIG_PRESENT");
    assert.match(identity?.next ?? "", /smoke:iota-identity-live/);
    assert.doesNotMatch(formatted, /identity\.testnet\.example|researcher\.json/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status blocks unsafe identity proof endpoints without printing them", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    const report = await checkLiveProofStatus({
      cwd,
      gasStationRuntimeReport: readyGasStationRuntime(),
      env: {
        IOTA_IDENTITY_PROOF_ENDPOINT: "http://identity.testnet.example/proof",
        IOTA_IDENTITY_PROFILE_PATH: "profiles/researcher.json",
      },
    });
    const formatted = formatLiveProofStatusReport(report);
    const identity = report.checks.find((check) => check.id === "iota-identity-live");

    assert.equal(identity?.status, "blocked");
    assert.equal(identity?.code, "IOTA_IDENTITY_PROOF_ENDPOINT_UNSAFE");
    assert.doesNotMatch(formatted, /identity\.testnet\.example|researcher\.json/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status validates VC trust policy config without printing values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    const report = await checkLiveProofStatus({
      cwd,
      gasStationRuntimeReport: readyGasStationRuntime(),
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
      gasStationRuntimeReport: readyGasStationRuntime(),
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
      gasStationRuntimeReport: readyGasStationRuntime(),
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
      gasStationRuntimeReport: readyGasStationRuntime(),
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
    const report = await checkLiveProofStatus({
      cwd,
      env: {},
      gasStationRuntimeReport: readyGasStationRuntime(),
    });
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

function readyGasStationRuntime() {
  return {
    ready: true,
    code: "GAS_STATION_RUNTIME_READY" as const,
    message: "Local Gas Station runtime prerequisites are present.",
    checks: [],
  };
}

function blockedGasStationRuntime() {
  return {
    ready: false,
    code: "GAS_STATION_DOCKER_DAEMON_UNAVAILABLE" as const,
    message: "Docker daemon is not reachable.",
    checks: [],
  };
}

function readySponsorFundingReport() {
  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.sponsor-funding-report",
    observedAt: new Date().toISOString(),
    ready: true,
    code: "SPONSOR_FUNDING_READY",
    message: "Sponsor wallet has enough sampled IOTA balance for the requested reserve budget.",
    contactsLiveService: true,
    spendsGas: false,
    signsTransactions: false,
    sponsorAddressRedacted: "0x12345678...90abcdef",
    coinType: "0x2::iota::IOTA",
    requiredMist: "50000000",
    totalBalanceMist: "100000000",
    coinObjectCount: 1,
    sampledCoinCount: 1,
    maxSampledCoinBalanceMist: "100000000",
    hasNextCoinPage: false,
  };
}
