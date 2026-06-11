import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGasStationDockerDirectPlan,
  formatGasStationDockerDirectPlan,
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

  assert.deepEqual(labels, [
    "create-network",
    "remove-existing-redis",
    "remove-existing-gas-station",
    "start-redis",
    "start-gas-station",
  ]);
  assert.equal(plan.networkName, "gaskit-local");
  assert.equal(plan.redisContainer, "gaskit-redis");
  assert.equal(plan.gasStationContainer, "gaskit-gas-station");
});
