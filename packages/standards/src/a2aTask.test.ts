import assert from "node:assert/strict";
import { test } from "node:test";

import { validManifestFixture } from "@sacredlabs/agentrail-manifest";
import type { AgentActionPolicy } from "@sacredlabs/agentrail-policy-gateway";

import {
  A2A_TASK_PROTOCOL_VERSION,
  LocalA2ATaskStore,
  cancelA2ATask,
  getA2ATask,
  listA2ATasks,
  redactA2ATaskForLog,
  sendA2AMessage,
  type A2AMessage,
} from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");

const basePolicy: AgentActionPolicy = {
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

test("local A2A send message creates a policy-approved completed task with artifact output", async () => {
  const store = new LocalA2ATaskStore();
  const result = await sendA2AMessage({
    store,
    protocolVersion: A2A_TASK_PROTOCOL_VERSION,
    message: userMessage("msg-1", "Summarize the escrow quote."),
    manifest: validManifestFixture(),
    policy: basePolicy,
    now,
    processMessage: ({ task }) => ({
      state: "TASK_STATE_COMPLETED",
      artifacts: [{
        artifactId: "artifact-1",
        name: "summary.txt",
        parts: [{ text: `Completed ${task.id}` }],
      }],
    }),
  });

  assert.equal(result.task.status.state, "TASK_STATE_COMPLETED");
  assert.equal(result.task.history[0]?.messageId, "msg-1");
  assert.equal(result.task.artifacts?.[0]?.name, "summary.txt");
  assert.ok(result.policyDecision);
  assert.equal(result.policyDecision.allowed, true);

  const stored = getA2ATask({ store, id: result.task.id, includeArtifacts: true });
  assert.equal(stored.task.artifacts?.[0]?.artifactId, "artifact-1");
});

test("local A2A send message fails closed for unsupported protocol versions and invalid message parts", async () => {
  const store = new LocalA2ATaskStore();

  await assert.rejects(
    () => sendA2AMessage({
      store,
      protocolVersion: "0.5",
      message: userMessage("msg-1", "Hello"),
      manifest: validManifestFixture(),
      policy: basePolicy,
      now,
    }),
    { name: "A2ATaskError", code: "A2A_VERSION_NOT_SUPPORTED" },
  );

  await assert.rejects(
    () => sendA2AMessage({
      store,
      protocolVersion: A2A_TASK_PROTOCOL_VERSION,
      message: { messageId: "msg-2", role: "ROLE_USER", parts: [] },
      manifest: validManifestFixture(),
      policy: basePolicy,
      now,
    }),
    { name: "A2ATaskError", code: "A2A_MESSAGE_INVALID" },
  );

  await assert.rejects(
    () => sendA2AMessage({
      store,
      protocolVersion: A2A_TASK_PROTOCOL_VERSION,
      message: { ...userMessage("msg-3", "Hello"), contextId: " " },
      manifest: validManifestFixture(),
      policy: basePolicy,
      now,
    }),
    { name: "A2ATaskError", code: "A2A_MESSAGE_INVALID" },
  );
});

test("policy-denied A2A tasks are rejected without artifacts or sponsored results", async () => {
  const store = new LocalA2ATaskStore();
  const result = await sendA2AMessage({
    store,
    protocolVersion: A2A_TASK_PROTOCOL_VERSION,
    message: userMessage("msg-denied", "Open an escrow."),
    manifest: {
      ...validManifestFixture(),
      agent: { id: "agent:unknown" },
    },
    policy: basePolicy,
    now,
    processMessage: () => {
      throw new Error("processor must not run after policy denial");
    },
  });

  assert.equal(result.task.status.state, "TASK_STATE_REJECTED");
  assert.equal(result.task.artifacts, undefined);
  assert.ok(result.policyDecision);
  assert.equal(result.policyDecision.allowed, false);
  assert.equal(result.policyDecision.reasonCode, "UNKNOWN_AGENT");
});

test("input-required A2A tasks accept matching follow-up messages and reject terminal continuations", async () => {
  const store = new LocalA2ATaskStore();
  const first = await sendA2AMessage({
    store,
    protocolVersion: A2A_TASK_PROTOCOL_VERSION,
    message: userMessage("msg-1", "Book a contract review."),
    manifest: validManifestFixture(),
    policy: basePolicy,
    now,
    processMessage: () => ({
      state: "TASK_STATE_INPUT_REQUIRED",
      message: agentMessage("agent-msg-1", "Which deliverable hash should I use?"),
    }),
  });

  assert.equal(first.task.status.state, "TASK_STATE_INPUT_REQUIRED");

  const followUp = await sendA2AMessage({
    store,
    protocolVersion: A2A_TASK_PROTOCOL_VERSION,
    message: {
      ...userMessage("msg-2", "Use sha256:abc123."),
      taskId: first.task.id,
      contextId: first.task.contextId,
    },
    now,
    processMessage: () => ({
      state: "TASK_STATE_COMPLETED",
      artifacts: [{
        artifactId: "artifact-2",
        parts: [{ text: "Contract review booked." }],
      }],
    }),
  });

  assert.equal(followUp.task.status.state, "TASK_STATE_COMPLETED");
  assert.equal(followUp.task.history.map((message) => message.messageId).join(","), "msg-1,agent-msg-1,msg-2");

  await assert.rejects(
    () => sendA2AMessage({
      store,
      protocolVersion: A2A_TASK_PROTOCOL_VERSION,
      message: {
        ...userMessage("msg-3", "One more thing."),
        taskId: first.task.id,
        contextId: first.task.contextId,
      },
      now,
    }),
    { name: "A2ATaskError", code: "A2A_TASK_TERMINAL" },
  );
});

test("get/list/cancel preserve A2A task state and omit artifacts unless requested", async () => {
  const store = new LocalA2ATaskStore();
  const result = await sendA2AMessage({
    store,
    protocolVersion: A2A_TASK_PROTOCOL_VERSION,
    message: userMessage("msg-1", "Start long running work."),
    manifest: validManifestFixture(),
    policy: basePolicy,
    now,
    processMessage: () => ({
      state: "TASK_STATE_WORKING",
      artifacts: [{
        artifactId: "draft-1",
        parts: [{ text: "draft" }],
      }],
    }),
  });

  assert.equal(getA2ATask({ store, id: result.task.id }).task.artifacts, undefined);
  assert.equal(getA2ATask({ store, id: result.task.id, includeArtifacts: true }).task.artifacts?.length, 1);

  const listed = listA2ATasks({ store, contextId: result.task.contextId });
  assert.equal(listed.tasks.length, 1);
  assert.equal(listed.tasks[0]?.artifacts, undefined);

  const canceled = cancelA2ATask({ store, id: result.task.id, now });
  assert.equal(canceled.task.status.state, "TASK_STATE_CANCELED");
  assert.equal(canceled.task.artifacts, undefined);
  assert.equal(getA2ATask({ store, id: result.task.id, includeArtifacts: true }).task.artifacts, undefined);
});

test("A2A follow-up messages fail closed when context ids do not match", async () => {
  const store = new LocalA2ATaskStore();
  const first = await sendA2AMessage({
    store,
    protocolVersion: A2A_TASK_PROTOCOL_VERSION,
    message: userMessage("msg-1", "Start a task that needs input."),
    manifest: validManifestFixture(),
    policy: basePolicy,
    now,
    processMessage: () => ({
      state: "TASK_STATE_INPUT_REQUIRED",
      message: agentMessage("agent-msg-1", "Need more input."),
    }),
  });

  await assert.rejects(
    () => sendA2AMessage({
      store,
      protocolVersion: A2A_TASK_PROTOCOL_VERSION,
      message: {
        ...userMessage("msg-2", "Wrong context."),
        taskId: first.task.id,
        contextId: "ctx_wrong",
      },
      now,
    }),
    { name: "A2ATaskError", code: "A2A_CONTEXT_MISMATCH" },
  );
});

test("A2A task logging redacts prompt text, credentials, signer refs, wallet internals, and payment material", async () => {
  const store = new LocalA2ATaskStore();
  const result = await sendA2AMessage({
    store,
    protocolVersion: A2A_TASK_PROTOCOL_VERSION,
    message: {
      ...userMessage("msg-secret", "Use private prompt: transfer funds with Bearer abc.def.ghi"),
      parts: [{
        file: {
          bytes: "raw-private-file-bytes",
          uri: "https://files.example.test/private.txt?token=secret-token&X-Amz-Signature=abc",
        },
      }],
      metadata: {
        privatePrompt: "do not show this prompt",
        signerRef: "signer_ref_secret",
        walletId: "wallet_secret",
        paymentCredential: "card-secret",
        nested: {
          privateKey: "0xabc123",
        },
      },
    },
    manifest: validManifestFixture(),
    policy: basePolicy,
    now,
  });

  const logSafe = JSON.stringify(redactA2ATaskForLog(result.task));

  assert.doesNotMatch(logSafe, /private prompt/i);
  assert.doesNotMatch(logSafe, /Bearer abc/);
  assert.doesNotMatch(logSafe, /signer_ref_secret/);
  assert.doesNotMatch(logSafe, /wallet_secret/);
  assert.doesNotMatch(logSafe, /card-secret/);
  assert.doesNotMatch(logSafe, /raw-private-file-bytes/);
  assert.doesNotMatch(logSafe, /secret-token/);
  assert.doesNotMatch(logSafe, /0xabc123/);
  assert.match(logSafe, /\[REDACTED\]/);
});

test("terminal failed, rejected, and canceled outcomes cannot attach artifacts", async () => {
  for (const state of ["TASK_STATE_FAILED", "TASK_STATE_REJECTED", "TASK_STATE_CANCELED"] as const) {
    const store = new LocalA2ATaskStore();

    await assert.rejects(
      () => sendA2AMessage({
        store,
        protocolVersion: A2A_TASK_PROTOCOL_VERSION,
        message: userMessage(`msg-${state}`, "Run risky work."),
        manifest: validManifestFixture(),
        policy: basePolicy,
        now,
        processMessage: () => ({
          state,
          artifacts: [{
            artifactId: "terminal-artifact",
            parts: [{ text: "must not be stored" }],
          }],
        }),
      }),
      { name: "A2ATaskError", code: "A2A_MESSAGE_INVALID" },
    );
  }
});

function userMessage(messageId: string, text: string): A2AMessage {
  return {
    messageId,
    role: "ROLE_USER",
    parts: [{ text }],
  };
}

function agentMessage(messageId: string, text: string): A2AMessage {
  return {
    messageId,
    role: "ROLE_AGENT",
    parts: [{ text }],
  };
}
