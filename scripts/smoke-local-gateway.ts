import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createVallumClient, VallumAuthError, VallumPolicyError } from "../packages/sdk/src/index.js";
import { loadGatewayConfigFromEnv } from "../apps/policy-gateway-service/src/config.js";
import { createGatewayServer, type GatewayEvent } from "../apps/policy-gateway-service/src/server.js";
import { createGatewayUsageReadModel } from "../apps/policy-gateway-service/src/usage.js";

interface ObservedRequest {
  method?: string;
  url?: string;
  body: unknown;
  authorization?: string;
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function createMockGasStation(): { server: Server; requests: ObservedRequest[] } {
  const requests: ObservedRequest[] = [];
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    requests.push({ method: request.method, url: request.url, body, authorization: request.headers.authorization });

    if (request.url === "/v1/reserve_gas") {
      writeJson(response, 200, {
        result: {
          reservation_id: "smoke-reservation-1",
          sponsor_address: "0xSMOKE_SPONSOR",
          gas_coins: [{ objectId: "0xSMOKE_GAS" }],
        },
      });
      return;
    }

    if (request.url === "/v1/execute_tx") {
      writeJson(response, 200, { effects: { transactionDigest: "smoke-digest-1" } });
      return;
    }

    writeJson(response, 404, { error: "NotFound" });
  });

  return { server, requests };
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  let timeout: NodeJS.Timeout | undefined;
  const closePromise = new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  const timeoutPromise = new Promise<void>((_, reject) => {
    timeout = setTimeout(() => {
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
      reject(new Error("Timed out closing local smoke server."));
    }, 2_000);
  });
  try {
    await Promise.race([closePromise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  const upstream = createMockGasStation();
  const usageStoreDir = await mkdtemp(join(tmpdir(), "vallum-smoke-usage-store-"));
  let usageStoreWrites = Promise.resolve();
  let gateway: Server | undefined;

  try {
    const upstreamBaseUrl = await listen(upstream.server);
    const events: GatewayEvent[] = [];
    const usage = createGatewayUsageReadModel({ maxRecentEvents: 10 });
    const usageStorePath = join(usageStoreDir, "usage-events.jsonl");
    const config = await loadGatewayConfigFromEnv({
      VALLUM_POLICY_PATH: "examples/policies/demo-dapp.yaml",
      VALLUM_DEMO_APP_KEY: "local-dev-demo-key",
      GAS_STATION_URL: upstreamBaseUrl,
      GAS_STATION_BEARER_TOKEN: "local-smoke-token",
      VALLUM_USAGE_EVENT_STORE_PATH: usageStorePath,
      VALLUM_OPERATOR_USAGE_TOKEN: "local-operator-smoke-token",
      VALLUM_OPERATOR_USAGE_MAX_RECENT_EVENTS: "10",
    });

    gateway = createGatewayServer({
      ...config,
      eventSink: (event) => {
        events.push(event);
        usage.record(event);
        usageStoreWrites = usageStoreWrites.then(() => Promise.resolve(config.eventSink?.(event)).then(() => undefined));
        return usageStoreWrites;
      },
    });
    const gatewayBaseUrl = await listen(gateway);
    const client = createVallumClient({ baseUrl: gatewayBaseUrl, apiKey: "local-dev-demo-key" });

    const health = await fetch(`${gatewayBaseUrl}/health`);
    const healthBody = await health.json();
    assert.equal(health.status, 200);
    assert.equal(healthBody.service, "vallum-policy-gateway");
    console.log("ok: gateway health");

    const missingAuth = await fetch(`${gatewayBaseUrl}/v1/reserve_gas`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gas_budget: 1, package_id: "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0", function_name: "mint_badge" }),
    });
    const missingAuthBody = await missingAuth.json();
    assert.equal(missingAuth.status, 401);
    assert.equal(missingAuthBody.reasonCode, "AUTH_MISSING");
    console.log("ok: missing auth fails closed");

    const wrongKeyClient = createVallumClient({ baseUrl: gatewayBaseUrl, apiKey: "wrong-local-key" });
    await assert.rejects(
      () => wrongKeyClient.reserveGas({ gasBudget: 1, packageId: "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0", functionName: "mint_badge" }),
      (error) => error instanceof VallumAuthError && error.status === 403,
    );
    console.log("ok: invalid auth fails closed");

    await assert.rejects(
      () => client.reserveGas({ gasBudget: 1, packageId: "0xNOT_ALLOWED", functionName: "mint_badge" }),
      (error) => error instanceof VallumPolicyError && error.reasonCode === "PACKAGE_NOT_ALLOWED",
    );
    assert.equal(upstream.requests.length, 0);
    console.log("ok: policy rejection does not call upstream");

    await assert.rejects(
      () => client.reserveGas({ gasBudget: 1, packageId: "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0", functionName: "burn_badge" }),
      (error) => error instanceof VallumPolicyError && error.reasonCode === "FUNCTION_NOT_ALLOWED",
    );
    assert.equal(upstream.requests.length, 0);
    console.log("ok: function policy rejection does not call upstream");

    const simulatedAllowed = await client.simulatePolicy({
      gasBudget: 1,
      walletAddress: "0xSMOKE_WALLET",
      packageId: "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0",
      functionName: "mint_badge",
    });
    assert.deepEqual(simulatedAllowed, { allowed: true });
    const simulatedRejected = await client.simulatePolicy({
      gasBudget: 1,
      walletAddress: "0xSMOKE_WALLET",
      packageId: "0xNOT_ALLOWED",
      functionName: "mint_badge",
    });
    assert.equal(simulatedRejected.allowed, false);
    assert.equal(simulatedRejected.reasonCode, "PACKAGE_NOT_ALLOWED");
    await assert.rejects(
      () =>
        client.simulatePolicy({
          gasBudget: -1,
          walletAddress: "0xSMOKE_WALLET",
          packageId: "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0",
          functionName: "mint_badge",
        }),
      (error) => error instanceof VallumPolicyError && error.status === 400,
    );
    assert.equal(upstream.requests.length, 0);
    assert.equal(events.length, 4);
    console.log("ok: policy simulation evaluates locally without upstream calls");

    const reservation = await client.reserveGas({
      gasBudget: 1,
      walletAddress: "0xSMOKE_WALLET",
      packageId: "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0",
      functionName: "mint_badge",
    });
    assert.equal(reservation.reservationId, "smoke-reservation-1");
    assert.match(reservation.agentRailTransactionId, /^vallum_/);
    assert.equal(reservation.sponsorAddress, "0xSMOKE_SPONSOR");
    assert.equal(upstream.requests.length, 1);
    assert.equal(upstream.requests[0]?.method, "POST");
    assert.equal(upstream.requests[0]?.url, "/v1/reserve_gas");
    assert.equal(upstream.requests[0]?.authorization, "Bearer local-smoke-token");
    assert.deepEqual(upstream.requests[0]?.body, {
      gas_budget: 1,
      wallet_address: "0xSMOKE_WALLET",
      package_id: "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0",
      function_name: "mint_badge",
    });
    console.log("ok: allowed reserve proxies through SDK");

    const executed = await client.executeSponsoredTransaction({
      reservationId: reservation.reservationId,
      agentRailTransactionId: reservation.agentRailTransactionId,
      transactionBytes: "AAE=",
      userSignature: "smoke-signature",
    });
    assert.equal(executed.digest, "smoke-digest-1");
    assert.equal(upstream.requests.length, 2);
    assert.equal(upstream.requests[1]?.method, "POST");
    assert.equal(upstream.requests[1]?.url, "/v1/execute_tx");
    assert.equal(upstream.requests[1]?.authorization, "Bearer local-smoke-token");
    assert.deepEqual(upstream.requests[1]?.body, {
      reservation_id: "smoke-reservation-1",
      tx_bytes: "AAE=",
      user_sig: "smoke-signature",
    });
    console.log("ok: execute proxies through SDK");

    assert.deepEqual(
      events.map((event) => [event.operation, event.outcome, event.httpStatus, event.reasonCode]),
      [
        ["reserve", "rejected", 401, "AUTH_MISSING"],
        ["reserve", "rejected", 403, "AUTH_INVALID"],
        ["reserve", "rejected", 400, "PACKAGE_NOT_ALLOWED"],
        ["reserve", "rejected", 400, "FUNCTION_NOT_ALLOWED"],
        ["reserve", "allowed", 200, undefined],
        ["execute", "allowed", 200, undefined],
      ],
    );
    const eventOutput = JSON.stringify(events);
    assert.equal(eventOutput.includes("local-dev-demo-key"), false);
    assert.equal(eventOutput.includes("local-smoke-token"), false);
    assert.equal(eventOutput.includes("smoke-signature"), false);
    console.log("ok: structured gateway events are sanitized");

    const usageSnapshot = usage.snapshot();
    assert.deepEqual(usageSnapshot.totals.byOperation, { reserve: 5, execute: 1 });
    assert.deepEqual(usageSnapshot.totals.byOutcome, { allowed: 2, rejected: 4, upstream_failed: 0 });
    assert.deepEqual(usageSnapshot.totals.byReasonCode, {
      AUTH_INVALID: 1,
      AUTH_MISSING: 1,
      FUNCTION_NOT_ALLOWED: 1,
      PACKAGE_NOT_ALLOWED: 1,
      unknown: 2,
    });
    assert.equal(usageSnapshot.byAppId["demo-dapp"]?.events, 4);
    assert.equal(usageSnapshot.byAppId.unknown?.events, 2);
    assert.equal(usageSnapshot.byWalletAddress["0xSMOKE_WALLET"]?.events, 2);
    assert.equal(usageSnapshot.byWalletAddress.unknown?.events, 4);
    assert.equal(usageSnapshot.totals.gasBudgetReserved, 1);
    assert.deepEqual(
      usageSnapshot.recentEvents.map((event) => [event.operation, event.outcome, event.reasonCode]),
      [
        ["reserve", "rejected", "AUTH_MISSING"],
        ["reserve", "rejected", "AUTH_INVALID"],
        ["reserve", "rejected", "PACKAGE_NOT_ALLOWED"],
        ["reserve", "rejected", "FUNCTION_NOT_ALLOWED"],
        ["reserve", "allowed", undefined],
        ["execute", "allowed", undefined],
      ],
    );
    const usageOutput = JSON.stringify(usageSnapshot);
    assert.equal(usageOutput.includes("local-dev-demo-key"), false);
    assert.equal(usageOutput.includes("local-smoke-token"), false);
    assert.equal(usageOutput.includes("smoke-signature"), false);
    console.log("ok: local usage read model aggregates sanitized events");

    await usageStoreWrites;
    const durableUsageSnapshot = await config.operatorUsage?.loadSnapshot();
    assert.deepEqual(durableUsageSnapshot?.totals, usageSnapshot.totals);
    assert.deepEqual(durableUsageSnapshot?.byAppId, usageSnapshot.byAppId);
    assert.deepEqual(durableUsageSnapshot?.byWalletAddress, usageSnapshot.byWalletAddress);
    assert.deepEqual(durableUsageSnapshot?.recentEvents, usageSnapshot.recentEvents);
    const durableUsageOutput = JSON.stringify(durableUsageSnapshot);
    assert.equal(durableUsageOutput.includes("local-dev-demo-key"), false);
    assert.equal(durableUsageOutput.includes("local-smoke-token"), false);
    assert.equal(durableUsageOutput.includes("local-operator-smoke-token"), false);
    assert.equal(durableUsageOutput.includes("smoke-signature"), false);
    console.log("ok: local usage event store replays sanitized events");

    const missingOperatorAuth = await fetch(`${gatewayBaseUrl}/operator/usage`);
    assert.equal(missingOperatorAuth.status, 401);
    assert.equal(missingOperatorAuth.headers.get("cache-control"), "no-store");
    const invalidOperatorAuth = await fetch(`${gatewayBaseUrl}/operator/usage`, {
      headers: { authorization: "Bearer local-smoke-token" },
    });
    assert.equal(invalidOperatorAuth.status, 403);
    assert.equal(invalidOperatorAuth.headers.get("cache-control"), "no-store");
    const operatorUsage = await fetch(`${gatewayBaseUrl}/operator/usage`, {
      headers: { authorization: "Bearer local-operator-smoke-token" },
    });
    const operatorUsageBody = await operatorUsage.json();
    assert.equal(operatorUsage.status, 200);
    assert.equal(operatorUsage.headers.get("cache-control"), "no-store");
    assert.equal(operatorUsageBody.source, "local-file-usage-event-store");
    assert.deepEqual(operatorUsageBody.usage, durableUsageSnapshot);
    const operatorUsageOutput = JSON.stringify(operatorUsageBody);
    assert.equal(operatorUsageOutput.includes("local-dev-demo-key"), false);
    assert.equal(operatorUsageOutput.includes("local-smoke-token"), false);
    assert.equal(operatorUsageOutput.includes("local-operator-smoke-token"), false);
    assert.equal(operatorUsageOutput.includes("smoke-signature"), false);
    console.log("ok: authenticated local operator usage API returns sanitized usage");

    console.log("Vallum local gateway smoke passed");
  } finally {
    await usageStoreWrites.catch(() => undefined);
    await Promise.all([gateway ? close(gateway) : Promise.resolve(), close(upstream.server)]);
    await rm(usageStoreDir, { recursive: true, force: true });
  }
}

await main();
