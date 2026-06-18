import assert from "node:assert/strict";
import { test } from "node:test";

import { validManifestFixture } from "@vallum/manifest";
import type { AgentActionPolicy } from "@vallum/policy-gateway";
import { validAgentProfileFixture } from "@vallum/registry";

import {
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  A2A_HTTP_EXTENDED_AGENT_CARD_PATH,
  A2A_HTTP_SEND_MESSAGE_PATH,
  A2A_HTTP_STREAM_MESSAGE_PATH,
  A2A_HTTP_TASKS_PATH,
  A2A_TASK_PROTOCOL_VERSION,
  LocalA2APushNotificationStore,
  LocalA2ATaskStore,
  handleLocalA2AHttpRequest,
  type A2AHttpA2ATaskBody,
  type A2AHttpResponse,
  type A2APushNotificationDeliveryRequest,
} from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");

const policy: AgentActionPolicy = {
  knownAgents: ["agent:quote-bot"],
  maxGasBudget: 50_000_000,
  allowedContracts: [{
    packageId: "0x2222222222222222222222222222222222222222222222222222222222222222",
    module: "escrow",
    functionName: "open_escrow",
  }],
  allowedCounterparties: ["provider:quote-service"],
  requireSimulation: true,
  humanApprovalGasThreshold: 100_000_000,
};

test("local A2A HTTP handler serves public well-known Agent Card without task auth", async () => {
  const response = await handleLocalA2AHttpRequest({
    method: "GET",
    path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
  }, {
    store: new LocalA2ATaskStore(),
    agentCardProfile: a2aProfileFixture(),
    taskAuthToken: "local-a2a-token",
    taskPolicy: policy,
    now: () => now,
  });

  assert.equal(response.status, 200);
  assertAgentCardResponse(response);
  assert.match(response.headers["content-type"] ?? "", /application\/a2a\+json/);
  assert.equal(response.body.kind, "agent-card");
  assert.doesNotMatch(response.json, /signer_ref|walletId|credential:|payment address/i);
});

test("local A2A HTTP handler serves authenticated extended Agent Card without leaking private profile fields", async () => {
  const options = {
    store: new LocalA2ATaskStore(),
    agentCardProfile: a2aProfileFixture(),
    extendedAgentCardProfile: extendedA2AProfileFixture(),
    taskAuthToken: "local-a2a-token",
    taskPolicy: policy,
    now: () => now,
    processMessage: () => ({
      state: "TASK_STATE_WORKING" as const,
    }),
  };

  const publicCard = await handleLocalA2AHttpRequest({
    method: "GET",
    path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
  }, options);
  const unauthorizedExtended = await handleLocalA2AHttpRequest({
    method: "GET",
    path: A2A_HTTP_EXTENDED_AGENT_CARD_PATH,
  }, options);
  const extended = await handleLocalA2AHttpRequest({
    method: "GET",
    path: A2A_HTTP_EXTENDED_AGENT_CARD_PATH,
    headers: { authorization: "Bearer local-a2a-token" },
  }, options);

  assertAgentCardResponse(publicCard);
  assert.equal(agentCardCapabilities(publicCard).extendedAgentCard, true);
  assert.equal(JSON.stringify(publicCard.body).includes("research.deep-dive"), false);
  assert.equal(unauthorizedExtended.status, 401);
  assertAgentCardResponse(extended);
  assert.equal(agentCardCapabilities(extended).extendedAgentCard, false);
  assert.equal(JSON.stringify(extended.body).includes("research.deep-dive"), true);
  assert.match(extended.headers["content-type"] ?? "", /application\/a2a\+json/);
  assert.doesNotMatch(extended.json, /credential:|signer_ref|wallet_researcher|privateNote|payment-secret/i);
});

