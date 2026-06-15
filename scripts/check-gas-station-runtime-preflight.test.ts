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
    assert.equal(findCheck(report, "runtime-mode").code, "GAS_STATION_LOCAL_DOCKER_MODE_SELECTED");
    assert.equal(findCheck(report, "local-config").code, "GAS_STATION_LOCAL_CONFIG_PRESENT");
    assert.equal(findCheck(report, "docker-daemon").code, "DOCKER_DAEMON_READY");
    assert.equal(findCheck(report, "docker-compose-plugin").code, "DOCKER_COMPOSE_PLUGIN_READY");
    assert.match(formatted, /ready=true/);
    assert.doesNotMatch(formatted, /iotaprivkey|private|secret|bearer|token|mnemonic|config\.local\.yaml/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("Gas Station runtime preflight passes in managed upstream mode without Docker", async () => {
  const report = await checkGasStationRuntimePreflight({
    env: {
      AGENTRAIL_GAS_STATION_RUNTIME_MODE: "managed-upstream",
      GAS_STATION_URL: "https://gas-station.testnet.example",
    },
    runner: async () => {
      throw new Error("managed-upstream mode must not inspect Docker");
    },
  });
  const formatted = formatGasStationRuntimePreflightReport(report);

  assert.equal(report.ready, true);
  assert.equal(report.code, "GAS_STATION_RUNTIME_READY");
  assert.equal(findCheck(report, "runtime-mode").code, "GAS_STATION_MANAGED_UPSTREAM_MODE_SELECTED");
  assert.equal(findCheck(report, "managed-upstream-url").code, "GAS_STATION_MANAGED_UPSTREAM_URL_CONFIGURED");
  assert.doesNotMatch(formatted, /gas-station\.testnet\.example/);
  assert.doesNotMatch(formatted, /docker info|config\.local\.yaml/i);
});

test("Gas Station runtime preflight blocks invalid managed upstream config", async () => {
  const missingUrl = await checkGasStationRuntimePreflight({
    env: { AGENTRAIL_GAS_STATION_RUNTIME_MODE: "managed-upstream" },
  });
  const invalidMode = await checkGasStationRuntimePreflight({
    env: {
      AGENTRAIL_GAS_STATION_RUNTIME_MODE: "managed",
      GAS_STATION_URL: "https://gas-station.testnet.example",
    },
  });

  assert.equal(missingUrl.ready, false);
  assert.equal(missingUrl.code, "GAS_STATION_MANAGED_UPSTREAM_CONFIG_MISSING");
  assert.equal(findCheck(missingUrl, "managed-upstream-url").code, "GAS_STATION_URL_MISSING");
  assert.equal(invalidMode.ready, false);
  assert.equal(invalidMode.code, "GAS_STATION_RUNTIME_MODE_INVALID");
  assert.equal(findCheck(invalidMode, "runtime-mode").code, "GAS_STATION_RUNTIME_MODE_UNSUPPORTED");
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

test("Gas Station runtime preflight blocks when Docker daemon output is empty", async () => {
  const cwd = await writeConfigFixture();
  try {
    const report = await checkGasStationRuntimePreflight({
      cwd,
      runner: async (command, args) => {
        const key = [command, ...args].join(" ");
        if (key === "docker --version") return { ok: true, output: "Docker version 28.3.2" };
        if (key === "docker info --format {{json .ServerVersion}}") return { ok: true, output: "\"\"" };
        if (key === "docker compose version") return { ok: true, output: "Docker Compose version v2" };
        return { ok: false, output: "" };
      },
    });

    assert.equal(report.ready, false);
    assert.equal(report.code, "GAS_STATION_DOCKER_DAEMON_UNAVAILABLE");
    assert.equal(findCheck(report, "docker-daemon").status, "blocked");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("Gas Station runtime preflight passes through direct Docker fallback when Compose is unavailable", async () => {
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

    assert.equal(report.ready, true);
    assert.equal(report.code, "GAS_STATION_RUNTIME_READY");
    assert.equal(findCheck(report, "docker-compose-plugin").status, "blocked");
    assert.equal(findCheck(report, "docker-compose-standalone").status, "blocked");
    assert.equal(findCheck(report, "docker-direct-runtime").code, "DOCKER_DIRECT_RUNTIME_READY");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("Gas Station runtime preflight blocks on missing Compose when direct Docker fallback is disabled", async () => {
  const cwd = await writeConfigFixture();
  try {
    const report = await checkGasStationRuntimePreflight({
      cwd,
      directDockerFallback: false,
      runner: runnerFixture({
        "docker --version": true,
        "docker info --format {{json .ServerVersion}}": true,
        "docker compose version": false,
        "docker-compose version": false,
      }),
    });

    assert.equal(report.ready, false);
    assert.equal(report.code, "GAS_STATION_DOCKER_COMPOSE_MISSING");
    assert.equal(findCheck(report, "docker-direct-runtime").status, "blocked");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("Gas Station runtime preflight blocks when rendered local config is missing", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentrail-gas-runtime-"));
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
  const cwd = await mkdtemp(join(tmpdir(), "agentrail-gas-runtime-"));
  const file = join(cwd, configPath);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, "signer:\n  local:\n    key: hidden-local-fixture\n");
  return cwd;
}

function runnerFixture(results: Record<string, boolean>): GasStationRuntimeCommandRunner {
  return async (command, args) => {
    const key = [command, ...args].join(" ");
    const ok = results[key] ?? false;
    return {
      ok,
      output: ok && key === "docker info --format {{json .ServerVersion}}" ? "\"28.3.2\"" : "",
    };
  };
}

function findCheck(
  report: Awaited<ReturnType<typeof checkGasStationRuntimePreflight>>,
  id: string,
) {
  const check = report.checks.find((candidate) => candidate.id === id);
  assert.ok(check, `expected ${id} check`);
  return check;
}
