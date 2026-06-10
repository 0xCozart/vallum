import assert from "node:assert/strict";
import { test } from "node:test";

import {
  approveReceipt,
  approvePayPerCallReceipt,
  completeEscrow,
  completePayPerCallReceipt,
  createEscrowReceipt,
  createPayPerCallReceipt,
  expireEscrow,
  failPayPerCallReceipt,
  linkExternalPaymentState,
  linkIotaReceiptState,
  releaseEscrow,
  refundEscrow,
  sponsorPayPerCallReceipt,
  sponsorReceipt,
  submitPayPerCallReceipt,
  submitReceipt,
  ReceiptTransitionError,
} from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");

test("escrow receipt advances through sponsored release lifecycle", () => {
  const completed = completedEscrowReceipt();
  const released = releaseEscrow(completed, {
    at: now,
    verifierId: "verifier:alice",
    releaseProofHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  });

  assert.equal(released.status, "released");
  assert.equal(released.escrow.status, "released");
  assert.equal(released.sponsorshipId, "mock_sponsorship_receipt_1");
  assert.equal(released.transactionDigest, "digest_receipt_1");
  assert.deepEqual(released.events.map((event) => event.type), [
    "escrow_created",
    "approved",
    "sponsored",
    "submitted",
    "completed",
    "released",
  ]);
});

test("double release is denied", () => {
  const released = releaseEscrow(completedEscrowReceipt(), {
    at: now,
    verifierId: "verifier:alice",
    releaseProofHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  });

  assert.throws(
    () => releaseEscrow(released, {
      at: now,
      verifierId: "verifier:alice",
      releaseProofHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    }),
    (error) => error instanceof ReceiptTransitionError && error.code === "INVALID_TRANSITION",
  );
});

test("unauthorized verifier release is denied", () => {
  assert.throws(
    () => releaseEscrow(completedEscrowReceipt(), {
      at: now,
      verifierId: "verifier:bob",
      releaseProofHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    }),
    (error) => error instanceof ReceiptTransitionError && error.code === "UNAUTHORIZED_VERIFIER",
  );
});

test("escrow can refund before release and cannot release afterward", () => {
  const refunded = refundEscrow(completedEscrowReceipt(), {
    at: now,
    reason: "Verifier rejected completion evidence.",
  });

  assert.equal(refunded.status, "refunded");
  assert.equal(refunded.escrow.status, "refunded");
  assert.equal(refunded.refundReason, "Verifier rejected completion evidence.");
  assert.throws(
    () => releaseEscrow(refunded, {
      at: now,
      verifierId: "verifier:alice",
      releaseProofHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    }),
    (error) => error instanceof ReceiptTransitionError && error.code === "INVALID_TRANSITION",
  );
});

test("escrow can expire to refunded receipt state", () => {
  const expired = expireEscrow(approveReceipt(baseEscrowReceipt(), { at: now }), {
    at: now,
    reason: "Escrow expired before submission.",
  });

  assert.equal(expired.status, "refunded");
  assert.equal(expired.escrow.status, "expired");
  assert.equal(expired.events.at(-1)?.type, "expired");
});

test("external payment and IOTA receipt states can diverge without data loss", () => {
  const receipt = linkIotaReceiptState(
    linkExternalPaymentState(completedEscrowReceipt(), {
      status: "succeeded",
      referenceId: "payment_1",
    }),
    {
      status: "failed",
      referenceId: "iota_receipt_1",
    },
  );

  assert.deepEqual(receipt.externalPayment, {
    status: "succeeded",
    referenceId: "payment_1",
  });
  assert.deepEqual(receipt.iotaReceipt, {
    status: "failed",
    referenceId: "iota_receipt_1",
  });
  assert.equal(receipt.status, "completed");
});

test("pay-per-call receipt advances through paid result lifecycle", () => {
  const approved = approvePayPerCallReceipt(basePayPerCallReceipt(), { at: now });
  const sponsored = sponsorPayPerCallReceipt(approved, {
    at: now,
    sponsorshipId: "mock_sponsorship_paid_call_1",
  });
  const submitted = submitPayPerCallReceipt(sponsored, {
    at: now,
    transactionDigest: "digest_paid_call_1",
  });
  const completed = completePayPerCallReceipt(submitted, {
    at: now,
    resultHash: "sha256:paid-call-result",
  });

  assert.equal(completed.status, "completed");
  assert.equal(completed.providerId, "agent:paid-tool-provider");
  assert.equal(completed.toolName, "premium_analysis");
  assert.equal(completed.sponsorshipId, "mock_sponsorship_paid_call_1");
  assert.equal(completed.transactionDigest, "digest_paid_call_1");
  assert.equal(completed.resultHash, "sha256:paid-call-result");
  assert.deepEqual(completed.events.map((event) => event.type), [
    "pay_per_call_created",
    "approved",
    "sponsored",
    "submitted",
    "completed",
  ]);
});

test("failed pay-per-call receipt cannot later complete", () => {
  const approved = approvePayPerCallReceipt(basePayPerCallReceipt(), { at: now });
  const failed = failPayPerCallReceipt(approved, {
    at: now,
    reason: "payment-failed",
  });

  assert.equal(failed.status, "failed");
  assert.equal(failed.failureReason, "payment-failed");
  assert.throws(
    () => completePayPerCallReceipt(failed, {
      at: now,
      resultHash: "sha256:late-result",
    }),
    (error) => error instanceof ReceiptTransitionError && error.code === "INVALID_TRANSITION",
  );
});

function baseEscrowReceipt() {
  return createEscrowReceipt({
    receiptId: "receipt_escrow_1",
    manifestId: "idem_quote_bot_20260610_0001",
    idempotencyKey: "idem_quote_bot_20260610_0001",
    agentId: "agent:quote-bot",
    ownerId: "owner:alice",
    providerId: "provider:quote-service",
    verifierId: "verifier:alice",
    amount: { amount: "10.00", asset: "USD" },
    createdAt: now,
  });
}

function completedEscrowReceipt() {
  const approved = approveReceipt(baseEscrowReceipt(), { at: now });
  const sponsored = sponsorReceipt(approved, {
    at: now,
    sponsorshipId: "mock_sponsorship_receipt_1",
  });
  const submitted = submitReceipt(sponsored, {
    at: now,
    transactionDigest: "digest_receipt_1",
  });
  return completeEscrow(submitted, {
    at: now,
    evidenceHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
}

function basePayPerCallReceipt() {
  return createPayPerCallReceipt({
    receiptId: "receipt_paid_call_1",
    manifestId: "idem_paid_call_1",
    idempotencyKey: "idem_paid_call_1",
    agentId: "agent:paid-tool-buyer",
    ownerId: "owner:paid-tool-buyer",
    providerId: "agent:paid-tool-provider",
    toolName: "premium_analysis",
    amount: { amount: "3.00", asset: "USD" },
    createdAt: now,
  });
}
