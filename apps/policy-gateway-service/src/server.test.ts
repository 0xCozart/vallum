import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { after, before, test } from "node:test";

import { createAgentRailClient, AgentRailAuthError, AgentRailError, AgentRailPolicyError } from "@agentrail/sdk";
import { createGatewayServer, type GatewayConfig } from "./server.js";

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

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function createMockGasStation(options: { reservationId?: string | number } = {}) {
  const requests: Array<{ method?: string; url?: string; body: unknown; authorization?: string }> = [];
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    requests.push({
      method: request.method,
      url: request.url,
      body,
      authorization: request.headers.authorization,
    });

    if (request.url === "/v1/reserve_gas") {
      json(response, 200, {
        result: {
          reservation_id: options.reservationId ?? "reservation-1",
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

async function listen(server: ReturnType<typeof createServer>): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

async function startGateway(configOverrides: Partial<GatewayConfig> = {}, upstreamOptions: { reservationId?: string | number } = {}) {
  const upstream = createMockGasStation(upstreamOptions);
  const upstreamBaseUrl = await listen(upstream.server);
  const gateway = createGatewayServer({
    apps: {
      "demo-dapp": {
        apiKey: "local-dev-demo-key",
        policy: demoPolicy,
      },
    },
    upstreamBaseUrl,
    upstreamBearerToken: "upstream-local-token",
    ...configOverrides,
  });
  const gatewayBaseUrl = await listen(gateway);

  return {
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

test("GET /health returns local gateway status without app auth", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());

  const response = await fetch(`${fixture.gatewayBaseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.service, "agentrail-policy-gateway");
  assert.equal(body.upstream.configured, true);
});

test("GET /operator/usage is absent unless operator usage is configured", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());

  const response = await fetch(`${fixture.gatewayBaseUrl}/operator/usage`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error, "NotFound");
});

test("GET /operator/usage requires a separate bearer token and returns no-store usage", async () => {
  let snapshotsLoaded = 0;
  const fixture = await startGateway({
    operatorUsage: {
      token: "operator-local-token",
      source: "local-test-snapshot",
      async loadSnapshot() {
        snapshotsLoaded += 1;
        return {
          totals: {
            events: 1,
            gasBudgetReserved: 7,
            byOperation: { reserve: 1, execute: 0 },
            byOutcome: { allowed: 1, rejected: 0, upstream_failed: 0 },
            byReasonCode: { unknown: 1 },
          },
          byAppId: {},
          byWalletAddress: {},
          recentEvents: [
            {
              id: "event-1",
              timestamp: "2026-04-27T00:00:00.000Z",
              operation: "reserve",
              outcome: "allowed",
              httpStatus: 200,
              appId: "demo-dapp",
              walletAddress: "0xWALLET",
              packageId: "0xDEMO_PACKAGE",
              functionName: "mint_badge",
              gasBudget: 7,
              agentRailTransactionId: "agentrail_public_id",
              upstreamReservationId: "reservation-1",
            },
          ],
        };
      },
    },
  });
  after(() => fixture.close());

  const missing = await fetch(`${fixture.gatewayBaseUrl}/operator/usage`);
  assert.equal(missing.status, 401);
  assert.equal(await missing.text(), JSON.stringify({ error: "Unauthorized", message: "Operator bearer token is required." }));
  assert.equal(missing.headers.get("cache-control"), "no-store");

  const invalid = await fetch(`${fixture.gatewayBaseUrl}/operator/usage`, {
    headers: { authorization: "Bearer upstream-local-token" },
  });
  const invalidText = await invalid.text();
  assert.equal(invalid.status, 403);
  assert.equal(invalid.headers.get("cache-control"), "no-store");
  assert.equal(invalidText.includes("upstream-local-token"), false);
  assert.equal(invalidText.includes("operator-local-token"), false);
  assert.equal(invalidText.includes("local-dev-demo-key"), false);

  const valid = await fetch(`${fixture.gatewayBaseUrl}/operator/usage`, {
    headers: { authorization: "Bearer operator-local-token" },
  });
  const body = await valid.json();

  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("cache-control"), "no-store");
  assert.equal(body.source, "local-test-snapshot");
  assert.match(body.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(body.usage.totals.events, 1);
  assert.equal(body.usage.recentEvents[0].appId, "demo-dapp");
  assert.equal(JSON.stringify(body).includes("operator-local-token"), false);
  assert.equal(JSON.stringify(body).includes("upstream-local-token"), false);
  assert.equal(JSON.stringify(body).includes("local-dev-demo-key"), false);
  assert.equal(snapshotsLoaded, 1);
});

test("GET /operator/usage hides usage-store load failures", async () => {
  const fixture = await startGateway({
    operatorUsage: {
      token: "operator-local-token",
      source: "local-test-snapshot",
      async loadSnapshot() {
        throw new Error("not-json-with-secret-local-dev-demo-key");
      },
    },
  });
  after(() => fixture.close());

  const response = await fetch(`${fixture.gatewayBaseUrl}/operator/usage`, {
    headers: { authorization: "Bearer operator-local-token" },
  });
  const text = await response.text();

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(text.includes("not-json"), false);
  assert.equal(text.includes("local-dev-demo-key"), false);
  assert.deepEqual(JSON.parse(text), { error: "UsageUnavailable", message: "Operator usage snapshot is unavailable." });
});

test("reserveGas rejects missing app credentials with AUTH_MISSING", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());

  const response = await fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gas_budget: 1, package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" }),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.reasonCode, "AUTH_MISSING");
  assert.equal(fixture.upstream.requests.length, 0);
});

test("reserveGas rejects invalid app credentials with AUTH_INVALID", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());
  const client = createAgentRailClient({ baseUrl: fixture.gatewayBaseUrl, apiKey: "wrong-key" });

  await assert.rejects(
    () =>
      client.reserveGas({
        gasBudget: 1,
        packageId: "0xDEMO_PACKAGE",
        functionName: "mint_badge",
      }),
    (error) => error instanceof AgentRailAuthError && error.status === 403,
  );
  assert.equal(fixture.upstream.requests.length, 0);
});

test("reserveGas rejects non-allowlisted package before upstream proxy", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());
  const client = createAgentRailClient({ baseUrl: fixture.gatewayBaseUrl, apiKey: "local-dev-demo-key" });

  await assert.rejects(
    () =>
      client.reserveGas({
        gasBudget: 1,
        packageId: "0xNOT_ALLOWED",
        functionName: "mint_badge",
      }),
    (error) => error instanceof AgentRailPolicyError && error.reasonCode === "PACKAGE_NOT_ALLOWED",
  );
  assert.equal(fixture.upstream.requests.length, 0);
});

test("reserveGas proxies allowed requests and returns SDK-compatible transaction id", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());
  const client = createAgentRailClient({ baseUrl: fixture.gatewayBaseUrl, apiKey: "local-dev-demo-key" });

  const result = await client.reserveGas({
    gasBudget: 1,
    reserveDurationSecs: 60,
    walletAddress: "0xWALLET",
    packageId: "0xDEMO_PACKAGE",
    functionName: "mint_badge",
  });

  assert.equal(result.reservationId, "reservation-1");
  assert.match(result.agentRailTransactionId, /^agentrail_/);
  assert.equal(result.sponsorAddress, "0xSPONSOR");
  assert.equal(fixture.upstream.requests.length, 1);
  assert.equal(fixture.upstream.requests[0]?.url, "/v1/reserve_gas");
  assert.equal(fixture.upstream.requests[0]?.authorization, "Bearer upstream-local-token");
});

test("reserveGas response exposes only the public AgentRail transaction id field", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());

  const response = await fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({ gas_budget: 1, package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(body.agentRailTransactionId, /^agentrail_/);
  assert.equal(Object.hasOwn(body, "_saas_tx_id"), false);
});

test("reserveGas coerces numeric upstream reservation ids for official Gas Station compatibility", async () => {
  const fixture = await startGateway({}, { reservationId: 1 });
  after(() => fixture.close());
  const client = createAgentRailClient({ baseUrl: fixture.gatewayBaseUrl, apiKey: "local-dev-demo-key" });

  const result = await client.reserveGas({
    gasBudget: 1,
    reserveDurationSecs: 60,
    walletAddress: "0xWALLET",
    packageId: "0xDEMO_PACKAGE",
    functionName: "mint_badge",
  });

  assert.equal(result.reservationId, "1");
  assert.match(result.agentRailTransactionId, /^agentrail_/);
});

test("executeSponsoredTransaction sends numeric official reservation ids back upstream as numbers", async () => {
  const fixture = await startGateway({}, { reservationId: 2 });
  after(() => fixture.close());
  const client = createAgentRailClient({ baseUrl: fixture.gatewayBaseUrl, apiKey: "local-dev-demo-key" });

  const reserve = await client.reserveGas({ gasBudget: 1, packageId: "0xDEMO_PACKAGE", functionName: "mint_badge" });
  const execute = await client.executeSponsoredTransaction({
    reservationId: reserve.reservationId,
    agentRailTransactionId: reserve.agentRailTransactionId,
    transactionBytes: "AAE=",
    userSignature: "sig",
  });

  assert.equal(execute.digest, "digest-1");
  assert.deepEqual(fixture.upstream.requests[1]?.body, {
    reservation_id: 2,
    tx_bytes: "AAE=",
    user_sig: "sig",
  });
});

test("executeSponsoredTransaction proxies only a known prior reservation", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());
  const client = createAgentRailClient({ baseUrl: fixture.gatewayBaseUrl, apiKey: "local-dev-demo-key" });

  const reserve = await client.reserveGas({
    gasBudget: 1,
    walletAddress: "0xWALLET",
    packageId: "0xDEMO_PACKAGE",
    functionName: "mint_badge",
  });

  const execute = await client.executeSponsoredTransaction({
    reservationId: reserve.reservationId,
    agentRailTransactionId: reserve.agentRailTransactionId,
    transactionBytes: "AAE=",
    userSignature: "sig",
  });

  assert.equal(execute.digest, "digest-1");
  assert.equal(fixture.upstream.requests.length, 2);
  assert.equal(fixture.upstream.requests[1]?.url, "/v1/execute_tx");
  assert.deepEqual(fixture.upstream.requests[1]?.body, {
    reservation_id: "reservation-1",
    tx_bytes: "AAE=",
    user_sig: "sig",
  });
});

test("execute does not re-consume one-use app quotas after a successful reservation", async () => {
  const oneUsePolicy = { ...demoPolicy, dailyRequestLimit: 1, dailyBudgetNanos: 1 };
  const fixture = await startGateway({
    apps: {
      "demo-dapp": {
        apiKey: "local-dev-demo-key",
        policy: oneUsePolicy,
      },
    },
  });
  after(() => fixture.close());
  const client = createAgentRailClient({ baseUrl: fixture.gatewayBaseUrl, apiKey: "local-dev-demo-key" });

  const reserve = await client.reserveGas({
    gasBudget: 1,
    walletAddress: "0xWALLET",
    packageId: "0xDEMO_PACKAGE",
    functionName: "mint_badge",
  });
  const execute = await client.executeSponsoredTransaction({
    reservationId: reserve.reservationId,
    agentRailTransactionId: reserve.agentRailTransactionId,
    transactionBytes: "AAE=",
    userSignature: "sig",
  });

  assert.equal(execute.digest, "digest-1");
});

test("execute accepts the returned agentRailTransactionId alias for non-SDK callers", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());

  const reserveResponse = await fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({ gas_budget: 1, package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" }),
  });
  const reserveBody = await reserveResponse.json();

  const executeResponse = await fetch(`${fixture.gatewayBaseUrl}/v1/execute_tx`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({
      agentRailTransactionId: reserveBody.agentRailTransactionId,
      reservation_id: reserveBody.result.reservation_id,
      tx_bytes: "AAE=",
      user_sig: "sig",
    }),
  });
  const executeBody = await executeResponse.json();

  assert.equal(executeResponse.status, 200);
  assert.equal(executeBody.effects.transactionDigest, "digest-1");
});

test("configured but unreachable upstream returns GAS_STATION_UNAVAILABLE", async () => {
  const fixture = await startGateway({ upstreamBaseUrl: "http://127.0.0.1:9" });
  after(() => fixture.close());

  const response = await fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({ gas_budget: 1, package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" }),
  });
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.reasonCode, "GAS_STATION_UNAVAILABLE");
  assert.equal(fixture.upstream.requests.length, 0);
});

test("malformed JSON returns BadRequest instead of an internal error", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());

  const response = await fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: "{not-json",
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "BadRequest");
  assert.equal(fixture.upstream.requests.length, 0);
});

test("JSON array request bodies return BadRequest instead of proxying malformed shapes", async () => {
  const fixture = await startGateway({
    apps: {
      "demo-dapp": {
        apiKey: "local-dev-demo-key",
        policy: { ...demoPolicy, allowedPackages: [], allowedFunctions: undefined },
      },
    },
  });
  after(() => fixture.close());

  const response = await fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify([]),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "BadRequest");
  assert.equal(fixture.upstream.requests.length, 0);
});

test("reserveGas enforces one-use request limits under concurrent upstream latency", async () => {
  const oneUsePolicy = { ...demoPolicy, dailyRequestLimit: 1 };
  let releaseUpstream: (() => void) | undefined;
  const upstreamGate = new Promise<void>((resolve) => {
    releaseUpstream = resolve;
  });
  let upstreamCalls = 0;
  const fixture = await startGateway({
    apps: {
      "demo-dapp": {
        apiKey: "local-dev-demo-key",
        policy: oneUsePolicy,
      },
    },
    upstreamBaseUrl: "http://local-upstream.test",
    fetchImpl: async () => {
      upstreamCalls += 1;
      await upstreamGate;
      return new Response(
        JSON.stringify({
          result: {
            reservation_id: `reservation-${upstreamCalls}`,
            sponsor_address: "0xSPONSOR",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
  after(() => fixture.close());

  const requestBody = { gas_budget: 1, package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" };
  const first = fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  const second = fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  await new Promise((resolve) => setTimeout(resolve, 50));
  releaseUpstream?.();
  const responses = await Promise.all([first, second]);
  const statuses = responses.map((response) => response.status).sort((a, b) => a - b);
  const bodies = await Promise.all(responses.map((response) => response.json()));

  assert.deepEqual(statuses, [200, 429]);
  assert.equal(bodies.some((body) => body.reasonCode === "APP_DAILY_REQUEST_LIMIT_EXCEEDED"), true);
  assert.equal(upstreamCalls, 1);
});

test("reserveGas normalizes upstream non-JSON failures without consuming quota", async () => {
  let upstreamCalls = 0;
  const fixture = await startGateway({
    apps: {
      "demo-dapp": {
        apiKey: "local-dev-demo-key",
        policy: { ...demoPolicy, dailyRequestLimit: 1 },
      },
    },
    upstreamBaseUrl: "http://local-upstream.test",
    fetchImpl: async () => {
      upstreamCalls += 1;
      if (upstreamCalls === 1) {
        return new Response("upstream exploded", { status: 500, headers: { "content-type": "text/plain" } });
      }
      return new Response(
        JSON.stringify({ result: { reservation_id: "reservation-after-retry", sponsor_address: "0xSPONSOR" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
  after(() => fixture.close());

  const requestBody = { gas_budget: 1, package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" };
  const failed = await fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  const failedBody = await failed.json();

  assert.equal(failed.status, 502);
  assert.equal(failedBody.reasonCode, "GAS_STATION_UNAVAILABLE");

  const retried = await fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  const retriedBody = await retried.json();

  assert.equal(retried.status, 200);
  assert.equal(retriedBody.result.reservation_id, "reservation-after-retry");
  assert.equal(upstreamCalls, 2);
});

test("execute rejects conflicting AgentRail transaction id aliases without touching upstream", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());

  const reserveResponse = await fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({ gas_budget: 1, package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" }),
  });
  const reserveBody = await reserveResponse.json();

  const executeResponse = await fetch(`${fixture.gatewayBaseUrl}/v1/execute_tx`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({
      _saas_tx_id: reserveBody.agentRailTransactionId,
      agentRailTransactionId: "agentrail_conflicting_id",
      reservation_id: reserveBody.result.reservation_id,
      tx_bytes: "AAE=",
      user_sig: "sig",
    }),
  });
  const executeBody = await executeResponse.json();

  assert.equal(executeResponse.status, 409);
  assert.equal(executeBody.reasonCode, "EXECUTION_FAILED");
  assert.equal(fixture.upstream.requests.length, 1);
});

test("execute keeps a reservation retryable after a transient upstream failure", async () => {
  let executeCalls = 0;
  const fixture = await startGateway({
    upstreamBaseUrl: "http://local-upstream.test",
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init?.body?.toString() ?? "{}");
      if (body.tx_bytes) {
        executeCalls += 1;
        if (executeCalls === 1) {
          return new Response(JSON.stringify({ error: "temporary outage" }), {
            status: 502,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ effects: { transactionDigest: "digest-after-retry" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ result: { reservation_id: "reservation-retry", sponsor_address: "0xSPONSOR" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  after(() => fixture.close());
  const client = createAgentRailClient({ baseUrl: fixture.gatewayBaseUrl, apiKey: "local-dev-demo-key" });

  const reserve = await client.reserveGas({ gasBudget: 1, packageId: "0xDEMO_PACKAGE", functionName: "mint_badge" });
  await assert.rejects(
    () =>
      client.executeSponsoredTransaction({
        reservationId: reserve.reservationId,
        agentRailTransactionId: reserve.agentRailTransactionId,
        transactionBytes: "AAE=",
        userSignature: "sig",
      }),
    (error) => error instanceof AgentRailError && error.status === 502,
  );

  const retried = await client.executeSponsoredTransaction({
    reservationId: reserve.reservationId,
    agentRailTransactionId: reserve.agentRailTransactionId,
    transactionBytes: "AAE=",
    userSignature: "sig",
  });

  assert.equal(retried.digest, "digest-after-retry");
  assert.equal(executeCalls, 2);
});

test("policy simulation evaluates policy without proxying upstream or emitting gateway events", async () => {
  const events: unknown[] = [];
  const fixture = await startGateway({
    eventSink: (event) => {
      events.push(event);
    },
  });
  after(() => fixture.close());

  const response = await fetch(`${fixture.gatewayBaseUrl}/v1/policy/simulate`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({ gas_budget: 1, wallet_address: "0xWALLET", package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { allowed: true });
  assert.equal(fixture.upstream.requests.length, 0);
  assert.deepEqual(events, []);
});

test("policy simulation returns rejection decisions as safe response data", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());

  const response = await fetch(`${fixture.gatewayBaseUrl}/v1/policy/simulate`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({ gas_budget: 1, wallet_address: "0xWALLET", package_id: "0xNOT_ALLOWED", function_name: "mint_badge" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.allowed, false);
  assert.equal(body.reasonCode, "PACKAGE_NOT_ALLOWED");
  assert.equal(typeof body.message, "string");
  assert.equal(fixture.upstream.requests.length, 0);
});

test("policy simulation requires valid app credentials and JSON object bodies", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());

  const missingAuth = await fetch(`${fixture.gatewayBaseUrl}/v1/policy/simulate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gas_budget: 1, package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" }),
  });
  const missingAuthBody = await missingAuth.json();
  assert.equal(missingAuth.status, 401);
  assert.equal(missingAuthBody.reasonCode, "AUTH_MISSING");

  const invalidAuth = await fetch(`${fixture.gatewayBaseUrl}/v1/policy/simulate`, {
    method: "POST",
    headers: { authorization: "Bearer wrong-key", "content-type": "application/json" },
    body: JSON.stringify({ gas_budget: 1, package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" }),
  });
  const invalidAuthBody = await invalidAuth.json();
  assert.equal(invalidAuth.status, 403);
  assert.equal(invalidAuthBody.reasonCode, "AUTH_INVALID");

  const arrayBody = await fetch(`${fixture.gatewayBaseUrl}/v1/policy/simulate`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify([]),
  });
  const arrayBodyJson = await arrayBody.json();
  assert.equal(arrayBody.status, 400);
  assert.equal(arrayBodyJson.error, "BadRequest");
  assert.equal(fixture.upstream.requests.length, 0);
});

test("policy simulation rejects malformed policy field shapes before evaluating", async () => {
  const fixture = await startGateway();
  after(() => fixture.close());

  for (const body of [
    { gas_budget: "999999999", wallet_address: "0xWALLET", package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" },
    { gas_budget: -1, wallet_address: "0xWALLET", package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" },
    { gas_budget: 1, wallet_address: 123, package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" },
    { gas_budget: 1, wallet_address: "0xWALLET", package_id: ["0xDEMO_PACKAGE"], function_name: "mint_badge" },
    { gas_budget: 1, wallet_address: "0xWALLET", package_id: "0xDEMO_PACKAGE", function_name: { name: "mint_badge" } },
  ]) {
    const response = await fetch(`${fixture.gatewayBaseUrl}/v1/policy/simulate`, {
      method: "POST",
      headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const responseBody = await response.json();
    assert.equal(response.status, 400);
    assert.equal(responseBody.error, "BadRequest");
  }

  assert.equal(fixture.upstream.requests.length, 0);
});

test("reserve rejects malformed gas budgets before quota mutation or upstream proxy", async () => {
  const fixture = await startGateway({
    apps: {
      "demo-dapp": {
        apiKey: "local-dev-demo-key",
        policy: { ...demoPolicy, dailyBudgetNanos: 1 },
      },
    },
  });
  after(() => fixture.close());

  const invalidReserve = await fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({ gas_budget: -1, wallet_address: "0xWALLET", package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" }),
  });
  const invalidReserveBody = await invalidReserve.json();
  assert.equal(invalidReserve.status, 400);
  assert.equal(invalidReserveBody.error, "BadRequest");
  assert.equal(fixture.upstream.requests.length, 0);

  const validReserve = await fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({ gas_budget: 1, wallet_address: "0xWALLET", package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" }),
  });
  const validReserveBody = await validReserve.json();
  assert.equal(validReserve.status, 200);
  assert.equal(validReserveBody.result.reservation_id, "reservation-1");
  assert.equal(fixture.upstream.requests.length, 1);
});

test("policy simulation reads current quota counters without mutating them", async () => {
  const oneUsePolicy = { ...demoPolicy, dailyRequestLimit: 1 };
  const fixture = await startGateway({
    apps: {
      "demo-dapp": {
        apiKey: "local-dev-demo-key",
        policy: oneUsePolicy,
      },
    },
  });
  after(() => fixture.close());

  const simulateBeforeReserve = await fetch(`${fixture.gatewayBaseUrl}/v1/policy/simulate`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({ gas_budget: 1, wallet_address: "0xWALLET", package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" }),
  });
  assert.deepEqual(await simulateBeforeReserve.json(), { allowed: true });

  const reserve = await fetch(`${fixture.gatewayBaseUrl}/v1/reserve_gas`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({ gas_budget: 1, wallet_address: "0xWALLET", package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" }),
  });
  assert.equal(reserve.status, 200);

  const simulateAfterReserve = await fetch(`${fixture.gatewayBaseUrl}/v1/policy/simulate`, {
    method: "POST",
    headers: { authorization: "Bearer local-dev-demo-key", "content-type": "application/json" },
    body: JSON.stringify({ gas_budget: 1, wallet_address: "0xWALLET", package_id: "0xDEMO_PACKAGE", function_name: "mint_badge" }),
  });
  const simulateAfterReserveBody = await simulateAfterReserve.json();
  assert.equal(simulateAfterReserve.status, 200);
  assert.equal(simulateAfterReserveBody.allowed, false);
  assert.equal(simulateAfterReserveBody.reasonCode, "APP_DAILY_REQUEST_LIMIT_EXCEEDED");
  assert.equal(fixture.upstream.requests.length, 1);
});

test("createGatewayServer rejects duplicate app API keys", () => {
  assert.throws(
    () =>
      createGatewayServer({
        apps: {
          first: { apiKey: "duplicate-key", policy: { ...demoPolicy, appId: "first" } },
          second: { apiKey: "duplicate-key", policy: { ...demoPolicy, appId: "second" } },
        },
      }),
    /duplicate app API key/i,
  );
});
