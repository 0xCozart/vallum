import { generateKeyPairSync } from "node:crypto";

import { validManifestFixture } from "@iota-gaskit/manifest";
import type { AgentActionPolicy } from "@iota-gaskit/policy-gateway";
import { validAgentProfileFixture } from "@iota-gaskit/registry";
import {
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  A2A_HTTP_SEND_MESSAGE_PATH,
  A2A_HTTP_STREAM_MESSAGE_PATH,
  A2A_HTTP_TASKS_PATH,
  A2A_TASK_PROTOCOL_VERSION,
  LocalA2ATaskStore,
  startLocalA2ANodeServer,
  verifyA2AAgentCardSignature,
  type SignedA2AAgentCard,
} from "../../packages/standards/src/index.js";

export interface A2ALocalServerDemoResult {
  readonly boundToLoopback: boolean;
  readonly agentCardStatus: number;
  readonly signatureVerified: boolean;
  readonly unauthorizedStatus: number;
  readonly sentStatus: number;
  readonly taskStatus: string;
  readonly hiddenArtifacts: boolean;
  readonly listedCount: number;
  readonly canceledStatus: string;
  readonly streamingStatus: number;
  readonly streamingEventCount: number;
  readonly streamingTaskStatus: string;
  readonly logLeaksSecretMaterial: boolean;
}

interface HttpJsonResponse {
  readonly status: number;
  readonly body: unknown;
  readonly text: string;
}

interface HttpTextResponse {
  readonly status: number;
  readonly text: string;
}

interface SseEvent {
  readonly event?: string;
  readonly data: unknown;
}

const now = new Date("2026-06-10T12:00:00.000Z");
const taskAuthToken = "local-a2a-server-demo-token";

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

export async function runA2ALocalServerDemo(): Promise<A2ALocalServerDemoResult> {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const store = new LocalA2ATaskStore();
  const server = await startLocalA2ANodeServer({
    store,
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
      signature: {
        keyId: "agent-card-key-1",
        privateKey,
        jwksUrl: "https://agent.example.test/.well-known/jwks.json",
        signedAt: now,
        expiresAt: new Date("2026-06-10T13:00:00.000Z"),
      },
    },
    taskAuthToken,
    taskPolicy: policy,
    now: () => now,
    processMessage: () => ({
      state: "TASK_STATE_WORKING" as const,
      artifacts: [{
        artifactId: "server-demo-draft",
        parts: [{ text: "draft output" }],
      }],
    }),
  });

  const auth = { authorization: `Bearer ${taskAuthToken}` };

  try {
    const agentCard = await requestJson(server.baseUrl, A2A_AGENT_CARD_WELL_KNOWN_PATH);
    const verified = verifyA2AAgentCardSignature(agentCard.body as SignedA2AAgentCard, {
      requiredKeyId: "agent-card-key-1",
      trustedKeys: { "agent-card-key-1": publicKey },
      now: new Date("2026-06-10T12:05:00.000Z"),
    });
    const unauthorized = await requestJson(server.baseUrl, A2A_HTTP_SEND_MESSAGE_PATH, {
      method: "POST",
      body: sendBody("demo-unauthorized"),
    });
    const sent = await requestJson(server.baseUrl, A2A_HTTP_SEND_MESSAGE_PATH, {
      method: "POST",
      headers: auth,
      body: sendBody("demo-authorized"),
    });
    const task = taskFrom(sent.body);
    const hidden = await requestJson(server.baseUrl, `/tasks/${encodeURIComponent(task.id)}`, {
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
      body: sendBody("demo-streaming"),
    });
    const streamingEvents = parseSseEvents(streaming.text);
    const streamingTask = taskFrom(streamingEvents.at(-1)?.data);
    const captured = [
      agentCard,
      unauthorized,
      sent,
      hidden,
      listed,
      canceled,
      streaming,
    ];

    return {
      boundToLoopback: server.boundToLoopback,
      agentCardStatus: agentCard.status,
      signatureVerified: verified.ok,
      unauthorizedStatus: unauthorized.status,
      sentStatus: sent.status,
      taskStatus: task.status?.state ?? "unknown",
      hiddenArtifacts: !JSON.stringify(hidden.body).includes("server-demo-draft"),
      listedCount: taskListFrom(listed.body).length,
      canceledStatus: taskFrom(canceled.body).status?.state ?? "unknown",
      streamingStatus: streaming.status,
      streamingEventCount: streamingEvents.length,
      streamingTaskStatus: streamingTask.status?.state ?? "unknown",
      logLeaksSecretMaterial: captured.some((response) => responseLeaks(response.text)),
    };
  } finally {
    await server.close();
  }
}

export function formatA2ALocalServerDemoResult(result: A2ALocalServerDemoResult): string {
  return [
    "A2A local server demo passed",
    `boundToLoopback=${result.boundToLoopback}`,
    `agentCard.status=${result.agentCardStatus}`,
    `signatureVerified=${result.signatureVerified}`,
    `unauthorized.status=${result.unauthorizedStatus}`,
    `sent.status=${result.sentStatus}`,
    `task.status=${result.taskStatus}`,
    `hiddenArtifacts=${String(result.hiddenArtifacts)}`,
    `listed.count=${result.listedCount}`,
    `canceled.status=${result.canceledStatus}`,
    `streaming.status=${result.streamingStatus}`,
    `streaming.events=${result.streamingEventCount}`,
    `streaming.taskStatus=${result.streamingTaskStatus}`,
    `logLeaksSecretMaterial=${String(result.logLeaksSecretMaterial)}`,
  ].join("\n");
}

async function requestJson(
  baseUrl: string,
  path: string,
  init: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: unknown;
  } = {},
): Promise<HttpJsonResponse> {
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
): Promise<HttpTextResponse> {
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

function taskFrom(value: unknown): {
  readonly id: string;
  readonly status?: { readonly state?: string };
} {
  if (!isRecord(value) || !isRecord(value.task) || typeof value.task.id !== "string") {
    throw new Error("A2A local server did not return a task response.");
  }
  return value.task as { readonly id: string; readonly status?: { readonly state?: string } };
}

function taskListFrom(value: unknown): readonly unknown[] {
  if (!isRecord(value) || !Array.isArray(value.tasks)) return [];
  return value.tasks;
}

function responseLeaks(text: string): boolean {
  return /private prompt|Bearer abc|signer_ref_demo_secret|wallet_demo_secret|payment-secret|PRIVATE KEY|BEGIN PRIVATE/i.test(text);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
