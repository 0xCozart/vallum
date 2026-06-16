import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { AGENT_TRANSACTION_MANIFEST_VERSION, type AgentTransactionManifest } from "@sacredlabs/agentrail-manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy, type AgentGatewayEvent } from "@sacredlabs/agentrail-policy-gateway";
import { completeEscrow, releaseEscrow, submitReceipt, type EscrowReceipt } from "@sacredlabs/agentrail-receipts";
import { openEscrow, type OpenEscrowResult } from "@sacredlabs/agentrail-sdk";

const now = new Date("2026-06-10T12:00:00.000Z");
const requesterAgentId = "agent:research-buyer";
const providerAgentId = "agent:analysis-provider";
const verifierId = "verifier:research-buyer";
const packageId = "0x2222222222222222222222222222222222222222222222222222222222222222";

export interface AgentEscrowDemoResult {
  readonly approved: OpenEscrowResult & { readonly receipt: EscrowReceipt };
  readonly denied: OpenEscrowResult;
  readonly gatewayEvents: readonly AgentGatewayEvent[];
}

const policy: AgentActionPolicy = {
  knownAgents: [requesterAgentId],
  maxGasBudget: 50_000_000,
  allowedContracts: [{
    packageId,
    module: "escrow",
    functionName: "open_escrow",
  }],
  allowedCounterparties: [providerAgentId],
  requireSimulation: true,
};

export async function runAgentEscrowDemo(): Promise<AgentEscrowDemoResult> {
  const gatewayEvents: AgentGatewayEvent[] = [];
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    eventSink: (event) => {
      gatewayEvents.push(event);
    },
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_agent_escrow_1" }),
    },
  });

  try {
    const gatewayBaseUrl = await listen(gateway);
    const approved = await openEscrow({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: agentEscrowManifest({ idempotencyKey: "idem_agent_escrow_approved_1" }),
      receiptId: "receipt_agent_escrow_approved_1",
      providerId: providerAgentId,
      verifierId,
      amount: { amount: "25.00", asset: "USD" },
      now: () => now,
    });

    if (!approved.sponsoredAction.approved) {
      throw new Error(`Expected approved escrow sponsorship, got ${approved.sponsoredAction.decision.reasonCode}.`);
    }

    const submitted = submitReceipt(approved.receipt, {
      at: now,
      transactionDigest: "mock_digest_agent_escrow_open_1",
    });
    const completed = completeEscrow(submitted, {
      at: now,
      evidenceHash: "sha256:agent-analysis-delivered",
    });
    const released = releaseEscrow(completed, {
      at: now,
      verifierId,
      releaseProofHash: "sha256:verifier-approved-agent-analysis",
    });

    const denied = await openEscrow({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: agentEscrowManifest({
        idempotencyKey: "idem_agent_escrow_denied_1",
        maxGasBudget: 50_000_001,
      }),
      receiptId: "receipt_agent_escrow_denied_1",
      providerId: providerAgentId,
      verifierId,
      amount: { amount: "25.00", asset: "USD" },
      now: () => now,
    });

    return {
      approved: { ...approved, receipt: released },
      denied,
      gatewayEvents,
    };
  } finally {
    await close(gateway);
  }
}

export function formatAgentEscrowDemoResult(result: AgentEscrowDemoResult): string {
  const approvedEvents = result.approved.receipt.events.map((event) => event.type).join(",");
  const gatewayEvents = result.gatewayEvents.map((event) => event.outcome).join(",");
  const deniedReason = result.denied.sponsoredAction.approved
    ? "none"
    : result.denied.sponsoredAction.decision.reasonCode;

  return [
    "AgentRail agent escrow demo passed",
    `approved.agent=${result.approved.receipt.agentId}`,
    `approved.provider=${result.approved.receipt.escrow.providerId}`,
    `approved.status=${result.approved.receipt.status}`,
    `approved.escrowStatus=${result.approved.receipt.escrow.status}`,
    `approved.receiptEvents=${approvedEvents}`,
    `approved.sponsorshipId=${result.approved.receipt.sponsorshipId}`,
    `denied.status=${result.denied.receipt.status}`,
    `denied.reason=${deniedReason}`,
    `gateway.events=${gatewayEvents}`,
  ].join("\n");
}

function agentEscrowManifest(options: {
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
      id: "owner:research-team",
    },
    wallet: {
      walletId: "wallet_agent_escrow_demo",
      signerRef: "signer_ref_agent_escrow_demo",
    },
    intent: "Hire the analysis provider agent and open verifier-release escrow for delivered research.",
    spend: {
      maxGasBudget: options.maxGasBudget ?? 50_000_000,
      maxPayment: {
        amount: "25.00",
        asset: "USD",
      },
    },
    action: {
      packageId,
      module: "escrow",
      functionName: "open_escrow",
      displayName: "Open agent escrow",
    },
    counterparty: {
      id: providerAgentId,
      address: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
    scope: ["contract:escrow", "action:open_escrow", "agent:provider:analysis"],
    expiresAt: "2026-06-10T13:00:00.000Z",
    idempotencyKey: options.idempotencyKey,
    simulation: {
      required: true,
      status: "passed",
      hash: "sha256:agent-escrow-simulation",
    },
    receipt: {
      required: true,
      templateId: "receipt:escrow:v1",
    },
    humanMandate: {
      required: false,
    },
    refundPolicy: {
      type: "refund_to_owner",
    },
    metadata: {
      purpose: "agent-escrow-demo",
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
