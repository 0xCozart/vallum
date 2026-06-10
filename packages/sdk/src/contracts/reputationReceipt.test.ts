import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { AGENT_TRANSACTION_MANIFEST_VERSION, type AgentTransactionManifest } from "@iota-gaskit/manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy } from "@iota-gaskit/policy-gateway";
import { attestReputation } from "./reputationReceipt.js";

const now = new Date("2026-06-10T12:00:00.000Z");
const packageId = "0x8888888888888888888888888888888888888888888888888888888888888888";

const policy: AgentActionPolicy = {
  knownAgents: ["agent:reputation-issuer"],
  maxGasBudget: 10_000_000,
  allowedContracts: [{
    templateId: "reputation_receipt_v1",
    templateVersion: "1.0.0",
  }],
  allowedCounterparties: ["agent:service-provider"],
  requireSimulation: true,
};

test("attestReputation completes only after gateway approval and reputation evidence", async () => {
  const order: string[] = [];
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => {
        order.push("gateway");
        return { sponsorshipId: "mock_sponsorship_reputation_1" };
      },
    },
  });

  try {
    const result = await attestReputation({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      manifest: reputationManifest(),
      receiptId: "receipt_reputation_1",
      issuerId: "agent:reputation-issuer",
      subjectId: "agent:service-provider",
      interactionId: "task:research-summary-1",
      criteriaHash: "sha256:reputation-criteria",
      amount: { amount: "0.00", asset: "USD" },
      collectEvidence: async () => {
        order.push("evidence");
        return {
          ok: true,
          transactionDigest: "mock_digest_reputation_1",
          score: 5,
          evidenceHash: "sha256:reputation-evidence",
          attestationHash: "sha256:reputation-attestation",
        };
      },
      now: () => now,
    });

    assert.equal(result.attested, true);
    assert.deepEqual(order, ["gateway", "evidence"]);
    assert.equal(result.receipt.status, "completed");
    assert.equal(result.receipt.transactionDigest, "mock_digest_reputation_1");
    assert.equal(result.receipt.score, 5);
    assert.equal(result.receipt.evidenceHash, "sha256:reputation-evidence");
    assert.equal(result.receipt.attestationHash, "sha256:reputation-attestation");
  } finally {
    await close(gateway);
  }
});

test("attestReputation does not collect evidence when gateway denies policy", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
  });

  try {
    const result = await attestReputation({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      manifest: reputationManifest({ maxGasBudget: 10_000_001 }),
      receiptId: "receipt_reputation_denied_1",
      issuerId: "agent:reputation-issuer",
      subjectId: "agent:service-provider",
      interactionId: "task:research-summary-1",
      criteriaHash: "sha256:reputation-criteria",
      amount: { amount: "0.00", asset: "USD" },
      collectEvidence: async () => {
        throw new Error("reputation evidence must not run after policy denial");
      },
      now: () => now,
    });

    assert.equal(result.attested, false);
    assert.equal(result.receipt.status, "denied");
  } finally {
    await close(gateway);
  }
});

test("attestReputation rejects issuer id that does not match manifest agent id before gateway call", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => {
        throw new Error("gateway must not reserve sponsorship for invalid issuer binding");
      },
    },
  });

  try {
    const gatewayBaseUrl = await listen(gateway);
    await assert.rejects(
      () => attestReputation({
        gatewayBaseUrl,
        apiKey: "test-key",
        manifest: reputationManifest(),
        receiptId: "receipt_reputation_spoofed_1",
        issuerId: "agent:spoofed-issuer",
        subjectId: "agent:service-provider",
        interactionId: "task:research-summary-1",
        criteriaHash: "sha256:reputation-criteria",
        amount: { amount: "0.00", asset: "USD" },
        collectEvidence: async () => {
          throw new Error("reputation evidence must not run for invalid issuer binding");
        },
        now: () => now,
      }),
      /issuerId must match agentId/,
    );
  } finally {
    await close(gateway);
  }
});

