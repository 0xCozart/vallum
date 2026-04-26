import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { loadGatewayConfigFromEnv } from "../apps/policy-gateway-service/src/config.js";
import { createGatewayServer } from "../apps/policy-gateway-service/src/server.js";
import { runLocalDemoFromEnv } from "../apps/demo-dapp/src/local-demo.js";

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
          reservation_id: "demo-reservation-1",
          sponsor_address: "0xDEMO_SPONSOR",
          gas_coins: [{ objectId: "0xDEMO_GAS" }],
        },
      });
      return;
    }

    if (request.url === "/v1/execute_tx") {
      writeJson(response, 200, { effects: { transactionDigest: "demo-digest-1" } });
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
      reject(new Error("Timed out closing demo dApp smoke server."));
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
    const config = await loadGatewayConfigFromEnv({
      GASKIT_POLICY_PATH: "examples/policies/demo-dapp.yaml",
      GASKIT_DEMO_APP_KEY: "local-dev-demo-key",
      GAS_STATION_URL: upstreamBaseUrl,
      GAS_STATION_BEARER_TOKEN: "local-demo-smoke-token",
    });

    gateway = createGatewayServer(config);
    const gatewayBaseUrl = await listen(gateway);

    const output = await runLocalDemoFromEnv({
      GASKIT_GATEWAY_URL: gatewayBaseUrl,
      GASKIT_DEMO_APP_KEY: "local-dev-demo-key",
    });

    assert.match(output, /IOTA GasKit demo dApp local flow passed/);
    assert.match(output, /reservationId=demo-reservation-1/);
    assert.match(output, /digest=demo-digest-1/);
    assert.doesNotMatch(output, /local-dev-demo-key|local-demo-smoke-token|Bearer/i);

    assert.equal(upstream.requests.length, 2);
    assert.equal(upstream.requests[0]?.method, "POST");
    assert.equal(upstream.requests[0]?.url, "/v1/reserve_gas");
    assert.equal(upstream.requests[0]?.authorization, "Bearer local-demo-smoke-token");
    assert.deepEqual(upstream.requests[0]?.body, {
      gas_budget: 1,
      wallet_address: "0xDEMO_WALLET",
      package_id: "0xYOUR_DEMO_PACKAGE_ID",
      function_name: "mint_badge",
    });
    assert.equal(upstream.requests[1]?.method, "POST");
    assert.equal(upstream.requests[1]?.url, "/v1/execute_tx");
    assert.equal(upstream.requests[1]?.authorization, "Bearer local-demo-smoke-token");
    assert.deepEqual(upstream.requests[1]?.body, {
      reservation_id: "demo-reservation-1",
      tx_bytes: "AAE=",
      user_sig: "demo-user-signature",
    });

    console.log(output);
  } finally {
    await Promise.all([gateway ? close(gateway) : Promise.resolve(), close(upstream.server)]);
  }
}

await main();
