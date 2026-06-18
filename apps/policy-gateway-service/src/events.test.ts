import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { after, test } from "node:test";

import { createVallumClient, VallumPolicyError } from "../../../packages/sdk/src/index.js";
import { createGatewayServer, createLocalTransactionIntentVerifier, type GatewayConfig, type GatewayEvent } from "./server.js";

const demoPolicy = {
  appId: "demo-dapp",
  appStatus: "active" as const,
  dailyBudgetNanos: 10_000_000_000,
  dailyRequestLimit: 100,
  allowedPackages: ["0xDEMO_PACKAGE"],
  allowedFunctions: ["mint_badge"],
  maxRequestsPerWalletPerDay: 25,
  maxGasBudgetPerTx: 50_000_000,
};

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function createMockGasStation() {
  const requests: Array<{ method?: string; url?: string; body: unknown; authorization?: string }> = [];
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    requests.push({ method: request.method, url: request.url, body, authorization: request.headers.authorization });

    if (request.url === "/v1/reserve_gas") {
      json(response, 200, {
        result: {
          reservation_id: "reservation-1",
          sponsor_address: "0xSPONSOR",
          gas_coins: [{ objectId: "0xGAS" }],
        },
      });
      return;
    }

    if (request.url === "/v1/execute_tx") {
      json(response, 200, { effects: { transactionDigest: "digest-1" } });
      return;
    }

    json(response, 404, { error: "not found" });
  });

  return { server, requests };
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

async function startGateway(configOverrides: Partial<GatewayConfig> = {}) {
  const upstream = createMockGasStation();
  const upstreamBaseUrl = await listen(upstream.server);
  const events: GatewayEvent[] = [];
  const gateway = createGatewayServer({
    apps: {
      "demo-dapp": {
        apiKey: "local-dev-demo-key",
        policy: demoPolicy,
      },
    },
    upstreamBaseUrl,
    upstreamBearerToken: "upstream-local-token",
    transactionIntentVerifier: createLocalTransactionIntentVerifier(),
    eventSink: (event) => {
      events.push(event);
    },
    ...configOverrides,
  });
  const gatewayBaseUrl = await listen(gateway);

  return {
    events,
    gateway,
    gatewayBaseUrl,
    upstream,
    async close() {
      await Promise.all([
        new Promise<void>((resolve, reject) => gateway.close((error) => (error ? reject(error) : resolve()))),
        new Promise<void>((resolve, reject) => upstream.server.close((error) => (error ? reject(error) : resolve()))),
      ]);
    },
  };
}

function eventText(events: GatewayEvent[]): string {
  return JSON.stringify(events);
}

test("gateway emits sanitized structured events for reserve and execute success", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());
  const client = createVallumClient({ baseUrl: fixture.gatewayBaseUrl, apiKey: "local-dev-demo-key" });

  const reserve = await client.reserveGas({
    gasBudget: 1,
    walletAddress: "0xWALLET",
    packageId: "0xDEMO_PACKAGE",
    functionName: "mint_badge",
  });
  await client.executeSponsoredTransaction({
    reservationId: reserve.reservationId,
    agentRailTransactionId: reserve.agentRailTransactionId,
    transactionBytes: "SENSITIVE_TX_BYTES",
    userSignature: "SENSITIVE_USER_SIGNATURE",
  });

  assert.deepEqual(
    fixture.events.map((event) => [event.operation, event.outcome, event.httpStatus]),
    [
      ["reserve", "allowed", 200],
      ["execute", "allowed", 200],
    ],
  );
  assert.equal(fixture.events[0]?.appId, "demo-dapp");
  assert.equal(fixture.events[0]?.walletAddress, "0xWALLET");
  assert.equal(fixture.events[0]?.packageId, "0xDEMO_PACKAGE");
  assert.equal(fixture.events[0]?.functionName, "mint_badge");
  assert.equal(fixture.events[0]?.gasBudget, 1);
  assert.match(fixture.events[0]?.agentRailTransactionId ?? "", /^vallum_/);
  assert.equal(fixture.events[1]?.agentRailTransactionId, reserve.agentRailTransactionId);
  assert.equal(fixture.events[1]?.upstreamReservationId, reserve.reservationId);

  const serialized = eventText(fixture.events);
  assert.equal(serialized.includes("local-dev-demo-key"), false);
  assert.equal(serialized.includes("upstream-local-token"), false);
  assert.equal(serialized.includes("SENSITIVE_TX_BYTES"), false);
  assert.equal(serialized.includes("SENSITIVE_USER_SIGNATURE"), false);
});