test("attestReputation withholds completion when evidence fails or is malformed", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_reputation_2" }),
    },
  });

  try {
    const gatewayBaseUrl = await listen(gateway);
    const failed = await attestReputation({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: reputationManifest(),
      receiptId: "receipt_reputation_failed_1",
      issuerId: "agent:reputation-issuer",
      subjectId: "agent:service-provider",
      interactionId: "task:research-summary-1",
      criteriaHash: "sha256:reputation-criteria",
      amount: { amount: "0.00", asset: "USD" },
      collectEvidence: async () => ({ ok: false, reason: "insufficient-review-evidence" }),
      now: () => now,
    });
    assert.equal(failed.attested, false);
    assert.equal(failed.receipt.status, "failed");
    assert.equal(failed.receipt.failureReason, "insufficient-review-evidence");

    const malformed = await attestReputation({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: reputationManifest(),
      receiptId: "receipt_reputation_malformed_1",
      issuerId: "agent:reputation-issuer",
      subjectId: "agent:service-provider",
      interactionId: "task:research-summary-1",
      criteriaHash: "sha256:reputation-criteria",
      amount: { amount: "0.00", asset: "USD" },
      collectEvidence: async () => ({
        ok: true,
        transactionDigest: "mock_digest_reputation_2",
        score: 6,
        evidenceHash: "sha256:reputation-evidence",
        attestationHash: "sha256:reputation-attestation",
      }),
      now: () => now,
    });
    assert.equal(malformed.attested, false);
    assert.equal(malformed.receipt.status, "failed");
    assert.equal(malformed.receipt.failureReason, "REPUTATION_EVIDENCE_INVALID");

    const thrown = await attestReputation({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: reputationManifest(),
      receiptId: "receipt_reputation_thrown_1",
      issuerId: "agent:reputation-issuer",
      subjectId: "agent:service-provider",
      interactionId: "task:research-summary-1",
      criteriaHash: "sha256:reputation-criteria",
      amount: { amount: "0.00", asset: "USD" },
      collectEvidence: async () => {
        throw new Error("evidence collector unavailable");
      },
      now: () => now,
    });
    assert.equal(thrown.attested, false);
    assert.equal(thrown.receipt.status, "failed");
    assert.equal(thrown.receipt.failureReason, "REPUTATION_EVIDENCE_FAILED");

    const rawPayload = await attestReputation({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: reputationManifest(),
      receiptId: "receipt_reputation_raw_payload_1",
      issuerId: "agent:reputation-issuer",
      subjectId: "agent:service-provider",
      interactionId: "task:research-summary-1",
      criteriaHash: "sha256:reputation-criteria",
      amount: { amount: "0.00", asset: "USD" },
      collectEvidence: async () => ({
        ok: true,
        transactionDigest: "mock_digest_reputation_3",
        score: 5,
        evidenceHash: "private review payload Bearer abc.def.ghi signer_ref_secret",
        attestationHash: "sha256:reputation-attestation",
      }),
      now: () => now,
    });
    assert.equal(rawPayload.attested, false);
    assert.equal(rawPayload.receipt.status, "failed");
    assert.equal(rawPayload.receipt.failureReason, "REPUTATION_EVIDENCE_INVALID");
  } finally {
    await close(gateway);
  }
});

function reputationManifest(options: { readonly maxGasBudget?: number } = {}): AgentTransactionManifest {
  return {
    version: AGENT_TRANSACTION_MANIFEST_VERSION,
    agent: {
      id: "agent:reputation-issuer",
      address: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
    owner: {
      id: "owner:reputation-issuer",
    },
    wallet: {
      walletId: "wallet_reputation_1",
      signerRef: "signer_ref_reputation_1",
    },
    intent: "Issue one local reputation receipt for a completed task.",
    spend: {
      maxGasBudget: options.maxGasBudget ?? 10_000_000,
      maxPayment: {
        amount: "0.00",
        asset: "USD",
      },
    },
    action: {
      packageId,
      module: "reputation_receipt",
      functionName: "create_receipt",
      templateId: "reputation_receipt_v1",
      templateVersion: "1.0.0",
      displayName: "Create reputation receipt",
    },
    counterparty: {
      id: "agent:service-provider",
      address: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
    scope: ["contract:reputation_receipt", "action:create_receipt", "interaction:task:research-summary-1"],
    expiresAt: "2026-06-10T13:00:00.000Z",
    idempotencyKey: "idem_reputation_20260610_0001",
    simulation: {
      required: true,
      status: "passed",
      hash: "sha256:reputation-simulation",
    },
    receipt: {
      required: true,
      templateId: "receipt:reputation:v1",
    },
    humanMandate: {
      required: false,
    },
    refundPolicy: {
      type: "none",
    },
    metadata: {
      purpose: "reputation-receipt-test",
      interactionId: "task:research-summary-1",
      criteriaHash: "sha256:reputation-criteria",
    },
  };
}

async function listen(server: ReturnType<typeof createAgentMockGatewayServer>): Promise<string> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: ReturnType<typeof createAgentMockGatewayServer>): Promise<void> {
  server.close();
  await once(server, "close");
}
