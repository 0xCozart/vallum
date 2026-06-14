import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  checkSponsoredExecutePrerequisites,
  formatSponsoredExecutePrerequisiteReport,
} from "./execute-testnet-sponsored-demo.js";

test("sponsored testnet execute prerequisites block missing upstream report without leaking env values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-execute-prereq-"));
  try {
    await writePolicy(cwd);
    const report = await checkSponsoredExecutePrerequisites({
      cwd,
      env: completeEnv(),
      gasStationRuntimeReport: readyGasStationRuntime(),
    });
    const formatted = formatSponsoredExecutePrerequisiteReport(report);

    assert.equal(report.ready, false);
    assert.equal(findCheck(report, "testnet-readiness").ok, true);
    assert.equal(findCheck(report, "gas-station-runtime").ok, true);
    assert.equal(findCheck(report, "testnet-upstream").code, "TESTNET_UPSTREAM_REPORT_MISSING");
    assert.doesNotMatch(formatted, /auth-value|bearer-value|demo-app-key|jwt-value/i);
    assert.doesNotMatch(formatted, /127\.0\.0\.1:9527|api\.testnet\.iota\.cafe/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("sponsored testnet execute prerequisites block failed runtime before live execute", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-execute-prereq-"));
  try {
    await writePolicy(cwd);
    const report = await checkSponsoredExecutePrerequisites({
      cwd,
      env: {
        ...completeEnv(),
        GASKIT_TESTNET_UPSTREAM_REPORT: "upstream-report.json",
      },
      gasStationRuntimeReport: blockedGasStationRuntime(),
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
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-execute-prereq-"));
  try {
    await writePolicy(cwd);
    const report = await checkSponsoredExecutePrerequisites({
      cwd,
      env: {
        ...completeEnv(),
        GASKIT_TESTNET_UPSTREAM_REPORT: "upstream-report.json",
      },
      gasStationRuntimeReport: readyGasStationRuntime(),
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
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-execute-prereq-"));
  try {
    await writePolicy(cwd);
    const report = await checkSponsoredExecutePrerequisites({
      cwd,
      env: {
        ...completeEnv(),
        GASKIT_TESTNET_UPSTREAM_REPORT: "upstream-report.json",
      },
      gasStationRuntimeReport: readyGasStationRuntime(),
      testnetUpstreamReport: validUpstreamReport(),
    });

    assert.equal(report.ready, true);
    assert.deepEqual(report.checks.map((check) => [check.id, check.ok]), [
      ["testnet-readiness", true],
      ["gas-station-runtime", true],
      ["testnet-upstream", true],
    ]);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("sponsored testnet execute prerequisites accept explicit managed upstream runtime only with upstream proof", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-execute-prereq-"));
  try {
    await writePolicy(cwd);
    const report = await checkSponsoredExecutePrerequisites({
      cwd,
      env: {
        ...completeEnv(),
        GASKIT_GAS_STATION_RUNTIME_MODE: "managed-upstream",
        GAS_STATION_URL: "https://gas-station.testnet.example",
        GASKIT_TESTNET_UPSTREAM_REPORT: "upstream-report.json",
      },
      gasStationRuntimeRunner: async () => {
        throw new Error("managed-upstream prerequisite check must not inspect Docker");
      },
      testnetUpstreamReport: validUpstreamReport(),
    });

    assert.equal(report.ready, true);
    assert.equal(findCheck(report, "gas-station-runtime").code, "GAS_STATION_RUNTIME_READY");
    assert.equal(findCheck(report, "testnet-upstream").ok, true);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

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
    DATABASE_URL: "file:./data/gaskit.sqlite3",
    GASKIT_GATEWAY_HOST: "127.0.0.1",
    GASKIT_GATEWAY_PORT: "8787",
    GASKIT_POLICY_PATH: "policy.yaml",
    GASKIT_DEMO_APP_KEY: "demo-app-key-for-testnet",
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

function validUpstreamReport() {
  return {
    schemaVersion: 1 as const,
    kind: "agentic-gaskit.testnet-upstream-diagnostic" as const,
    observedAt: new Date().toISOString(),
    gasStationRoot: { configured: true, ok: true, status: 200 },
    gasStationV1Health: { configured: true, ok: false, status: 404 },
    iotaRpc: { configured: true, ok: true, status: 200 },
    reserveGas: { skipped: false, ok: true, status: 200 },
    ok: true,
  };
}
