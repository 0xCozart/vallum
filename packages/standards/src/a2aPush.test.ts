import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LocalA2APushNotificationAttemptStore,
  LocalA2APushNotificationStore,
  buildA2APushNotificationDeliveryRequest,
  createA2APushNotificationConfig,
  createA2APushHttpTransport,
  deliverA2APushNotifications,
  type A2APushNotificationDeliveryRequest,
  type A2ATask,
} from "./index.js";

const now = new Date("2026-06-11T12:00:00.000Z");

test("A2A push delivery builds credential-free task POST requests through injected transport", async () => {
  const store = new LocalA2APushNotificationStore();
  createA2APushNotificationConfig({
    store,
    taskId: "task-push-1",
    now,
    value: {
      id: "push-1",
      url: "https://client.example.test/a2a/push",
      authentication: { scheme: "Bearer" },
    },
  });
  const captured: A2APushNotificationDeliveryRequest[] = [];

  const result = await deliverA2APushNotifications({
    store,
    task: taskFixture(),
    transport: (request) => {
      captured.push(request);
      return { status: 202 };
    },
  });

  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0]?.status, "delivered");
  assert.equal(result.attempts[0]?.httpStatus, 202);
  assert.equal(captured.length, 1);
  const request = captured[0];
  assert.equal(request?.method, "POST");
  assert.equal(request?.url, "https://client.example.test/a2a/push");
  assert.match(request?.headers["content-type"] ?? "", /application\/a2a\+json/);
  assert.equal(request?.headers["a2a-version"], "1.0");
  assert.equal(request?.headers.authorization, undefined);
  assert.equal(request?.body.kind, "task");
  assert.equal(request?.body.task.status.state, "TASK_STATE_COMPLETED");
  assert.doesNotMatch(request?.json ?? "", /private prompt|Bearer abc|signer_ref_secret|wallet_secret|payment-secret/i);
});

test("A2A push delivery skips without transport and isolates transport failures", async () => {
  const store = new LocalA2APushNotificationStore();
  createA2APushNotificationConfig({
    store,
    taskId: "task-push-1",
    now,
    value: {
      id: "push-1",
      url: "https://client.example.test/a2a/push",
    },
  });

  const skipped = await deliverA2APushNotifications({
    store,
    task: taskFixture(),
  });
  const failed = await deliverA2APushNotifications({
    store,
    task: taskFixture(),
    transport: () => {
      throw new Error("network down with Bearer should-not-print");
    },
  });

  assert.equal(skipped.attempts[0]?.status, "skipped");
  assert.equal(skipped.attempts[0]?.errorCode, "A2A_PUSH_TRANSPORT_UNCONFIGURED");
  assert.equal(failed.attempts[0]?.status, "failed");
  assert.equal(failed.attempts[0]?.errorCode, "A2A_PUSH_TRANSPORT_FAILED");
  assert.equal(JSON.stringify(failed).includes("should-not-print"), false);
});

