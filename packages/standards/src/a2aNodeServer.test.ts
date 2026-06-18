import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";

import { validManifestFixture } from "@vallum/manifest";
import type { AgentActionPolicy } from "@vallum/policy-gateway";
import { A2A_JWKS_WELL_KNOWN_PATH, validAgentProfileFixture } from "@vallum/registry";

import {
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  A2A_HTTP_SEND_MESSAGE_PATH,
  A2A_HTTP_STREAM_MESSAGE_PATH,
  A2A_HTTP_TASKS_PATH,
  A2A_TASK_PROTOCOL_VERSION,
  LocalA2ATaskStore,
  startLocalA2ANodeServer,
} from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");
const taskAuthToken = "local-a2a-node-server-token";

interface SseEvent {
  readonly event?: string;
  readonly data: unknown;
}

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

test("local A2A Node server serves Agent Card and authorized task routes over loopback HTTP", async () => {
  const server = await startLocalA2ANodeServer({
    ...serverOptions(),
    processMessage: () => ({
      state: "TASK_STATE_WORKING" as const,
      artifacts: [{
        artifactId: "node-server-draft",
        parts: [{ text: "draft output" }],
      }],
    }),
  });
  const auth = { authorization: `Bearer ${taskAuthToken}` };

  try {
    assert.equal(server.boundToLoopback, true);
    assert.equal(server.host, "127.0.0.1");

    const agentCard = await requestJson(server.baseUrl, A2A_AGENT_CARD_WELL_KNOWN_PATH);
    const unauthorized = await requestJson(server.baseUrl, A2A_HTTP_SEND_MESSAGE_PATH, {
      method: "POST",
      body: sendBody("msg-unauthorized"),
    });
    const sent = await requestJson(server.baseUrl, A2A_HTTP_SEND_MESSAGE_PATH, {
      method: "POST",
      headers: auth,
      body: sendBody("msg-authorized"),
    });
    const task = taskFrom(sent.body);
    const hidden = await requestJson(server.baseUrl, `/tasks/${encodeURIComponent(task.id)}`, {
      headers: auth,
    });
    const visible = await requestJson(server.baseUrl, `/tasks/${encodeURIComponent(task.id)}?includeArtifacts=true`, {
      headers: auth,
    });
    const listed = await requestJson(server.baseUrl, A2A_HTTP_TASKS_PATH, {
      headers: auth,
    });
    const canceled = await requestJson(server.baseUrl, `/tasks/${encodeURIComponent(task.id)}:cancel`, {
      method: "POST",
      headers: auth,
    });
    const streaming = await requestText(server.baseUrl, A2A_HTTP_STREAM_MESSAGE_PATH, {
      method: "POST",
      headers: auth,
      body: sendBody("msg-stream"),
    });
    const streamingEvents = parseSseEvents(streaming.text);
    const streamedTask = taskFrom(streamingEvents.at(-1)?.data);

    assert.equal(agentCard.status, 200);
    assert.match(agentCard.headers.get("content-type") ?? "", /application\/a2a\+json/);
    assert.equal(agentCardCapabilities(agentCard.body).streaming, true);
    assert.equal(agentCardCapabilities(agentCard.body).pushNotifications, false);
    assert.equal(unauthorized.status, 401);
    assert.equal(sent.status, 200);
    assert.equal(task.status?.state, "TASK_STATE_WORKING");
    assert.doesNotMatch(hidden.text, /node-server-draft/);
    assert.match(visible.text, /node-server-draft/);
    assert.equal(taskListFrom(listed.body).length, 1);
    assert.equal(taskFrom(canceled.body).status?.state, "TASK_STATE_CANCELED");
    assert.equal(streaming.status, 200);
    assert.match(streaming.headers.get("content-type") ?? "", /text\/event-stream/);
    assert.equal(streamingEvents.length, 1);
    assert.equal(streamingEvents[0]?.event, "task");
    assert.equal(streamedTask.status?.state, "TASK_STATE_WORKING");
    for (const response of [agentCard, unauthorized, sent, hidden, visible, listed, canceled, streaming]) {
      assertSafeResponse(response.text);
    }
  } finally {
    await server.close();
  }
});

