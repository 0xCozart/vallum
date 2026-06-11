import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  checkGasStationRuntimePreflight,
  formatGasStationRuntimePreflightReport,
  type GasStationRuntimeCommandRunner,
} from "./check-gas-station-runtime-preflight.js";

const configPath = "deploy/gas-station/config.local.yaml";

test("Gas Station runtime preflight passes when config Docker daemon and Compose are available", async () => {
  const cwd = await writeConfigFixture();
  try {
    const report = await checkGasStationRuntimePreflight({
      cwd,
      runner: runnerFixture({
        "docker --version": true,
        "docker info --format {{json .ServerVersion}}": true,
        "docker compose version": true,
        "docker-compose version": false,
      }),
    });
    const formatted = formatGasStationRuntimePreflightReport(report);

    assert.equal(report.ready, true);
    assert.equal(report.code, "GAS_STATION_RUNTIME_READY");
    assert.equal(findCheck(report, "local-config").code, "GAS_STATION_LOCAL_CONFIG_PRESENT");
    assert.equal(findCheck(report, "docker-daemon").code, "DOCKER_DAEMON_READY");
    assert.equal(findCheck(report, "docker-compose-plugin").code, "DOCKER_COMPOSE_PLUGIN_READY");
    assert.match(formatted, /ready=true/);
    assert.doesNotMatch(formatted, /iotaprivkey|private|secret|bearer|token|mnemonic|config\.local\.yaml/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("Gas Station runtime preflight blocks when Docker daemon is unavailable", async () => {
  const cwd = await writeConfigFixture();
  try {
    const report = await checkGasStationRuntimePreflight({
      cwd,
      runner: runnerFixture({
        "docker --version": true,
        "docker info --format {{json .ServerVersion}}": false,
        "docker compose version": true,
        "docker-compose version": false,
      }),
    });

    assert.equal(report.ready, false);
    assert.equal(report.code, "GAS_STATION_DOCKER_DAEMON_UNAVAILABLE");
    assert.equal(findCheck(report, "docker-daemon").status, "blocked");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("Gas Station runtime preflight blocks when no Compose command is available", async () => {
  const cwd = await writeConfigFixture();
  try {
    const report = await checkGasStationRuntimePreflight({
      cwd,
      runner: runnerFixture({
        "docker --version": true,
        "docker info --format {{json .ServerVersion}}": true,
        "docker compose version": false,
        "docker-compose version": false,
      }),
    });

    assert.equal(report.ready, false);
    assert.equal(report.code, "GAS_STATION_DOCKER_COMPOSE_MISSING");
    assert.equal(findCheck(report, "docker-compose-plugin").status, "blocked");
    assert.equal(findCheck(report, "docker-compose-standalone").status, "blocked");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("Gas Station runtime preflight blocks when rendered local config is missing", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-gas-runtime-"));
  try {
    const report = await checkGasStationRuntimePreflight({
      cwd,
      runner: runnerFixture({
        "docker --version": true,
        "docker info --format {{json .ServerVersion}}": true,
        "docker compose version": true,
        "docker-compose version": false,
      }),
    });

    assert.equal(report.ready, false);
    assert.equal(report.code, "GAS_STATION_LOCAL_CONFIG_MISSING");
    assert.equal(findCheck(report, "local-config").status, "blocked");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

async function writeConfigFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-gas-runtime-"));
  const file = join(cwd, configPath);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, "signer:\n  local:\n    key: hidden-local-fixture\n");
  return cwd;
}

function runnerFixture(results: Record<string, boolean>): GasStationRuntimeCommandRunner {
  return async (command, args) => ({
    ok: results[[command, ...args].join(" ")] ?? false,
  });
}

function findCheck(
  report: Awaited<ReturnType<typeof checkGasStationRuntimePreflight>>,
  id: string,
) {
  const check = report.checks.find((candidate) => candidate.id === id);
  assert.ok(check, `expected ${id} check`);
  return check;
}
