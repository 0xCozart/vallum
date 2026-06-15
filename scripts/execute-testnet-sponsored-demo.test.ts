import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildSponsoredExecuteReport,
  checkSponsoredExecutePrerequisites,
  formatSponsoredExecuteField,
  formatSponsoredExecutePrerequisiteReport,
  writeSponsoredExecuteReportFile,
} from "./execute-testnet-sponsored-demo.js";

test("sponsored testnet execute prerequisites block missing upstream report without leaking env values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentrail-execute-prereq-"));
  try {
    await writePolicy(cwd);
    const report = await checkSponsoredExecutePrerequisites({
      cwd,
      env: completeEnv(),
      gasStationRuntimeReport: readyGasStationRuntime(),
      policyGatewayHealthReport: readyPolicyGateway(),
    });
    const formatted = formatSponsoredExecutePrerequisiteReport(report);

    assert.equal(report.ready, false);
    assert.equal(findCheck(report, "testnet-readiness").ok, true);
    assert.equal(findCheck(report, "gas-station-runtime").ok, true);
    assert.equal(findCheck(report, "policy-gateway").ok, true);
    assert.equal(findCheck(report, "testnet-upstream").code, "TESTNET_UPSTREAM_REPORT_MISSING");
    assert.doesNotMatch(formatted, /auth-value|bearer-value|demo-app-key|jwt-value/i);
    assert.doesNotMatch(formatted, /127\.0\.0\.1:9527|127\.0\.0\.1:8787|api\.testnet\.iota\.cafe/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("sponsored testnet execute prerequisites block failed runtime before live execute", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentrail-execute-prereq-"));
  try {
    await writePolicy(cwd);
    const report = await checkSponsoredExecutePrerequisites({
      cwd,
      env: {
        ...completeEnv(),
        AGENTRAIL_TESTNET_UPSTREAM_REPORT: "upstream-report.json",
      },
      gasStationRuntimeReport: blockedGasStationRuntime(),
      policyGatewayHealthReport: readyPolicyGateway(),
      testnetUpstreamReport: validUpstreamReport(),
    });

    assert.equal(report.ready, false);
    assert.equal(findCheck(report, "gas-station-runtime").code, "GAS_STATION_DOCKER_DAEMON_UNAVAILABLE");
    assert.equal(findCheck(report, "testnet-upstream").ok, true);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("sponsored testnet execute prerequisites require passing reserve compatibility report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentrail-execute-prereq-"));
  try {
    await writePolicy(cwd);
    const report = await checkSponsoredExecutePrerequisites({
      cwd,
      env: {
        ...completeEnv(),
        AGENTRAIL_TESTNET_UPSTREAM_REPORT: "upstream-report.json",
      },
      gasStationRuntimeReport: readyGasStationRuntime(),
      policyGatewayHealthReport: readyPolicyGateway(),
      testnetUpstreamReport: {
        ...validUpstreamReport(),
        reserveGas: { skipped: true, ok: false },
      },
    });

    assert.equal(report.ready, false);
    assert.equal(findCheck(report, "testnet-upstream").code, "TESTNET_UPSTREAM_REPORT_RESERVE_SKIPPED");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("sponsored testnet execute prerequisites pass only after readiness runtime and upstream proof", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentrail-execute-prereq-"));
  try {
    await writePolicy(cwd);
    const report = await checkSponsoredExecutePrerequisites({
      cwd,
      env: {
        ...completeEnv(),
        AGENTRAIL_TESTNET_UPSTREAM_REPORT: "upstream-report.json",
      },
      gasStationRuntimeReport: readyGasStationRuntime(),
      policyGatewayHealthReport: readyPolicyGateway(),
      testnetUpstreamReport: validUpstreamReport(),
    });

    assert.equal(report.ready, true);
    assert.deepEqual(report.checks.map((check) => [check.id, check.ok]), [
      ["testnet-readiness", true],
      ["gas-station-runtime", true],
      ["policy-gateway", true],
      ["testnet-upstream", true],
    ]);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("sponsored testnet execute prerequisites accept explicit managed upstream runtime only with upstream proof", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentrail-execute-prereq-"));
  try {
    await writePolicy(cwd);
    const report = await checkSponsoredExecutePrerequisites({
      cwd,
      env: {
        ...completeEnv(),
        AGENTRAIL_GAS_STATION_RUNTIME_MODE: "managed-upstream",
        GAS_STATION_URL: "https://gas-station.testnet.example",
        AGENTRAIL_TESTNET_UPSTREAM_REPORT: "upstream-report.json",
      },
      gasStationRuntimeRunner: async () => {
        throw new Error("managed-upstream prerequisite check must not inspect Docker");
      },
      policyGatewayHealthReport: readyPolicyGateway(),
      testnetUpstreamReport: validUpstreamReport(),
    });

    assert.equal(report.ready, true);
    assert.equal(findCheck(report, "gas-station-runtime").code, "GAS_STATION_RUNTIME_READY");
    assert.equal(findCheck(report, "testnet-upstream").ok, true);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("sponsored testnet execute prerequisites block unreachable local policy gateway before live execute", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentrail-execute-prereq-"));
  try {
    await writePolicy(cwd);
    const report = await checkSponsoredExecutePrerequisites({
      cwd,
      env: {
        ...completeEnv(),
        AGENTRAIL_TESTNET_UPSTREAM_REPORT: "upstream-report.json",
      },
      gasStationRuntimeReport: readyGasStationRuntime(),
      policyGatewayHealthReport: blockedPolicyGateway(),
      testnetUpstreamReport: validUpstreamReport(),
    });
    const formatted = formatSponsoredExecutePrerequisiteReport(report);

    assert.equal(report.ready, false);
    assert.equal(findCheck(report, "policy-gateway").code, "POLICY_GATEWAY_UNREACHABLE");
    assert.equal(findCheck(report, "testnet-upstream").ok, true);
    assert.doesNotMatch(formatted, /127\.0\.0\.1:8787|demo-app-key|bearer-value/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("sponsored testnet execute live output redacts addresses and opaque reservation ids", () => {
  const fullAddress = "0x1111111111111111111111111111111111111111111111111111111111111111";
  const reservationId = "reservation-id-that-should-not-print-in-full";
  const transactionId = "transaction-id-that-should-not-print-in-full";

  const addressLine = formatSponsoredExecuteField("sponsorAddress", fullAddress);
  const reservationLine = formatSponsoredExecuteField("reservationId", reservationId);
  const transactionLine = formatSponsoredExecuteField("agentRailTransactionId", transactionId);

  assert.equal(addressLine, "sponsorAddress=0x11111111...11111111");
  assert.match(reservationLine, /^reservationId=reservat.*n-full$/);
  assert.match(transactionLine, /^agentRailTransactionId=transact.*n-full$/);
  assert.doesNotMatch(addressLine, new RegExp(escapeRegExp(fullAddress)));
  assert.doesNotMatch(reservationLine, new RegExp(escapeRegExp(reservationId)));
  assert.doesNotMatch(transactionLine, new RegExp(escapeRegExp(transactionId)));
});

test("sponsored testnet execute report writes sanitized ignored evidence", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentrail-execute-report-"));
  try {
    const fullAddress = "0x1111111111111111111111111111111111111111111111111111111111111111";
    const userAddress = "0x2222222222222222222222222222222222222222222222222222222222222222";
    const reservationId = "reservation-id-that-should-not-print-in-full";
    const transactionId = "transaction-id-that-should-not-print-in-full";
    const digest = "publicDigestThatCanBeCheckedOnTestnet";
    const report = buildSponsoredExecuteReport({
      demoTarget: "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0::demo_badge::mint_badge",
      ephemeralUserAddress: userAddress,
      reservationId,
      agentRailTransactionId: transactionId,
      sponsorAddress: fullAddress,
      transactionDigest: digest,
    }, new Date("2026-06-14T00:00:00.000Z"));
    const outFile = join(cwd, "tmp/agentrail/sponsored-execute-report.json");

    await writeSponsoredExecuteReportFile(outFile, report);

    const raw = await readFile(outFile, "utf8");
    const mode = (await stat(outFile)).mode & 0o777;
    const parsed = JSON.parse(raw) as typeof report;

    assert.equal(mode, 0o600);
    assert.equal(parsed.kind, "agentrail.sponsored-testnet-execute-report");
    assert.equal(parsed.result, "passed");
    assert.equal(parsed.transactionDigest, digest);
    assert.equal(parsed.contactsLiveService, true);
    assert.equal(parsed.spendsGas, true);
    assert.equal(parsed.signsTransactions, true);
    assert.equal(parsed.sponsorAddressRedacted, "0x11111111...11111111");
    assert.equal(parsed.ephemeralUserAddressRedacted, "0x22222222...22222222");
    assert.doesNotMatch(raw, new RegExp(escapeRegExp(fullAddress)));
    assert.doesNotMatch(raw, new RegExp(escapeRegExp(userAddress)));
    assert.doesNotMatch(raw, new RegExp(escapeRegExp(reservationId)));
    assert.doesNotMatch(raw, new RegExp(escapeRegExp(transactionId)));
    assert.doesNotMatch(raw, /secret|private|mnemonic|iotaprivkey|bearer|signature|transactionBytes/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findCheck(
  report: Awaited<ReturnType<typeof checkSponsoredExecutePrerequisites>>,
  id: string,
) {
  const check = report.checks.find((candidate) => candidate.id === id);
  assert.ok(check, `expected ${id} check`);
  return check;
}

async function writePolicy(cwd: string): Promise<void> {
  await writeFile(join(cwd, "policy.yaml"), [
    "apps:",
    "  demo-dapp:",
    "    api_key_name: demo-dapp-key",
    "    status: active",
    "    daily_budget_iota: 10",
    "    daily_request_limit: 1000",
    "    max_requests_per_wallet_per_day: 25",
    "    max_gas_budget_per_tx: 50000000",
    "    allowed_packages:",
    "      - \"0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0\"",
    "    allowed_functions:",
    "      - \"mint_badge\"",
    "    denied_wallets: []",
    "",
  ].join("\n"));
}

function completeEnv(): Record<string, string> {
  return {
    IOTA_RPC_URL: "https://api.testnet.iota.cafe",
    GAS_STATION_KEYPAIR: "sponsor-key-fixture-for-readiness-only",
    GAS_STATION_AUTH: "auth-value-for-testnet-demo",
    JWT_SECRET: "jwt-value-for-testnet-demo-1234567890",
    DATABASE_URL: "file:./data/agentrail.sqlite3",
    AGENTRAIL_GATEWAY_HOST: "127.0.0.1",
    AGENTRAIL_GATEWAY_PORT: "8787",
    AGENTRAIL_POLICY_PATH: "policy.yaml",
    AGENTRAIL_DEMO_APP_KEY: "demo-app-key-for-testnet",
    GAS_STATION_URL: "http://127.0.0.1:9527",
    GAS_STATION_BEARER_TOKEN: "bearer-value-for-testnet-demo",
  };
}

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

function readyPolicyGateway() {
  return {
    ready: true,
    code: "POLICY_GATEWAY_READY" as const,
    message: "Local policy gateway health endpoint is reachable.",
    status: 200,
  };
}

function blockedPolicyGateway() {
  return {
    ready: false,
    code: "POLICY_GATEWAY_UNREACHABLE" as const,
    message: "Local policy gateway health endpoint is not reachable.",
  };
}

function validUpstreamReport() {
  return {
    schemaVersion: 1 as const,
    kind: "agentrail.testnet-upstream-diagnostic" as const,
    observedAt: new Date().toISOString(),
    gasStationRoot: { configured: true, ok: true, status: 200 },
    gasStationV1Health: { configured: true, ok: false, status: 404 },
    iotaRpc: { configured: true, ok: true, status: 200 },
    reserveGas: { skipped: false, ok: true, status: 200 },
    ok: true,
  };
}