test("local A2A HTTP extended Agent Card fails closed when unsupported or method is wrong", async () => {
  const options = {
    store: new LocalA2ATaskStore(),
    agentCardProfile: a2aProfileFixture(),
    taskAuthToken: "local-a2a-token",
    taskPolicy: policy,
    now: () => now,
  };
  const auth = { authorization: "Bearer local-a2a-token" };

  const publicCard = await handleLocalA2AHttpRequest({
    method: "GET",
    path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
  }, options);
  const missingExtended = await handleLocalA2AHttpRequest({
    method: "GET",
    path: A2A_HTTP_EXTENDED_AGENT_CARD_PATH,
    headers: auth,
  }, options);
  const wrongMethod = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_EXTENDED_AGENT_CARD_PATH,
    headers: auth,
  }, options);

  assertAgentCardResponse(publicCard);
  assert.equal(agentCardCapabilities(publicCard).extendedAgentCard, false);
  assert.equal(missingExtended.status, 501);
  assert.match(missingExtended.json, /A2A_EXTENDED_AGENT_CARD_NOT_CONFIGURED/);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.allow, "GET");
  assert.doesNotMatch(missingExtended.json, /research\.summary|signer_ref|credential:/i);
});

test("local A2A HTTP task endpoints fail closed when bearer auth is missing or unconfigured", async () => {
  const missingAuth = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    body: sendBody("msg-missing-auth"),
  }, {
    store: new LocalA2ATaskStore(),
    taskAuthToken: "local-a2a-token",
    taskPolicy: policy,
    now: () => now,
  });
  const unconfiguredAuth = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: { authorization: "Bearer local-a2a-token" },
    body: sendBody("msg-unconfigured-auth"),
  }, {
    store: new LocalA2ATaskStore(),
    taskPolicy: policy,
    now: () => now,
  });
  const streamingWithoutAuth = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_STREAM_MESSAGE_PATH,
    body: sendBody("msg-stream-no-auth"),
  }, {
    store: new LocalA2ATaskStore(),
    taskAuthToken: "local-a2a-token",
    taskPolicy: policy,
    now: () => now,
  });

  assert.equal(missingAuth.status, 401);
  assertA2AError(missingAuth.body, 401, "A2A_AUTH_REQUIRED", "INVALID_REQUEST");
  assert.equal(unconfiguredAuth.status, 503);
  assertA2AError(unconfiguredAuth.body, 503, "A2A_AUTH_NOT_CONFIGURED", "INVALID_REQUEST");
  assert.equal(streamingWithoutAuth.status, 401);
  assert.deepEqual(streamingWithoutAuth.body, missingAuth.body);
});

test("local A2A HTTP handler sends gets lists and cancels authorized tasks", async () => {
  const store = new LocalA2ATaskStore();
  const options = {
    store,
    taskAuthToken: "local-a2a-token",
    taskPolicy: policy,
    now: () => now,
    processMessage: () => ({
      state: "TASK_STATE_WORKING" as const,
      artifacts: [{
        artifactId: "draft-1",
        parts: [{ text: "draft output" }],
      }],
    }),
  };
  const auth = { authorization: "Bearer local-a2a-token" };

  const sent = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: auth,
    body: sendBody("msg-authorized"),
  }, options);
  assert.equal(sent.status, 200);
  assertTaskResponse(sent);
  assert.equal(sent.body.task.status.state, "TASK_STATE_WORKING");

  const taskId = sent.body.task.id;
  const hiddenArtifacts = await handleLocalA2AHttpRequest({
    method: "GET",
    path: `/tasks/${taskId}`,
    headers: auth,
  }, options);
  const visibleArtifacts = await handleLocalA2AHttpRequest({
    method: "GET",
    path: `/tasks/${taskId}?includeArtifacts=true`,
    headers: auth,
  }, options);
  const listed = await handleLocalA2AHttpRequest({
    method: "GET",
    path: A2A_HTTP_TASKS_PATH,
    headers: auth,
  }, options);
  const canceled = await handleLocalA2AHttpRequest({
    method: "POST",
    path: `/tasks/${taskId}:cancel`,
    headers: auth,
  }, options);

  assert.equal(hiddenArtifacts.status, 200);
  assertTaskResponse(hiddenArtifacts);
  assertTaskResponse(visibleArtifacts);
  assertTaskListResponse(listed);
  assertTaskResponse(canceled);
  assert.equal(hiddenArtifacts.body.task.artifacts, undefined);
  assert.equal(visibleArtifacts.body.task.artifacts?.[0]?.artifactId, "draft-1");
  assert.equal(listed.body.tasks.length, 1);
  assert.equal(listed.body.tasks[0]?.artifacts, undefined);
  assert.equal(canceled.body.task.status.state, "TASK_STATE_CANCELED");
  assert.equal(canceled.body.task.artifacts, undefined);
});

