import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { createDemoBrowserServer } from "../apps/demo-dapp/src/browser.js";
import { loadGatewayConfigFromEnv } from "../apps/policy-gateway-service/src/config.js";
import { createGatewayServer } from "../apps/policy-gateway-service/src/server.js";

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
          reservation_id: "browser-reservation-1",
          sponsor_address: "0xBROWSER_SPONSOR",
          gas_coins: [{ objectId: "0xBROWSER_GAS" }],
        },
      });
      return;
    }

    if (request.url === "/v1/execute_tx") {
      writeJson(response, 200, { effects: { transactionDigest: "browser-digest-1" } });
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
      reject(new Error("Timed out closing demo browser smoke server."));
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
  let browser: Server | undefined;

  try {
    const upstreamBaseUrl = await listen(upstream.server);
    const config = await loadGatewayConfigFromEnv({
      GASKIT_POLICY_PATH: "examples/policies/demo-dapp.yaml",
      GASKIT_DEMO_APP_KEY: "local-dev-demo-key",
      GAS_STATION_URL: upstreamBaseUrl,
      GAS_STATION_BEARER_TOKEN: "local-browser-smoke-token",
    });

    gateway = createGatewayServer(config);
    const gatewayBaseUrl = await listen(gateway);

    browser = createDemoBrowserServer({
      gatewayUrl: gatewayBaseUrl,
      apiKey: "local-dev-demo-key",
    });
    const browserBaseUrl = await listen(browser);

    const page = await fetch(`${browserBaseUrl}/`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /IOTA GasKit Local Demo/);
    assert.match(html, /data-testid="run-demo"/);
    assert.doesNotMatch(html, /local-dev-demo-key|local-browser-smoke-token|Bearer/i);
    console.log("ok: browser wrapper page hides credentials");

    const health = await fetch(`${browserBaseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok", service: "iota-gaskit-demo-dapp" });
    console.log("ok: browser wrapper health");

    const rejectedOrigin = await fetch(`${browserBaseUrl}/api/run-demo`, {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    assert.equal(rejectedOrigin.status, 403);
    assert.equal(upstream.requests.length, 0);
    console.log("ok: browser wrapper rejects cross-origin demo API calls");

    const rejectedBody = await fetch(`${browserBaseUrl}/api/run-demo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    assert.equal(rejectedBody.status, 400);
    assert.equal(upstream.requests.length, 0);
    console.log("ok: browser wrapper rejects request bodies before gateway calls");

    const api = await fetch(`${browserBaseUrl}/api/run-demo`, { method: "POST" });
    assert.equal(api.status, 200);
    const apiBody = await api.json();
    assert.deepEqual(apiBody, {
      ok: true,
      result: {
        reservationId: "browser-reservation-1",
        gasKitTransactionId: apiBody.result.gasKitTransactionId,
        sponsorAddress: "0xBROWSER_SPONSOR",
        digest: "browser-digest-1",
      },
    });
    assert.match(apiBody.result.gasKitTransactionId, /^gaskit_/);
    assert.doesNotMatch(JSON.stringify(apiBody), /local-dev-demo-key|local-browser-smoke-token|Bearer/i);
    console.log("ok: browser wrapper runs same-origin demo API");

    assert.equal(upstream.requests.length, 2);
    assert.equal(upstream.requests[0]?.method, "POST");
    assert.equal(upstream.requests[0]?.url, "/v1/reserve_gas");
    assert.equal(upstream.requests[0]?.authorization, "Bearer local-browser-smoke-token");
    assert.deepEqual(upstream.requests[0]?.body, {
      gas_budget: 1,
      wallet_address: "0xDEMO_WALLET",
      package_id: "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0",
      function_name: "mint_badge",
    });
    assert.equal(upstream.requests[1]?.method, "POST");
    assert.equal(upstream.requests[1]?.url, "/v1/execute_tx");
    assert.equal(upstream.requests[1]?.authorization, "Bearer local-browser-smoke-token");
    assert.deepEqual(upstream.requests[1]?.body, {
      reservation_id: "browser-reservation-1",
      tx_bytes: "AAE=",
      user_sig: "demo-user-signature",
    });
    console.log("ok: browser wrapper reaches gateway without exposing app credentials");

    console.log("IOTA GasKit demo dApp browser smoke passed");
  } finally {
    await Promise.all([
      browser ? close(browser) : Promise.resolve(),
      gateway ? close(gateway) : Promise.resolve(),
      close(upstream.server),
    ]);
  }
}

await main();
