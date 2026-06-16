import assert from "node:assert/strict";
import { test } from "node:test";

import type { AgentActionPolicy } from "@sacredlabs/agentrail-policy-gateway";
import {
  runAP2MockMandateFlow,
  type AP2MandateBundle,
} from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");

const policy: AgentActionPolicy = {
  knownAgents: ["agent:shopping-buyer"],
  maxGasBudget: 30_000_000,
  allowedContracts: [{
    packageId: "0xap2package",
    module: "ap2_checkout",
    functionName: "execute_payment",
    templateId: "ap2_payment_v1",
    templateVersion: "1.0.0",
  }],
  allowedCounterparties: ["ap2:merchant:running-store"],
  requireSimulation: true,
};

test("local AP2 mock flow returns a result only after policy and successful receipts", async () => {
  const calls: string[] = [];
  const result = await runAP2MockMandateFlow({
    mandateBundle: ap2MandateBundleFixture(),
    manifestContext: manifestContext(),
    policy,
    now,
    issueReceipts: async () => {
      calls.push("receipts");
      return successfulReceiptBundle();
    },
    execute: async () => {
      calls.push("execute");
      return { ok: true, orderId: "order_123" };
    },
  });

  assert.equal(result.approved, true);
  assert.equal(result.toolResult.orderId, "order_123");
  assert.equal(result.receipt.linkedState.status, "succeeded");
  assert.deepEqual(calls, ["receipts", "execute"]);
  assert.equal(result.manifest.metadata?.ap2TrustedSurfaceNonAgentic, "true");
  assert.equal(JSON.stringify(result.logSafeMandateMetadata).includes("checkout.jwt.private"), false);
  assert.equal(JSON.stringify(result.logSafeMandateMetadata).includes("instrument_card_1"), false);
});

test("local AP2 mock flow denies before receipt issuance or execution", async () => {
  const calls: string[] = [];
  const result = await runAP2MockMandateFlow({
    mandateBundle: ap2MandateBundleFixture(),
    manifestContext: {
      ...manifestContext(),
      maxGasBudget: 30_000_001,
    },
    policy,
    now,
    issueReceipts: async () => {
      calls.push("receipts");
      return successfulReceiptBundle();
    },
    execute: async () => {
      calls.push("execute");
      return { ok: true };
    },
  });

  assert.equal(result.approved, false);
  assert.equal("denial" in result, true);
  if (!("denial" in result)) throw new Error("Expected AP2 policy denial.");
  assert.equal(result.denial.reasonCode, "GAS_BUDGET_TOO_HIGH");
  assert.equal(result.stage, "policy");
  assert.deepEqual(calls, []);
});

test("local AP2 mock flow withholds execution when payment receipt fails", async () => {
  const calls: string[] = [];
  const result = await runAP2MockMandateFlow({
    mandateBundle: ap2MandateBundleFixture(),
    manifestContext: manifestContext(),
    policy,
    now,
    issueReceipts: async () => {
      calls.push("receipts");
      return {
        ...successfulReceiptBundle(),
        paymentReceipt: {
          ...successfulReceiptBundle().paymentReceipt,
          status: "Error",
          error: "insufficient_funds",
        },
      };
    },
    execute: async () => {
      calls.push("execute");
      return { ok: true };
    },
  });

  assert.equal(result.approved, false);
  assert.equal("paymentFailure" in result, true);
  if (!("paymentFailure" in result)) throw new Error("Expected AP2 payment failure.");
  assert.equal(result.paymentFailure.reasonCode, "AP2_PAYMENT_RECEIPT_FAILED");
  assert.equal(result.receipt.linkedState.status, "failed");
  assert.deepEqual(calls, ["receipts"]);
});

test("local AP2 mock flow fails closed when receipt references do not match mandates", async () => {
  const calls: string[] = [];
  await assert.rejects(
    () => runAP2MockMandateFlow({
      mandateBundle: ap2MandateBundleFixture(),
      manifestContext: manifestContext(),
      policy,
      now,
      issueReceipts: async () => {
        calls.push("receipts");
        return {
          ...successfulReceiptBundle(),
          paymentReceipt: {
            ...successfulReceiptBundle().paymentReceipt,
            reference: "other_payment_mandate",
          },
        };
      },
      execute: async () => {
        calls.push("execute");
        return { ok: true };
      },
    }),
    /payment receipt reference must match/,
  );

  assert.deepEqual(calls, ["receipts"]);
});

test("local AP2 mock flow fails closed for unsupported mandate versions", async () => {
  await assert.rejects(
    () => runAP2MockMandateFlow({
      mandateBundle: {
        ...ap2MandateBundleFixture(),
        checkoutMandate: {
          ...ap2MandateBundleFixture().checkoutMandate,
          vct: "mandate.checkout.2",
        },
      },
      manifestContext: manifestContext(),
      policy,
      now,
      issueReceipts: async () => successfulReceiptBundle(),
      execute: async () => ({ ok: true }),
    }),
    /Unsupported AP2 mandate version/,
  );
});

function manifestContext() {
  return {
    agent: { id: "agent:shopping-buyer" },
    owner: { id: "owner:alice" },
    wallet: {
      walletId: "wallet_ap2_1",
      signerRef: "signer_ref_ap2_1",
    },
    packageId: "0xap2package",
    module: "ap2_checkout",
    functionName: "execute_payment",
    templateId: "ap2_payment_v1",
    templateVersion: "1.0.0",
    maxGasBudget: 30_000_000,
    idempotencyKey: "ap2_checkout_hash_123_payment_456",
  };
}

function ap2MandateBundleFixture(): AP2MandateBundle {
  return {
    mode: "direct",
    checkoutMandate: {
      vct: "mandate.checkout.1",
      checkout_jwt: "checkout.jwt.private",
      checkout_hash: "checkout_hash_123",
      iat: 1_781_092_800,
      exp: 1_781_093_100,
    },
    paymentMandate: {
      vct: "mandate.payment.1",
      transaction_id: "checkout_hash_123",
      payment_mandate_id: "payment_txn_456",
      payee: {
        id: "merchant:running-store",
        name: "Running Store",
      },
      payment_amount: {
        amount: 27_999,
        currency: "USD",
      },
      payment_instrument: {
        id: "instrument_card_1",
        type: "card",
      },
      iat: 1_781_092_800,
      exp: 1_781_093_400,
      risk_data: {
        device: "private-device-fingerprint",
      },
    },
    trustedSurface: {
      id: "trusted-surface:web-checkout",
      nonAgentic: true,
    },
    disputeEvidenceReference: "ap2-dispute-evidence://case/checkout_hash_123",
  };
}

function successfulReceiptBundle() {
  return {
    checkoutReceipt: {
      status: "Success" as const,
      iss: "merchant:running-store",
      iat: 1_781_092_820,
      reference: "checkout_hash_123",
      order_id: "order_123",
    },
    paymentReceipt: {
      status: "Success" as const,
      iss: "pisp:test",
      iat: 1_781_092_840,
      reference: "payment_txn_456",
      payment_id: "payment_789",
      psp_confirmation_id: "psp_confirmation_1",
      network_confirmation_id: "network_confirmation_1",
    },
  };
}
