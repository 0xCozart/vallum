import { validManifestFixture } from "@iota-gaskit/manifest";
import type { AgentActionPolicy } from "@iota-gaskit/policy-gateway";
import { validAgentProfileFixture } from "@iota-gaskit/registry";
import {
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  A2A_HTTP_EXTENDED_AGENT_CARD_PATH,
  A2A_HTTP_SEND_MESSAGE_PATH,
  A2A_HTTP_TASKS_PATH,
  A2A_TASK_PROTOCOL_VERSION,
  LocalA2APushNotificationStore,
  LocalA2ATaskStore,
  handleLocalA2AHttpRequest,
  type A2AHttpResponse,
} from "../../packages/standards/src/index.js";

export interface A2AHttpDemoResult {
  readonly agentCardStatus: number;
  readonly unauthorizedStatus: number;
  readonly sentStatus: number;
  readonly taskStatus: string;
  readonly hiddenArtifacts: boolean;
  readonly listedCount: number;
  readonly canceledStatus: string;
  readonly extendedAgentCardStatus: number;
  readonly extendedAgentCardSkillCount: number;
  readonly pushConfigStatus: number;
  readonly pushConfigListCount: number;
  readonly pushConfigCredentialRejectionStatus: number;
  readonly logLeaksSecretMaterial: boolean;
}

const now = new Date("2026-06-10T12:00:00.000Z");
const taskAuthToken = "local-a2a-demo-token";

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

export async function runA2AHttpDemo(): Promise<A2AHttpDemoResult> {
  const store = new LocalA2ATaskStore();
  const options = {
    store,
    pushNotificationStore: new LocalA2APushNotificationStore(),
    agentCardProfile: {
      ...validAgentProfileFixture(),
      endpoints: [
        { type: "a2a" as const, url: "https://agent.example.test/a2a" },
        ...validAgentProfileFixture().endpoints,
      ],
    },
    extendedAgentCardProfile: extendedA2AProfileFixture(),
    taskAuthToken,
    taskPolicy: policy,
    now: () => now,
    processMessage: () => ({
      state: "TASK_STATE_WORKING" as const,
      artifacts: [{
        artifactId: "demo-draft",
        parts: [{ text: "draft output" }],
      }],
    }),
  };
  const auth = { authorization: `Bearer ${taskAuthToken}` };

  const agentCard = await handleLocalA2AHttpRequest({
    method: "GET",
    path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
  }, options);
  const unauthorized = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    body: sendBody("demo-unauthorized"),
  }, options);
  const sent = await handleLocalA2AHttpRequest({
    method: "POST",
    path: A2A_HTTP_SEND_MESSAGE_PATH,
    headers: auth,
    body: sendBody("demo-authorized"),
  }, options);
  if (!isTaskResponse(sent)) {
    throw new Error("A2A HTTP demo did not create a task.");
  }

  const task = sent.body.task;
  const hidden = await handleLocalA2AHttpRequest({
    method: "GET",
    path: `/tasks/${encodeURIComponent(task.id)}`,
    headers: auth,
  }, options);
  const listed = await handleLocalA2AHttpRequest({
    method: "GET",
    path: A2A_HTTP_TASKS_PATH,
    headers: auth,
  }, options);
  const canceled = await handleLocalA2AHttpRequest({
    method: "POST",
    path: `/tasks/${encodeURIComponent(task.id)}:cancel`,
    headers: auth,
  }, options);
  const extendedAgentCard = await handleLocalA2AHttpRequest({
    method: "GET",
    path: A2A_HTTP_EXTENDED_AGENT_CARD_PATH,
    headers: auth,
  }, options);
  const pushConfig = await handleLocalA2AHttpRequest({
    method: "POST",
    path: `/tasks/${encodeURIComponent(task.id)}/pushNotificationConfigs`,
    headers: auth,
    body: {
      id: "push-demo-1",
      url: "https://client.example.test/a2a/push",
      authentication: { scheme: "Bearer" },
    },
  }, options);
  const pushConfigList = await handleLocalA2AHttpRequest({
    method: "GET",
    path: `/tasks/${encodeURIComponent(task.id)}/pushNotificationConfigs`,
    headers: auth,
  }, options);
  const pushConfigCredentialRejection = await handleLocalA2AHttpRequest({
    method: "POST",
    path: `/tasks/${encodeURIComponent(task.id)}/pushNotificationConfigs`,
    headers: auth,
    body: {
      id: "push-demo-secret",
      url: "https://client.example.test/a2a/push",
      token: "push-secret-token",
      authentication: {
        scheme: "Bearer",
        credentials: "Bearer push.secret.token",
      },
    },
  }, options);

  return {
    agentCardStatus: agentCard.status,
    unauthorizedStatus: unauthorized.status,
    sentStatus: sent.status,
    taskStatus: task.status.state,
    hiddenArtifacts: !JSON.stringify(hidden.body).includes("demo-draft"),
    listedCount: isTaskListResponse(listed) ? listed.body.tasks.length : 0,
    canceledStatus: isTaskResponse(canceled) ? canceled.body.task.status.state : "unknown",
    extendedAgentCardStatus: extendedAgentCard.status,
    extendedAgentCardSkillCount: isAgentCardResponse(extendedAgentCard) ? agentCardSkillCount(extendedAgentCard.body) : 0,
    pushConfigStatus: pushConfig.status,
    pushConfigListCount: isPushConfigListResponse(pushConfigList) ? pushConfigList.body.configs.length : 0,
    pushConfigCredentialRejectionStatus: pushConfigCredentialRejection.status,
    logLeaksSecretMaterial: responseLeaks(agentCard)
      || responseLeaks(unauthorized)
      || responseLeaks(sent)
      || responseLeaks(hidden)
      || responseLeaks(listed)
      || responseLeaks(canceled)
      || responseLeaks(extendedAgentCard)
      || responseLeaks(pushConfig)
      || responseLeaks(pushConfigList)
      || responseLeaks(pushConfigCredentialRejection),
  };
}

