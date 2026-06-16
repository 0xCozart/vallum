import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { AGENT_TRANSACTION_MANIFEST_VERSION, type AgentTransactionManifest } from "@vallum/manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy, type AgentGatewayEvent } from "@vallum/policy-gateway";
import { attestReputation, type AttestReputationResult } from "@vallum/sdk";

const now = new Date("2026-06-10T12:00:00.000Z");
const issuerAgentId = "agent:reputation-issuer";
const subjectAgentId = "agent:service-provider";
const packageId = "0x8888888888888888888888888888888888888888888888888888888888888888";

export interface ReputationReceiptDemoResult {
  readonly approved: AttestReputationResult;
  readonly denied: AttestReputationResult;
  readonly failedEvidence: AttestReputationResult;
  readonly gatewayEvents: readonly AgentGatewayEvent[];
}

const policy: AgentActionPolicy = {
  knownAgents: [issuerAgentId],
  maxGasBudget: 10_000_000,
  allowedContracts: [{
    templateId: "reputation_receipt_v1",
    templateVersion: "1.0.0",
  }],
  allowedCounterparties: [subjectAgentId],
  requireSimulation: true,
};

export async function runReputationReceiptDemo(): Promise<ReputationReceiptDemoResult> {
  const gatewayEvents: AgentGatewayEvent[] = [];
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    eventSink: (event) => {
      gatewayEvents.push(event);
    },
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_reputation_demo" }),
    },
  });

  try {
    const gatewayBaseUrl = await listen(gateway);
    const approved = await attestReputation({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: reputationManifest({ idempotencyKey: "idem_reputation_approved_1" }),
      receiptId: "receipt_reputation_approved_1",
      issuerId: issuerAgentId,
      subjectId: subjectAgentId,
      interactionId: "task:research-summary-1",
      criteriaHash: "sha256:reputation-criteria",
      amount: { amount: "0.00", asset: "USD" },
      collectEvidence: async () => ({
        ok: true,
        transactionDigest: "mock_digest_reputation_1",
        score: 5,
        evidenceHash: "sha256:reputation-evidence",
        attestationHash: "sha256:reputation-attestation",
      }),
      now: () => now,
    });

    const denied = await attestReputation({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: reputationManifest({
        idempotencyKey: "idem_reputation_denied_1",
        maxGasBudget: 10_000_001,
      }),
      receiptId: "receipt_reputation_denied_1",
      issuerId: issuerAgentId,
      subjectId: subjectAgentId,
      interactionId: "task:research-summary-1",
      criteriaHash: "sha256:reputation-criteria",
      amount: { amount: "0.00", asset: "USD" },
      collectEvidence: async () => {
        throw new Error("Reputation evidence must not run when policy denies.");
      },
      now: () => now,
    });

    const failedEvidence = await attestReputation({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: reputationManifest({ idempotencyKey: "idem_reputation_failed_evidence_1" }),
      receiptId: "receipt_reputation_failed_evidence_1",
      issuerId: issuerAgentId,
      subjectId: subjectAgentId,
      interactionId: "task:research-summary-1",
      criteriaHash: "sha256:reputation-criteria",
      amount: { amount: "0.00", asset: "USD" },
      collectEvidence: async () => ({ ok: false, reason: "insufficient-review-evidence" }),
      now: () => now,
    });

    return {
      approved,
      denied,
      failedEvidence,
      gatewayEvents,
    };
  } finally {
    await close(gateway);
  }
}

export function formatReputationReceiptDemoResult(result: ReputationReceiptDemoResult): string {
  const gatewayEvents = result.gatewayEvents.map((event) => event.outcome).join(",");
  return [
    "Reputation receipt demo passed",
    `approved.status=${result.approved.receipt.status}`,
    `approved.sponsorshipId=${result.approved.receipt.sponsorshipId}`,
    `approved.subjectId=${result.approved.receipt.subjectId}`,
    `approved.score=${result.approved.receipt.score}`,
    `denied.status=${result.denied.receipt.status}`,
    `failedEvidence.status=${result.failedEvidence.receipt.status}`,
    `gateway.events=${gatewayEvents}`,
  ].join("\n");
}

function reputationManifest(options: {
  readonly idempotencyKey: string;
  readonly maxGasBudget?: number;
}): AgentTransactionManifest {
  return {
    version: AGENT_TRANSACTION_MANIFEST_VERSION,
    agent: {
      id: issuerAgentId,
      address: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
    owner: {
      id: "owner:reputation-issuer",
    },
    wallet: {
      walletId: "wallet_reputation_demo",
      signerRef: "signer_ref_reputation_demo",
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
      id: subjectAgentId,
      address: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
    scope: ["contract:reputation_receipt", "action:create_receipt", "interaction:task:research-summary-1"],
    expiresAt: "2026-06-10T13:00:00.000Z",
    idempotencyKey: options.idempotencyKey,
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
      purpose: "reputation-receipt-demo",
      interactionId: "task:research-summary-1",
      criteriaHash: "sha256:reputation-criteria",
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
