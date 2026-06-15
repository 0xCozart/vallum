import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyReserveGasResult,
  fetchStatus,
  formatHttpCheckLog,
} from "./diagnose-gas-station-upstream.js";
import {
  classifyGasStationReachability,
  validateTestnetUpstreamReport,
} from "./testnet-upstream-report.js";

test("gas station diagnostic HTTP logs omit raw response bodies", () => {
  const rawBody = "upstream body with bearer-looking secret and reserve internals";
  const line = formatHttpCheckLog({
    ok: false,
    name: "Gas Station reserve_gas compatibility probe",
    status: 500,
  });

  assert.equal(line, "fail: Gas Station reserve_gas compatibility probe HTTP 500");
  assert.doesNotMatch(line, /bearer|secret|reserve internals|upstream body/i);
  assert.doesNotMatch(line, new RegExp(rawBody));
});

test("gas station optional wrapper health logs as informational when absent", () => {
  const line = formatHttpCheckLog({
    ok: false,
    name: "Gas Station /v1/health",
    optional: true,
    optionalReason: "optional wrapper health endpoint",
    status: 404,
  });

  assert.equal(line, "info: Gas Station /v1/health HTTP 404 (optional wrapper health endpoint)");
  assert.doesNotMatch(line, /bearer|secret|token|private|raw/i);
});

test("gas station reachability classification accepts raw upstream root health", () => {
  assert.deepEqual(
    classifyGasStationReachability({
      root: { configured: true, ok: true, status: 200 },
      v1Health: { configured: true, ok: false, status: 404 },
    }),
    {
      ok: true,
      code: "GAS_STATION_ROOT_READY",
      message: "Gas Station root endpoint is reachable; wrapper /v1/health may be absent on raw upstream containers.",
    },
  );
  assert.deepEqual(
    classifyGasStationReachability({
      root: { configured: true, ok: false },
      v1Health: { configured: true, ok: true, status: 200 },
    }),
    {
      ok: true,
      code: "GAS_STATION_V1_HEALTH_READY",
      message: "Gas Station wrapper health endpoint is reachable.",
    },
  );
});

test("gas station diagnostic status fetch consumes but does not return response bodies", async () => {
  const originalFetch = globalThis.fetch;
  const rawBody = JSON.stringify({
    result: null,
    error: "Unable to reserve gas coins for the given budget.",
    diagnosticMarker: "pretend-sensitive-upstream-body",
  });
  try {
    globalThis.fetch = (async () => new Response(rawBody, { status: 500 })) as typeof fetch;

    const result = await fetchStatus("https://gas-station.testnet.example/v1/reserve_gas");

    assert.deepEqual(result, { ok: false, status: 500 });
    assert.equal("body" in result, false);
    assert.notEqual(JSON.stringify(result), rawBody);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reserve gas classification uses bounded sponsor funding blocker codes", () => {
  assert.deepEqual(
    classifyReserveGasResult({
      bearerTokenConfigured: true,
      ok: false,
      skipped: false,
      sponsorFundingCode: "SPONSOR_FUNDING_TOTAL_INSUFFICIENT",
      status: 500,
    }),
    {
      code: "RESERVE_GAS_SPONSOR_FUNDING_BLOCKED",
      message: "reserve_gas compatibility probe failed while the sponsor funding report is not ready.",
    },
  );
  assert.deepEqual(
    classifyReserveGasResult({
      bearerTokenConfigured: false,
      ok: false,
      skipped: false,
      status: 401,
    }),
    {
      code: "RESERVE_GAS_AUTH_MISSING",
      message: "reserve_gas compatibility probe failed while no bearer token was configured.",
    },
  );
  assert.deepEqual(
    classifyReserveGasResult({
      bearerTokenConfigured: true,
      ok: true,
      skipped: false,
      status: 200,
    }),
    {
      code: "RESERVE_GAS_READY",
      message: "reserve_gas compatibility probe passed.",
    },
  );
});

test("testnet upstream validation surfaces sanitized reserve failure messages", () => {
  const validation = validateTestnetUpstreamReport({
    schemaVersion: 1,
    kind: "agentrail.testnet-upstream-diagnostic",
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
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.code, "TESTNET_UPSTREAM_REPORT_FAILED");
  assert.equal(
    validation.message,
    "reserve_gas compatibility probe failed while the sponsor funding report is not ready.",
  );
  assert.doesNotMatch(validation.message, /bearer|token|private|mnemonic|0x[a-f0-9]{64}|raw/i);
});

test("testnet upstream validation accepts root reachability without wrapper health", () => {
  const validation = validateTestnetUpstreamReport({
    schemaVersion: 1,
    kind: "agentrail.testnet-upstream-diagnostic",
    observedAt: new Date().toISOString(),
    gasStationRoot: { configured: true, ok: true, status: 200 },
    gasStationV1Health: { configured: true, ok: false, status: 404 },
    gasStationReachability: {
      ok: true,
      code: "GAS_STATION_ROOT_READY",
      message: "Gas Station root endpoint is reachable; wrapper /v1/health may be absent on raw upstream containers.",
    },
    iotaRpc: { configured: true, ok: true, status: 200 },
    reserveGas: {
      skipped: false,
      ok: true,
      status: 200,
      code: "RESERVE_GAS_READY",
      message: "reserve_gas compatibility probe passed.",
    },
    ok: true,
  });

  assert.equal(validation.ok, true);
  assert.equal(validation.code, "TESTNET_UPSTREAM_REPORT_VALID");
});
