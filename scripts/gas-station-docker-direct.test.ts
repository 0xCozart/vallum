import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGasStationDockerDirectPlan,
  checkGasStationDockerDirectStatus,
  formatGasStationDockerDirectPlan,
  formatGasStationDockerDirectStatus,
  type DockerInspectRunner,
} from "./gas-station-docker-direct.js";

test("direct Docker Gas Station plan uses loopback ports and sanitized config mount", () => {
  const plan = buildGasStationDockerDirectPlan({
    env: {
      IOTA_GAS_STATION_IMAGE: "iotaledger/gas-station:test",
      GAS_STATION_AUTH: "auth-value-for-test",
    },
  });
  const formatted = formatGasStationDockerDirectPlan(plan);
  const startGasStation = plan.commands.find((command) => command.label === "start-gas-station");

  assert.ok(startGasStation);
  assert.deepEqual(
    startGasStation.args.filter((arg) => arg.startsWith("127.0.0.1:")),
    ["127.0.0.1:9527:9527", "127.0.0.1:9184:9184"],
  );
  assert.ok(startGasStation.args.includes("GAS_STATION_AUTH"));
  assert.match(formatted, /<absolute-config-path>:\/app\/config\.yaml:ro/);
  assert.match(formatted, /GAS_STATION_AUTH=<from-env>/);
  assert.doesNotMatch(formatted, /auth-value-for-test|iotaprivkey|bearer|private|mnemonic/i);
});

test("direct Docker Gas Station plan starts Redis and Gas Station on an isolated network", () => {
  const plan = buildGasStationDockerDirectPlan();
  const labels = plan.commands.map((command) => command.label);
  const startRedis = plan.commands.find((command) => command.label === "start-redis");

  assert.deepEqual(labels, [
    "create-network",
    "remove-existing-redis",
    "remove-existing-gas-station",
    "start-redis",
    "start-gas-station",
  ]);
  assert.equal(plan.networkName, "agentrail-local");
  assert.equal(plan.redisNetworkAlias, "redis");
  assert.equal(plan.redisContainer, "agentrail-redis");
  assert.equal(plan.gasStationContainer, "agentrail-gas-station");
  assert.ok(startRedis);
  assert.match(startRedis.args.join(" "), /--network-alias redis/);
});

test("direct Docker Gas Station status reports running local stack without contacting live services", async () => {
  const report = await checkGasStationDockerDirectStatus({
    runner: inspectRunnerFixture({
      "docker network inspect agentrail-local --format {{.Name}}": { ok: true, output: "agentrail-local\n" },
      "docker inspect agentrail-redis --format {{.State.Status}}": { ok: true, output: "running\n" },
      "docker inspect agentrail-gas-station --format {{.State.Status}}": { ok: true, output: "running\n" },
    }),
  });
  const formatted = formatGasStationDockerDirectStatus(report);

  assert.equal(report.ready, true);
  assert.equal(report.code, "DOCKER_DIRECT_STACK_READY");
  assert.equal(report.startsContainers, false);
  assert.equal(report.contactsLiveServices, false);
  assert.match(formatted, /next=npm run diagnose:gas-station/);
  assert.doesNotMatch(formatted, /bearer|token|private|mnemonic|iotaprivkey/i);
});

test("direct Docker Gas Station status blocks missing or stopped local containers without leaking output", async () => {
  const report = await checkGasStationDockerDirectStatus({
    runner: inspectRunnerFixture({
      "docker network inspect agentrail-local --format {{.Name}}": { ok: true, output: "agentrail-local\n" },
      "docker inspect agentrail-redis --format {{.State.Status}}": { ok: true, output: "exited\nsecret-looking-token" },
      "docker inspect agentrail-gas-station --format {{.State.Status}}": { ok: false, output: "raw docker error with bearer token" },
    }),
  });
  const formatted = formatGasStationDockerDirectStatus(report);

  assert.equal(report.ready, false);
  assert.equal(report.code, "DOCKER_DIRECT_STACK_NOT_READY");
  assert.equal(report.startsContainers, false);
  assert.equal(report.contactsLiveServices, false);
  assert.match(formatted, /DOCKER_DIRECT_CONTAINER_NOT_RUNNING/);
  assert.doesNotMatch(formatted, /secret-looking-token|raw docker error|bearer token/i);
});

function inspectRunnerFixture(
  results: Record<string, { ok: boolean; output: string }>,
): DockerInspectRunner {
  return async (command, args) => {
    const key = [command, ...args].join(" ");
    return results[key] ?? { ok: false, output: "" };
  };
}
