import assert from "node:assert/strict";
import test from "node:test";

import type { GatewayEvent } from "./server.js";
import { createGatewayUsageReadModel } from "./usage.js";

function event(overrides: Partial<GatewayEvent>): GatewayEvent {
  return {
    id: overrides.id ?? "event-1",
    timestamp: overrides.timestamp ?? "2026-04-24T20:42:32.000Z",
    operation: overrides.operation ?? "reserve",
    outcome: overrides.outcome ?? "allowed",
    httpStatus: overrides.httpStatus ?? 200,
    ...overrides,
  };
}

test("usage read model aggregates gateway events by operation, outcome, app, wallet, and reason", () => {
  const usage = createGatewayUsageReadModel();

  usage.record(
    event({
      id: "reserve-allowed",
      operation: "reserve",
      outcome: "allowed",
      appId: "demo-dapp",
      walletAddress: "0xUSER",
      packageId: "0xPACKAGE",
      functionName: "mint_badge",
      gasBudget: 50_000_000,
    }),
  );
  usage.record(
    event({
      id: "execute-allowed",
      operation: "execute",
      outcome: "allowed",
      appId: "demo-dapp",
      walletAddress: "0xUSER",
      gasKitTransactionId: "gaskit-1",
      upstreamReservationId: "reservation-1",
    }),
  );
  usage.record(
    event({
      id: "reserve-rejected",
      operation: "reserve",
      outcome: "rejected",
      httpStatus: 400,
      appId: "demo-dapp",
      walletAddress: "0xUSER",
      reasonCode: "PACKAGE_NOT_ALLOWED",
    }),
  );
  usage.record(
    event({
      id: "reserve-upstream-failed",
      operation: "reserve",
      outcome: "upstream_failed",
      httpStatus: 502,
      appId: "demo-dapp",
      walletAddress: "0xUSER",
      reasonCode: "GAS_STATION_UNAVAILABLE",
      upstreamStatus: 503,
    }),
  );

  const snapshot = usage.snapshot();

  assert.deepEqual(snapshot.totals.byOperation, { reserve: 3, execute: 1 });
  assert.deepEqual(snapshot.totals.byOutcome, { allowed: 2, rejected: 1, upstream_failed: 1 });
  assert.deepEqual(snapshot.totals.byReasonCode, {
    GAS_STATION_UNAVAILABLE: 1,
    PACKAGE_NOT_ALLOWED: 1,
    unknown: 2,
  });
  assert.equal(snapshot.totals.events, 4);
  assert.equal(snapshot.totals.gasBudgetReserved, 50_000_000);
  assert.equal(snapshot.byAppId["demo-dapp"]?.events, 4);
  assert.equal(snapshot.byAppId["demo-dapp"]?.gasBudgetReserved, 50_000_000);
  assert.equal(snapshot.byWalletAddress["0xUSER"]?.events, 4);
});

test("usage read model groups missing metadata and bounds recent events", () => {
  const usage = createGatewayUsageReadModel({ maxRecentEvents: 2 });

  usage.record(event({ id: "one", operation: "reserve", outcome: "rejected", httpStatus: 401, reasonCode: "AUTH_MISSING" }));
  usage.record(event({ id: "two", operation: "reserve", outcome: "rejected", httpStatus: 403, reasonCode: "AUTH_INVALID" }));
  usage.record(event({ id: "three", operation: "execute", outcome: "rejected", httpStatus: 400, reasonCode: "EXECUTION_FAILED" }));

  const snapshot = usage.snapshot();

  assert.equal(snapshot.byAppId.unknown?.events, 3);
  assert.equal(snapshot.byWalletAddress.unknown?.events, 3);
  assert.deepEqual(
    snapshot.recentEvents.map((recentEvent) => recentEvent.id),
    ["two", "three"],
  );
});

test("usage read model stores only allowlisted event fields", () => {
  const usage = createGatewayUsageReadModel();
  const secretBearingEvent = {
    ...event({
      id: "secret-bearing-event",
      operation: "execute",
      outcome: "allowed",
      appId: "demo-dapp",
      walletAddress: "0xUSER",
      gasKitTransactionId: "gaskit-1",
      upstreamReservationId: "reservation-1",
    }),
    apiKey: "local-dev-demo-key",
    bearerToken: "local-smoke-token",
    transactionBytes: "AAE=",
    userSignature: "smoke-signature",
    raw: { upstream: "raw-upstream-body" },
  } as GatewayEvent & Record<string, unknown>;

  usage.record(secretBearingEvent);

  const snapshotOutput = JSON.stringify(usage.snapshot());
  assert.equal(snapshotOutput.includes("secret-bearing-event"), true);
  assert.equal(snapshotOutput.includes("gaskit-1"), true);
  assert.equal(snapshotOutput.includes("local-dev-demo-key"), false);
  assert.equal(snapshotOutput.includes("local-smoke-token"), false);
  assert.equal(snapshotOutput.includes("AAE="), false);
  assert.equal(snapshotOutput.includes("smoke-signature"), false);
  assert.equal(snapshotOutput.includes("raw-upstream-body"), false);
});

test("usage read model counts missing reasons under unknown", () => {
  const usage = createGatewayUsageReadModel();

  usage.record(event({ id: "allowed-reserve", operation: "reserve", outcome: "allowed" }));
  usage.record(event({ id: "allowed-execute", operation: "execute", outcome: "allowed" }));
  usage.record(event({ id: "rejected", operation: "reserve", outcome: "rejected", reasonCode: "AUTH_MISSING" }));

  assert.deepEqual(usage.snapshot().totals.byReasonCode, {
    AUTH_MISSING: 1,
    unknown: 2,
  });
});

test("usage read model allows disabling recent event retention", () => {
  const usage = createGatewayUsageReadModel({ maxRecentEvents: 0 });

  usage.record(event({ id: "one", operation: "reserve", outcome: "allowed", gasBudget: 1 }));
  usage.record(event({ id: "two", operation: "execute", outcome: "allowed" }));

  const snapshot = usage.snapshot();
  assert.equal(snapshot.totals.events, 2);
  assert.equal(snapshot.totals.gasBudgetReserved, 1);
  assert.deepEqual(snapshot.recentEvents, []);
});

test("usage read model keeps literal unknown metadata separate from missing metadata", () => {
  const usage = createGatewayUsageReadModel();

  usage.record(event({ id: "missing-metadata" }));
  usage.record(event({ id: "literal-unknown-metadata", appId: "unknown", walletAddress: "unknown" }));

  const snapshot = usage.snapshot();
  assert.equal(snapshot.byAppId.unknown?.events, 1);
  assert.equal(snapshot.byAppId["literal:unknown"]?.events, 1);
  assert.equal(snapshot.byWalletAddress.unknown?.events, 1);
  assert.equal(snapshot.byWalletAddress["literal:unknown"]?.events, 1);
});

test("usage read model safely counts prototype-like reason codes", () => {
  const usage = createGatewayUsageReadModel();

  usage.record(event({ id: "prototype-reason", reasonCode: "__proto__" as GatewayEvent["reasonCode"] }));

  assert.equal(usage.snapshot().totals.byReasonCode.__proto__, 1);
  assert.equal(JSON.stringify(usage.snapshot()).includes("__proto__"), true);
});