test("local A2A HTTP handler can emit official A2A task and list bodies in compatibility mode", async () => {
  const store = new LocalA2ATaskStore();
  const options = {
    store,
    taskAuthToken: "local-a2a-token",
    standardsBodyMode: "a2a" as const,
    allowUnmanifestedTasks: true,
    now: () => now,
    processMessage: () => ({
      state: "TASK_STATE_COMPLETED" as const,
      artifacts: [{
        artifactId: "a2a-output",
        parts: [{ text: "official A2A output" }],
      }],
    }),
  };
  const auth = { authorization: "Bearer local-a2a-token" };

  const sent = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: auth,
    body: {
      message: {
        messageId: "msg-a2a-raw",
        role: "ROLE_USER",
        parts: [{ text: "Run official A2A work." }],
      },
    },
  }, options);
  assertA2ASendTaskResponse(sent);
  assert.equal(sent.body.task.status.state, "TASK_STATE_COMPLETED");
  assert.equal("kind" in sent.body, false);
  assert.equal("agenticVallum" in sent.body.task, false);

  const listed = await handleLocalA2AHttpRequest({
    method: "GET",
    path: A2A_HTTP_TASKS_PATH,
    headers: auth,
  }, options);
  assertRawA2ATaskListResponse(listed);
  assert.equal(listed.body.tasks.length, 1);
  assert.equal(listed.body.nextPageToken, "");
  assert.equal(listed.body.pageSize, 1);
  assert.equal(listed.body.totalSize, 1);
  assert.equal("kind" in listed.body, false);
  assert.doesNotMatch(sent.json, /agenticVallum|policyDecision|\"kind\"/);
  assert.doesNotMatch(listed.json, /agenticVallum|policyDecision|\"kind\"/);
});

test("local A2A HTTP handler supports return-immediately compatibility without running local processor", async () => {
  const response = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: { authorization: "Bearer local-a2a-token" },
    body: {
      message: {
        messageId: "msg-return-immediately",
        role: "ROLE_USER",
        parts: [{ text: "Start async work." }],
      },
      configuration: {
        returnImmediately: true,
      },
    },
  }, {
    store: new LocalA2ATaskStore(),
    taskAuthToken: "local-a2a-token",
    standardsBodyMode: "a2a",
    allowUnmanifestedTasks: true,
    now: () => now,
    processMessage: () => {
      throw new Error("processor must not run for returnImmediately");
    },
  });

  assertA2ASendTaskResponse(response);
  assert.equal(response.body.task.status.state, "TASK_STATE_SUBMITTED");
  assert.equal(response.body.task.artifacts, undefined);
});

test("local A2A HTTP compatibility mode can emit direct Message send responses", async () => {
  const response = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: { authorization: "Bearer local-a2a-token" },
    body: {
      message: {
        messageId: "msg-direct-message-response",
        role: "ROLE_USER",
        parts: [{ text: "Reply directly." }],
      },
    },
  }, {
    store: new LocalA2ATaskStore(),
    taskAuthToken: "local-a2a-token",
    standardsBodyMode: "a2a",
    allowUnmanifestedTasks: true,
    now: () => now,
    processMessage: ({ task }) => ({
      state: "TASK_STATE_COMPLETED" as const,
      responseKind: "message" as const,
      message: {
        messageId: "agent-direct-message-response",
        role: "ROLE_AGENT",
        taskId: task.id,
        contextId: task.contextId,
        parts: [{ text: "Direct message response" }],
      },
    }),
  });

  assertA2ASendMessageResponse(response);
  assert.equal(response.body.message.role, "ROLE_AGENT");
  assert.equal(response.body.message.parts[0]?.text, "Direct message response");
  assert.equal("task" in response.body, false);
  assert.doesNotMatch(response.json, /agenticVallum|policyDecision|\"kind\"/);
});

