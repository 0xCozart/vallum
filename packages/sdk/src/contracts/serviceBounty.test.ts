import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { AGENT_TRANSACTION_MANIFEST_VERSION, type AgentTransactionManifest } from "@iota-gaskit/manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy } from "@iota-gaskit/policy-gateway";
import { fulfillServiceBounty } from "./serviceBounty.js";

const now = new Date("2026-06-10T12:00:00.000Z");
const packageId = "0x7777777777777777777777777777777777777777777777777777777777777777";

const policy: AgentActionPolicy = {
  knownAgents: ["agent:bounty-requester"],
  maxGasBudget: 50_000_000,
  allowedContracts: [{
    templateId: "service_bounty_v1",
    templateVersion: "1.0.0",
  }],
  allowedCounterparties: ["agent:bounty-provider"],
  requireSimulation: true,
};

test("fulfillServiceBounty releases bounty only after gateway approval and completion proof", async () => {
  const order: string[] = [];
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => {
        order.push("gateway");
        return { sponsorshipId: "mock_sponsorship_service_bounty_1" };
      },
    },
  });

  try {
    const result = await fulfillServiceBounty({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      manifest: serviceBountyManifest(),
      receiptId: "receipt_service_bounty_1",
      requesterId: "agent:bounty-requester",
      providerId: "agent:bounty-provider",
      bountyId: "bounty:research-summary-1",
      deliverableHash: "sha256:expected-deliverable",
      amount: { amount: "12.00", asset: "USD" },
      completeWork: async () => {
        order.push("completion");
        return {
          ok: true,
          transactionDigest: "mock_digest_service_bounty_1",
          completionProofHash: "sha256:service-bounty-completion-proof",
          releaseProofHash: "sha256:service-bounty-release-proof",
        };
      },
      now: () => now,
    });

    assert.equal(result.released, true);
    assert.deepEqual(order, ["gateway", "completion"]);
    assert.equal(result.receipt.status, "released");
    assert.equal(result.receipt.transactionDigest, "mock_digest_service_bounty_1");
    assert.equal(result.receipt.completionProofHash, "sha256:service-bounty-completion-proof");
    assert.equal(result.receipt.releaseProofHash, "sha256:service-bounty-release-proof");
  } finally {
    await close(gateway);
  }
});

test("fulfillServiceBounty does not request completion proof when gateway denies policy", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
  });

  try {
    const result = await fulfillServiceBounty({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      manifest: serviceBountyManifest({ maxGasBudget: 50_000_001 }),
      receiptId: "receipt_service_bounty_denied_1",
      requesterId: "agent:bounty-requester",
      providerId: "agent:bounty-provider",
      bountyId: "bounty:research-summary-1",
      deliverableHash: "sha256:expected-deliverable",
      amount: { amount: "12.00", asset: "USD" },
      completeWork: async () => {
        throw new Error("completion proof must not run after policy denial");
      },
      now: () => now,
    });

    assert.equal(result.released, false);
    assert.equal(result.receipt.status, "denied");
  } finally {
    await close(gateway);
  }
});

test("fulfillServiceBounty withholds release when completion proof fails or is malformed", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_service_bounty_2" }),
    },
  });

  try {
    const gatewayBaseUrl = await listen(gateway);
    const failed = await fulfillServiceBounty({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: serviceBountyManifest(),
      receiptId: "receipt_service_bounty_failed_1",
      requesterId: "agent:bounty-requester",
      providerId: "agent:bounty-provider",
      bountyId: "bounty:research-summary-1",
      deliverableHash: "sha256:expected-deliverable",
      amount: { amount: "12.00", asset: "USD" },
      completeWork: async () => ({ ok: false, reason: "provider-missed-deadline" }),
      now: () => now,
    });
    assert.equal(failed.released, false);
    assert.equal(failed.receipt.status, "failed");
    assert.equal(failed.receipt.failureReason, "provider-missed-deadline");

    const malformed = await fulfillServiceBounty({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: serviceBountyManifest(),
      receiptId: "receipt_service_bounty_malformed_1",
      requesterId: "agent:bounty-requester",
      providerId: "agent:bounty-provider",
      bountyId: "bounty:research-summary-1",
      deliverableHash: "sha256:expected-deliverable",
      amount: { amount: "12.00", asset: "USD" },
      completeWork: async () => ({
        ok: true,
        transactionDigest: "mock_digest_service_bounty_2",
        completionProofHash: "",
        releaseProofHash: "sha256:service-bounty-release-proof",
      }),
      now: () => now,
    });
    assert.equal(malformed.released, false);
    assert.equal(malformed.receipt.status, "failed");
    assert.equal(malformed.receipt.failureReason, "COMPLETION_PROOF_INVALID");

    const thrown = await fulfillServiceBounty({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: serviceBountyManifest(),
      receiptId: "receipt_service_bounty_thrown_1",
      requesterId: "agent:bounty-requester",
      providerId: "agent:bounty-provider",
      bountyId: "bounty:research-summary-1",
      deliverableHash: "sha256:expected-deliverable",
      amount: { amount: "12.00", asset: "USD" },
      completeWork: async () => {
        throw new Error("provider completion service unavailable");
      },
      now: () => now,
    });
    assert.equal(thrown.released, false);
    assert.equal(thrown.receipt.status, "failed");
    assert.equal(thrown.receipt.failureReason, "COMPLETION_PROOF_FAILED");
  } finally {
    await close(gateway);
  }
});

function serviceBountyManifest(options: { readonly maxGasBudget?: number } = {}): AgentTransactionManifest {
  return {
    version: AGENT_TRANSACTION_MANIFEST_VERSION,
    agent: {
      id: "agent:bounty-requester",
      address: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
    owner: {
      id: "owner:bounty-requester",
    },
    wallet: {
      walletId: "wallet_service_bounty_1",
      signerRef: "signer_ref_service_bounty_1",
    },
    intent: "Post and release one scoped service bounty.",
    spend: {
      maxGasBudget: options.maxGasBudget ?? 50_000_000,
      maxPayment: {
        amount: "12.00",
        asset: "USD",
      },
    },
    action: {
      packageId,
      module: "service_bounty",
      functionName: "post_bounty",
      templateId: "service_bounty_v1",
      templateVersion: "1.0.0",
      displayName: "Post service bounty",
    },
    counterparty: {
      id: "agent:bounty-provider",
      address: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
    scope: ["contract:service_bounty", "action:post_bounty", "bounty:research-summary-1"],
    expiresAt: "2026-06-10T13:00:00.000Z",
    idempotencyKey: "idem_service_bounty_20260610_0001",
    simulation: {
      required: true,
      status: "passed",
      hash: "sha256:service-bounty-simulation",
    },
    receipt: {
      required: true,
      templateId: "receipt:service_bounty:v1",
    },
    humanMandate: {
      required: false,
    },
    refundPolicy: {
      type: "refund_to_owner",
    },
    metadata: {
      purpose: "service-bounty-test",
      bountyId: "bounty:research-summary-1",
      deliverableHash: "sha256:expected-deliverable",
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
