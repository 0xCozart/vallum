import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LocalA2APushNotificationStore,
  createA2APushNotificationConfig,
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