test("local A2A Node server serves public JWKS only when explicitly configured", async () => {
  const { publicKey } = generateKeyPairSync("ed25519");
  const server = await startLocalA2ANodeServer({
    ...serverOptions(),
    publicJwks: {
      keys: [{ keyId: "agent-card-key-1", publicKey }],
      cacheControl: "public, max-age=60",
    },
  });
  const unconfigured = await startLocalA2ANodeServer(serverOptions());

  try {
    const jwks = await requestJson(server.baseUrl, A2A_JWKS_WELL_KNOWN_PATH);
    const unavailable = await requestJson(unconfigured.baseUrl, A2A_JWKS_WELL_KNOWN_PATH);
    const wrongMethod = await requestText(server.baseUrl, A2A_JWKS_WELL_KNOWN_PATH, { method: "POST" });

    assert.equal(jwks.status, 200);
    assert.match(jwks.headers.get("content-type") ?? "", /application\/jwk-set\+json/);
    assert.equal(jwks.headers.get("cache-control"), "public, max-age=60");
    assert.equal(jwksBody(jwks.body).keys[0]?.kid, "agent-card-key-1");
    assert.equal(jwksBody(jwks.body).keys[0]?.alg, "EdDSA");
    assert.equal(unavailable.status, 404);
    assert.match(unavailable.text, /A2A_JWKS_UNAVAILABLE/);
    assert.equal(wrongMethod.status, 405);
    assert.doesNotMatch(`${jwks.text}\n${unavailable.text}\n${wrongMethod.text}`, /"d"|"p"|"q"|private|secret|mnemonic|seed|Bearer abc|signer_ref/i);
  } finally {
    await server.close();
    await unconfigured.close();
  }
});

test("local A2A Node server streams task subscribe events in official A2A compatibility mode", async () => {
  const server = await startLocalA2ANodeServer({
    ...serverOptions(),
    standardsBodyMode: "a2a",
    allowUnmanifestedTasks: true,
    processMessage: ({ message }) => message.taskId
      ? {
          state: "TASK_STATE_COMPLETED" as const,
          artifacts: [{
            artifactId: "node-subscribe-terminal",
            parts: [{ text: "done" }],
          }],
        }
      : {
          state: "TASK_STATE_INPUT_REQUIRED" as const,
        },
  });
  const auth = { authorization: `Bearer ${taskAuthToken}` };

  try {
    const sent = await requestJson(server.baseUrl, A2A_HTTP_SEND_MESSAGE_PATH, {
      method: "POST",
      headers: auth,
      body: {
        message: {
          messageId: "msg-subscribe-a2a",
          role: "ROLE_USER",
          parts: [{ text: "Run official A2A server work." }],
        },
      },
    });
    const task = sendTaskFrom(sent.body);
    const subscribedPromise = requestText(server.baseUrl, `/tasks/${encodeURIComponent(task.id)}:subscribe`, {
      method: "POST",
      headers: auth,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const completed = await requestJson(server.baseUrl, A2A_HTTP_SEND_MESSAGE_PATH, {
      method: "POST",
      headers: auth,
      body: {
        message: {
          messageId: "msg-subscribe-a2a-complete",
          role: "ROLE_USER",
          taskId: task.id,
          parts: [{ text: "Complete." }],
        },
      },
    });
    const subscribed = await subscribedPromise;
    const events = parseSseEvents(subscribed.text);
    const firstUpdate = streamStatusUpdateFrom(events[0]?.data);
    const lastUpdate = streamStatusUpdateFrom(events.at(-1)?.data);

    assert.equal(sent.status, 200);
    assert.equal(completed.status, 200);
    assert.equal(subscribed.status, 200);
    assert.match(subscribed.headers.get("content-type") ?? "", /text\/event-stream/);
    assert.equal(events[0]?.event, "task");
    assert.equal(firstUpdate.taskId, task.id);
    assert.equal(firstUpdate.status?.state, "TASK_STATE_INPUT_REQUIRED");
    assert.equal(lastUpdate.taskId, task.id);
    assert.equal(lastUpdate.status?.state, "TASK_STATE_COMPLETED");
    assert.doesNotMatch(`${sent.text}\n${completed.text}\n${subscribed.text}`, /agenticVallum|policyDecision|\"kind\"/);
    assertSafeResponse(`${sent.text}\n${completed.text}\n${subscribed.text}`);
  } finally {
    await server.close();
  }
});

test("local A2A Node server refuses non-loopback hosts unless explicitly opted in", async () => {
  await assert.rejects(
    () => startLocalA2ANodeServer({
      ...serverOptions(),
      host: "0.0.0.0",
    }),
    /refuses non-loopback hosts/,
  );
});

test("local A2A Node server returns safe JSON errors for malformed and oversized bodies", async () => {
  const server = await startLocalA2ANodeServer({
    ...serverOptions(),
    maxBodyBytes: 16,
  });
  const auth = { authorization: `Bearer ${taskAuthToken}` };

  try {
    const malformed = await fetch(`${server.baseUrl}${A2A_HTTP_SEND_MESSAGE_PATH}`, {
      method: "POST",
      headers: {
        ...auth,
        "content-type": "application/json",
      },
      body: "{not json",
    });
    const tooLarge = await fetch(`${server.baseUrl}${A2A_HTTP_SEND_MESSAGE_PATH}`, {
      method: "POST",
      headers: {
        ...auth,
        "content-type": "application/json",
      },
      body: JSON.stringify(sendBody("msg-too-large")),
    });
    const malformedText = await malformed.text();
    const tooLargeText = await tooLarge.text();

    assert.equal(malformed.status, 400);
    assert.equal(tooLarge.status, 413);
    assert.match(malformedText, /A2A_BODY_INVALID|A2A_MESSAGE_INVALID/);
    assert.match(tooLargeText, /A2A_BODY_TOO_LARGE/);
    assertSafeResponse(malformedText);
    assertSafeResponse(tooLargeText);
  } finally {
    await server.close();
  }
});

function serverOptions() {
  return {
    store: new LocalA2ATaskStore(),
    agentCardProfile: {
      ...validAgentProfileFixture(),
      endpoints: [
        { type: "a2a" as const, url: "http://127.0.0.1/a2a" },
        ...validAgentProfileFixture().endpoints,
      ],
    },
    agentCardOptions: {
      now,
      capabilities: {
        streaming: true,
        pushNotifications: false,
      },
    },
    taskAuthToken,
    taskPolicy: policy,
    now: () => now,
  };
}

function sendBody(messageId: string) {
  return {
    message: {
      messageId,
      role: "ROLE_USER",
      parts: [{ text: "Use private prompt: run local A2A server work with Bearer abc.def.ghi" }],
      metadata: {
        signerRef: "signer_ref_demo_secret",
        walletId: "wallet_demo_secret",
        paymentCredential: "payment-secret",
      },
    },
    manifest: validManifestFixture(),
    protocolVersion: A2A_TASK_PROTOCOL_VERSION,
  };
}

async function requestJson(
  baseUrl: string,
  path: string,
  init: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: unknown;
  } = {},
): Promise<{
  readonly status: number;
  readonly headers: Headers;
  readonly body: unknown;
  readonly text: string;
}> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      ...init.headers,
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: JSON.parse(text) as unknown,
    text,
  };
}

