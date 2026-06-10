import assert from "node:assert/strict";
import { test } from "node:test";

import {
  approveReceipt,
  approvePayPerCallReceipt,
  approveServiceBountyReceipt,
  approveDataLicenseReceipt,
  completeEscrow,
  completePayPerCallReceipt,
  completeServiceBountyReceipt,
  createDataLicenseReceipt,
  createEscrowReceipt,
  createPayPerCallReceipt,
  createServiceBountyReceipt,
  denyDataLicenseReceipt,
  denyServiceBountyReceipt,
  expireEscrow,
  failDataLicenseReceipt,
  failPayPerCallReceipt,
  failServiceBountyReceipt,
  grantDataLicenseAccess,
  linkExternalPaymentState,
  linkIotaReceiptState,
  revokeDataLicenseAccess,
  releaseEscrow,
  releaseServiceBountyReceipt,
  refundEscrow,
  sponsorDataLicenseReceipt,
  sponsorPayPerCallReceipt,
  sponsorServiceBountyReceipt,
  sponsorReceipt,
  submitDataLicenseReceipt,
  submitPayPerCallReceipt,
  submitServiceBountyReceipt,
  submitReceipt,
  ReceiptInputError,
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

test("data-license receipt advances through access grant and revocation lifecycle", () => {
  const approved = approveDataLicenseReceipt(baseDataLicenseReceipt(), { at: now });
  const sponsored = sponsorDataLicenseReceipt(approved, {
    at: now,
    sponsorshipId: "mock_sponsorship_data_license_1",
  });
  const submitted = submitDataLicenseReceipt(sponsored, {
    at: now,
    transactionDigest: "digest_data_license_1",
  });
  const granted = grantDataLicenseAccess(submitted, {
    at: now,
    accessProofHash: "sha256:data-license-access-proof",
    expiresAt: "2026-07-10T12:00:00.000Z",
  });
  const revoked = revokeDataLicenseAccess(granted, {
    at: now,
    reason: "provider-rotated-dataset-key",
  });

  assert.equal(granted.status, "completed");
  assert.equal(granted.providerId, "agent:data-provider");
  assert.equal(granted.datasetId, "dataset:pricing-feed-v1");
  assert.equal(granted.termsHash, "sha256:data-license-terms");
  assert.equal(granted.accessProofHash, "sha256:data-license-access-proof");
  assert.equal(granted.expiresAt, "2026-07-10T12:00:00.000Z");
  assert.equal(revoked.status, "revoked");
  assert.equal(revoked.revocationReason, "provider-rotated-dataset-key");
  assert.deepEqual(revoked.events.map((event) => event.type), [
    "data_license_created",
    "approved",
    "sponsored",
    "submitted",
    "access_granted",
    "access_revoked",
  ]);
});

test("denied and failed data-license receipts cannot later grant access", () => {
  const denied = denyDataLicenseReceipt(baseDataLicenseReceipt(), {
    at: now,
    reason: "GAS_BUDGET_TOO_HIGH",
  });
  assert.equal(denied.status, "denied");
  assert.throws(
    () => grantDataLicenseAccess(denied, {
      at: now,
      accessProofHash: "sha256:late-access-proof",
    }),
    (error) => error instanceof ReceiptTransitionError && error.code === "INVALID_TRANSITION",
  );

  const approved = approveDataLicenseReceipt(baseDataLicenseReceipt(), { at: now });
  const failed = failDataLicenseReceipt(approved, {
    at: now,
    reason: "ACCESS_PROOF_INVALID",
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.failureReason, "ACCESS_PROOF_INVALID");
  assert.throws(
    () => grantDataLicenseAccess(failed, {
      at: now,
      accessProofHash: "sha256:late-access-proof",
    }),
    (error) => error instanceof ReceiptTransitionError && error.code === "INVALID_TRANSITION",
  );
});

test("data-license receipts reject blank terms and access proof evidence", () => {
  assert.throws(
    () => createDataLicenseReceipt({
      ...baseDataLicenseReceiptInput(),
      datasetId: " ",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );
  assert.throws(
    () => createDataLicenseReceipt({
      ...baseDataLicenseReceiptInput(),
      termsHash: "",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );

  const approved = approveDataLicenseReceipt(createDataLicenseReceipt(baseDataLicenseReceiptInput()), { at: now });
  const sponsored = sponsorDataLicenseReceipt(approved, {
    at: now,
    sponsorshipId: "mock_sponsorship_data_license_1",
  });
  const submitted = submitDataLicenseReceipt(sponsored, {
    at: now,
    transactionDigest: "digest_data_license_1",
  });

  assert.throws(
    () => grantDataLicenseAccess(submitted, {
      at: now,
      accessProofHash: "",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );
});

test("service-bounty receipt advances through completion and release lifecycle", () => {
  const approved = approveServiceBountyReceipt(baseServiceBountyReceipt(), { at: now });
  const sponsored = sponsorServiceBountyReceipt(approved, {
    at: now,
    sponsorshipId: "mock_sponsorship_service_bounty_1",
  });
  const submitted = submitServiceBountyReceipt(sponsored, {
    at: now,
    transactionDigest: "digest_service_bounty_1",
  });
  const completed = completeServiceBountyReceipt(submitted, {
    at: now,
    completionProofHash: "sha256:service-bounty-completion-proof",
  });
  const released = releaseServiceBountyReceipt(completed, {
    at: now,
    releaseProofHash: "sha256:service-bounty-release-proof",
  });

  assert.equal(released.status, "released");
  assert.equal(released.requesterId, "agent:bounty-requester");
  assert.equal(released.providerId, "agent:bounty-provider");
  assert.equal(released.bountyId, "bounty:research-summary-1");
  assert.equal(released.deliverableHash, "sha256:expected-deliverable");
  assert.equal(released.completionProofHash, "sha256:service-bounty-completion-proof");
  assert.equal(released.releaseProofHash, "sha256:service-bounty-release-proof");
  assert.deepEqual(released.events.map((event) => event.type), [
    "service_bounty_created",
    "approved",
    "sponsored",
    "submitted",
    "completed",
    "released",
  ]);
});

test("denied and failed service-bounty receipts cannot later release", () => {
  const denied = denyServiceBountyReceipt(baseServiceBountyReceipt(), {
    at: now,
    reason: "GAS_BUDGET_TOO_HIGH",
  });
  assert.equal(denied.status, "denied");
  assert.throws(
    () => releaseServiceBountyReceipt(denied, {
      at: now,
      releaseProofHash: "sha256:late-release",
    }),
    (error) => error instanceof ReceiptTransitionError && error.code === "INVALID_TRANSITION",
  );

  const failed = failServiceBountyReceipt(approveServiceBountyReceipt(baseServiceBountyReceipt(), { at: now }), {
    at: now,
    reason: "COMPLETION_PROOF_INVALID",
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.failureReason, "COMPLETION_PROOF_INVALID");
  assert.throws(
    () => releaseServiceBountyReceipt(failed, {
      at: now,
      releaseProofHash: "sha256:late-release",
    }),
    (error) => error instanceof ReceiptTransitionError && error.code === "INVALID_TRANSITION",
  );
});

test("service-bounty receipts reject blank bounty and proof evidence", () => {
  assert.throws(
    () => createServiceBountyReceipt({
      ...baseServiceBountyReceiptInput(),
      bountyId: "",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );
  assert.throws(
    () => createServiceBountyReceipt({
      ...baseServiceBountyReceiptInput(),
      deliverableHash: " ",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );

  const approved = approveServiceBountyReceipt(createServiceBountyReceipt(baseServiceBountyReceiptInput()), { at: now });
  const sponsored = sponsorServiceBountyReceipt(approved, {
    at: now,
    sponsorshipId: "mock_sponsorship_service_bounty_1",
  });
  const submitted = submitServiceBountyReceipt(sponsored, {
    at: now,
    transactionDigest: "digest_service_bounty_1",
  });

  assert.throws(
    () => completeServiceBountyReceipt(submitted, {
      at: now,
      completionProofHash: "",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
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

function baseDataLicenseReceipt() {
  return createDataLicenseReceipt(baseDataLicenseReceiptInput());
}

function baseDataLicenseReceiptInput() {
  return {
    receiptId: "receipt_data_license_1",
    manifestId: "idem_data_license_1",
    idempotencyKey: "idem_data_license_1",
    agentId: "agent:data-buyer",
    ownerId: "owner:data-buyer",
    providerId: "agent:data-provider",
    datasetId: "dataset:pricing-feed-v1",
    licenseeId: "agent:data-buyer",
    termsHash: "sha256:data-license-terms",
    amount: { amount: "7.50", asset: "USD" },
    createdAt: now,
  };
}

function baseServiceBountyReceipt() {
  return createServiceBountyReceipt(baseServiceBountyReceiptInput());
}

function baseServiceBountyReceiptInput() {
  return {
    receiptId: "receipt_service_bounty_1",
    manifestId: "idem_service_bounty_1",
    idempotencyKey: "idem_service_bounty_1",
    agentId: "agent:bounty-requester",
    ownerId: "owner:bounty-requester",
    requesterId: "agent:bounty-requester",
    providerId: "agent:bounty-provider",
    bountyId: "bounty:research-summary-1",
    deliverableHash: "sha256:expected-deliverable",
    amount: { amount: "12.00", asset: "USD" },
    createdAt: now,
  };
}
