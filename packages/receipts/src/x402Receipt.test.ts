import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createX402ExternalPaymentReceiptState,
  redactX402PaymentMetadata,
} from "./x402Receipt.js";

test("x402 receipt evidence links external payment state without collapsing IOTA state", () => {
  const state = createX402ExternalPaymentReceiptState({
    paymentId: "pay_1234567890abcdef1234567890abcdef",
    verify: {
      isValid: true,
      payer: "0x2222222222222222222222222222222222222222",
    },
    settle: {
      success: true,
      payer: "0x2222222222222222222222222222222222222222",
      transaction: "0x89c91c789e57059b17285e7ba1716a1f5ff4c5dace0ea5a5135f26158d0421b9",
      network: "eip155:84532",
      amount: "1000",
    },
  });

  assert.deepEqual(state.linkedState, {
    status: "succeeded",
    referenceId: "x402:pay_1234567890abcdef1234567890abcdef",
  });
  assert.equal(state.metadata.x402PaymentId, "pay_1234567890abcdef1234567890abcdef");
  assert.equal(state.metadata.x402VerifyStatus, "valid");
  assert.equal(state.metadata.x402SettlementStatus, "succeeded");
  assert.equal(state.metadata.x402Network, "eip155:84532");
  assert.equal(state.metadata.x402Transaction, "0x89c91c789e57059b17285e7ba1716a1f5ff4c5dace0ea5a5135f26158d0421b9");
});

test("x402 receipt evidence redacts sensitive external payment metadata", () => {
  const redacted = redactX402PaymentMetadata({
    paymentId: "pay_1234567890abcdef1234567890abcdef",
    payer: "0x2222222222222222222222222222222222222222",
    paymentPayload: {
      payload: {
        signature: "0xsensitive",
        authorization: {
          from: "0x2222222222222222222222222222222222222222",
        },
      },
    },
    paymentCredential: "secret",
    nested: {
      signedAuthorization: "secret",
      payerAddress: "0x2222222222222222222222222222222222222222",
      eip3009Signature: "0xsensitive",
      safe: "kept",
    },
  }) as Record<string, unknown>;

  assert.equal(redacted.paymentId, "pay_1234567890abcdef1234567890abcdef");
  assert.equal(redacted.payer, "[REDACTED]");
  assert.equal(redacted.paymentPayload, "[REDACTED]");
  assert.equal(redacted.paymentCredential, "[REDACTED]");
  assert.deepEqual(redacted.nested, {
    signedAuthorization: "[REDACTED]",
    payerAddress: "[REDACTED]",
    eip3009Signature: "[REDACTED]",
    safe: "kept",
  });
  assert.equal(JSON.stringify(redacted).includes("0xsensitive"), false);
  assert.equal(JSON.stringify(redacted).includes("secret"), false);
});