test("A2A push delivery retries only when configured and records safe attempt metadata", async () => {
  const store = new LocalA2APushNotificationStore();
  const attemptStore = new LocalA2APushNotificationAttemptStore();
  createA2APushNotificationConfig({
    store,
    taskId: "task-push-1",
    now,
    value: {
      id: "push-1",
      url: "https://client.example.test/a2a/push",
    },
  });
  let calls = 0;
  let nowCalls = 0;
  const dates = [
    new Date("2026-06-11T12:00:01.000Z"),
    new Date("2026-06-11T12:00:02.000Z"),
  ];

  const result = await deliverA2APushNotifications({
    store,
    task: taskFixture(),
    attemptStore,
    maxAttempts: 2,
    retryDelayMs: 250,
    now: () => dates[Math.min(nowCalls++, dates.length - 1)] ?? now,
    transport: () => {
      calls += 1;
      return { status: calls === 1 ? 503 : 202 };
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts[0]?.status, "failed");
  assert.equal(result.attempts[0]?.attemptNumber, 1);
  assert.equal(result.attempts[0]?.httpStatus, 503);
  assert.equal(result.attempts[0]?.nextRetryAt, "2026-06-11T12:00:01.250Z");
  assert.equal(result.attempts[1]?.status, "delivered");
  assert.equal(result.attempts[1]?.attemptNumber, 2);
  assert.equal(result.attempts[1]?.httpStatus, 202);
  assert.equal(result.attempts[1]?.nextRetryAt, undefined);
  assert.deepEqual(attemptStore.list(), result.attempts);
  assert.doesNotMatch(JSON.stringify(attemptStore.list()), /private prompt|Bearer abc|signer_ref_secret|wallet_secret|payment-secret|json|body/i);
});

test("A2A push delivery does not retry by default", async () => {
  const store = new LocalA2APushNotificationStore();
  createA2APushNotificationConfig({
    store,
    taskId: "task-push-1",
    now,
    value: {
      id: "push-1",
      url: "https://client.example.test/a2a/push",
    },
  });
  let calls = 0;

  const result = await deliverA2APushNotifications({
    store,
    task: taskFixture(),
    transport: () => {
      calls += 1;
      return { status: 503 };
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0]?.status, "failed");
  assert.equal(result.attempts[0]?.attemptNumber, 1);
  assert.equal(result.attempts[0]?.nextRetryAt, undefined);
});

test("A2A push HTTP transport posts sanitized delivery requests without auth headers", async () => {
  const config = createConfigFixture();
  const request = {
    ...buildA2APushNotificationDeliveryRequest(config, taskFixture()),
    headers: {
      ...buildA2APushNotificationDeliveryRequest(config, taskFixture()).headers,
      authorization: "Bearer should-not-send",
      cookie: "session=should-not-send",
    },
  };
  const captured: Array<{ readonly url: string; readonly init: RequestInit }> = [];
  const transport = createA2APushHttpTransport({
    fetch: async (url, init) => {
      captured.push({ url: String(url), init: init ?? {} });
      return new Response(null, { status: 204 });
    },
    timeoutMs: 25,
  });

  const response = await transport(request);

  assert.equal(response.status, 204);
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.url, "https://client.example.test/a2a/push");
  assert.equal(captured[0]?.init.method, "POST");
  assert.equal(captured[0]?.init.redirect, "manual");
  const headers = captured[0]?.init.headers as Record<string, string>;
  assert.match(headers["content-type"] ?? "", /application\/a2a\+json/);
  assert.equal(headers["a2a-version"], "1.0");
  assert.equal(headers.authorization, undefined);
  assert.equal(headers.cookie, undefined);
  assert.doesNotMatch(String(captured[0]?.init.body ?? ""), /private prompt|Bearer abc|should-not-send|signer_ref_secret|wallet_secret|payment-secret/i);
});

test("A2A push HTTP transport rejects unsafe URLs before fetch", async () => {
  let called = false;
  const config = createConfigFixture();
  const safeRequest = buildA2APushNotificationDeliveryRequest(config, taskFixture());
  const transport = createA2APushHttpTransport({
    fetch: async () => {
      called = true;
      return new Response(null, { status: 204 });
    },
  });

  await assert.rejects(
    async () => transport({
      ...safeRequest,
      url: "https://127.0.0.1/a2a/push",
    }),
    /A2A push notification URL must be public HTTPS/,
  );
  assert.equal(called, false);
});

test("A2A push callback URLs reject query strings before storage or delivery", async () => {
  const store = new LocalA2APushNotificationStore();

  assert.throws(
    () => createA2APushNotificationConfig({
      store,
      taskId: "task-push-1",
      now,
      value: {
        id: "push-query",
        url: "https://client.example.test/a2a/push?token=should-not-store",
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /query strings/);
      assert.doesNotMatch(error.message, /should-not-store|token/);
      return true;
    },
  );

  const safeRequest = buildA2APushNotificationDeliveryRequest(createConfigFixture(), taskFixture());
  const transport = createA2APushHttpTransport({
    fetch: async () => new Response(null, { status: 204 }),
  });
  await assert.rejects(
    async () => transport({
      ...safeRequest,
      url: "https://client.example.test/a2a/push?secret=should-not-send",
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /query strings/);
      assert.doesNotMatch(error.message, /should-not-send|secret/);
      return true;
    },
  );
});

test("A2A push callback host allowlists gate storage and injected transport delivery", async () => {
  const store = new LocalA2APushNotificationStore();

  const allowed = createA2APushNotificationConfig({
    store,
    taskId: "task-push-1",
    now,
    allowedCallbackHosts: ["client.example.test"],
    value: {
      id: "push-allowlisted",
      url: "https://client.example.test/a2a/push",
    },
  });
  assert.equal(allowed.url, "https://client.example.test/a2a/push");

  assert.throws(
    () => createA2APushNotificationConfig({
      store,
      taskId: "task-push-1",
      now,
      allowedCallbackHosts: ["client.example.test"],
      value: {
        id: "push-denied-host",
        url: "https://evil.example.test/a2a/push",
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /allowlist/);
      assert.doesNotMatch(error.message, /client\.example|evil\.example|push-denied-host/i);
      return true;
    },
  );

  const captured: string[] = [];
  const transport = createA2APushHttpTransport({
    allowedCallbackHosts: ["client.example.test"],
    fetch: async (url) => {
      captured.push(String(url));
      return new Response(null, { status: 204 });
    },
  });
  const safeRequest = buildA2APushNotificationDeliveryRequest(allowed, taskFixture());
  assert.equal((await transport(safeRequest)).status, 204);
  assert.deepEqual(captured, ["https://client.example.test/a2a/push"]);

  await assert.rejects(
    async () => transport({
      ...safeRequest,
      url: "https://other.example.test/a2a/push",
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /allowlist/);
      assert.doesNotMatch(error.message, /client\.example|other\.example/i);
      return true;
    },
  );
});

test("A2A push HTTP transport reports redirects and timeouts as failed delivery without leaking errors", async () => {
  const store = new LocalA2APushNotificationStore();
  createA2APushNotificationConfig({
    store,
    taskId: "task-push-1",
    now,
    value: {
      id: "push-1",
      url: "https://client.example.test/a2a/push",
    },
  });

  const redirectResult = await deliverA2APushNotifications({
    store,
    task: taskFixture(),
    transport: createA2APushHttpTransport({
      fetch: async (_url, init) => {
        assert.equal(init?.redirect, "manual");
        return new Response("", { status: 302 });
      },
    }),
  });
  const timeoutResult = await deliverA2APushNotifications({
    store,
    task: taskFixture(),
    transport: createA2APushHttpTransport({
      timeoutMs: 1,
      fetch: (_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("timeout with Bearer should-not-print"));
        });
      }),
    }),
  });

  assert.equal(redirectResult.attempts[0]?.status, "failed");
  assert.equal(redirectResult.attempts[0]?.httpStatus, 302);
  assert.equal(redirectResult.attempts[0]?.errorCode, "A2A_PUSH_TRANSPORT_FAILED");
  assert.equal(timeoutResult.attempts[0]?.status, "failed");
  assert.equal(timeoutResult.attempts[0]?.errorCode, "A2A_PUSH_TRANSPORT_FAILED");
  assert.equal(JSON.stringify(timeoutResult).includes("should-not-print"), false);
});

function createConfigFixture() {
  const store = new LocalA2APushNotificationStore();
  return createA2APushNotificationConfig({
    store,
    taskId: "task-push-1",
    now,
    value: {
      id: "push-1",
      url: "https://client.example.test/a2a/push",
    },
  });
}

function taskFixture(): A2ATask {
  return {
    id: "task-push-1",
    contextId: "ctx-push-1",
    status: {
      state: "TASK_STATE_COMPLETED",
      timestamp: now.toISOString(),
    },
    history: [{
      messageId: "msg-push-1",
      role: "ROLE_USER",
      parts: [{ text: "private prompt: Bearer abc.def.ghi" }],
      metadata: {
        signerRef: "signer_ref_secret",
        walletId: "wallet_secret",
        paymentCredential: "payment-secret",
      },
    }],
  };
}