test("gateway emits sanitized rejection events before upstream calls", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());
  const client = createVallumClient({ baseUrl: fixture.gatewayBaseUrl, apiKey: "local-dev-demo-key" });

  await assert.rejects(
    () =>
      client.reserveGas({
        gasBudget: 1,
        walletAddress: "0xWALLET",
        packageId: "0xNOT_ALLOWED",
        functionName: "mint_badge",
      }),
    (error) => error instanceof VallumPolicyError && error.reasonCode === "PACKAGE_NOT_ALLOWED",
  );

  assert.equal(fixture.upstream.requests.length, 0);
  assert.equal(fixture.events.length, 1);
  assert.equal(fixture.events[0]?.operation, "reserve");
  assert.equal(fixture.events[0]?.outcome, "rejected");
  assert.equal(fixture.events[0]?.httpStatus, 400);
  assert.equal(fixture.events[0]?.reasonCode, "PACKAGE_NOT_ALLOWED");
  assert.equal(fixture.events[0]?.appId, "demo-dapp");

  const serialized = eventText(fixture.events);
  assert.equal(serialized.includes("local-dev-demo-key"), false);
  assert.equal(serialized.includes("upstream-local-token"), false);
});

test("gateway emits upstream failure events without consuming quota details or request bodies", async () => {
  const fixture = await startGateway({
    upstreamBaseUrl: "http://local-upstream.test",
    fetchImpl: async () => new Response("raw upstream body must not be logged", { status: 503 }),
  });
  after(() => fixture.close());

  const response = await fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({
      gas_budget: 1,
      wallet_address: "0xWALLET",
      package_id: "0xDEMO_PACKAGE",
      function_name: "mint_badge",
      extra_secret_like_field: "SENSITIVE_EXTRA_FIELD",
    }),
  });
  await response.json();

  assert.equal(response.status, 502);
  assert.equal(fixture.events.length, 1);
  assert.equal(fixture.events[0]?.operation, "reserve");
  assert.equal(fixture.events[0]?.outcome, "upstream_failed");
  assert.equal(fixture.events[0]?.httpStatus, 502);
  assert.equal(fixture.events[0]?.upstreamStatus, 503);
  assert.equal(fixture.events[0]?.reasonCode, "GAS_STATION_UNAVAILABLE");

  const serialized = eventText(fixture.events);
  assert.equal(serialized.includes("raw upstream body"), false);
  assert.equal(serialized.includes("SENSITIVE_EXTRA_FIELD"), false);
});

test("gateway event sink failures do not affect request handling", async () => {
  let eventAttempts = 0;
  const fixture = await startGateway({
    eventSink: () => {
      eventAttempts += 1;
      throw new Error("sink unavailable");
    },
  });
  after(() => fixture.close());
  const client = createVallumClient({ baseUrl: fixture.gatewayBaseUrl, apiKey: "local-dev-demo-key" });

  const reserve = await client.reserveGas({
    gasBudget: 1,
    walletAddress: "0xWALLET",
    packageId: "0xDEMO_PACKAGE",
    functionName: "mint_badge",
  });

  assert.equal(reserve.reservationId, "reservation-1");
  assert.equal(eventAttempts, 1);
});

test("gateway event sink rejections do not create unhandled rejections", async () => {
  let eventAttempts = 0;
  let unhandledRejection: unknown;
  const onUnhandledRejection = (reason: unknown) => {
    unhandledRejection = reason;
  };
  process.once("unhandledRejection", onUnhandledRejection);

  const fixture = await startGateway({
    eventSink: async () => {
      eventAttempts += 1;
      throw new Error("async sink unavailable");
    },
  });
  after(() => fixture.close());

  try {
    const client = createVallumClient({ baseUrl: fixture.gatewayBaseUrl, apiKey: "local-dev-demo-key" });
    const reserve = await client.reserveGas({
      gasBudget: 1,
      walletAddress: "0xWALLET",
      packageId: "0xDEMO_PACKAGE",
      functionName: "mint_badge",
    });
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(reserve.reservationId, "reservation-1");
    assert.equal(eventAttempts, 1);
    assert.equal(unhandledRejection, undefined);
  } finally {
    process.removeListener("unhandledRejection", onUnhandledRejection);
  }
});

