import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { AGENT_TRANSACTION_MANIFEST_VERSION, type AgentTransactionManifest } from "@agentrail/manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy } from "@agentrail/policy-gateway";
import { renewSubscription, startSubscription } from "./subscription.js";

const now = new Date("2026-06-10T12:00:00.000Z");
const packageId = "0x9999999999999999999999999999999999999999999999999999999999999998";

const policy: AgentActionPolicy = {
  knownAgents: ["agent:subscription-buyer"],
  maxGasBudget: 20_000_000,
  allowedContracts: [{
    templateId: "subscription_v1",
    templateVersion: "1.0.0",
  }],
  allowedCounterparties: ["agent:subscription-provider"],
  requireSimulation: true,
};

test("startSubscription activates only after gateway approval and subscription proof", async () => {
  const order: string[] = [];
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => {
        order.push("gateway");
        return { sponsorshipId: "mock_sponsorship_subscription_1" };
      },
    },
  });

  try {
    const result = await startSubscription({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      manifest: subscriptionManifest(),
      receiptId: "receipt_subscription_1",
      subscriberId: "agent:subscription-buyer",
      providerId: "agent:subscription-provider",
      planId: "plan:research-feed-monthly",
      termsHash: "sha256:subscription-terms",
      periodStart: "2026-06-10T12:00:00.000Z",
      periodEnd: "2026-07-10T12:00:00.000Z",
      amount: { amount: "9.00", asset: "USD" },
      activate: async () => {
        order.push("proof");
        return {
          ok: true,
          transactionDigest: "mock_digest_subscription_1",
          activationProofHash: "sha256:subscription-activation-proof",
        };
      },
      now: () => now,
    });

    assert.equal(result.active, true);
    assert.deepEqual(order, ["gateway", "proof"]);
    assert.equal(result.receipt.status, "active");
    assert.equal(result.receipt.transactionDigest, "mock_digest_subscription_1");
    assert.equal(result.receipt.activationProofHash, "sha256:subscription-activation-proof");
  } finally {
    await close(gateway);
  }
});

test("startSubscription does not collect proof when gateway denies policy", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
  });

  try {
    const result = await startSubscription({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      manifest: subscriptionManifest({ maxGasBudget: 20_000_001 }),
      receiptId: "receipt_subscription_denied_1",
      subscriberId: "agent:subscription-buyer",
      providerId: "agent:subscription-provider",
      planId: "plan:research-feed-monthly",
      termsHash: "sha256:subscription-terms",
      periodStart: "2026-06-10T12:00:00.000Z",
      periodEnd: "2026-07-10T12:00:00.000Z",
      amount: { amount: "9.00", asset: "USD" },
      activate: async () => {
        throw new Error("subscription proof must not run after policy denial");
      },
      now: () => now,
    });

    assert.equal(result.active, false);
    assert.equal(result.receipt.status, "denied");
  } finally {
    await close(gateway);
  }
});

test("startSubscription rejects subscriber id that does not match manifest agent id before gateway call", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => {
        throw new Error("gateway must not reserve sponsorship for invalid subscriber binding");
      },
    },
  });

  try {
    const gatewayBaseUrl = await listen(gateway);
    await assert.rejects(
      () => startSubscription({
        gatewayBaseUrl,
        apiKey: "test-key",
        manifest: subscriptionManifest(),
        receiptId: "receipt_subscription_spoofed_1",
        subscriberId: "agent:spoofed-subscriber",
        providerId: "agent:subscription-provider",
        planId: "plan:research-feed-monthly",
        termsHash: "sha256:subscription-terms",
        periodStart: "2026-06-10T12:00:00.000Z",
        periodEnd: "2026-07-10T12:00:00.000Z",
        amount: { amount: "9.00", asset: "USD" },
        activate: async () => {
          throw new Error("subscription proof must not run for invalid subscriber binding");
        },
        now: () => now,
      }),
      /subscriberId must match agentId/,
    );
  } finally {
    await close(gateway);
  }
});

