import { validManifestFixture } from "@vallum/manifest";
import type { AgentActionPolicy } from "@vallum/policy-gateway";
import {
  A2A_TASK_PROTOCOL_VERSION,
  LocalA2ATaskStore,
  cancelA2ATask,
  listA2ATasks,
  redactA2ATaskForLog,
  sendA2AMessage,
  type A2ATask,
} from "../../packages/standards/src/index.js";

export interface A2ATaskMessageDemoResult {
  readonly approved: A2ATask;
  readonly denied: A2ATask;
  readonly followUp: A2ATask;
  readonly canceled: A2ATask;
  readonly listedCount: number;
  readonly logLeaksSecretMaterial: boolean;
}

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

export async function runA2ATaskMessageDemo(): Promise<A2ATaskMessageDemoResult> {
  const store = new LocalA2ATaskStore();

  const approved = await sendA2AMessage({
    store,
    protocolVersion: A2A_TASK_PROTOCOL_VERSION,
    message: {
      messageId: "demo-approved",
      role: "ROLE_USER",
      parts: [{ text: "Use private prompt: summarize the escrow quote with Bearer abc.def.ghi" }],
      metadata: {
        signerRef: "signer_ref_demo_secret",
        walletId: "wallet_demo_secret",
        paymentCredential: "payment-secret",
      },
    },
    manifest: validManifestFixture(),
    policy,
    now,
    processMessage: () => ({
      state: "TASK_STATE_COMPLETED",
      artifacts: [{
        artifactId: "demo-artifact-approved",
        name: "summary.txt",
        parts: [{ text: "Escrow quote summary ready." }],
      }],
    }),
  });

  const denied = await sendA2AMessage({
    store,
    protocolVersion: A2A_TASK_PROTOCOL_VERSION,
    message: {
      messageId: "demo-denied",
      role: "ROLE_USER",
      parts: [{ text: "Ask an unknown agent to open escrow." }],
    },
    manifest: {
      ...validManifestFixture(),
      agent: { id: "agent:unknown" },
    },
    policy,
    now,
  });

  const inputRequired = await sendA2AMessage({
    store,
    protocolVersion: A2A_TASK_PROTOCOL_VERSION,
    message: {
      messageId: "demo-input",
      role: "ROLE_USER",
      parts: [{ text: "Prepare a service handoff." }],
    },
    manifest: validManifestFixture(),
    policy,
    now,
    processMessage: () => ({
      state: "TASK_STATE_INPUT_REQUIRED",
      message: {
        messageId: "demo-agent-question",
        role: "ROLE_AGENT",
        parts: [{ text: "Which deliverable hash should be used?" }],
      },
    }),
  });

  const followUp = await sendA2AMessage({
    store,
    protocolVersion: A2A_TASK_PROTOCOL_VERSION,
    message: {
      messageId: "demo-follow-up",
      role: "ROLE_USER",
      taskId: inputRequired.task.id,
      contextId: inputRequired.task.contextId,
      parts: [{ text: "Use sha256:demo." }],
    },
    now,
    processMessage: () => ({
      state: "TASK_STATE_COMPLETED",
      artifacts: [{
        artifactId: "demo-artifact-follow-up",
        parts: [{ text: "Service handoff prepared." }],
      }],
    }),
  });

  const working = await sendA2AMessage({
    store,
    protocolVersion: A2A_TASK_PROTOCOL_VERSION,
    message: {
      messageId: "demo-working",
      role: "ROLE_USER",
      parts: [{ text: "Start cancellable background task." }],
    },
    manifest: validManifestFixture(),
    policy,
    now,
    processMessage: () => ({
      state: "TASK_STATE_WORKING",
      artifacts: [{
        artifactId: "demo-draft",
        parts: [{ text: "draft" }],
      }],
    }),
  });
  const canceled = cancelA2ATask({ store, id: working.task.id, now }).task;
  const listedCount = listA2ATasks({ store }).tasks.length;
  const logSafe = JSON.stringify(redactA2ATaskForLog(approved.task));

  return {
    approved: approved.task,
    denied: denied.task,
    followUp: followUp.task,
    canceled,
    listedCount,
    logLeaksSecretMaterial: /private prompt|Bearer abc|signer_ref_demo_secret|wallet_demo_secret|payment-secret/i.test(logSafe),
  };
}

export function formatA2ATaskMessageDemoResult(result: A2ATaskMessageDemoResult): string {
  return [
    "A2A task/message demo passed",
    `approved.status=${result.approved.status.state}`,
    `denied.status=${result.denied.status.state}`,
    `followUp.status=${result.followUp.status.state}`,
    `canceled.status=${result.canceled.status.state}`,
    `listed.count=${result.listedCount}`,
    `logLeaksSecretMaterial=${String(result.logLeaksSecretMaterial)}`,
  ].join("\n");
}