test("local A2A HTTP compatibility mode maps unsupported flat file media to A2A content-type errors", async () => {
  const response = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: { authorization: "Bearer local-a2a-token" },
    body: {
      message: {
        messageId: "msg-unsupported-media",
        role: "ROLE_USER",
        parts: [{
          raw: "dGNr",
          mediaType: "application/x-unsupported-tck-type",
        }],
      },
    },
  }, {
    store: new LocalA2ATaskStore(),
    taskAuthToken: "local-a2a-token",
    standardsBodyMode: "a2a",
    allowUnmanifestedTasks: true,
    now: () => now,
  });

  assert.equal(response.status, 415);
  assertA2AError(response.body, 415, "A2A_CONTENT_TYPE_NOT_SUPPORTED", "CONTENT_TYPE_NOT_SUPPORTED");
});

test("local A2A HTTP compatibility mode rejects unsupported request content types", async () => {
  const response = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: {
      authorization: "Bearer local-a2a-token",
      "content-type": "text/plain",
    },
    body: JSON.stringify({
      message: {
        messageId: "msg-unsupported-request-content-type",
        role: "ROLE_USER",
        parts: [{ text: "Wrong envelope media type." }],
      },
    }),
  }, {
    store: new LocalA2ATaskStore(),
    taskAuthToken: "local-a2a-token",
    standardsBodyMode: "a2a",
    allowUnmanifestedTasks: true,
    now: () => now,
  });

  assert.equal(response.status, 415);
  assertA2AError(response.body, 415, "A2A_CONTENT_TYPE_NOT_SUPPORTED", "CONTENT_TYPE_NOT_SUPPORTED");
});

test("local A2A HTTP subscribe route reports missing tasks with AIP-193 not found errors", async () => {
  const response = await handleLocalA2AHttpRequest({
    method: "POST",
    path: "/tasks/task_missing:subscribe",
    headers: { authorization: "Bearer local-a2a-token" },
  }, {
    store: new LocalA2ATaskStore(),
    taskAuthToken: "local-a2a-token",
    standardsBodyMode: "a2a",
    allowUnmanifestedTasks: true,
    now: () => now,
  });

  assert.equal(response.status, 404);
  assertA2AError(response.body, 404, "A2A_TASK_NOT_FOUND", "TASK_NOT_FOUND");
});

test("local A2A HTTP compatibility mode rejects terminal task subscribe attempts", async () => {
  const store = new LocalA2ATaskStore();
  const options = {
    store,
    taskAuthToken: "local-a2a-token",
    standardsBodyMode: "a2a" as const,
    allowUnmanifestedTasks: true,
    now: () => now,
  };
  const auth = { authorization: "Bearer local-a2a-token" };
  const sent = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: auth,
    body: {
      message: {
        messageId: "msg-terminal-subscribe",
        role: "ROLE_USER",
        parts: [{ text: "Complete immediately." }],
      },
    },
  }, options);
  assertA2ASendTaskResponse(sent);

  const subscribed = await handleLocalA2AHttpRequest({
    method: "POST",
    path: `/tasks/${encodeURIComponent(sent.body.task.id)}:subscribe`,
    headers: auth,
  }, options);

  assert.equal(subscribed.status, 409);
  assertA2AError(subscribed.body, 409, "A2A_TASK_TERMINAL", "INVALID_REQUEST");
});

test("local A2A HTTP compatibility mode maps unsupported push config to the official 400 status", async () => {
  const response = await handleLocalA2AHttpRequest({
    method: "POST",
    path: "/tasks/task_without_push/pushNotificationConfigs",
    headers: { authorization: "Bearer local-a2a-token" },
    body: {
      url: "https://client.example.test/a2a/push",
    },
  }, {
    store: new LocalA2ATaskStore(),
    taskAuthToken: "local-a2a-token",
    standardsBodyMode: "a2a",
    allowUnmanifestedTasks: true,
    now: () => now,
  });

  assert.equal(response.status, 400);
  assertA2AError(response.body, 400, "A2A_PUSH_NOTIFICATION_NOT_SUPPORTED", "PUSH_NOTIFICATION_NOT_SUPPORTED");
});