test("startSubscription withholds activation when proof fails or is malformed", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_subscription_2" }),
    },
  });

  try {
    const gatewayBaseUrl = await listen(gateway);
    const failed = await startSubscription({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: subscriptionManifest(),
      receiptId: "receipt_subscription_failed_1",
      subscriberId: "agent:subscription-buyer",
      providerId: "agent:subscription-provider",
      planId: "plan:research-feed-monthly",
      termsHash: "sha256:subscription-terms",
      periodStart: "2026-06-10T12:00:00.000Z",
      periodEnd: "2026-07-10T12:00:00.000Z",
      amount: { amount: "9.00", asset: "USD" },
      activate: async () => ({ ok: false, reason: "provider-access-unavailable" }),
      now: () => now,
    });
    assert.equal(failed.active, false);
    assert.equal(failed.receipt.status, "failed");
    assert.equal(failed.receipt.failureReason, "provider-access-unavailable");

    const malformed = await startSubscription({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: subscriptionManifest(),
      receiptId: "receipt_subscription_malformed_1",
      subscriberId: "agent:subscription-buyer",
      providerId: "agent:subscription-provider",
      planId: "plan:research-feed-monthly",
      termsHash: "sha256:subscription-terms",
      periodStart: "2026-06-10T12:00:00.000Z",
      periodEnd: "2026-07-10T12:00:00.000Z",
      amount: { amount: "9.00", asset: "USD" },
      activate: async () => ({
        ok: true,
        transactionDigest: "mock_digest_subscription_2",
        activationProofHash: "raw bearer token access-token",
      }),
      now: () => now,
    });
    assert.equal(malformed.active, false);
    assert.equal(malformed.receipt.status, "failed");
    assert.equal(malformed.receipt.failureReason, "SUBSCRIPTION_PROOF_INVALID");
  } finally {
    await close(gateway);
  }
});

test("renewSubscription renews an active local receipt through gateway approval and renewal proof", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_subscription_3" }),
    },
  });

  try {
    const gatewayBaseUrl = await listen(gateway);
    const started = await startSubscription({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: subscriptionManifest({ idempotencyKey: "idem_subscription_start_1" }),
      receiptId: "receipt_subscription_renew_1",
      subscriberId: "agent:subscription-buyer",
      providerId: "agent:subscription-provider",
      planId: "plan:research-feed-monthly",
      termsHash: "sha256:subscription-terms",
      periodStart: "2026-06-10T12:00:00.000Z",
      periodEnd: "2026-07-10T12:00:00.000Z",
      amount: { amount: "9.00", asset: "USD" },
      activate: async () => ({
        ok: true,
        transactionDigest: "mock_digest_subscription_start_1",
        activationProofHash: "sha256:subscription-activation-proof",
      }),
      now: () => now,
    });
    assert.equal(started.active, true);

    const renewed = await renewSubscription({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: subscriptionManifest({ idempotencyKey: "idem_subscription_renew_1", functionName: "renew_subscription" }),
      receipt: started.receipt,
      periodEnd: "2026-08-10T12:00:00.000Z",
      renew: async () => ({
        ok: true,
        transactionDigest: "mock_digest_subscription_renew_1",
        renewalProofHash: "sha256:subscription-renewal-proof",
      }),
      now: () => now,
    });

    assert.equal(renewed.renewed, true);
    assert.equal(renewed.receipt.status, "renewed");
    assert.equal(renewed.receipt.renewalCount, 1);
    assert.equal(renewed.receipt.renewalSponsorshipId, "mock_sponsorship_subscription_3");
    assert.equal(renewed.receipt.renewalTransactionDigest, "mock_digest_subscription_renew_1");
    assert.equal(renewed.receipt.renewalProofHash, "sha256:subscription-renewal-proof");
  } finally {
    await close(gateway);
  }
});

function subscriptionManifest(options: {
  readonly idempotencyKey?: string;
  readonly maxGasBudget?: number;
  readonly functionName?: "start_subscription" | "renew_subscription";
} = {}): AgentTransactionManifest {
  const functionName = options.functionName ?? "start_subscription";
  return {
    version: AGENT_TRANSACTION_MANIFEST_VERSION,
    agent: {
      id: "agent:subscription-buyer",
      address: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
    owner: {
      id: "owner:subscription-buyer",
    },
    wallet: {
      walletId: "wallet_subscription_1",
      signerRef: "signer_ref_subscription_1",
    },
    intent: "Start or renew one local subscription entitlement.",
    spend: {
      maxGasBudget: options.maxGasBudget ?? 20_000_000,
      maxPayment: {
        amount: "9.00",
        asset: "USD",
      },
    },
    action: {
      packageId,
      module: "subscription",
      functionName,
      templateId: "subscription_v1",
      templateVersion: "1.0.0",
      displayName: "Manage subscription",
    },
    counterparty: {
      id: "agent:subscription-provider",
      address: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
    scope: ["contract:subscription", `action:${functionName}`, "plan:research-feed-monthly"],
    expiresAt: "2026-06-10T13:00:00.000Z",
    idempotencyKey: options.idempotencyKey ?? "idem_subscription_20260610_0001",
    simulation: {
      required: true,
      status: "passed",
      hash: "sha256:subscription-simulation",
    },
    receipt: {
      required: true,
      templateId: "receipt:subscription:v1",
    },
    humanMandate: {
      required: false,
    },
    refundPolicy: {
      type: "none",
    },
    metadata: {
      purpose: "subscription-test",
      planId: "plan:research-feed-monthly",
      termsHash: "sha256:subscription-terms",
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
