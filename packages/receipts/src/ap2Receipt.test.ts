import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AP2ReceiptError,
  createAP2MandateReceiptState,
  redactAP2MandateMetadata,
} from "./ap2Receipt.js";

test("AP2 receipt evidence preserves dispute references and linked receipt state", () => {
  const state = createAP2MandateReceiptState({
    manifestId: "ap2_checkout_hash_123_payment_456",
    checkoutHash: "checkout_hash_123",
    paymentMandateId: "payment_txn_456",
    disputeEvidenceReference: "ap2-dispute-evidence://case/checkout_hash_123",
    checkoutReceipt: {
      status: "Success",
      iss: "merchant:running-store",
      iat: 1_781_092_820,
      reference: "checkout_hash_123",
      order_id: "order_123",
    },
    paymentReceipt: {
      status: "Success",
      iss: "pisp:test",
      iat: 1_781_092_840,
      reference: "payment_txn_456",
      payment_id: "payment_789",
      psp_confirmation_id: "psp_confirmation_1",
      network_confirmation_id: "network_confirmation_1",
    },
  });

  assert.deepEqual(state.linkedState, {
    status: "succeeded",
    referenceId: "ap2:payment_789",
  });
  assert.equal(state.metadata.ap2ManifestId, "ap2_checkout_hash_123_payment_456");
  assert.equal(state.metadata.ap2CheckoutReceiptStatus, "Success");
  assert.equal(state.metadata.ap2PaymentReceiptStatus, "Success");
  assert.equal(state.metadata.ap2DisputeEvidenceReference, "ap2-dispute-evidence://case/checkout_hash_123");
  assert.equal(state.metadata.ap2OrderId, "order_123");
  assert.equal(state.metadata.ap2PspConfirmationId, "psp_confirmation_1");
});

test("AP2 receipt evidence fails linked state when either receipt is an error", () => {
  const state = createAP2MandateReceiptState({
    manifestId: "ap2_checkout_hash_123_payment_456",
    checkoutHash: "checkout_hash_123",
    paymentMandateId: "payment_txn_456",
    checkoutReceipt: {
      status: "Success",
      iss: "merchant:running-store",
      iat: 1_781_092_820,
      reference: "checkout_hash_123",
      order_id: "order_123",
    },
    paymentReceipt: {
      status: "Error",
      iss: "pisp:test",
      iat: 1_781_092_840,
      reference: "payment_txn_456",
      payment_id: "payment_789",
      error: "insufficient_funds",
      error_description: "Do not log private issuer text.",
    },
  });

  assert.equal(state.linkedState.status, "failed");
  assert.equal(state.metadata.ap2PaymentError, "insufficient_funds");
});

test("AP2 receipt evidence fails closed when receipt references do not bind to mandates", () => {
  assert.throws(
    () => createAP2MandateReceiptState({
      manifestId: "ap2_checkout_hash_123_payment_456",
      checkoutHash: "checkout_hash_123",
      paymentMandateId: "payment_txn_456",
      checkoutReceipt: {
        status: "Success",
        iss: "merchant:running-store",
        iat: 1_781_092_820,
        reference: "other_checkout_hash",
        order_id: "order_123",
      },
      paymentReceipt: {
        status: "Success",
        iss: "pisp:test",
        iat: 1_781_092_840,
        reference: "payment_txn_456",
        payment_id: "payment_789",
      },
    }),
    (error) => error instanceof AP2ReceiptError && error.code === "AP2_RECEIPT_REFERENCE_MISMATCH",
  );

  assert.throws(
    () => createAP2MandateReceiptState({
      manifestId: "ap2_checkout_hash_123_payment_456",
      checkoutHash: "checkout_hash_123",
      paymentMandateId: "payment_txn_456",
      checkoutReceipt: {
        status: "Success",
        iss: "merchant:running-store",
        iat: 1_781_092_820,
        reference: "checkout_hash_123",
        order_id: "order_123",
      },
      paymentReceipt: {
        status: "Success",
        iss: "pisp:test",
        iat: 1_781_092_840,
        reference: "other_payment_mandate",
        payment_id: "payment_789",
      },
    }),
    (error) => error instanceof AP2ReceiptError && error.code === "AP2_RECEIPT_REFERENCE_MISMATCH",
  );
});

test("AP2 metadata redaction removes private mandate payloads and payment context", () => {
  const redacted = redactAP2MandateMetadata({
    checkout_jwt: "checkout.jwt.private",
    user_authorization: "user.authorization.private",
    merchant_authorization: "merchant.authorization.private",
    payment_instrument: {
      id: "instrument_card_1",
      type: "card",
    },
    risk_data: {
      device: "private-device-fingerprint",
    },
    nested: {
      credentialJwt: "credential.private",
      signature: "sig.private",
      safe: "kept",
    },
  }) as Record<string, unknown>;

  assert.equal(redacted.checkout_jwt, "[REDACTED]");
  assert.equal(redacted.user_authorization, "[REDACTED]");
  assert.equal(redacted.merchant_authorization, "[REDACTED]");
  assert.equal(redacted.payment_instrument, "[REDACTED]");
  assert.equal(redacted.risk_data, "[REDACTED]");
  assert.deepEqual(redacted.nested, {
    credentialJwt: "[REDACTED]",
    signature: "[REDACTED]",
    safe: "kept",
  });
  assert.equal(JSON.stringify(redacted).includes("private"), false);
});
