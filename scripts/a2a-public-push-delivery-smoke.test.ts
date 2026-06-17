import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  formatA2APublicPushDeliverySmokeResult,
  runA2APublicPushDeliverySmoke,
} from "./smoke-a2a-public-push-delivery.js";

const VALID_ENV = {
  A2A_PUBLIC_BASE_URL: "https://agents.example/a2a",
  A2A_PUBLIC_PUSH_CALLBACK_URL: "https://client.example/a2a/push",
};

test("A2A public push delivery smoke blocks missing config without network calls", async () => {
  let calls = 0;
  const result = await runA2APublicPushDeliverySmoke({
    env: {},
    fetch: async () => {
      calls += 1;
      return new Response(null, { status: 204 });
    },
  });
  const formatted = formatA2APublicPushDeliverySmokeResult(result);

  assert.equal(result.ok, false);
  assert.equal(result.kind, "blocked");
  assert.equal(result.code, "A2A_PUBLIC_PUSH_CONFIG_MISSING");
  assert.equal(calls, 0);
  assert.match(formatted, /A2A_PUBLIC_BASE_URL/);
  assert.doesNotMatch(formatted, /agents\.example|client\.example/);
});

test("A2A public push delivery smoke rejects unsafe callback config without printing values", async () => {
  let calls = 0;
  const result = await runA2APublicPushDeliverySmoke({
    env: {
      A2A_PUBLIC_BASE_URL: "https://agents.example/a2a",
      A2A_PUBLIC_PUSH_CALLBACK_URL: "https://localhost/a2a/push?token=secret",
    },
    fetch: async () => {
      calls += 1;
      return new Response(null, { status: 204 });
    },
  });
  const formatted = formatA2APublicPushDeliverySmokeResult(result);

  assert.equal(result.ok, false);
  assert.equal(result.kind, "blocked");
  assert.equal(result.code, "A2A_PUBLIC_PUSH_CONFIG_UNSAFE");
  assert.equal(calls, 0);
  assert.doesNotMatch(formatted, /localhost|token|secret|agents\.example/);
});

test("A2A public push delivery smoke delivers through injected fetch and writes redacted report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-a2a-public-push-"));
  const requests: Array<{ url: string; body: string }> = [];
  try {
    const reportPath = join(cwd, "a2a-public-push-delivery-report.json");
    const result = await runA2APublicPushDeliverySmoke({
      env: VALID_ENV,
      now: new Date("2026-06-11T12:00:00.000Z"),
      reportPath,
      fetch: async (input, init) => {
        requests.push({
          url: String(input),
          body: String(init?.body ?? ""),
        });
        return new Response(null, { status: 204 });
      },
    });
    const formatted = formatA2APublicPushDeliverySmokeResult(result);
    const reportRaw = await readFile(reportPath, "utf8");
    const report = JSON.parse(reportRaw) as Record<string, unknown>;

    assert.equal(result.ok, true);
    assert.deepEqual(requests.map((request) => request.url), ["https://client.example/a2a/push"]);
    assert.match(requests[0]?.body ?? "", /vallum-public-push-proof-task/);
    assert.doesNotMatch(requests[0]?.body ?? "", /private prompt|Bearer|signer_ref|payment-secret|redaction-fixture/);
    assert.deepEqual(report, {
      schemaVersion: 1,
      kind: "a2a-public-push-delivery",
      result: "passed",
      observedAt: "2026-06-11T12:00:00.000Z",
      publicBaseUrl: "https://agents.example/a2a",
      deliveryStatus: 204,
      attempts: 1,
      checks: ["public-config", "callback-delivery", "redaction-review"],
    });
    assert.match(formatted, /A2A public push delivery smoke passed/);
    assert.doesNotMatch(formatted, /client\.example|agents\.example|a2a-public-push-delivery-report|private prompt|redaction-fixture/);
    assert.doesNotMatch(reportRaw, /client\.example|private prompt|redaction-fixture/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public push delivery smoke fails closed on non-success callback status", async () => {
  const result = await runA2APublicPushDeliverySmoke({
    env: VALID_ENV,
    fetch: async () => new Response(null, { status: 500 }),
  });
  const formatted = formatA2APublicPushDeliverySmokeResult(result);

  assert.equal(result.ok, false);
  assert.equal(result.kind, "failed");
  assert.equal(result.code, "A2A_PUBLIC_PUSH_DELIVERY_FAILED");
  assert.doesNotMatch(formatted, /client\.example|agents\.example/);
});