test("local A2A HTTP handler manages push notification configs without storing webhook credentials", async () => {
  const store = new LocalA2ATaskStore();
  const pushNotificationStore = new LocalA2APushNotificationStore();
  const options = {
    store,
    pushNotificationStore,
    taskAuthToken: "local-a2a-token",
    taskPolicy: policy,
    now: () => now,
  };
  const auth = { authorization: "Bearer local-a2a-token" };
  const sent = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: auth,
    body: sendBody("msg-push-config"),
  }, options);
  assertTaskResponse(sent);
  const taskId = sent.body.task.id;

  const created = await handleLocalA2AHttpRequest({
    method: "POST",
    path: `/tasks/${encodeURIComponent(taskId)}/pushNotificationConfigs`,
    headers: auth,
    body: {
      id: "push-demo-1",
      url: "https://client.example.test/a2a/push",
      authentication: { scheme: "Bearer" },
    },
  }, options);
  assertPushConfigResponse(created);

  const listed = await handleLocalA2AHttpRequest({
    method: "GET",
    path: `/tasks/${encodeURIComponent(taskId)}/pushNotificationConfigs`,
    headers: auth,
  }, options);
  const fetched = await handleLocalA2AHttpRequest({
    method: "GET",
    path: `/tasks/${encodeURIComponent(taskId)}/pushNotificationConfigs/push-demo-1`,
    headers: auth,
  }, options);
  const deleted = await handleLocalA2AHttpRequest({
    method: "DELETE",
    path: `/tasks/${encodeURIComponent(taskId)}/pushNotificationConfigs/push-demo-1`,
    headers: auth,
  }, options);

  assert.equal(created.body.config.id, "push-demo-1");
  assert.equal(created.body.config.taskId, taskId);
  assert.equal(created.body.config.url, "https://client.example.test/a2a/push");
  assert.equal(created.body.config.createdAt, now.toISOString());
  assert.deepEqual(created.body.config.authentication, { schemes: ["Bearer"] });
  assertPushConfigListResponse(listed);
  assert.equal(listed.body.configs.length, 1);
  assertPushConfigResponse(fetched);
  assert.equal(fetched.body.config.id, "push-demo-1");
  assertPushConfigDeletedResponse(deleted);
  assert.equal(deleted.body.kind, "push-config-deleted");
  assertPushConfigSafeJson(created);
  assertPushConfigSafeJson(listed);
  assertPushConfigSafeJson(fetched);
  assertPushConfigSafeJson(deleted);
});

test("local A2A HTTP handler dispatches local push delivery through injected transport", async () => {
  const store = new LocalA2ATaskStore();
  const pushNotificationStore = new LocalA2APushNotificationStore();
  const captured: A2APushNotificationDeliveryRequest[] = [];
  const options = {
    store,
    pushNotificationStore,
    pushNotificationTransport: (request: A2APushNotificationDeliveryRequest) => {
      captured.push(request);
      return { status: 202 };
    },
    taskAuthToken: "local-a2a-token",
    taskPolicy: policy,
    now: () => now,
    processMessage: () => ({
      state: "TASK_STATE_WORKING" as const,
      artifacts: [{
        artifactId: "push-delivery-draft",
        parts: [{ text: "private prompt: Bearer abc.def.ghi" }],
      }],
    }),
  };
  const auth = { authorization: "Bearer local-a2a-token" };
  const sent = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: auth,
    body: sendBody("msg-push-delivery"),
  }, options);
  assertTaskResponse(sent);
  assert.equal(captured.length, 0);
  const taskId = sent.body.task.id;

  const created = await handleLocalA2AHttpRequest({
    method: "POST",
    path: `/tasks/${encodeURIComponent(taskId)}/pushNotificationConfigs`,
    headers: auth,
    body: {
      id: "push-demo-1",
      url: "https://client.example.test/a2a/push",
      authentication: { scheme: "Bearer" },
    },
  }, options);
  const canceled = await handleLocalA2AHttpRequest({
    method: "POST",
    path: `/tasks/${encodeURIComponent(taskId)}:cancel`,
    headers: auth,
  }, options);

  assertPushConfigResponse(created);
  assertTaskResponse(canceled);
  assert.equal(canceled.body.task.status.state, "TASK_STATE_CANCELED");
  assert.equal(captured.length, 1);
  const delivery = captured[0];
  assert.equal(delivery?.method, "POST");
  assert.equal(delivery?.url, "https://client.example.test/a2a/push");
  assert.equal(delivery?.headers.authorization, undefined);
  assert.match(delivery?.headers["content-type"] ?? "", /application\/a2a\+json/);
  assert.equal(delivery?.headers["a2a-version"], A2A_TASK_PROTOCOL_VERSION);
  assert.equal(delivery?.body.kind, "task");
  assert.equal(delivery?.body.task.status.state, "TASK_STATE_CANCELED");
  assert.doesNotMatch(delivery?.json ?? "", /private prompt|Bearer abc|signer_ref|wallet_|payment-secret/i);
});

