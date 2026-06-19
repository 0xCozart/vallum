import assert from "node:assert/strict";
import { test } from "node:test";

import {
  approveReceipt,
  approvePayPerCallReceipt,
  approveReputationReceipt,
  approveServiceBountyReceipt,
  approveSubscriptionReceipt,
  approveDataLicenseReceipt,
  activateSubscriptionReceipt,
  cancelSubscriptionReceipt,
  completeEscrow,
  completePayPerCallReceipt,
  completeReputationReceipt,
  completeServiceBountyReceipt,
  createDataLicenseReceipt,
  createEscrowReceipt,
  createPayPerCallReceipt,
  createReputationReceipt,
  createServiceBountyReceipt,
  createSubscriptionReceipt,
  denyDataLicenseReceipt,
  denyReputationReceipt,
  denyServiceBountyReceipt,
  denySubscriptionReceipt,
  expireEscrow,
  failDataLicenseReceipt,
  failPayPerCallReceipt,
  failReputationReceipt,
  failServiceBountyReceipt,
  failSubscriptionReceipt,
  grantDataLicenseAccess,
  linkExternalPaymentState,
  linkIotaReceiptState,
  renewSubscriptionReceipt,
  recordEscrowSettlementOpen,
  recordEscrowSettlementRefund,
  recordEscrowSettlementRelease,
  revokeDataLicenseAccess,
  releaseEscrow,
  releaseServiceBountyReceipt,
  refundEscrow,
  sponsorDataLicenseReceipt,
  sponsorPayPerCallReceipt,
  sponsorReputationReceipt,
  sponsorServiceBountyReceipt,
  sponsorSubscriptionReceipt,
  sponsorReceipt,
  submitDataLicenseReceipt,
  submitPayPerCallReceipt,
  submitReputationReceipt,
  submitServiceBountyReceipt,
  submitSubscriptionReceipt,
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

test("escrow settlement release records fee split and replay-safe receipt hashes", () => {
  const opened = recordEscrowSettlementOpen(sponsoredIotaEscrowReceipt(), {
    at: now,
    settlementRail: "iota-testnet",
    escrowId: "escrow:testnet:agent-action:1",
    releaseMode: "proof",
    invocationId: "invocation:agent-action:1",
    actionId: "action:agent-action",
    actionContractId: "action-contract:agent-action",
    actionContractVersion: "1.0.0",
    providerPayoutRef: "provider-payout:provider-wallet",
    platformFeeRef: "platform-fee:vallum",
    refundAuthorityRef: "refund-authority:buyer-agent",
    refundDestinationRef: "refund:buyer-wallet",
    providerNetAmount: { amount: "9.50", asset: "IOTA" },
    platformFeeAmount: { amount: "0.50", asset: "IOTA" },
    assetType: "0x2::iota::IOTA",
    grossAmountBaseUnits: "10000000000",
    providerNetBaseUnits: "9500000000",
    platformFeeBaseUnits: "500000000",
    refundAfterEpochMs: "1781094600000",
    allowPayeeRelease: false,
    transactionDigest: "digest_open_escrow_1",
  });
  const completed = completeEscrow(opened, {
    at: now,
    evidenceHash: "sha256:provider-evidence",
  });
  const released = recordEscrowSettlementRelease(completed, {
    at: now,
    verifierId: "verifier:alice",
    escrowId: "escrow:testnet:agent-action:1",
    invocationId: "invocation:agent-action:1",
    releaseProofHash: "sha256:release-proof",
    providerExecutionReceiptHash: "sha256:provider-execution-receipt",
    evidenceAttestationHash: "sha256:evidence-attestation",
    settlementReceiptHash: "sha256:settlement-receipt",
    buyerFacingReceiptHash: "sha256:buyer-facing-receipt",
    transactionDigest: "digest_release_escrow_1",
  });

  assert.equal(released.status, "released");
  assert.equal(released.escrow.status, "released");
  assert.equal(released.escrowSettlement?.status, "released");
  assert.equal(released.escrowSettlement?.escrowId, "escrow:testnet:agent-action:1");
  assert.equal(released.escrowSettlement?.providerNetAmount.amount, "9.50");
  assert.equal(released.escrowSettlement?.platformFeeAmount.amount, "0.50");
  assert.equal(released.escrowSettlement?.refundAuthorityRef, "refund-authority:buyer-agent");
  assert.equal(released.escrowSettlement?.assetType, "0x2::iota::IOTA");
  assert.equal(released.escrowSettlement?.grossAmountBaseUnits, "10000000000");
  assert.equal(released.escrowSettlement?.providerNetBaseUnits, "9500000000");
  assert.equal(released.escrowSettlement?.platformFeeBaseUnits, "500000000");
  assert.equal(released.escrowSettlement?.refundAfterEpochMs, "1781094600000");
  assert.equal(released.escrowSettlement?.allowPayeeRelease, false);
  assert.equal(released.escrowSettlement?.platformFeePaid, true);
  assert.equal(released.escrowSettlement?.providerExecutionReceiptHash, "sha256:provider-execution-receipt");
  assert.equal(released.escrowSettlement?.evidenceAttestationHash, "sha256:evidence-attestation");
  assert.equal(released.escrowSettlement?.settlementReceiptHash, "sha256:settlement-receipt");
  assert.equal(released.escrowSettlement?.buyerFacingReceiptHash, "sha256:buyer-facing-receipt");
  assert.equal(released.escrowSettlement?.settlementTransactionDigest, "digest_release_escrow_1");
});

test("escrow settlement open rejects invalid fee splits", () => {
  assert.throws(
    () => recordEscrowSettlementOpen(sponsoredIotaEscrowReceipt(), {
      at: now,
      settlementRail: "iota-testnet",
      escrowId: "escrow:testnet:agent-action:2",
      releaseMode: "proof",
      invocationId: "invocation:agent-action:2",
      actionId: "action:agent-action",
      actionContractId: "action-contract:agent-action",
      actionContractVersion: "1.0.0",
      providerPayoutRef: "provider-payout:provider-wallet",
      platformFeeRef: "platform-fee:vallum",
      refundAuthorityRef: "refund-authority:buyer-agent",
      refundDestinationRef: "refund:buyer-wallet",
      providerNetAmount: { amount: "9.00", asset: "IOTA" },
      platformFeeAmount: { amount: "0.50", asset: "IOTA" },
      assetType: "0x2::iota::IOTA",
      grossAmountBaseUnits: "10000000000",
      providerNetBaseUnits: "9500000000",
      platformFeeBaseUnits: "500000000",
      refundAfterEpochMs: "1781094600000",
      allowPayeeRelease: false,
      transactionDigest: "digest_open_escrow_2",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );
});

test("escrow settlement open rejects invalid custody base-unit splits", () => {
  assert.throws(
    () => recordEscrowSettlementOpen(sponsoredIotaEscrowReceipt(), {
      at: now,
      settlementRail: "iota-testnet",
      escrowId: "escrow:testnet:agent-action:base-units",
      releaseMode: "proof",
      invocationId: "invocation:agent-action:base-units",
      actionId: "action:agent-action",
      actionContractId: "action-contract:agent-action",
      actionContractVersion: "1.0.0",
      providerPayoutRef: "provider-payout:provider-wallet",
      platformFeeRef: "platform-fee:vallum",
      refundAuthorityRef: "refund-authority:buyer-agent",
      refundDestinationRef: "refund:buyer-wallet",
      providerNetAmount: { amount: "9.50", asset: "IOTA" },
      platformFeeAmount: { amount: "0.50", asset: "IOTA" },
      assetType: "0x2::iota::IOTA",
      grossAmountBaseUnits: "10000000000",
      providerNetBaseUnits: "9000000000",
      platformFeeBaseUnits: "500000000",
      refundAfterEpochMs: "1781094600000",
      allowPayeeRelease: false,
      transactionDigest: "digest_open_escrow_base_units",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );
});

test("escrow settlement open rejects invalid rails and raw settlement addresses", () => {
  assert.throws(
    () => recordEscrowSettlementOpen(sponsoredIotaEscrowReceipt(), {
      at: now,
      settlementRail: "production" as never,
      escrowId: "escrow:testnet:agent-action:invalid-rail",
      releaseMode: "proof",
      invocationId: "invocation:agent-action:invalid-rail",
      actionId: "action:agent-action",
      actionContractId: "action-contract:agent-action",
      actionContractVersion: "1.0.0",
      providerPayoutRef: "provider-payout:provider-wallet",
      platformFeeRef: "platform-fee:vallum",
      refundAuthorityRef: "refund-authority:buyer-agent",
      refundDestinationRef: "refund:buyer-wallet",
      providerNetAmount: { amount: "9.50", asset: "IOTA" },
      platformFeeAmount: { amount: "0.50", asset: "IOTA" },
      assetType: "0x2::iota::IOTA",
      grossAmountBaseUnits: "10000000000",
      providerNetBaseUnits: "9500000000",
      platformFeeBaseUnits: "500000000",
      refundAfterEpochMs: "1781094600000",
      allowPayeeRelease: false,
      transactionDigest: "digest_open_escrow_invalid_rail",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );
  assert.throws(
    () => recordEscrowSettlementOpen(sponsoredIotaEscrowReceipt(), {
      at: now,
      settlementRail: "iota-testnet",
      escrowId: "escrow:testnet:agent-action:raw-address",
      releaseMode: "proof",
      invocationId: "invocation:agent-action:raw-address",
      actionId: "action:agent-action",
      actionContractId: "action-contract:agent-action",
      actionContractVersion: "1.0.0",
      providerPayoutRef: "iota1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
      platformFeeRef: "platform-fee:vallum",
      refundAuthorityRef: "refund-authority:buyer-agent",
      refundDestinationRef: "refund:buyer-wallet",
      providerNetAmount: { amount: "9.50", asset: "IOTA" },
      platformFeeAmount: { amount: "0.50", asset: "IOTA" },
      assetType: "0x2::iota::IOTA",
      grossAmountBaseUnits: "10000000000",
      providerNetBaseUnits: "9500000000",
      platformFeeBaseUnits: "500000000",
      refundAfterEpochMs: "1781094600000",
      allowPayeeRelease: false,
      transactionDigest: "digest_open_escrow_raw_address",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );
});

test("escrow settlement refund records refund evidence without paying platform fee", () => {
  const opened = recordEscrowSettlementOpen(sponsoredIotaEscrowReceipt(), {
    at: now,
    settlementRail: "iota-testnet",
    escrowId: "escrow:testnet:agent-action:3",
    releaseMode: "proof",
    invocationId: "invocation:agent-action:3",
    actionId: "action:agent-action",
    actionContractId: "action-contract:agent-action",
    actionContractVersion: "1.0.0",
    providerPayoutRef: "provider-payout:provider-wallet",
    platformFeeRef: "platform-fee:vallum",
    refundAuthorityRef: "refund-authority:buyer-agent",
    refundDestinationRef: "refund:buyer-wallet",
    providerNetAmount: { amount: "9.50", asset: "IOTA" },
    platformFeeAmount: { amount: "0.50", asset: "IOTA" },
    assetType: "0x2::iota::IOTA",
    grossAmountBaseUnits: "10000000000",
    providerNetBaseUnits: "9500000000",
    platformFeeBaseUnits: "500000000",
    refundAfterEpochMs: "1781094600000",
    allowPayeeRelease: false,
    transactionDigest: "digest_open_escrow_3",
  });
  const refunded = recordEscrowSettlementRefund(opened, {
    at: now,
    escrowId: "escrow:testnet:agent-action:3",
    invocationId: "invocation:agent-action:3",
    reason: "invalid-evidence",
    settlementReceiptHash: "sha256:refund-settlement-receipt",
    buyerFacingReceiptHash: "sha256:refund-buyer-facing-receipt",
    transactionDigest: "digest_refund_escrow_3",
  });

  assert.equal(refunded.status, "refunded");
  assert.equal(refunded.escrow.status, "refunded");
  assert.equal(refunded.escrowSettlement?.status, "refunded");
  assert.equal(refunded.escrowSettlement?.platformFeePaid, false);
  assert.equal(refunded.escrowSettlement?.refundReason, "invalid-evidence");
  assert.equal(refunded.escrowSettlement?.settlementReceiptHash, "sha256:refund-settlement-receipt");
  assert.equal(refunded.escrowSettlement?.buyerFacingReceiptHash, "sha256:refund-buyer-facing-receipt");
  assert.equal(refunded.escrowSettlement?.settlementTransactionDigest, "digest_refund_escrow_3");
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

test("reputation receipt advances through attested evidence lifecycle", () => {
  const approved = approveReputationReceipt(baseReputationReceipt(), { at: now });
  const sponsored = sponsorReputationReceipt(approved, {
    at: now,
    sponsorshipId: "mock_sponsorship_reputation_1",
  });
  const submitted = submitReputationReceipt(sponsored, {
    at: now,
    transactionDigest: "digest_reputation_1",
  });
  const completed = completeReputationReceipt(submitted, {
    at: now,
    score: 5,
    evidenceHash: "sha256:reputation-evidence",
    attestationHash: "sha256:reputation-attestation",
  });

  assert.equal(completed.status, "completed");
  assert.equal(completed.issuerId, "agent:reputation-issuer");
  assert.equal(completed.subjectId, "agent:service-provider");
  assert.equal(completed.interactionId, "task:research-summary-1");
  assert.equal(completed.score, 5);
  assert.equal(completed.evidenceHash, "sha256:reputation-evidence");
  assert.equal(completed.attestationHash, "sha256:reputation-attestation");
  assert.deepEqual(completed.events.map((event) => event.type), [
    "reputation_receipt_created",
    "approved",
    "sponsored",
    "submitted",
    "completed",
  ]);
});

test("denied and failed reputation receipts cannot later complete", () => {
  const denied = denyReputationReceipt(baseReputationReceipt(), {
    at: now,
    reason: "COUNTERPARTY_NOT_ALLOWED",
  });
  assert.equal(denied.status, "denied");
  assert.throws(
    () => completeReputationReceipt(denied, {
      at: now,
      score: 5,
      evidenceHash: "sha256:late-evidence",
      attestationHash: "sha256:late-attestation",
    }),
    (error) => error instanceof ReceiptTransitionError && error.code === "INVALID_TRANSITION",
  );

  const failed = failReputationReceipt(approveReputationReceipt(baseReputationReceipt(), { at: now }), {
    at: now,
    reason: "REPUTATION_EVIDENCE_INVALID",
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.failureReason, "REPUTATION_EVIDENCE_INVALID");
  assert.throws(
    () => completeReputationReceipt(failed, {
      at: now,
      score: 5,
      evidenceHash: "sha256:late-evidence",
      attestationHash: "sha256:late-attestation",
    }),
    (error) => error instanceof ReceiptTransitionError && error.code === "INVALID_TRANSITION",
  );
});

test("reputation receipts reject blank fields and malformed score", () => {
  assert.throws(
    () => createReputationReceipt({
      ...baseReputationReceiptInput(),
      interactionId: "",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );
  assert.throws(
    () => createReputationReceipt({
      ...baseReputationReceiptInput(),
      issuerId: "agent:spoofed-issuer",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );

  const approved = approveReputationReceipt(createReputationReceipt(baseReputationReceiptInput()), { at: now });
  const sponsored = sponsorReputationReceipt(approved, {
    at: now,
    sponsorshipId: "mock_sponsorship_reputation_1",
  });
  const submitted = submitReputationReceipt(sponsored, {
    at: now,
    transactionDigest: "digest_reputation_1",
  });

  assert.throws(
    () => completeReputationReceipt(submitted, {
      at: now,
      score: 0,
      evidenceHash: "sha256:reputation-evidence",
      attestationHash: "sha256:reputation-attestation",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );
  assert.throws(
    () => completeReputationReceipt(submitted, {
      at: now,
      score: 5,
      evidenceHash: " ",
      attestationHash: "sha256:reputation-attestation",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );
});

test("subscription receipt advances through activation renewal and cancellation lifecycle", () => {
  const approved = approveSubscriptionReceipt(baseSubscriptionReceipt(), { at: now });
  const sponsored = sponsorSubscriptionReceipt(approved, {
    at: now,
    sponsorshipId: "mock_sponsorship_subscription_1",
  });
  const submitted = submitSubscriptionReceipt(sponsored, {
    at: now,
    transactionDigest: "digest_subscription_1",
  });
  const active = activateSubscriptionReceipt(submitted, {
    at: now,
    activationProofHash: "sha256:subscription-activation-proof",
  });
  const renewed = renewSubscriptionReceipt(active, {
    at: now,
    periodEnd: "2026-08-10T12:00:00.000Z",
    renewalProofHash: "sha256:subscription-renewal-proof",
  });
  const canceled = cancelSubscriptionReceipt(renewed, {
    at: now,
    reason: "subscriber-canceled",
  });

  assert.equal(active.status, "active");
  assert.equal(renewed.status, "renewed");
  assert.equal(canceled.status, "canceled");
  assert.equal(renewed.subscriberId, "agent:subscription-buyer");
  assert.equal(renewed.providerId, "agent:subscription-provider");
  assert.equal(renewed.planId, "plan:research-feed-monthly");
  assert.equal(renewed.termsHash, "sha256:subscription-terms");
  assert.equal(renewed.periodEnd, "2026-08-10T12:00:00.000Z");
  assert.equal(renewed.renewalCount, 1);
  assert.equal(renewed.activationProofHash, "sha256:subscription-activation-proof");
  assert.equal(renewed.renewalProofHash, "sha256:subscription-renewal-proof");
  assert.deepEqual(canceled.events.map((event) => event.type), [
    "subscription_created",
    "approved",
    "sponsored",
    "submitted",
    "activated",
    "renewed",
    "canceled",
  ]);
});

test("denied failed and canceled subscription receipts cannot later activate or renew", () => {
  const denied = denySubscriptionReceipt(baseSubscriptionReceipt(), {
    at: now,
    reason: "GAS_BUDGET_TOO_HIGH",
  });
  assert.equal(denied.status, "denied");
  assert.throws(
    () => activateSubscriptionReceipt(denied, {
      at: now,
      activationProofHash: "sha256:late-activation",
    }),
    (error) => error instanceof ReceiptTransitionError && error.code === "INVALID_TRANSITION",
  );

  const failed = failSubscriptionReceipt(approveSubscriptionReceipt(baseSubscriptionReceipt(), { at: now }), {
    at: now,
    reason: "SUBSCRIPTION_PROOF_INVALID",
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.failureReason, "SUBSCRIPTION_PROOF_INVALID");
  assert.throws(
    () => activateSubscriptionReceipt(failed, {
      at: now,
      activationProofHash: "sha256:late-activation",
    }),
    (error) => error instanceof ReceiptTransitionError && error.code === "INVALID_TRANSITION",
  );

  const submitted = submitSubscriptionReceipt(
    sponsorSubscriptionReceipt(approveSubscriptionReceipt(baseSubscriptionReceipt(), { at: now }), {
      at: now,
      sponsorshipId: "mock_sponsorship_subscription_1",
    }),
    { at: now, transactionDigest: "digest_subscription_1" },
  );
  const canceled = cancelSubscriptionReceipt(activateSubscriptionReceipt(submitted, {
    at: now,
    activationProofHash: "sha256:subscription-activation-proof",
  }), {
    at: now,
    reason: "subscriber-canceled",
  });
  assert.throws(
    () => renewSubscriptionReceipt(canceled, {
      at: now,
      periodEnd: "2026-08-10T12:00:00.000Z",
      renewalProofHash: "sha256:late-renewal",
    }),
    (error) => error instanceof ReceiptTransitionError && error.code === "INVALID_TRANSITION",
  );
});

test("subscription receipts reject blank fields malformed proofs and backwards renewal periods", () => {
  assert.throws(
    () => createSubscriptionReceipt({
      ...baseSubscriptionReceiptInput(),
      planId: "",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );
  assert.throws(
    () => createSubscriptionReceipt({
      ...baseSubscriptionReceiptInput(),
      subscriberId: "agent:spoofed-subscriber",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );

  const submitted = submitSubscriptionReceipt(
    sponsorSubscriptionReceipt(approveSubscriptionReceipt(createSubscriptionReceipt(baseSubscriptionReceiptInput()), {
      at: now,
    }), {
      at: now,
      sponsorshipId: "mock_sponsorship_subscription_1",
    }),
    { at: now, transactionDigest: "digest_subscription_1" },
  );

  assert.throws(
    () => activateSubscriptionReceipt(submitted, {
      at: now,
      activationProofHash: "raw bearer token access-token",
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );

  const active = activateSubscriptionReceipt(submitted, {
    at: now,
    activationProofHash: "sha256:subscription-activation-proof",
  });
  assert.throws(
    () => renewSubscriptionReceipt(active, {
      at: now,
      periodEnd: "2026-06-01T12:00:00.000Z",
      renewalProofHash: "sha256:subscription-renewal-proof",
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

function sponsoredIotaEscrowReceipt() {
  const approved = approveReceipt(createEscrowReceipt({
    receiptId: "receipt_iota_escrow_1",
    manifestId: "idem_iota_escrow_1",
    idempotencyKey: "idem_iota_escrow_1",
    agentId: "agent:quote-bot",
    ownerId: "owner:alice",
    providerId: "provider:quote-service",
    verifierId: "verifier:alice",
    amount: { amount: "10.00", asset: "IOTA" },
    createdAt: now,
  }), { at: now });
  return sponsorReceipt(approved, {
    at: now,
    sponsorshipId: "mock_sponsorship_iota_escrow_1",
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

function baseReputationReceipt() {
  return createReputationReceipt(baseReputationReceiptInput());
}

function baseReputationReceiptInput() {
  return {
    receiptId: "receipt_reputation_1",
    manifestId: "idem_reputation_1",
    idempotencyKey: "idem_reputation_1",
    agentId: "agent:reputation-issuer",
    ownerId: "owner:reputation-issuer",
    issuerId: "agent:reputation-issuer",
    subjectId: "agent:service-provider",
    interactionId: "task:research-summary-1",
    criteriaHash: "sha256:reputation-criteria",
    amount: { amount: "0.00", asset: "USD" },
    createdAt: now,
  };
}

function baseSubscriptionReceipt() {
  return createSubscriptionReceipt(baseSubscriptionReceiptInput());
}

function baseSubscriptionReceiptInput() {
  return {
    receiptId: "receipt_subscription_1",
    manifestId: "idem_subscription_1",
    idempotencyKey: "idem_subscription_1",
    agentId: "agent:subscription-buyer",
    ownerId: "owner:subscription-buyer",
    subscriberId: "agent:subscription-buyer",
    providerId: "agent:subscription-provider",
    planId: "plan:research-feed-monthly",
    termsHash: "sha256:subscription-terms",
    periodStart: "2026-06-10T12:00:00.000Z",
    periodEnd: "2026-07-10T12:00:00.000Z",
    amount: { amount: "9.00", asset: "USD" },
    createdAt: now,
  };
}