export function formatA2AHttpDemoResult(result: A2AHttpDemoResult): string {
  return [
    "A2A HTTP demo passed",
    `agentCard.status=${result.agentCardStatus}`,
    `unauthorized.status=${result.unauthorizedStatus}`,
    `sent.status=${result.sentStatus}`,
    `task.status=${result.taskStatus}`,
    `hiddenArtifacts=${String(result.hiddenArtifacts)}`,
    `listed.count=${result.listedCount}`,
    `canceled.status=${result.canceledStatus}`,
    `extendedAgentCard.status=${result.extendedAgentCardStatus}`,
    `extendedAgentCard.skillCount=${result.extendedAgentCardSkillCount}`,
    `pushConfig.status=${result.pushConfigStatus}`,
    `pushConfig.listCount=${result.pushConfigListCount}`,
    `pushConfig.credentialRejectionStatus=${result.pushConfigCredentialRejectionStatus}`,
    `logLeaksSecretMaterial=${String(result.logLeaksSecretMaterial)}`,
  ].join("\n");
}

function sendBody(messageId: string) {
  return {
    message: {
      messageId,
      role: "ROLE_USER",
      parts: [{ text: "Use private prompt: run local A2A HTTP work with Bearer abc.def.ghi" }],
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

function extendedA2AProfileFixture() {
  const profile = validAgentProfileFixture();
  return {
    ...profile,
    endpoints: [
      { type: "a2a" as const, url: "https://agent.example.test/a2a" },
      ...profile.endpoints,
    ],
    metadata: {
      purpose: "extended-card-demo",
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

function responseLeaks(response: A2AHttpResponse): boolean {
  return /private prompt|privateNote|Bearer abc|push-secret-token|push\.secret|signer_ref_demo_secret|wallet_demo_secret|payment-secret|credential:research/i.test(response.json);
}

function isAgentCardResponse(response: A2AHttpResponse): response is A2AHttpResponse & {
  readonly body: Extract<A2AHttpResponse["body"], { readonly kind: "agent-card" }>;
} {
  return response.status === 200 && "kind" in response.body && response.body.kind === "agent-card";
}

function agentCardSkillCount(body: Extract<A2AHttpResponse["body"], { readonly kind: "agent-card" }>): number {
  return Array.isArray(body.skills) ? body.skills.length : 0;
}

function isTaskResponse(response: A2AHttpResponse): response is A2AHttpResponse & {
  readonly body: Extract<A2AHttpResponse["body"], { readonly kind: "task" }>;
} {
  return response.status === 200 && "kind" in response.body && response.body.kind === "task";
}

function isTaskListResponse(response: A2AHttpResponse): response is A2AHttpResponse & {
  readonly body: Extract<A2AHttpResponse["body"], { readonly kind: "task-list" }>;
} {
  return response.status === 200 && "kind" in response.body && response.body.kind === "task-list";
}

function isPushConfigListResponse(response: A2AHttpResponse): response is A2AHttpResponse & {
  readonly body: Extract<A2AHttpResponse["body"], { readonly kind: "push-config-list" }>;
} {
  return response.status === 200 && "kind" in response.body && response.body.kind === "push-config-list";
}
