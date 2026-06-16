import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { AGENT_TRANSACTION_MANIFEST_VERSION, type AgentTransactionManifest } from "@vallum/manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy, type AgentGatewayEvent } from "@vallum/policy-gateway";
import { callPaidTool, type CallPaidToolResult } from "@vallum/sdk";

const now = new Date("2026-06-10T12:00:00.000Z");
const buyerAgentId = "agent:paid-tool-buyer";
const providerAgentId = "agent:paid-tool-provider";
const packageId = "0x5555555555555555555555555555555555555555555555555555555555555555";

export interface PaidMcpToolDemoResult {
  readonly approved: CallPaidToolResult<string>;
  readonly denied: CallPaidToolResult<string>;
  readonly failedPayment: CallPaidToolResult<string>;
  readonly gatewayEvents: readonly AgentGatewayEvent[];
}

const policy: AgentActionPolicy = {
  knownAgents: [buyerAgentId],
  maxGasBudget: 50_000_000,
  allowedContracts: [{
    templateId: "pay_per_call_v1",
    templateVersion: "1.0.0",
  }],
  allowedCounterparties: [providerAgentId],
  requireSimulation: true,
};

export async function runPaidMcpToolDemo(): Promise<PaidMcpToolDemoResult> {
  const gatewayEvents: AgentGatewayEvent[] = [];
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    eventSink: (event) => {
      gatewayEvents.push(event);
    },
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_paid_mcp_tool" }),
    },
  });

  try {
    const gatewayBaseUrl = await listen(gateway);
    const approved = await callPaidTool<string>({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: paidToolManifest({ idempotencyKey: "idem_paid_mcp_tool_approved_1" }),
      receiptId: "receipt_paid_mcp_tool_approved_1",
      providerId: providerAgentId,
      toolName: "premium_analysis",
      amount: { amount: "3.00", asset: "USD" },
      confirmPayment: async () => ({ ok: true, transactionDigest: "mock_digest_paid_mcp_tool_1" }),
      invokeTool: async () => ({
        result: "premium-analysis: market demand is high",
        resultHash: "sha256:premium-analysis-result",
      }),
      now: () => now,
    });

    const denied = await callPaidTool<string>({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: paidToolManifest({
        idempotencyKey: "idem_paid_mcp_tool_denied_1",
        maxGasBudget: 50_000_001,
      }),
      receiptId: "receipt_paid_mcp_tool_denied_1",
      providerId: providerAgentId,
      toolName: "premium_analysis",
      amount: { amount: "3.00", asset: "USD" },
      confirmPayment: async () => {
        throw new Error("Payment confirmation must not run when policy denies.");
      },
      invokeTool: async () => {
        throw new Error("Paid tool must not run when policy denies.");
      },
      now: () => now,
    });

    const failedPayment = await callPaidTool<string>({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: paidToolManifest({ idempotencyKey: "idem_paid_mcp_tool_failed_payment_1" }),
      receiptId: "receipt_paid_mcp_tool_failed_payment_1",
      providerId: providerAgentId,
      toolName: "premium_analysis",
      amount: { amount: "3.00", asset: "USD" },
      confirmPayment: async () => ({ ok: false, reason: "mock-payment-failed" }),
      invokeTool: async () => {
        throw new Error("Paid tool must not run when payment fails.");
      },
      now: () => now,
    });

    return {
      approved,
      denied,
      failedPayment,
      gatewayEvents,
    };
  } finally {
    await close(gateway);
  }
}

export function formatPaidMcpToolDemoResult(result: PaidMcpToolDemoResult): string {
  const deniedReason = result.denied.sponsoredAction.approved
    ? "unexpected-approved"
    : result.denied.sponsoredAction.decision.reasonCode;
  const gatewayAudit = result.gatewayEvents
    .map((event) => `${event.outcome}:${event.reasonCode ?? "none"}`)
    .join(",");
  return [
    "Paid MCP tool demo passed",
    "boundary.localOnly=true",
    "boundary.liveNetwork=false",
    "boundary.route=SDK->mock-policy-gateway",
    "request.intent=Purchase one premium MCP tool result.",
    "request.action=pay_per_call.request_call",
    "request.tool=premium_analysis",
    "request.amount=3.00 USD",
    "manifest.idempotencyKey=redacted",
    "manifest.signerReference.internal=true",
    "manifest.signerReference.exposed=false",
    "manifest.receiptRequired=true",
    "manifest.simulationRequired=true",
    `approved.status=${result.approved.receipt.status}`,
    `approved.paid=${result.approved.paid}`,
    `approved.receiptId=${result.approved.receipt.receiptId}`,
    "approved.receiptManifestId=redacted",
    `approved.receiptEvents=${receiptEvents(result.approved.receipt.events)}`,
    `approved.sponsorshipId=${result.approved.receipt.sponsorshipId}`,
    `approved.paymentDigest=${result.approved.receipt.transactionDigest}`,
    `approved.resultHash=${result.approved.receipt.resultHash}`,
    `denied.status=${result.denied.receipt.status}`,
    `denied.paid=${result.denied.paid}`,
    `denied.reason=${deniedReason}`,
    `denied.receiptId=${result.denied.receipt.receiptId}`,
    `denied.receiptEvents=${receiptEvents(result.denied.receipt.events)}`,
    `failedPayment.status=${result.failedPayment.receipt.status}`,
    `failedPayment.paid=${result.failedPayment.paid}`,
    `failedPayment.reason=${result.failedPayment.receipt.failureReason}`,
    `failedPayment.receiptId=${result.failedPayment.receipt.receiptId}`,
    `failedPayment.receiptEvents=${receiptEvents(result.failedPayment.receipt.events)}`,
    `gateway.audit=${gatewayAudit}`,
    "secrets.apiKey.exposed=false",
    "secrets.rawTransactionBytes.exposed=false",
    "secrets.userSignature.exposed=false",
  ].join("\n");
}

function receiptEvents(events: CallPaidToolResult<string>["receipt"]["events"]): string {
  return events.map((event) => event.type).join(",");
}

function paidToolManifest(options: {
  readonly idempotencyKey: string;
  readonly maxGasBudget?: number;
}): AgentTransactionManifest {
  return {
    version: AGENT_TRANSACTION_MANIFEST_VERSION,
    agent: {
      id: buyerAgentId,
      address: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
    owner: {
      id: "owner:paid-tool-buyer",
    },
    wallet: {
      walletId: "wallet_paid_mcp_tool_demo",
      signerRef: "signer_ref_paid_mcp_tool_demo",
    },
    intent: "Purchase one premium MCP tool result.",
    spend: {
      maxGasBudget: options.maxGasBudget ?? 50_000_000,
      maxPayment: {
        amount: "3.00",
        asset: "USD",
      },
    },
    action: {
      packageId,
      module: "pay_per_call",
      functionName: "request_call",
      templateId: "pay_per_call_v1",
      templateVersion: "1.0.0",
      displayName: "Request paid MCP tool call",
    },
    counterparty: {
      id: providerAgentId,
      address: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
    scope: ["contract:pay_per_call", "action:request_call", "tool:premium_analysis"],
    expiresAt: "2026-06-10T13:00:00.000Z",
    idempotencyKey: options.idempotencyKey,
    simulation: {
      required: true,
      status: "passed",
      hash: "sha256:paid-mcp-tool-simulation",
    },
    receipt: {
      required: true,
      templateId: "receipt:pay_per_call:v1",
    },
    humanMandate: {
      required: false,
    },
    refundPolicy: {
      type: "refund_to_owner",
    },
    metadata: {
      purpose: "paid-mcp-tool-demo",
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