test("gateway omits unverified execute ids from rejection events", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());

  const conflict = await fetch(`${fixture.gatewayBaseUrl}/v1/execute_tx`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({
      _saas_tx_id: "SENSITIVE_TX_BYTES\nlegacy",
      agentRailTransactionId: "SENSITIVE_USER_SIGNATURE-public",
      reservation_id: "SENSITIVE_RESERVATION_ID",
    }),
  });
  await conflict.json();

  const unknown = await fetch(`${fixture.gatewayBaseUrl}/v1/execute_tx`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({
      agentRailTransactionId: "SENSITIVE_TX_BYTES",
      reservation_id: "SENSITIVE_USER_SIGNATURE",
    }),
  });
  await unknown.json();

  assert.equal(conflict.status, 409);
  assert.equal(unknown.status, 409);
  assert.deepEqual(
    fixture.events.map((event) => ({
      operation: event.operation,
      outcome: event.outcome,
      httpStatus: event.httpStatus,
      appId: event.appId,
      agentRailTransactionId: event.agentRailTransactionId,
      upstreamReservationId: event.upstreamReservationId,
      reasonCode: event.reasonCode,
    })),
    [
      {
        operation: "execute",
        outcome: "rejected",
        httpStatus: 409,
        appId: "demo-dapp",
        agentRailTransactionId: undefined,
        upstreamReservationId: undefined,
        reasonCode: "EXECUTION_FAILED",
      },
      {
        operation: "execute",
        outcome: "rejected",
        httpStatus: 409,
        appId: "demo-dapp",
        agentRailTransactionId: undefined,
        upstreamReservationId: undefined,
        reasonCode: "EXECUTION_FAILED",
      },
    ],
  );
  const serialized = eventText(fixture.events);
  assert.equal(serialized.includes("SENSITIVE_TX_BYTES"), false);
  assert.equal(serialized.includes("SENSITIVE_USER_SIGNATURE"), false);
  assert.equal(serialized.includes("SENSITIVE_RESERVATION_ID"), false);
});

test("gateway sanitizes control characters, C1 controls, and long event metadata strings", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());
  const client = createVallumClient({ baseUrl: fixture.gatewayBaseUrl, apiKey: "local-dev-demo-key" });
  const walletAddress = `0xWALLET\u0000\u001f\u007f\u0085${"x".repeat(300)}`;

  await client.reserveGas({ gasBudget: 1, walletAddress, packageId: "0xDEMO_PACKAGE", functionName: "mint_badge" });

  assert.equal(fixture.events[0]?.walletAddress?.length, 256);
  assert.equal(fixture.events[0]?.walletAddress?.includes("\u0000"), false);
  assert.equal(fixture.events[0]?.walletAddress?.includes("\u001f"), false);
  assert.equal(fixture.events[0]?.walletAddress?.includes("\u007f"), false);
  assert.equal(fixture.events[0]?.walletAddress?.includes("\u0085"), false);
});

test("gateway omits undefined optional event fields", async () => {
  const fixture = await startGateway({
    apps: {
      "demo-dapp": {
        apiKey: "local-dev-demo-key",
        policy: { ...demoPolicy, deniedWallets: [], maxRequestsPerWalletPerDay: undefined },
      },
    },
  });
  after(() => fixture.close());
  const client = createVallumClient({ baseUrl: fixture.gatewayBaseUrl, apiKey: "local-dev-demo-key" });

  await client.reserveGas({ gasBudget: 1, packageId: "0xDEMO_PACKAGE", functionName: "mint_badge" });

  assert.equal(Object.prototype.hasOwnProperty.call(fixture.events[0] ?? {}, "walletAddress"), false);
});
