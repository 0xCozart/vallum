import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fetchStatus,
  formatHttpCheckLog,
} from "./diagnose-gas-station-upstream.js";

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
