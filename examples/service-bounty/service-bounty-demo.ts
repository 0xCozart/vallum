import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { AGENT_TRANSACTION_MANIFEST_VERSION, type AgentTransactionManifest } from "@vallum/manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy, type AgentGatewayEvent } from "@vallum/policy-gateway";
import { fulfillServiceBounty, type FulfillServiceBountyResult } from "@vallum/sdk";

const now = new Date("2026-06-10T12:00:00.000Z");
const requesterAgentId = "agent:bounty-requester";
const providerAgentId = "agent:bounty-provider";
const packageId = "0x7777777777777777777777777777777777777777777777777777777777777777";

export interface ServiceBountyDemoResult {
  readonly approved: FulfillServiceBountyResult;
  readonly denied: FulfillServiceBountyResult;
  readonly failedCompletion: FulfillServiceBountyResult;
  readonly gatewayEvents: readonly AgentGatewayEvent[];
}

const policy: AgentActionPolicy = {
  knownAgents: [requesterAgentId],
  maxGasBudget: 50_000_000,
  allowedContracts: [{
    templateId: "service_bounty_v1",
    templateVersion: "1.0.0",
  }],
  allowedCounterparties: [providerAgentId],
  requireSimulation: true,
};

export async function runServiceBountyDemo(): Promise<ServiceBountyDemoResult> {
  const gatewayEvents: AgentGatewayEvent[] = [];
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    eventSink: (event) => {
      gatewayEvents.push(event);
    },
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_service_bounty_demo" }),
    },
  });

  try {
    const gatewayBaseUrl = await listen(gateway);
    const approved = await fulfillServiceBounty({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: serviceBountyManifest({ idempotencyKey: "idem_service_bounty_approved_1" }),
      receiptId: "receipt_service_bounty_approved_1",
      requesterId: requesterAgentId,
      providerId: providerAgentId,
      bountyId: "bounty:research-summary-1",
      deliverableHash: "sha256:expected-deliverable",
      amount: { amount: "12.00", asset: "USD" },
      completeWork: async () => ({
        ok: true,
        transactionDigest: "mock_digest_service_bounty_1",
        completionProofHash: "sha256:service-bounty-completion-proof",
        releaseProofHash: "sha256:service-bounty-release-proof",
      }),
      now: () => now,
    });

    const denied = await fulfillServiceBounty({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: serviceBountyManifest({
        idempotencyKey: "idem_service_bounty_denied_1",
        maxGasBudget: 50_000_001,
      }),
      receiptId: "receipt_service_bounty_denied_1",
      requesterId: requesterAgentId,
      providerId: providerAgentId,
      bountyId: "bounty:research-summary-1",
      deliverableHash: "sha256:expected-deliverable",
      amount: { amount: "12.00", asset: "USD" },
      completeWork: async () => {
        throw new Error("Completion proof must not run when policy denies.");
      },
      now: () => now,
    });

    const failedCompletion = await fulfillServiceBounty({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: serviceBountyManifest({ idempotencyKey: "idem_service_bounty_failed_completion_1" }),
      receiptId: "receipt_service_bounty_failed_completion_1",
      requesterId: requesterAgentId,
      providerId: providerAgentId,
      bountyId: "bounty:research-summary-1",
      deliverableHash: "sha256:expected-deliverable",
      amount: { amount: "12.00", asset: "USD" },
      completeWork: async () => ({ ok: false, reason: "provider-missed-deadline" }),
      now: () => now,
    });

    return {
      approved,
      denied,
      failedCompletion,
      gatewayEvents,
    };
  } finally {
    await close(gateway);
  }
}

export function formatServiceBountyDemoResult(result: ServiceBountyDemoResult): string {
  const gatewayEvents = result.gatewayEvents.map((event) => event.outcome).join(",");
  return [
    "Service bounty demo passed",
    `approved.status=${result.approved.receipt.status}`,
    `approved.sponsorshipId=${result.approved.receipt.sponsorshipId}`,
    `approved.bountyId=${result.approved.receipt.bountyId}`,
    `denied.status=${result.denied.receipt.status}`,
    `failedCompletion.status=${result.failedCompletion.receipt.status}`,
    `gateway.events=${gatewayEvents}`,
  ].join("\n");
}

function serviceBountyManifest(options: {
  readonly idempotencyKey: string;
  readonly maxGasBudget?: number;
}): AgentTransactionManifest {
  return {
    version: AGENT_TRANSACTION_MANIFEST_VERSION,
    agent: {
      id: requesterAgentId,
      address: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
    owner: {
      id: "owner:bounty-requester",
    },
    wallet: {
      walletId: "wallet_service_bounty_demo",
      signerRef: "signer_ref_service_bounty_demo",
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
      id: providerAgentId,
      address: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
    scope: ["contract:service_bounty", "action:post_bounty", "bounty:research-summary-1"],
    expiresAt: "2026-06-10T13:00:00.000Z",
    idempotencyKey: options.idempotencyKey,
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
      purpose: "service-bounty-demo",
      bountyId: "bounty:research-summary-1",
      deliverableHash: "sha256:expected-deliverable",
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
