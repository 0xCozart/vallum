import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { AGENT_TRANSACTION_MANIFEST_VERSION, type AgentTransactionManifest } from "@iota-gaskit/manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy } from "@iota-gaskit/policy-gateway";
import { callPaidTool } from "./payPerCall.js";

const now = new Date("2026-06-10T12:00:00.000Z");
const packageId = "0x5555555555555555555555555555555555555555555555555555555555555555";

const policy: AgentActionPolicy = {
  knownAgents: ["agent:paid-tool-buyer"],
  maxGasBudget: 50_000_000,
  allowedContracts: [{
    templateId: "pay_per_call_v1",
    templateVersion: "1.0.0",
  }],
  allowedCounterparties: ["agent:paid-tool-provider"],
  requireSimulation: true,
};

test("callPaidTool returns paid result only after gateway approval and payment confirmation", async () => {
  const order: string[] = [];
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => {
        order.push("gateway");
        return { sponsorshipId: "mock_sponsorship_paid_tool_1" };
      },
    },
  });

  try {
    const result = await callPaidTool({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      manifest: paidToolManifest(),
      receiptId: "receipt_paid_tool_1",
      providerId: "agent:paid-tool-provider",
      toolName: "premium_analysis",
      amount: { amount: "3.00", asset: "USD" },
      confirmPayment: async () => {
        order.push("payment");
        return { ok: true, transactionDigest: "mock_digest_paid_tool_1" };
      },
      invokeTool: async () => {
        order.push("tool");
        return {
          result: "paid analysis result",
          resultHash: "sha256:paid-analysis-result",
        };
      },
      now: () => now,
    });

    assert.equal(result.paid, true);
    if (result.paid) {
      assert.equal(result.result, "paid analysis result");
    }
    assert.deepEqual(order, ["gateway", "payment", "tool"]);
    assert.equal(result.receipt.status, "completed");
    assert.equal(result.receipt.transactionDigest, "mock_digest_paid_tool_1");
    assert.equal(result.receipt.resultHash, "sha256:paid-analysis-result");
    assert.deepEqual(result.receipt.events.map((event) => event.type), [
      "pay_per_call_created",
      "approved",
      "sponsored",
      "submitted",
      "completed",
    ]);
  } finally {
    await close(gateway);
  }
});

test("callPaidTool does not invoke paid tool when gateway denies payment policy", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
  });

  try {
    const result = await callPaidTool({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      manifest: paidToolManifest({ maxGasBudget: 50_000_001 }),
      receiptId: "receipt_paid_tool_denied_1",
      providerId: "agent:paid-tool-provider",
      toolName: "premium_analysis",
      amount: { amount: "3.00", asset: "USD" },
      confirmPayment: async () => {
        throw new Error("payment must not run after policy denial");
      },
      invokeTool: async () => {
        throw new Error("paid tool must not run after policy denial");
      },
      now: () => now,
    });

    assert.equal(result.paid, false);
    assert.equal(result.receipt.status, "denied");
    assert.equal(result.receipt.events.at(-1)?.type, "denied");
  } finally {
    await close(gateway);
  }
});

test("callPaidTool withholds paid result when payment confirmation fails", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_paid_tool_2" }),
    },
  });

  try {
    const result = await callPaidTool({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      manifest: paidToolManifest(),
      receiptId: "receipt_paid_tool_failed_payment_1",
      providerId: "agent:paid-tool-provider",
      toolName: "premium_analysis",
      amount: { amount: "3.00", asset: "USD" },
      confirmPayment: async () => ({ ok: false, reason: "mock-payment-failed" }),
      invokeTool: async () => {
        throw new Error("paid tool must not run after failed payment");
      },
      now: () => now,
    });

    assert.equal(result.paid, false);
    assert.equal(result.receipt.status, "failed");
    assert.equal(result.receipt.failureReason, "mock-payment-failed");
    assert.equal("result" in result, false);
  } finally {
    await close(gateway);
  }
});

test("callPaidTool withholds paid result when payment confirmation throws", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_paid_tool_3" }),
    },
  });

  try {
    const result = await callPaidTool({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      manifest: paidToolManifest(),
      receiptId: "receipt_paid_tool_payment_exception_1",
      providerId: "agent:paid-tool-provider",
      toolName: "premium_analysis",
      amount: { amount: "3.00", asset: "USD" },
      confirmPayment: async () => {
        throw new Error("provider payment timeout");
      },
      invokeTool: async () => {
        throw new Error("paid tool must not run after payment exception");
      },
      now: () => now,
    });

    assert.equal(result.paid, false);
    assert.equal(result.receipt.status, "failed");
    assert.equal(result.receipt.failureReason, "PAYMENT_CONFIRMATION_FAILED");
  } finally {
    await close(gateway);
  }
});

