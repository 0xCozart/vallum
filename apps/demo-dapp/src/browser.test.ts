import assert from "node:assert/strict";
import { test } from "node:test";

import { GasKitPolicyError } from "@iota-gaskit/sdk";

import {
  createDemoBrowserServer,
  renderDemoBrowserPage,
  startDemoBrowserServerFromEnv,
  type DemoBrowserServerOptions,
} from "./browser.js";

async function withServer<T>(options: DemoBrowserServerOptions, run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createDemoBrowserServer(options);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("renderDemoBrowserPage renders a same-origin demo runner without credentials", () => {
  const html = renderDemoBrowserPage();

  assert.match(html, /IOTA GasKit Local Demo/);
  assert.match(html, /data-testid="run-demo"/);
  assert.match(html, /fetch\("\/api\/run-demo"/);
  assert.doesNotMatch(html, /local-dev-demo-key|Bearer|GASKIT_DEMO_APP_KEY/i);
});

test("demo browser server serves the page and health endpoint", async () => {
  await withServer({ runFlow: async () => ({ reservationId: "unused", gasKitTransactionId: "unused", digest: "unused" }) }, async (baseUrl) => {
    const page = await fetch(`${baseUrl}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await page.text(), /IOTA GasKit Local Demo/);

    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok", service: "iota-gaskit-demo-dapp" });
  });
});

test("demo browser server runs the local grant flow through a POST API", async () => {
  let calls = 0;
  await withServer({
    runFlow: async () => {
      calls += 1;
      return {
        reservationId: "reservation-1",
        gasKitTransactionId: "gaskit_tx_1",
        sponsorAddress: "0xSPONSOR",
        digest: "digest-1",
        apiKey: "local-dev-demo-key",
        raw: { bearer: "secret-token" },
      } as never;
    },
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/run-demo`, { method: "POST" });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, {
      ok: true,
      result: {
        reservationId: "reservation-1",
        gasKitTransactionId: "gaskit_tx_1",
        sponsorAddress: "0xSPONSOR",
        digest: "digest-1",
      },
    });
    assert.doesNotMatch(JSON.stringify(body), /local-dev-demo-key|secret-token|raw|apiKey|Bearer/i);
  });
  assert.equal(calls, 1);
});

test("demo browser server sanitizes SDK errors without exposing raw upstream bodies", async () => {
  await withServer({
    runFlow: async () => {
      throw new GasKitPolicyError("Package not allowed for local-dev-demo-key", "PACKAGE_NOT_ALLOWED", 400, {
        bearer: "secret-token",
      });
    },
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/run-demo`, { method: "POST" });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, {
      ok: false,
      error: {
        name: "GasKitPolicyError",
        message: "Package not allowed for [REDACTED]",
        reasonCode: "PACKAGE_NOT_ALLOWED",
        status: 400,
      },
    });
    assert.doesNotMatch(JSON.stringify(body), /secret-token|local-dev-demo-key|bearer|raw|stack/i);
  });
});

test("demo browser server returns generic internal errors without leaking messages", async () => {
  await withServer({
    runFlow: async () => {
      throw new Error("upstream said Bearer secret-token while using local-dev-demo-key");
    },
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/run-demo`, { method: "POST" });
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.deepEqual(body, {
      ok: false,
      error: {
        name: "Error",
        message: "Demo flow failed.",
        status: 500,
      },
    });
    assert.doesNotMatch(JSON.stringify(body), /secret-token|local-dev-demo-key|Bearer|stack/i);
  });
});

test("demo browser server rejects request bodies before running the flow", async () => {
  let calls = 0;
  await withServer({
    runFlow: async () => {
      calls += 1;
      return { reservationId: "unused", gasKitTransactionId: "unused", digest: "unused" };
    },
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/run-demo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: { message: "Request body is not accepted for this local demo endpoint." },
    });
  });
  assert.equal(calls, 0);
});

test("demo browser server rejects cross-origin POST attempts before running the flow", async () => {
  let calls = 0;
  await withServer({
    runFlow: async () => {
      calls += 1;
      return { reservationId: "unused", gasKitTransactionId: "unused", digest: "unused" };
    },
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/run-demo`, {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: { message: "Cross-origin requests are not allowed for this local demo endpoint." },
    });
  });
  assert.equal(calls, 0);
});

test("demo browser server rejects unsupported methods and unknown routes", async () => {
  await withServer({ runFlow: async () => ({ reservationId: "unused", gasKitTransactionId: "unused", digest: "unused" }) }, async (baseUrl) => {
    const getApi = await fetch(`${baseUrl}/api/run-demo`);
    assert.equal(getApi.status, 405);
    assert.equal(getApi.headers.get("allow"), "POST");

    const missing = await fetch(`${baseUrl}/missing`);
    assert.equal(missing.status, 404);
  });
});

test("demo browser server refuses non-loopback hosts and invalid ports", async () => {
  await assert.rejects(
    () => startDemoBrowserServerFromEnv({ GASKIT_DEMO_DAPP_HOST: "0.0.0.0", GASKIT_DEMO_DAPP_PORT: "0" }),
    /loopback/i,
  );

  await assert.rejects(
    () => startDemoBrowserServerFromEnv({ GASKIT_DEMO_DAPP_HOST: "127.0.0.1", GASKIT_DEMO_DAPP_PORT: "not-a-port" }),
    /valid port/i,
  );
});