async function requestText(
  baseUrl: string,
  path: string,
  init: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: unknown;
  } = {},
): Promise<{
  readonly status: number;
  readonly headers: Headers;
  readonly text: string;
}> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      ...init.headers,
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return {
    status: response.status,
    headers: response.headers,
    text: await response.text(),
  };
}

function parseSseEvents(text: string): readonly SseEvent[] {
  return text.trim().split(/\n\n+/)
    .map((chunk): SseEvent | undefined => {
      const event = chunk.split("\n")
        .find((line) => line.startsWith("event: "))
        ?.slice("event: ".length);
      const data = chunk.split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice("data: ".length))
        .join("\n");
      return data.trim() === ""
        ? undefined
        : { ...(event ? { event } : {}), data: JSON.parse(data) as unknown };
    })
    .filter((event): event is SseEvent => event !== undefined);
}

function jwksBody(value: unknown): { readonly keys: readonly Record<string, unknown>[] } {
  assert.ok(typeof value === "object" && value !== null && "keys" in value);
  const keys = (value as { readonly keys: unknown }).keys;
  assert.ok(Array.isArray(keys));
  return { keys: keys as readonly Record<string, unknown>[] };
}

function taskFrom(value: unknown): {
  readonly id: string;
  readonly status?: { readonly state?: string };
} {
  if (!isRecord(value) || !isRecord(value.task) || typeof value.task.id !== "string") {
    throw new Error("A2A local Node server did not return a task response.");
  }
  return value.task as { readonly id: string; readonly status?: { readonly state?: string } };
}

function rawTaskFrom(value: unknown): {
  readonly id: string;
  readonly status?: { readonly state?: string };
} {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("A2A local Node server did not return a raw task response.");
  }
  return value as { readonly id: string; readonly status?: { readonly state?: string } };
}

function sendTaskFrom(value: unknown): {
  readonly id: string;
  readonly status?: { readonly state?: string };
} {
  if (!isRecord(value) || !isRecord(value.task)) {
    throw new Error("A2A local Node server did not return a send task response.");
  }
  return rawTaskFrom(value.task);
}

function streamStatusUpdateFrom(value: unknown): {
  readonly taskId: string;
  readonly status?: { readonly state?: string };
} {
  if (!isRecord(value) || !isRecord(value.status_update) || typeof value.status_update.taskId !== "string") {
    throw new Error("A2A local Node server did not return a stream status update.");
  }
  return value.status_update as { readonly taskId: string; readonly status?: { readonly state?: string } };
}

function taskListFrom(value: unknown): readonly unknown[] {
  if (!isRecord(value) || !Array.isArray(value.tasks)) return [];
  return value.tasks;
}

function agentCardCapabilities(value: unknown): { readonly streaming?: boolean; readonly pushNotifications?: boolean } {
  if (!isRecord(value) || !isRecord(value.capabilities)) {
    throw new Error("A2A local Node server did not return Agent Card capabilities.");
  }
  return value.capabilities;
}

function assertSafeResponse(text: string): void {
  assert.doesNotMatch(
    text,
    /private prompt|Bearer abc|signer_ref_demo_secret|wallet_demo_secret|payment-secret|PRIVATE KEY|BEGIN PRIVATE/i,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