test("local A2A HTTP push delivery transport failures do not fail task routes", async () => {
  const store = new LocalA2ATaskStore();
  const options = {
    store,
    pushNotificationStore: new LocalA2APushNotificationStore(),
    pushNotificationTransport: () => {
      throw new Error("webhook failed with Bearer should-not-print");
    },
    taskAuthToken: "local-a2a-token",
    taskPolicy: policy,
    now: () => now,
    processMessage: () => ({
      state: "TASK_STATE_WORKING" as const,
    }),
  };
  const auth = { authorization: "Bearer local-a2a-token" };
  const sent = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: auth,
    body: sendBody("msg-push-delivery-failure"),
  }, options);
  assertTaskResponse(sent);
  const taskId = sent.body.task.id;

  await handleLocalA2AHttpRequest({
    method: "POST",
    path: `/tasks/${encodeURIComponent(taskId)}/pushNotificationConfigs`,
    headers: auth,
    body: {
      id: "push-demo-1",
      url: "https://client.example.test/a2a/push",
    },
  }, options);
  const canceled = await handleLocalA2AHttpRequest({
    method: "POST",
    path: `/tasks/${encodeURIComponent(taskId)}:cancel`,
    headers: auth,
  }, options);

  assertTaskResponse(canceled);
  assert.equal(canceled.status, 200);
  assert.equal(canceled.body.task.status.state, "TASK_STATE_CANCELED");
  assert.doesNotMatch(canceled.json, /should-not-print/);
});

test("local A2A HTTP push notification configs fail closed for unsafe URLs and credential storage", async () => {
  const store = new LocalA2ATaskStore();
  const options = {
    store,
    pushNotificationStore: new LocalA2APushNotificationStore(),
    taskAuthToken: "local-a2a-token",
    taskPolicy: policy,
    now: () => now,
  };
  const auth = { authorization: "Bearer local-a2a-token" };
  const sent = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: auth,
    body: sendBody("msg-push-config-denials"),
  }, options);
  assertTaskResponse(sent);
  const taskId = sent.body.task.id;

  const unsafeUrl = await handleLocalA2AHttpRequest({
    method: "POST",
    path: `/tasks/${encodeURIComponent(taskId)}/pushNotificationConfigs`,
    headers: auth,
    body: {
      url: "http://localhost/a2a/push",
    },
  }, options);
  const token = await handleLocalA2AHttpRequest({
    method: "POST",
    path: `/tasks/${encodeURIComponent(taskId)}/pushNotificationConfigs`,
    headers: auth,
    body: {
      url: "https://client.example.test/a2a/push",
      token: "push-secret-token",
    },
  }, options);
  const credentials = await handleLocalA2AHttpRequest({
    method: "POST",
    path: `/tasks/${encodeURIComponent(taskId)}/pushNotificationConfigs`,
    headers: auth,
    body: {
      url: "https://client.example.test/a2a/push",
      authentication: {
        scheme: "Bearer",
        credentials: "Bearer abc.def.ghi",
      },
    },
  }, options);

  assert.equal(unsafeUrl.status, 400);
  assert.equal(token.status, 400);
  assert.equal(credentials.status, 400);
  assert.match(unsafeUrl.json, /A2A_PUSH_URL_UNSAFE/);
  assert.match(token.json, /A2A_PUSH_CREDENTIAL_STORAGE_UNSUPPORTED/);
  assert.match(credentials.json, /A2A_PUSH_CREDENTIAL_STORAGE_UNSUPPORTED/);
  assert.doesNotMatch(token.json, /push-secret-token/);
  assert.doesNotMatch(credentials.json, /abc\.def\.ghi/);
});

