import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { createGasKitClient, GasKitAuthError, GasKitPolicyError } from "../packages/sdk/src/index.js";
import { loadGatewayConfigFromEnv } from "../apps/policy-gateway-service/src/config.js";
import { createGatewayServer, type GatewayEvent } from "../apps/policy-gateway-service/src/server.js";

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
  let gateway: Server | undefined;

  try {
    const upstreamBaseUrl = await listen(upstream.server);
    const events: GatewayEvent[] = [];
    const config = await loadGatewayConfigFromEnv({
      GASKIT_POLICY_PATH: "examples/policies/demo-dapp.yaml",
      GASKIT_DEMO_APP_KEY: "local-dev-demo-key",
      GAS_STATION_URL: upstreamBaseUrl,
      GAS_STATION_BEARER_TOKEN: "local-smoke-token",
    });

    gateway = createGatewayServer({
      ...config,
      eventSink: (event) => {
        events.push(event);
      },
    });
    const gatewayBaseUrl = await listen(gateway);
    const client = createGasKitClient({ baseUrl: gatewayBaseUrl, apiKey: "local-dev-demo-key" });

    const health = await fetch(`${gatewayBaseUrl}/health`);
    const healthBody = await health.json();
    assert.equal(health.status, 200);
    assert.equal(healthBody.service, "iota-gaskit-policy-gateway");
    console.log("ok: gateway health");

    const missingAuth = await fetch(`${gatewayBaseUrl}/v1/reserve_gas`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gas_budget: 1, package_id: "0xYOUR_DEMO_PACKAGE_ID", function_name: "mint_badge" }),
    });
    const missingAuthBody = await missingAuth.json();
    assert.equal(missingAuth.status, 401);
    assert.equal(missingAuthBody.reasonCode, "AUTH_MISSING");
    console.log("ok: missing auth fails closed");

    const wrongKeyClient = createGasKitClient({ baseUrl: gatewayBaseUrl, apiKey: "wrong-local-key" });
    await assert.rejects(
      () => wrongKeyClient.reserveGas({ gasBudget: 1, packageId: "0xYOUR_DEMO_PACKAGE_ID", functionName: "mint_badge" }),
      (error) => error instanceof GasKitAuthError && error.status === 403,
    );
    console.log("ok: invalid auth fails closed");

    await assert.rejects(
      () => client.reserveGas({ gasBudget: 1, packageId: "0xNOT_ALLOWED", functionName: "mint_badge" }),
      (error) => error instanceof GasKitPolicyError && error.reasonCode === "PACKAGE_NOT_ALLOWED",
    );
    assert.equal(upstream.requests.length, 0);
    console.log("ok: policy rejection does not call upstream");

    await assert.rejects(
      () => client.reserveGas({ gasBudget: 1, packageId: "0xYOUR_DEMO_PACKAGE_ID", functionName: "burn_badge" }),
      (error) => error instanceof GasKitPolicyError && error.reasonCode === "FUNCTION_NOT_ALLOWED",
    );
    assert.equal(upstream.requests.length, 0);
    console.log("ok: function policy rejection does not call upstream");

    const reservation = await client.reserveGas({
      gasBudget: 1,
      walletAddress: "0xSMOKE_WALLET",
      packageId: "0xYOUR_DEMO_PACKAGE_ID",
      functionName: "mint_badge",
    });
    assert.equal(reservation.reservationId, "smoke-reservation-1");
    assert.match(reservation.gasKitTransactionId, /^gaskit_/);
    assert.equal(reservation.sponsorAddress, "0xSMOKE_SPONSOR");
    assert.equal(upstream.requests.length, 1);
    assert.equal(upstream.requests[0]?.method, "POST");
    assert.equal(upstream.requests[0]?.url, "/v1/reserve_gas");
    assert.equal(upstream.requests[0]?.authorization, "Bearer local-smoke-token");
    assert.deepEqual(upstream.requests[0]?.body, {
      gas_budget: 1,
      wallet_address: "0xSMOKE_WALLET",
      package_id: "0xYOUR_DEMO_PACKAGE_ID",
      function_name: "mint_badge",
    });
    console.log("ok: allowed reserve proxies through SDK");

    const executed = await client.executeSponsoredTransaction({
      reservationId: reservation.reservationId,
      gasKitTransactionId: reservation.gasKitTransactionId,
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

    console.log("IOTA GasKit local gateway smoke passed");
  } finally {
    await Promise.all([gateway ? close(gateway) : Promise.resolve(), close(upstream.server)]);
  }
}

await main();