test("callPaidTool withholds paid result when tool invocation throws", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_paid_tool_4" }),
    },
  });

  try {
    const result = await callPaidTool({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      manifest: paidToolManifest(),
      receiptId: "receipt_paid_tool_exception_1",
      providerId: "agent:paid-tool-provider",
      toolName: "premium_analysis",
      amount: { amount: "3.00", asset: "USD" },
      confirmPayment: async () => ({ ok: true, transactionDigest: "mock_digest_paid_tool_2" }),
      invokeTool: async () => {
        throw new Error("tool provider failed");
      },
      now: () => now,
    });

    assert.equal(result.paid, false);
    assert.equal(result.receipt.status, "failed");
    assert.equal(result.receipt.transactionDigest, "mock_digest_paid_tool_2");
    assert.equal(result.receipt.failureReason, "TOOL_INVOCATION_FAILED");
  } finally {
    await close(gateway);
  }
});

test("callPaidTool rejects blank payment and result evidence", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_paid_tool_5" }),
    },
  });

  try {
    const gatewayBaseUrl = await listen(gateway);
    const blankPayment = await callPaidTool({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: paidToolManifest(),
      receiptId: "receipt_paid_tool_blank_payment_1",
      providerId: "agent:paid-tool-provider",
      toolName: "premium_analysis",
      amount: { amount: "3.00", asset: "USD" },
      confirmPayment: async () => ({ ok: true, transactionDigest: "   " }),
      invokeTool: async () => {
        throw new Error("paid tool must not run with blank payment digest");
      },
      now: () => now,
    });
    assert.equal(blankPayment.paid, false);
    assert.equal(blankPayment.receipt.failureReason, "PAYMENT_CONFIRMATION_INVALID");

    const blankResult = await callPaidTool({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: paidToolManifest(),
      receiptId: "receipt_paid_tool_blank_result_1",
      providerId: "agent:paid-tool-provider",
      toolName: "premium_analysis",
      amount: { amount: "3.00", asset: "USD" },
      confirmPayment: async () => ({ ok: true, transactionDigest: "mock_digest_paid_tool_3" }),
      invokeTool: async () => ({
        result: "paid analysis result",
        resultHash: "",
      }),
      now: () => now,
    });
    assert.equal(blankResult.paid, false);
    assert.equal(blankResult.receipt.failureReason, "TOOL_RESULT_HASH_INVALID");
  } finally {
    await close(gateway);
  }
});

test("callPaidTool rejects malformed runtime payment and result evidence", async () => {
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_paid_tool_6" }),
    },
  });

  try {
    const gatewayBaseUrl = await listen(gateway);
    const malformedPayment = await callPaidTool({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: paidToolManifest(),
      receiptId: "receipt_paid_tool_malformed_payment_1",
      providerId: "agent:paid-tool-provider",
      toolName: "premium_analysis",
      amount: { amount: "3.00", asset: "USD" },
      confirmPayment: async () => ({ ok: true, transactionDigest: 42 } as never),
      invokeTool: async () => {
        throw new Error("paid tool must not run with malformed payment digest");
      },
      now: () => now,
    });
    assert.equal(malformedPayment.paid, false);
    assert.equal(malformedPayment.receipt.failureReason, "PAYMENT_CONFIRMATION_INVALID");

    const malformedResult = await callPaidTool({
      gatewayBaseUrl,
      apiKey: "test-key",
      manifest: paidToolManifest(),
      receiptId: "receipt_paid_tool_malformed_result_1",
      providerId: "agent:paid-tool-provider",
      toolName: "premium_analysis",
      amount: { amount: "3.00", asset: "USD" },
      confirmPayment: async () => ({ ok: true, transactionDigest: "mock_digest_paid_tool_4" }),
      invokeTool: async () => ({
        result: "paid analysis result",
        resultHash: 42,
      }) as never,
      now: () => now,
    });
    assert.equal(malformedResult.paid, false);
    assert.equal(malformedResult.receipt.failureReason, "TOOL_RESULT_HASH_INVALID");
  } finally {
    await close(gateway);
  }
});

function paidToolManifest(options: { readonly maxGasBudget?: number } = {}): AgentTransactionManifest {
  return {
    version: AGENT_TRANSACTION_MANIFEST_VERSION,
    agent: {
      id: "agent:paid-tool-buyer",
      address: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
    owner: {
      id: "owner:paid-tool-buyer",
    },
    wallet: {
      walletId: "wallet_paid_tool_1",
      signerRef: "signer_ref_paid_tool_1",
    },
    intent: "Purchase one premium analysis tool result.",
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
      displayName: "Request paid tool call",
    },
    counterparty: {
      id: "agent:paid-tool-provider",
      address: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
    scope: ["contract:pay_per_call", "action:request_call", "tool:premium_analysis"],
    expiresAt: "2026-06-10T13:00:00.000Z",
    idempotencyKey: "idem_paid_tool_20260610_0001",
    simulation: {
      required: true,
      status: "passed",
      hash: "sha256:paid-tool-simulation",
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
      purpose: "paid-tool-test",
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
