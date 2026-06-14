import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildLiveProofStatusArtifact,
  checkLiveProofStatus,
  formatLiveProofStatusArtifact,
  formatLiveProofStatusReport,
  writeLiveProofStatusArtifact,
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
        ["testnet-sponsored-execute", "blocked", "TESTNET_DIGEST_REPORT_MISSING"],
        ["iota-names-live", "blocked", "IOTA_NAMES_LIVE_CONFIG_MISSING"],
        ["iota-identity-live", "blocked", "IOTA_IDENTITY_LIVE_CONFIG_MISSING"],
        ["vc-validation-live", "blocked", "VC_TRUST_POLICY_CONFIG_MISSING"],
      ],
    );
    assert.match(formatted, /GASKIT_SPONSOR_FUNDING_REPORT/);
    assert.match(formatted, /GASKIT_TESTNET_UPSTREAM_REPORT/);
    assert.match(formatted, /GASKIT_TESTNET_DIGEST_REPORT/);
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
    assert.equal(funding?.evidence, "sponsor-funding-report-loaded-redacted");
    assert.match(formatted, /evidence=sponsor-funding-report-loaded-redacted/);
    assert.doesNotMatch(formatted, /sponsor-funding-report\.json/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status includes sanitized sponsor faucet failure context", async () => {
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
    await writeFile(join(cwd, "sponsor-faucet-report.json"), JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.sponsor-faucet-request",
      result: "failed",
      code: "SPONSOR_FAUCET_FAILED",
      observedAt: new Date().toISOString(),
      network: "iota-testnet",
      message: "Sponsor faucet request failed without exposing raw faucet response details.",
      approvalRequired: true,
      contactsLiveService: true,
      spendsGas: false,
      signsTransactions: false,
      sponsorAddressRedacted: "0x12345678...90abcdef",
      faucetUrlConfigured: true,
      faucetApiVersion: "v1-batch",
      faucetHttpStatus: 200,
      faucetFailureKind: "faucet-error",
      faucetErrorCode: "FUNDS_UNAVAILABLE",
      nextCommands: ["npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json"],
    }));
    const report = await checkLiveProofStatus({
      cwd,
      gasStationRuntimeReport: readyGasStationRuntime(),
      env: {
        GASKIT_SPONSOR_FUNDING_REPORT: "sponsor-funding-report.json",
        GASKIT_SPONSOR_FAUCET_REPORT: "sponsor-faucet-report.json",
      },
    });
    const formatted = formatLiveProofStatusReport(report);
    const funding = report.checks.find((check) => check.id === "sponsor-funding");

    assert.equal(funding?.status, "blocked");
    assert.equal(funding?.code, "SPONSOR_FUNDING_TOTAL_INSUFFICIENT");
    assert.match(funding?.next ?? "", /Latest sponsor faucet report failed via v1-batch with HTTP 200 \(faucet-error\) code=FUNDS_UNAVAILABLE/);
    assert.doesNotMatch(formatted, /sponsor-faucet-report\.json|0x1234567890abcdef|faucet\.testnet\.example|task-/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status uses the default ignored sponsor faucet report when env is unset", async () => {
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
    await mkdir(join(cwd, "tmp/gaskit"), { recursive: true });
    await writeFile(join(cwd, "tmp/gaskit/sponsor-faucet-request.json"), JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.sponsor-faucet-request",
      result: "failed",
      code: "SPONSOR_FAUCET_FAILED",
      observedAt: new Date().toISOString(),
      network: "iota-testnet",
      message: "Sponsor faucet request failed without exposing raw faucet response details.",
      approvalRequired: true,
      contactsLiveService: true,
      spendsGas: false,
      signsTransactions: false,
      sponsorAddressRedacted: "0x12345678...90abcdef",
      faucetUrlConfigured: true,
      faucetApiVersion: "v0-documented",
      faucetHttpStatus: 405,
      faucetFailureKind: "http-status",
      faucetErrorCode: "REQUEST_UNSUPPORTED",
      nextCommands: ["npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json"],
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
    assert.match(funding?.next ?? "", /Latest sponsor faucet report failed via v0-documented with HTTP 405 \(http-status\) code=REQUEST_UNSUPPORTED/);
    assert.doesNotMatch(formatted, /tmp\/gaskit\/sponsor-faucet-request\.json|0x1234567890abcdef|faucet\.testnet\.example|task-/);
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
    assert.match(upstream?.next ?? "", /without --skip-reserve/);
    assert.doesNotMatch(upstream?.next ?? "", /Bring the configured Gas Station upstream online/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status marks sponsored execute digest ready with a passing digest report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    await writeFile(join(cwd, "digest-report.json"), JSON.stringify(readyTestnetDigestReport()));
    const report = await checkLiveProofStatus({
      cwd,
      gasStationRuntimeReport: readyGasStationRuntime(),
      env: {
        GASKIT_TESTNET_DIGEST_REPORT: "digest-report.json",
      },
    });
    const formatted = formatLiveProofStatusReport(report);
    const digest = report.checks.find((check) => check.id === "testnet-sponsored-execute");

    assert.equal(digest?.status, "ready");
    assert.equal(digest?.code, "TESTNET_SPONSORED_EXECUTE_DIGEST_VERIFIED");
    assert.equal(digest?.evidence, "testnet-digest-report-valid-redacted");
    assert.doesNotMatch(formatted, /digest-report\.json|FLdnYRUACAKQn8CwugEv1u6gYTh9jBr8rGMk2JZ2adsd/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status blocks stale or unverified sponsored execute digest reports", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    await writeFile(join(cwd, "digest-report.json"), JSON.stringify({
      ...readyTestnetDigestReport(),
      observedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    }));
    const report = await checkLiveProofStatus({
      cwd,
      gasStationRuntimeReport: readyGasStationRuntime(),
      env: {
        GASKIT_TESTNET_DIGEST_REPORT: "digest-report.json",
      },
    });
    const formatted = formatLiveProofStatusReport(report);
    const digest = report.checks.find((check) => check.id === "testnet-sponsored-execute");

    assert.equal(digest?.status, "blocked");
    assert.equal(digest?.code, "TESTNET_DIGEST_REPORT_STALE");
    assert.equal(digest?.evidence, "testnet-digest-report-loaded-redacted");
    assert.doesNotMatch(formatted, /digest-report\.json|FLdnYRUACAKQn8CwugEv1u6gYTh9jBr8rGMk2JZ2adsd/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status routes ready local Gas Station runtime to diagnostics", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    const report = await checkLiveProofStatus({
      cwd,
      env: {},
      gasStationRuntimeReport: readyGasStationRuntime(),
    });
    const runtime = report.checks.find((check) => check.id === "gas-station-runtime");

    assert.equal(runtime?.status, "ready");
    assert.equal(runtime?.code, "GAS_STATION_RUNTIME_READY");
    assert.match(runtime?.next ?? "", /diagnose:gas-station/);
    assert.doesNotMatch(runtime?.next ?? "", /Start the local Gas Station/);
    assert.doesNotMatch(runtime?.next ?? "", /docker-direct -- --execute/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status routes reserve failures blocked by sponsor funding to funding next steps", async () => {
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
    await writeFile(join(cwd, "upstream-report.json"), JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.testnet-upstream-diagnostic",
      observedAt: new Date().toISOString(),
      gasStationRoot: { configured: true, ok: true, status: 200 },
      gasStationV1Health: { configured: true, ok: false, status: 404 },
      iotaRpc: { configured: true, ok: true, status: 200 },
      reserveGas: {
        skipped: false,
        ok: false,
        status: 500,
        code: "RESERVE_GAS_SPONSOR_FUNDING_BLOCKED",
        message: "reserve_gas compatibility probe failed while the sponsor funding report is not ready.",
      },
      ok: false,
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
    assert.equal(upstream?.code, "TESTNET_UPSTREAM_REPORT_FAILED");
    assert.equal(upstream?.evidence, "testnet-upstream-report-loaded-redacted");
    assert.match(upstream?.message ?? "", /sponsor funding report is not ready/);
    assert.match(upstream?.next ?? "", /sponsor:check-funding/);
    assert.doesNotMatch(upstream?.next ?? "", /sponsor-funding-report\.json|upstream-report\.json/);
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

test("live proof status blocks configured identity proof endpoint without a smoke report", async () => {
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

    assert.equal(identity?.status, "blocked");
    assert.equal(identity?.code, "IOTA_IDENTITY_LIVE_REPORT_MISSING");
    assert.deepEqual(identity?.missing, ["IOTA_IDENTITY_LIVE_REPORT"]);
    assert.match(identity?.next ?? "", /--report/);
    assert.doesNotMatch(formatted, /identity\.testnet\.example|researcher\.json/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status marks identity ready with a passing smoke report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    await writeFile(join(cwd, "iota-identity-report.json"), JSON.stringify(readyIotaIdentityReport()));
    const report = await checkLiveProofStatus({
      cwd,
      gasStationRuntimeReport: readyGasStationRuntime(),
      env: {
        IOTA_IDENTITY_PROOF_ENDPOINT: "https://identity.testnet.example/proof",
        IOTA_IDENTITY_PROFILE_PATH: "profiles/researcher.json",
        IOTA_IDENTITY_LIVE_REPORT: "iota-identity-report.json",
      },
    });
    const formatted = formatLiveProofStatusReport(report);
    const identity = report.checks.find((check) => check.id === "iota-identity-live");

    assert.equal(identity?.status, "ready");
    assert.equal(identity?.code, "IOTA_IDENTITY_LIVE_REPORT_VALID");
    assert.doesNotMatch(formatted, /iota-identity-report\.json|identity\.testnet\.example|researcher\.json/);
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

test("live proof status blocks VC trust policy config without an identity smoke report", async () => {
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

    assert.equal(vc?.status, "blocked");
    assert.equal(vc?.code, "VC_VALIDATION_LIVE_REPORT_MISSING");
    assert.deepEqual(vc?.missing, ["IOTA_IDENTITY_LIVE_REPORT"]);
    assert.doesNotMatch(formatted, /agent-registry|agent-capability-key-1/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status validates VC trust policy with current credential evidence report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    await writeFile(join(cwd, "iota-identity-report.json"), JSON.stringify(readyIotaIdentityReport()));
    const report = await checkLiveProofStatus({
      cwd,
      gasStationRuntimeReport: readyGasStationRuntime(),
      env: {
        IOTA_IDENTITY_PROOF_ENDPOINT: "https://identity.testnet.example/proof",
        IOTA_IDENTITY_PROFILE_PATH: "profiles/researcher.json",
        IOTA_IDENTITY_LIVE_REPORT: "iota-identity-report.json",
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
    assert.equal(vc?.code, "VC_VALIDATION_LIVE_REPORT_VALID");
    assert.equal(vc?.evidence, "vc-live-report-valid-redacted");
    assert.doesNotMatch(formatted, /iota-identity-report\.json|identity\.testnet\.example|researcher\.json/);
    assert.doesNotMatch(formatted, /agent-registry|agent-capability-key-1/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status blocks VC validation when identity report has no credential evidence", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    await writeFile(join(cwd, "iota-identity-report.json"), JSON.stringify({
      ...readyIotaIdentityReport(),
      credentialRefsChecked: 0,
    }));
    const report = await checkLiveProofStatus({
      cwd,
      gasStationRuntimeReport: readyGasStationRuntime(),
      env: {
        IOTA_IDENTITY_PROOF_ENDPOINT: "https://identity.testnet.example/proof",
        IOTA_IDENTITY_PROFILE_PATH: "profiles/researcher.json",
        IOTA_IDENTITY_LIVE_REPORT: "iota-identity-report.json",
        IOTA_IDENTITY_TRUSTED_ISSUER_DIDS: "did:iota:issuer:agent-registry",
        IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS: "#agent-capability-key-1",
        IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES: "VerifiableCredential,AgentCapabilityCredential",
        IOTA_IDENTITY_ACCEPTED_STATUS_TYPES: "RevocationBitmap2022,StatusList2021Entry",
        IOTA_IDENTITY_CACHE_TTL_MS: "60000",
      },
    });
    const formatted = formatLiveProofStatusReport(report);
    const vc = report.checks.find((check) => check.id === "vc-validation-live");

    assert.equal(vc?.status, "blocked");
    assert.equal(vc?.code, "VC_VALIDATION_CREDENTIAL_EVIDENCE_MISSING");
    assert.doesNotMatch(formatted, /iota-identity-report\.json|identity\.testnet\.example|researcher\.json/);
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

test("live proof status blocks configured names without a smoke report", async () => {
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
    assert.equal(names?.status, "blocked");
    assert.equal(names?.code, "IOTA_NAMES_LIVE_REPORT_MISSING");
    assert.deepEqual(names?.missing, ["IOTA_NAMES_LIVE_REPORT"]);
    assert.match(names?.next ?? "", /--report/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status marks names ready with a passing smoke report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    await writeFile(join(cwd, "iota-names-report.json"), JSON.stringify(readyIotaNamesReport()));
    const report = await checkLiveProofStatus({
      cwd,
      gasStationRuntimeReport: readyGasStationRuntime(),
      env: {
        IOTA_NAMES_GRAPHQL_URL: "https://graphql.testnet.example/iota",
        IOTA_NAMES_NAME: "researcher.demo.iota",
        IOTA_NAMES_EXPECTED_ADDRESS: "0x1111111111111111111111111111111111111111111111111111111111111111",
        IOTA_NAMES_LIVE_REPORT: "iota-names-report.json",
      },
    });
    const formatted = formatLiveProofStatusReport(report);
    const names = report.checks.find((check) => check.id === "iota-names-live");

    assert.equal(names?.status, "ready");
    assert.equal(names?.code, "IOTA_NAMES_LIVE_REPORT_VALID");
    assert.doesNotMatch(formatted, /iota-names-report\.json|graphql\.testnet\.example|researcher\.demo\.iota/);
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

test("live proof status artifact summarizes blockers without secret values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    const report = await checkLiveProofStatus({
      cwd,
      env: {
        IOTA_NAMES_GRAPHQL_URL: "https://graphql.testnet.example/iota",
        IOTA_NAMES_NAME: "researcher.demo.iota",
        IOTA_NAMES_EXPECTED_ADDRESS: "0x1111111111111111111111111111111111111111111111111111111111111111",
        IOTA_IDENTITY_PROOF_ENDPOINT: "https://identity.testnet.example/proof",
        IOTA_IDENTITY_PROFILE_PATH: "profiles/researcher.json",
      },
      gasStationRuntimeReport: readyGasStationRuntime(),
    });
    const artifact = buildLiveProofStatusArtifact(report, new Date("2026-06-14T00:00:00.000Z"));
    const formatted = formatLiveProofStatusArtifact(artifact);

    assert.equal(artifact.schemaVersion, 1);
    assert.equal(artifact.kind, "agentic-gaskit.live-proof-status-report");
    assert.equal(artifact.generatedAt, "2026-06-14T00:00:00.000Z");
    assert.equal(artifact.ok, false);
    assert.ok(artifact.readyCheckIds.includes("gas-station-runtime"));
    assert.ok(artifact.blockedCheckIds.includes("sponsor-funding"));
    assert.ok(artifact.blockedCheckIds.includes("iota-names-live"));
    assert.ok(artifact.blockerCodes.includes("SPONSOR_FUNDING_REPORT_MISSING"));
    assert.ok(artifact.boundaries.some((boundary) => boundary.includes("non-networked")));
    assert.doesNotMatch(
      formatted,
      /fake-testnet-sponsor-key|fake-gas-station-auth|fake-upstream-bearer|local-secret|iotaprivkey|graphql\.testnet\.example|identity\.testnet\.example|researcher\.demo\.iota|researcher\.json|0x1111111111111111111111111111111111111111111111111111111111111111/i,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof status artifact writer uses restrictive local file permissions", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-"));
  try {
    const outFile = join("reports", "live-proof-status.json");
    const artifact = await writeLiveProofStatusArtifact({
      cwd,
      env: {},
      outFile,
      now: new Date("2026-06-14T00:00:00.000Z"),
      gasStationRuntimeReport: readyGasStationRuntime(),
    });
    const outPath = join(cwd, outFile);
    const metadata = await stat(outPath);
    const parsed = JSON.parse(await readFile(outPath, "utf8"));

    assert.equal(metadata.mode & 0o777, 0o600);
    assert.equal(parsed.kind, artifact.kind);
    assert.equal(parsed.generatedAt, "2026-06-14T00:00:00.000Z");
    assert.deepEqual(parsed.blockedCheckIds, artifact.blockedCheckIds);
    assert.doesNotMatch(
      JSON.stringify(parsed),
      /fake-testnet-sponsor-key|fake-gas-station-auth|fake-upstream-bearer|local-secret|iotaprivkey/i,
    );
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

function readyTestnetDigestReport() {
  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.testnet-digest-proof-report",
    observedAt: new Date().toISOString(),
    digest: "FLdnYRUACAKQn8CwugEv1u6gYTh9jBr8rGMk2JZ2adsd",
    rpcUrl: "https://api.testnet.iota.cafe",
    documented: true,
    liveChecked: true,
    verified: true,
    status: "verified-testnet",
    effectsStatus: "success",
    checkpoint: "1",
    timestampMs: "1760000000000",
    next: "The documented public digest is retrievable from the configured IOTA testnet RPC.",
  };
}