test("local A2A HTTP handler returns safe errors without leaking request secrets", async () => {
  const response = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: { authorization: "Bearer wrong-token" },
    body: {
      message: {
        messageId: "msg-secret",
        role: "ROLE_USER",
        parts: [{ text: "private prompt: Bearer abc.def.ghi signer_ref_secret" }],
      },
      manifest: validManifestFixture(),
      protocolVersion: A2A_TASK_PROTOCOL_VERSION,
    },
  }, {
    store: new LocalA2ATaskStore(),
    taskAuthToken: "local-a2a-token",
    taskPolicy: policy,
    now: () => now,
  });

  assert.equal(response.status, 401);
  assert.match(response.headers["content-type"] ?? "", /application\/json/);
  assert.doesNotMatch(response.json, /wrong-token|abc\.def|signer_ref_secret|private prompt/i);
  assert.match(response.json, /A2A_AUTH_REQUIRED/);
});

test("local A2A HTTP handler denies unsupported methods and malformed bodies safely", async () => {
  const options = {
    store: new LocalA2ATaskStore(),
    taskAuthToken: "local-a2a-token",
    taskPolicy: policy,
    now: () => now,
  };
  const auth = { authorization: "Bearer local-a2a-token" };

  const badMethod = await handleLocalA2AHttpRequest({
    method: "DELETE",
    path: A2A_HTTP_TASKS_PATH,
    headers: auth,
  }, options);
  const badBody = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: auth,
    body: "{not json",
  }, options);
  const badVersion = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: { ...auth, "A2A-Version": "0.3" },
    body: sendBody("msg-bad-version"),
  }, options);
  const streaming = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_STREAM_MESSAGE_PATH,
    headers: auth,
    body: sendBody("msg-streaming"),
  }, options);
  const push = await handleLocalA2AHttpRequest({
    method: "POST",
    path: "/tasks/task-1/pushNotificationConfigs",
    headers: auth,
    body: {},
  }, options);

  assert.equal(badMethod.status, 405);
  assert.equal(badMethod.headers.allow, "GET");
  assert.equal(badBody.status, 400);
  assert.equal(badVersion.status, 400);
  assertA2AError(badVersion.body, 400, "A2A_VERSION_NOT_SUPPORTED", "VERSION_NOT_SUPPORTED");
  assert.equal(streaming.status, 501);
  assert.equal(push.status, 501);
  assertSafeJson(badBody);
});

function sendBody(messageId: string) {
  return {
    message: {
      messageId,
      role: "ROLE_USER",
      parts: [{ text: "Run local A2A work." }],
    },
    manifest: validManifestFixture(),
    protocolVersion: A2A_TASK_PROTOCOL_VERSION,
  };
}

