import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { AGENT_TRANSACTION_MANIFEST_VERSION, type AgentTransactionManifest } from "@vallum/manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy, type AgentGatewayEvent } from "@vallum/policy-gateway";
import { cancelSubscriptionReceipt } from "@vallum/receipts";
import { renewSubscription, startSubscription, type RenewSubscriptionResult, type StartSubscriptionResult } from "@vallum/sdk";

const now = new Date("2026-06-10T12:00:00.000Z");
const subscriberAgentId = "agent:subscription-buyer";
const providerAgentId = "agent:subscription-provider";
const packageId = "0x9999999999999999999999999999999999999999999999999999999999999998";

export interface SubscriptionDemoResult {
  readonly approved: StartSubscriptionResult;
  readonly denied: StartSubscriptionResult;
  readonly failedProof: StartSubscriptionResult;
  readonly renewed: RenewSubscriptionResult;
  readonly canceledStatus: string;
  readonly gatewayEvents: readonly AgentGatewayEvent[];
}

const policy: AgentActionPolicy = {
  knownAgents: [subscriberAgentId],
  maxGasBudget: 20_000_000,
  allowedContracts: [{
    templateId: "subscription_v1",
    templateVersion: "1.0.0",
  }],
  allowedCounterparties: [providerAgentId],
  requireSimulation: true,
};

export async function runSubscriptionDemo(): Promise<SubscriptionDemoResult> {
  const gatewayEvents: AgentGatewayEvent[] = [];
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    eventSink: (event) => {
      gatewayEvents.push(event);
    },
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_subscription_demo" }),
    },
  });

  try {
    const gatewayBaseUrl = await listen(gateway);
    const approved = await startSubscription({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: subscriptionManifest({ idempotencyKey: "idem_subscription_approved_1" }),
      receiptId: "receipt_subscription_approved_1",
      subscriberId: subscriberAgentId,
      providerId: providerAgentId,
      planId: "plan:research-feed-monthly",
      termsHash: "sha256:subscription-terms",
      periodStart: "2026-06-10T12:00:00.000Z",
      periodEnd: "2026-07-10T12:00:00.000Z",
      amount: { amount: "9.00", asset: "USD" },
      activate: async () => ({
        ok: true,
        transactionDigest: "mock_digest_subscription_1",
        activationProofHash: "sha256:subscription-activation-proof",
      }),
      now: () => now,
    });

    const denied = await startSubscription({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: subscriptionManifest({
        idempotencyKey: "idem_subscription_denied_1",
        maxGasBudget: 20_000_001,
      }),
      receiptId: "receipt_subscription_denied_1",
      subscriberId: subscriberAgentId,
      providerId: providerAgentId,
      planId: "plan:research-feed-monthly",
      termsHash: "sha256:subscription-terms",
      periodStart: "2026-06-10T12:00:00.000Z",
      periodEnd: "2026-07-10T12:00:00.000Z",
      amount: { amount: "9.00", asset: "USD" },
      activate: async () => {
        throw new Error("Subscription proof must not run when policy denies.");
      },
      now: () => now,
    });

    const failedProof = await startSubscription({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: subscriptionManifest({ idempotencyKey: "idem_subscription_failed_proof_1" }),
      receiptId: "receipt_subscription_failed_proof_1",
      subscriberId: subscriberAgentId,
      providerId: providerAgentId,
      planId: "plan:research-feed-monthly",
      termsHash: "sha256:subscription-terms",
      periodStart: "2026-06-10T12:00:00.000Z",
      periodEnd: "2026-07-10T12:00:00.000Z",
      amount: { amount: "9.00", asset: "USD" },
      activate: async () => ({ ok: false, reason: "provider-access-unavailable" }),
      now: () => now,
    });

    if (!approved.active) {
      throw new Error("Expected approved subscription to activate in local demo.");
    }
    const renewed = await renewSubscription({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: subscriptionManifest({
        idempotencyKey: "idem_subscription_renewed_1",
        functionName: "renew_subscription",
      }),
      receipt: approved.receipt,
      periodEnd: "2026-08-10T12:00:00.000Z",
      renew: async () => ({
        ok: true,
        transactionDigest: "mock_digest_subscription_renewal_1",
        renewalProofHash: "sha256:subscription-renewal-proof",
      }),
      now: () => now,
    });
    const canceled = renewed.renewed
      ? cancelSubscriptionReceipt(renewed.receipt, { at: now, reason: "subscriber-canceled" })
      : renewed.receipt;

    return {
      approved,
      denied,
      failedProof,
      renewed,
      canceledStatus: canceled.status,
      gatewayEvents,
    };
  } finally {
    await close(gateway);
  }
}

export function formatSubscriptionDemoResult(result: SubscriptionDemoResult): string {
  const gatewayEvents = result.gatewayEvents.map((event) => event.outcome).join(",");
  return [
    "Subscription demo passed",
    `approved.status=${result.approved.receipt.status}`,
    `approved.sponsorshipId=${result.approved.receipt.sponsorshipId}`,
    `approved.planId=${result.approved.receipt.planId}`,
    `denied.status=${result.denied.receipt.status}`,
    `failedProof.status=${result.failedProof.receipt.status}`,
    `renewed.status=${result.renewed.receipt.status}`,
    `canceled.status=${result.canceledStatus}`,
    `gateway.events=${gatewayEvents}`,
  ].join("\n");
}

function subscriptionManifest(options: {
  readonly idempotencyKey: string;
  readonly maxGasBudget?: number;
  readonly functionName?: "start_subscription" | "renew_subscription";
}): AgentTransactionManifest {
  const functionName = options.functionName ?? "start_subscription";
  return {
    version: AGENT_TRANSACTION_MANIFEST_VERSION,
    agent: {
      id: subscriberAgentId,
      address: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
    owner: {
      id: "owner:subscription-buyer",
    },
    wallet: {
      walletId: "wallet_subscription_demo",
      signerRef: "signer_ref_subscription_demo",
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
      id: providerAgentId,
      address: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
    scope: ["contract:subscription", `action:${functionName}`, "plan:research-feed-monthly"],
    expiresAt: "2026-06-10T13:00:00.000Z",
    idempotencyKey: options.idempotencyKey,
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
      purpose: "subscription-demo",
      planId: "plan:research-feed-monthly",
      termsHash: "sha256:subscription-terms",
    },
  };
}

async function listen(server: Server): Promise<string> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}
