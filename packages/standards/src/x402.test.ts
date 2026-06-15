import assert from "node:assert/strict";
import { test } from "node:test";

import type { AgentActionPolicy } from "@agentrail/policy-gateway";
import {
  runX402MockFacilitatorFlow,
  type X402PaymentRequired,
} from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");

const policy: AgentActionPolicy = {
  knownAgents: ["agent:x402-buyer"],
  maxGasBudget: 25_000_000,
  allowedContracts: [{
    packageId: "0xpaypercallpackage",
    module: "pay_per_call",
    functionName: "request_call",
    templateId: "pay_per_call_v1",
    templateVersion: "1.0.0",
  }],
  allowedCounterparties: ["x402:0x1111111111111111111111111111111111111111"],
  requireSimulation: true,
};

test("local x402 mock facilitator flow returns a result only after policy, verify, and settle", async () => {
  const calls: string[] = [];
  const result = await runX402MockFacilitatorFlow({
    paymentRequired: paymentRequiredFixture(),
    manifestContext: manifestContext(),
    policy,
    now,
    facilitator: {
      verify: async () => {
        calls.push("verify");
        return {
          isValid: true,
          payer: "0x2222222222222222222222222222222222222222",
        };
      },
      settle: async () => {
        calls.push("settle");
        return {
          success: true,
          payer: "0x2222222222222222222222222222222222222222",
          transaction: "0x89c91c789e57059b17285e7ba1716a1f5ff4c5dace0ea5a5135f26158d0421b9",
          network: "eip155:84532",
          amount: "1000",
        };
      },
    },
    invokeTool: async () => {
      calls.push("tool");
      return { ok: true, forecast: "sunny" };
    },
  });

  assert.equal(result.approved, true);
  assert.equal(result.toolResult?.forecast, "sunny");
  assert.deepEqual(calls, ["verify", "settle", "tool"]);
  assert.equal(result.manifest.metadata?.x402ResourceUrl, "https://api.example.test/weather");
  assert.equal(result.receipt.linkedState.status, "succeeded");
  assert.equal(JSON.stringify(result.logSafePaymentMetadata).includes("0xpayment-signature"), false);
});

test("local x402 mock facilitator flow denies before verify or tool invocation", async () => {
  const calls: string[] = [];
  const result = await runX402MockFacilitatorFlow({
    paymentRequired: paymentRequiredFixture(),
    manifestContext: {
      ...manifestContext(),
      maxGasBudget: 25_000_001,
    },
    policy,
    now,
    facilitator: {
      verify: async () => {
        calls.push("verify");
        return { isValid: true };
      },
      settle: async () => {
        calls.push("settle");
        return {
          success: true,
          transaction: "0x89c91c789e57059b17285e7ba1716a1f5ff4c5dace0ea5a5135f26158d0421b9",
          network: "eip155:84532",
        };
      },
    },
    invokeTool: async () => {
      calls.push("tool");
      return { ok: true };
    },
  });

  assert.equal(result.approved, false);
  assert.equal("denial" in result, true);
  if (!("denial" in result)) throw new Error("Expected x402 policy denial result.");
  assert.equal(result.denial.reasonCode, "GAS_BUDGET_TOO_HIGH");
  assert.equal(result.stage, "policy");
  assert.deepEqual(calls, []);
});

test("local x402 mock facilitator flow withholds the tool when verify fails", async () => {
  const calls: string[] = [];
  const result = await runX402MockFacilitatorFlow({
    paymentRequired: paymentRequiredFixture(),
    manifestContext: manifestContext(),
    policy,
    now,
    facilitator: {
      verify: async () => {
        calls.push("verify");
        return {
          isValid: false,
          invalidReason: "invalid_signature",
          payerAddress: "0x2222222222222222222222222222222222222222",
        };
      },
      settle: async () => {
        calls.push("settle");
        return {
          success: true,
          transaction: "0x89c91c789e57059b17285e7ba1716a1f5ff4c5dace0ea5a5135f26158d0421b9",
          network: "eip155:84532",
        };
      },
    },
    invokeTool: async () => {
      calls.push("tool");
      return { ok: true };
    },
  });

  assert.equal(result.approved, false);
  assert.equal("paymentFailure" in result, true);
  if (!("paymentFailure" in result)) throw new Error("Expected x402 payment failure result.");
  assert.equal(result.paymentFailure.reasonCode, "X402_VERIFY_FAILED");
  assert.equal(result.receipt.linkedState.status, "failed");
  assert.deepEqual(calls, ["verify"]);
  assert.equal(JSON.stringify(result.logSafePaymentMetadata).includes("0x2222222222222222222222222222222222222222"), false);
});

test("local x402 mock facilitator flow withholds the tool when settle fails", async () => {
  const calls: string[] = [];
  const result = await runX402MockFacilitatorFlow({
    paymentRequired: paymentRequiredFixture(),
    manifestContext: manifestContext(),
    policy,
    now,
    facilitator: {
      verify: async () => {
        calls.push("verify");
        return { isValid: true };
      },
      settle: async () => {
        calls.push("settle");
        return {
          success: false,
          errorReason: "insufficient_funds",
          transaction: "",
          network: "eip155:84532",
        };
      },
    },
    invokeTool: async () => {
      calls.push("tool");
      return { ok: true };
    },
  });

  assert.equal(result.approved, false);
  assert.equal("paymentFailure" in result, true);
  if (!("paymentFailure" in result)) throw new Error("Expected x402 payment failure result.");
  assert.equal(result.paymentFailure.reasonCode, "X402_SETTLE_FAILED");
  assert.equal(result.receipt.linkedState.status, "failed");
  assert.deepEqual(calls, ["verify", "settle"]);
});

test("local x402 mock facilitator flow fails closed for unsupported x402 versions", async () => {
  await assert.rejects(
    () => runX402MockFacilitatorFlow({
      paymentRequired: {
        ...paymentRequiredFixture(),
        x402Version: 1,
      },
      manifestContext: manifestContext(),
      policy,
      now,
      facilitator: {
        verify: async () => ({ isValid: true }),
        settle: async () => ({
          success: true,
          transaction: "0x89c91c789e57059b17285e7ba1716a1f5ff4c5dace0ea5a5135f26158d0421b9",
          network: "eip155:84532",
        }),
      },
      invokeTool: async () => ({ ok: true }),
    }),
    /Unsupported x402 protocol version/,
  );
});

function manifestContext() {
  return {
    agent: { id: "agent:x402-buyer" },
    owner: { id: "owner:alice" },
    wallet: {
      walletId: "wallet_x402_1",
      signerRef: "signer_ref_x402_1",
    },
    packageId: "0xpaypercallpackage",
    module: "pay_per_call",
    functionName: "request_call",
    templateId: "pay_per_call_v1",
    templateVersion: "1.0.0",
    maxGasBudget: 25_000_000,
    idempotencyKey: "pay_1234567890abcdef1234567890abcdef",
  };
}

function paymentRequiredFixture(): X402PaymentRequired {
  return {
    x402Version: 2,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url: "https://api.example.test/weather",
      description: "Weather data",
      mimeType: "application/json",
    },
    accepts: [{
      scheme: "exact",
      network: "eip155:84532",
      amount: "1000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      payTo: "0x1111111111111111111111111111111111111111",
      maxTimeoutSeconds: 60,
      extra: {
        name: "USDC",
        version: "2",
      },
    }],
    extensions: {
      "payment-identifier": {
        required: true,
      },
    },
  };
}