function assertA2AError(body: unknown, status: number, reason: string, errorInfoReason: string) {
  assert.ok(isRecord(body));
  assert.ok(isRecord(body.error));
  assert.equal(body.error.code, status);
  assert.equal(body.error.reason, reason);
  const details = body.error.details;
  assert.ok(Array.isArray(details));
  assert.equal(details[0]?.["@type"], "type.googleapis.com/google.rpc.ErrorInfo");
  assert.equal(details[0]?.domain, "a2a-protocol.org");
  assert.equal(details[0]?.reason, errorInfoReason);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function a2aProfileFixture() {
  return {
    ...validAgentProfileFixture(),
    endpoints: [
      { type: "a2a" as const, url: "https://agent.example.test/a2a" },
      ...validAgentProfileFixture().endpoints,
    ],
  };
}

function extendedA2AProfileFixture() {
  const profile = a2aProfileFixture();
  return {
    ...profile,
    metadata: {
      purpose: "extended-card-fixture",
      privateNote: "do-not-emit",
    },
    capabilities: [
      ...profile.capabilities,
      {
        id: "research.deep-dive",
        displayName: "Research deep dive",
        contracts: ["escrow:v1"],
        scopes: ["contract:escrow", "action:open_escrow", "mode:extended"],
        credentialRefs: ["credential:research-deep-dive:v1"],
      },
    ],
  };
}

function assertSafeJson(response: A2AHttpResponse): void {
  assert.doesNotThrow(() => JSON.parse(response.json));
  assert.doesNotMatch(response.json, /not json|Bearer|signer_ref|private prompt/i);
}

function assertPushConfigSafeJson(response: A2AHttpResponse): void {
  assert.doesNotThrow(() => JSON.parse(response.json));
  assert.doesNotMatch(response.json, /not json|push-secret|credentials|signer_ref|private prompt/i);
}

function assertAgentCardResponse(response: A2AHttpResponse): asserts response is A2AHttpResponse & {
  readonly body: Extract<A2AHttpResponse["body"], { readonly kind: "agent-card" }>;
} {
  assert.equal(response.status, 200);
  assert.ok("kind" in response.body && response.body.kind === "agent-card");
}

function agentCardCapabilities(
  response: A2AHttpResponse & { readonly body: Extract<A2AHttpResponse["body"], { readonly kind: "agent-card" }> },
): { readonly extendedAgentCard?: boolean } {
  assert.ok("capabilities" in response.body && typeof response.body.capabilities === "object" && response.body.capabilities !== null);
  return response.body.capabilities as { readonly extendedAgentCard?: boolean };
}

function assertTaskResponse(response: A2AHttpResponse): asserts response is A2AHttpResponse & {
  readonly body: Extract<A2AHttpResponse["body"], { readonly kind: "task" }>;
} {
  assert.equal(response.status, 200);
  assert.ok("kind" in response.body && response.body.kind === "task");
}

function assertTaskListResponse(response: A2AHttpResponse): asserts response is A2AHttpResponse & {
  readonly body: Extract<A2AHttpResponse["body"], { readonly kind: "task-list" }>;
} {
  assert.equal(response.status, 200);
  assert.ok("kind" in response.body && response.body.kind === "task-list");
}

function assertA2ASendTaskResponse(response: A2AHttpResponse): asserts response is A2AHttpResponse & {
  readonly body: { readonly task: A2AHttpA2ATaskBody };
} {
  assert.equal(response.status, 200);
  assert.ok(isRecord(response.body));
  const body = response.body as { readonly task?: unknown };
  assert.ok(isRecord(body.task));
  assert.equal(typeof body.task.id, "string");
  assert.ok(isRecord(body.task.status));
}

function assertA2ASendMessageResponse(response: A2AHttpResponse): asserts response is A2AHttpResponse & {
  readonly body: { readonly message: { readonly role: string; readonly parts: readonly { readonly text?: string }[] } };
} {
  assert.equal(response.status, 200);
  assert.ok(isRecord(response.body));
  const body = response.body as { readonly message?: unknown };
  assert.ok(isRecord(body.message));
  assert.equal(typeof body.message.role, "string");
  assert.ok(Array.isArray(body.message.parts));
}

function assertRawA2ATaskResponse(response: A2AHttpResponse): asserts response is A2AHttpResponse & {
  readonly body: A2AHttpA2ATaskBody;
} {
  assert.equal(response.status, 200);
  assert.ok(isRecord(response.body));
  const body = response.body as Record<string, unknown>;
  assert.equal(typeof body.id, "string");
  assert.ok(isRecord(body.status));
}

function assertRawA2ATaskListResponse(response: A2AHttpResponse): asserts response is A2AHttpResponse & {
  readonly body: {
    readonly tasks: readonly A2AHttpA2ATaskBody[];
    readonly nextPageToken?: string;
    readonly pageSize?: number;
    readonly totalSize?: number;
  };
} {
  assert.equal(response.status, 200);
  assert.ok(isRecord(response.body));
  const body = response.body as { readonly tasks?: unknown };
  assert.ok(Array.isArray(body.tasks));
}

function assertPushConfigResponse(response: A2AHttpResponse): asserts response is A2AHttpResponse & {
  readonly body: Extract<A2AHttpResponse["body"], { readonly kind: "push-config" }>;
} {
  assert.equal(response.status, 200);
  assert.ok("kind" in response.body && response.body.kind === "push-config");
}

function assertPushConfigListResponse(response: A2AHttpResponse): asserts response is A2AHttpResponse & {
  readonly body: Extract<A2AHttpResponse["body"], { readonly kind: "push-config-list" }>;
} {
  assert.equal(response.status, 200);
  assert.ok("kind" in response.body && response.body.kind === "push-config-list");
}

function assertPushConfigDeletedResponse(response: A2AHttpResponse): asserts response is A2AHttpResponse & {
  readonly body: Extract<A2AHttpResponse["body"], { readonly kind: "push-config-deleted" }>;
} {
  assert.equal(response.status, 200);
  assert.ok("kind" in response.body && response.body.kind === "push-config-deleted");
}
