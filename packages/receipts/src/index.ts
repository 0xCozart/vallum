export * from "./ap2Receipt.js";

export type ReceiptStatus =
  | "attempted"
  | "denied"
  | "approved"
  | "sponsored"
  | "submitted"
  | "active"
  | "renewed"
  | "canceled"
  | "completed"
  | "released"
  | "refunded"
  | "disputed"
  | "revoked"
  | "failed";

export type EscrowStatus = "open" | "released" | "refunded" | "expired";

export interface ReceiptAmount {
  readonly amount: string;
  readonly asset: string;
}

export interface EscrowReceipt {
  readonly receiptId: string;
  readonly manifestId: string;
  readonly idempotencyKey: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly status: ReceiptStatus;
  readonly amount: ReceiptAmount;
  readonly escrow: EscrowState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly sponsorshipId?: string;
  readonly transactionDigest?: string;
  readonly evidenceHash?: string;
  readonly releaseProofHash?: string;
  readonly refundReason?: string;
  readonly events: readonly ReceiptEvent[];
  readonly externalPayment?: LinkedReceiptState;
  readonly iotaReceipt?: LinkedReceiptState;
  readonly escrowSettlement?: EscrowSettlementState;
}

export type EscrowSettlementRail = "local" | "iota-testnet" | "iota-mainnet";
export type EscrowSettlementReleaseMode = "proof" | "acceptance" | "review";

const escrowSettlementRails = ["local", "iota-testnet", "iota-mainnet"] as const;
const escrowSettlementReleaseModes = ["proof", "acceptance", "review"] as const;

export interface EscrowSettlementState {
  readonly status: "open" | "released" | "refunded";
  readonly settlementRail: EscrowSettlementRail;
  readonly escrowId: string;
  readonly releaseMode: EscrowSettlementReleaseMode;
  readonly invocationId: string;
  readonly actionId: string;
  readonly actionContractId: string;
  readonly actionContractVersion: string;
  readonly providerPayoutRef: string;
  readonly platformFeeRef: string;
  readonly refundAuthorityRef: string;
  readonly refundDestinationRef: string;
  readonly providerNetAmount: ReceiptAmount;
  readonly platformFeeAmount: ReceiptAmount;
  readonly assetType: string;
  readonly grossAmountBaseUnits: string;
  readonly providerNetBaseUnits: string;
  readonly platformFeeBaseUnits: string;
  readonly refundAfterEpochMs: string;
  readonly allowPayeeRelease: boolean;
  readonly openedTransactionDigest: string;
  readonly providerExecutionReceiptHash?: string;
  readonly evidenceAttestationHash?: string;
  readonly settlementReceiptHash?: string;
  readonly buyerFacingReceiptHash?: string;
  readonly settlementTransactionDigest?: string;
  readonly releaseProofHash?: string;
  readonly refundReason?: string;
  readonly platformFeePaid?: boolean;
}

export interface PayPerCallReceipt {
  readonly receiptId: string;
  readonly manifestId: string;
  readonly idempotencyKey: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly providerId: string;
  readonly toolName: string;
  readonly status: ReceiptStatus;
  readonly amount: ReceiptAmount;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly sponsorshipId?: string;
  readonly transactionDigest?: string;
  readonly resultHash?: string;
  readonly failureReason?: string;
  readonly events: readonly ReceiptEvent[];
}

export interface DataLicenseReceipt {
  readonly receiptId: string;
  readonly manifestId: string;
  readonly idempotencyKey: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly providerId: string;
  readonly licenseeId: string;
  readonly datasetId: string;
  readonly termsHash: string;
  readonly status: ReceiptStatus;
  readonly amount: ReceiptAmount;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly sponsorshipId?: string;
  readonly transactionDigest?: string;
  readonly accessProofHash?: string;
  readonly expiresAt?: string;
  readonly failureReason?: string;
  readonly revocationReason?: string;
  readonly events: readonly ReceiptEvent[];
}

export interface ServiceBountyReceipt {
  readonly receiptId: string;
  readonly manifestId: string;
  readonly idempotencyKey: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly requesterId: string;
  readonly providerId: string;
  readonly bountyId: string;
  readonly deliverableHash: string;
  readonly status: ReceiptStatus;
  readonly amount: ReceiptAmount;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly sponsorshipId?: string;
  readonly transactionDigest?: string;
  readonly completionProofHash?: string;
  readonly releaseProofHash?: string;
  readonly failureReason?: string;
  readonly events: readonly ReceiptEvent[];
}

export interface ReputationReceipt {
  readonly receiptId: string;
  readonly manifestId: string;
  readonly idempotencyKey: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly issuerId: string;
  readonly subjectId: string;
  readonly interactionId: string;
  readonly criteriaHash: string;
  readonly status: ReceiptStatus;
  readonly amount: ReceiptAmount;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly sponsorshipId?: string;
  readonly transactionDigest?: string;
  readonly score?: number;
  readonly evidenceHash?: string;
  readonly attestationHash?: string;
  readonly failureReason?: string;
  readonly events: readonly ReceiptEvent[];
}

export interface SubscriptionReceipt {
  readonly receiptId: string;
  readonly manifestId: string;
  readonly idempotencyKey: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly subscriberId: string;
  readonly providerId: string;
  readonly planId: string;
  readonly termsHash: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly renewalCount: number;
  readonly status: ReceiptStatus;
  readonly amount: ReceiptAmount;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly sponsorshipId?: string;
  readonly transactionDigest?: string;
  readonly renewalSponsorshipId?: string;
  readonly renewalTransactionDigest?: string;
  readonly activationProofHash?: string;
  readonly renewalProofHash?: string;
  readonly cancellationReason?: string;
  readonly failureReason?: string;
  readonly events: readonly ReceiptEvent[];
}

export interface EscrowState {
  readonly status: EscrowStatus;
  readonly providerId: string;
  readonly verifierId: string;
}

export interface LinkedReceiptState {
  readonly status: "pending" | "succeeded" | "failed";
  readonly referenceId: string;
}

export interface ReceiptEvent {
  readonly type:
    | "escrow_created"
    | "pay_per_call_created"
    | "data_license_created"
    | "service_bounty_created"
    | "reputation_receipt_created"
    | "subscription_created"
    | "approved"
    | "denied"
    | "sponsored"
    | "submitted"
    | "activated"
    | "renewed"
    | "canceled"
    | "completed"
    | "access_granted"
    | "access_revoked"
    | "released"
    | "refunded"
    | "expired"
    | "failed";
  readonly at: string;
  readonly reason?: string;
}

export interface CreateEscrowReceiptInput {
  readonly receiptId: string;
  readonly manifestId: string;
  readonly idempotencyKey: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly providerId: string;
  readonly verifierId: string;
  readonly amount: ReceiptAmount;
  readonly createdAt: Date;
}

export interface CreatePayPerCallReceiptInput {
  readonly receiptId: string;
  readonly manifestId: string;
  readonly idempotencyKey: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly providerId: string;
  readonly toolName: string;
  readonly amount: ReceiptAmount;
  readonly createdAt: Date;
}

export interface CreateDataLicenseReceiptInput {
  readonly receiptId: string;
  readonly manifestId: string;
  readonly idempotencyKey: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly providerId: string;
  readonly licenseeId: string;
  readonly datasetId: string;
  readonly termsHash: string;
  readonly amount: ReceiptAmount;
  readonly createdAt: Date;
}

export interface CreateServiceBountyReceiptInput {
  readonly receiptId: string;
  readonly manifestId: string;
  readonly idempotencyKey: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly requesterId: string;
  readonly providerId: string;
  readonly bountyId: string;
  readonly deliverableHash: string;
  readonly amount: ReceiptAmount;
  readonly createdAt: Date;
}

export interface CreateReputationReceiptInput {
  readonly receiptId: string;
  readonly manifestId: string;
  readonly idempotencyKey: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly issuerId: string;
  readonly subjectId: string;
  readonly interactionId: string;
  readonly criteriaHash: string;
  readonly amount: ReceiptAmount;
  readonly createdAt: Date;
}

export interface CreateSubscriptionReceiptInput {
  readonly receiptId: string;
  readonly manifestId: string;
  readonly idempotencyKey: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly subscriberId: string;
  readonly providerId: string;
  readonly planId: string;
  readonly termsHash: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly amount: ReceiptAmount;
  readonly createdAt: Date;
}

export interface TransitionOptions {
  readonly at: Date;
}

export interface RecordEscrowSettlementOpenOptions extends TransitionOptions {
  readonly settlementRail: EscrowSettlementRail;
  readonly escrowId: string;
  readonly releaseMode: EscrowSettlementReleaseMode;
  readonly invocationId: string;
  readonly actionId: string;
  readonly actionContractId: string;
  readonly actionContractVersion: string;
  readonly providerPayoutRef: string;
  readonly platformFeeRef: string;
  readonly refundAuthorityRef: string;
  readonly refundDestinationRef: string;
  readonly providerNetAmount: ReceiptAmount;
  readonly platformFeeAmount: ReceiptAmount;
  readonly assetType: string;
  readonly grossAmountBaseUnits: string;
  readonly providerNetBaseUnits: string;
  readonly platformFeeBaseUnits: string;
  readonly refundAfterEpochMs: string;
  readonly allowPayeeRelease: boolean;
  readonly transactionDigest: string;
}

export interface RecordEscrowSettlementReleaseOptions extends TransitionOptions {
  readonly verifierId: string;
  readonly escrowId: string;
  readonly invocationId: string;
  readonly releaseProofHash: string;
  readonly providerExecutionReceiptHash: string;
  readonly evidenceAttestationHash: string;
  readonly settlementReceiptHash: string;
  readonly buyerFacingReceiptHash: string;
  readonly transactionDigest: string;
}

export interface RecordEscrowSettlementRefundOptions extends TransitionOptions {
  readonly escrowId: string;
  readonly invocationId: string;
  readonly reason: string;
  readonly settlementReceiptHash: string;
  readonly buyerFacingReceiptHash: string;
  readonly transactionDigest: string;
}

export class ReceiptTransitionError extends Error {
  constructor(
    readonly code: "INVALID_TRANSITION" | "UNAUTHORIZED_VERIFIER",
    message: string,
  ) {
    super(message);
    this.name = "ReceiptTransitionError";
  }
}

export class ReceiptInputError extends Error {
  constructor(
    readonly code: "FIELD_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "ReceiptInputError";
  }
}

export function createEscrowReceipt(input: CreateEscrowReceiptInput): EscrowReceipt {
  const at = input.createdAt.toISOString();
  return {
    receiptId: input.receiptId,
    manifestId: input.manifestId,
    idempotencyKey: input.idempotencyKey,
    agentId: input.agentId,
    ownerId: input.ownerId,
    status: "attempted",
    amount: input.amount,
    escrow: {
      status: "open",
      providerId: input.providerId,
      verifierId: input.verifierId,
    },
    createdAt: at,
    updatedAt: at,
    events: [{ type: "escrow_created", at }],
  };
}

export function createPayPerCallReceipt(input: CreatePayPerCallReceiptInput): PayPerCallReceipt {
  const at = input.createdAt.toISOString();
  return {
    receiptId: input.receiptId,
    manifestId: input.manifestId,
    idempotencyKey: input.idempotencyKey,
    agentId: input.agentId,
    ownerId: input.ownerId,
    providerId: input.providerId,
    toolName: input.toolName,
    status: "attempted",
    amount: input.amount,
    createdAt: at,
    updatedAt: at,
    events: [{ type: "pay_per_call_created", at }],
  };
}

export function createDataLicenseReceipt(input: CreateDataLicenseReceiptInput): DataLicenseReceipt {
  requireNonEmpty(input.providerId, "providerId");
  requireNonEmpty(input.licenseeId, "licenseeId");
  requireNonEmpty(input.datasetId, "datasetId");
  requireNonEmpty(input.termsHash, "termsHash");
  const at = input.createdAt.toISOString();
  return {
    receiptId: input.receiptId,
    manifestId: input.manifestId,
    idempotencyKey: input.idempotencyKey,
    agentId: input.agentId,
    ownerId: input.ownerId,
    providerId: input.providerId,
    licenseeId: input.licenseeId,
    datasetId: input.datasetId,
    termsHash: input.termsHash,
    status: "attempted",
    amount: input.amount,
    createdAt: at,
    updatedAt: at,
    events: [{ type: "data_license_created", at }],
  };
}

export function createServiceBountyReceipt(input: CreateServiceBountyReceiptInput): ServiceBountyReceipt {
  requireNonEmpty(input.requesterId, "requesterId");
  requireNonEmpty(input.providerId, "providerId");
  requireNonEmpty(input.bountyId, "bountyId");
  requireNonEmpty(input.deliverableHash, "deliverableHash");
  const at = input.createdAt.toISOString();
  return {
    receiptId: input.receiptId,
    manifestId: input.manifestId,
    idempotencyKey: input.idempotencyKey,
    agentId: input.agentId,
    ownerId: input.ownerId,
    requesterId: input.requesterId,
    providerId: input.providerId,
    bountyId: input.bountyId,
    deliverableHash: input.deliverableHash,
    status: "attempted",
    amount: input.amount,
    createdAt: at,
    updatedAt: at,
    events: [{ type: "service_bounty_created", at }],
  };
}

export function createReputationReceipt(input: CreateReputationReceiptInput): ReputationReceipt {
  requireNonEmpty(input.issuerId, "issuerId");
  requireNonEmpty(input.subjectId, "subjectId");
  requireNonEmpty(input.interactionId, "interactionId");
  requireNonEmpty(input.criteriaHash, "criteriaHash");
  requireMatchingField(input.issuerId, input.agentId, "issuerId", "agentId");
  const at = input.createdAt.toISOString();
  return {
    receiptId: input.receiptId,
    manifestId: input.manifestId,
    idempotencyKey: input.idempotencyKey,
    agentId: input.agentId,
    ownerId: input.ownerId,
    issuerId: input.issuerId,
    subjectId: input.subjectId,
    interactionId: input.interactionId,
    criteriaHash: input.criteriaHash,
    status: "attempted",
    amount: input.amount,
    createdAt: at,
    updatedAt: at,
    events: [{ type: "reputation_receipt_created", at }],
  };
}

export function createSubscriptionReceipt(input: CreateSubscriptionReceiptInput): SubscriptionReceipt {
  requireNonEmpty(input.subscriberId, "subscriberId");
  requireNonEmpty(input.providerId, "providerId");
  requireNonEmpty(input.planId, "planId");
  requireSafeHashReference(input.termsHash, "termsHash");
  requireNonEmpty(input.periodStart, "periodStart");
  requireNonEmpty(input.periodEnd, "periodEnd");
  requireMatchingField(input.subscriberId, input.agentId, "subscriberId", "agentId");
  requirePeriodAfter(input.periodStart, input.periodEnd, "periodEnd");
  const at = input.createdAt.toISOString();
  return {
    receiptId: input.receiptId,
    manifestId: input.manifestId,
    idempotencyKey: input.idempotencyKey,
    agentId: input.agentId,
    ownerId: input.ownerId,
    subscriberId: input.subscriberId,
    providerId: input.providerId,
    planId: input.planId,
    termsHash: input.termsHash,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    renewalCount: 0,
    status: "attempted",
    amount: input.amount,
    createdAt: at,
    updatedAt: at,
    events: [{ type: "subscription_created", at }],
  };
}

export function approveReceipt(receipt: EscrowReceipt, options: TransitionOptions): EscrowReceipt {
  requireReceiptStatus(receipt, ["attempted"], "approve");
  return withReceiptEvent(receipt, "approved", options.at, { status: "approved" });
}

export function approvePayPerCallReceipt(
  receipt: PayPerCallReceipt,
  options: TransitionOptions,
): PayPerCallReceipt {
  requireReceiptStatus(receipt, ["attempted"], "approve");
  return withPayPerCallReceiptEvent(receipt, "approved", options.at, { status: "approved" });
}

export function approveDataLicenseReceipt(
  receipt: DataLicenseReceipt,
  options: TransitionOptions,
): DataLicenseReceipt {
  requireReceiptStatus(receipt, ["attempted"], "approve");
  return withDataLicenseReceiptEvent(receipt, "approved", options.at, { status: "approved" });
}

export function approveServiceBountyReceipt(
  receipt: ServiceBountyReceipt,
  options: TransitionOptions,
): ServiceBountyReceipt {
  requireReceiptStatus(receipt, ["attempted"], "approve");
  return withServiceBountyReceiptEvent(receipt, "approved", options.at, { status: "approved" });
}

export function approveReputationReceipt(
  receipt: ReputationReceipt,
  options: TransitionOptions,
): ReputationReceipt {
  requireReceiptStatus(receipt, ["attempted"], "approve");
  return withReputationReceiptEvent(receipt, "approved", options.at, { status: "approved" });
}

export function approveSubscriptionReceipt(
  receipt: SubscriptionReceipt,
  options: TransitionOptions,
): SubscriptionReceipt {
  requireReceiptStatus(receipt, ["attempted"], "approve");
  return withSubscriptionReceiptEvent(receipt, "approved", options.at, { status: "approved" });
}

export function denyReceipt(receipt: EscrowReceipt, options: TransitionOptions & { readonly reason: string }): EscrowReceipt {
  requireReceiptStatus(receipt, ["attempted"], "deny");
  return withReceiptEvent(receipt, "denied", options.at, {
    status: "denied",
  }, options.reason);
}

export function denyPayPerCallReceipt(
  receipt: PayPerCallReceipt,
  options: TransitionOptions & { readonly reason: string },
): PayPerCallReceipt {
  requireReceiptStatus(receipt, ["attempted"], "deny");
  return withPayPerCallReceiptEvent(receipt, "denied", options.at, {
    status: "denied",
    failureReason: options.reason,
  }, options.reason);
}

export function denyDataLicenseReceipt(
  receipt: DataLicenseReceipt,
  options: TransitionOptions & { readonly reason: string },
): DataLicenseReceipt {
  requireReceiptStatus(receipt, ["attempted"], "deny");
  return withDataLicenseReceiptEvent(receipt, "denied", options.at, {
    status: "denied",
    failureReason: options.reason,
  }, options.reason);
}

export function denyServiceBountyReceipt(
  receipt: ServiceBountyReceipt,
  options: TransitionOptions & { readonly reason: string },
): ServiceBountyReceipt {
  requireReceiptStatus(receipt, ["attempted"], "deny");
  return withServiceBountyReceiptEvent(receipt, "denied", options.at, {
    status: "denied",
    failureReason: options.reason,
  }, options.reason);
}

export function denyReputationReceipt(
  receipt: ReputationReceipt,
  options: TransitionOptions & { readonly reason: string },
): ReputationReceipt {
  requireReceiptStatus(receipt, ["attempted"], "deny");
  return withReputationReceiptEvent(receipt, "denied", options.at, {
    status: "denied",
    failureReason: options.reason,
  }, options.reason);
}

export function denySubscriptionReceipt(
  receipt: SubscriptionReceipt,
  options: TransitionOptions & { readonly reason: string },
): SubscriptionReceipt {
  requireReceiptStatus(receipt, ["attempted"], "deny");
  return withSubscriptionReceiptEvent(receipt, "denied", options.at, {
    status: "denied",
    failureReason: options.reason,
  }, options.reason);
}

export function sponsorReceipt(
  receipt: EscrowReceipt,
  options: TransitionOptions & { readonly sponsorshipId: string },
): EscrowReceipt {
  requireReceiptStatus(receipt, ["approved"], "sponsor");
  return withReceiptEvent(receipt, "sponsored", options.at, {
    status: "sponsored",
    sponsorshipId: options.sponsorshipId,
  });
}

export function sponsorPayPerCallReceipt(
  receipt: PayPerCallReceipt,
  options: TransitionOptions & { readonly sponsorshipId: string },
): PayPerCallReceipt {
  requireReceiptStatus(receipt, ["approved"], "sponsor");
  return withPayPerCallReceiptEvent(receipt, "sponsored", options.at, {
    status: "sponsored",
    sponsorshipId: options.sponsorshipId,
  });
}

export function sponsorDataLicenseReceipt(
  receipt: DataLicenseReceipt,
  options: TransitionOptions & { readonly sponsorshipId: string },
): DataLicenseReceipt {
  requireReceiptStatus(receipt, ["approved"], "sponsor");
  return withDataLicenseReceiptEvent(receipt, "sponsored", options.at, {
    status: "sponsored",
    sponsorshipId: options.sponsorshipId,
  });
}

export function sponsorServiceBountyReceipt(
  receipt: ServiceBountyReceipt,
  options: TransitionOptions & { readonly sponsorshipId: string },
): ServiceBountyReceipt {
  requireReceiptStatus(receipt, ["approved"], "sponsor");
  return withServiceBountyReceiptEvent(receipt, "sponsored", options.at, {
    status: "sponsored",
    sponsorshipId: options.sponsorshipId,
  });
}

export function sponsorReputationReceipt(
  receipt: ReputationReceipt,
  options: TransitionOptions & { readonly sponsorshipId: string },
): ReputationReceipt {
  requireReceiptStatus(receipt, ["approved"], "sponsor");
  return withReputationReceiptEvent(receipt, "sponsored", options.at, {
    status: "sponsored",
    sponsorshipId: options.sponsorshipId,
  });
}

export function sponsorSubscriptionReceipt(
  receipt: SubscriptionReceipt,
  options: TransitionOptions & { readonly sponsorshipId: string },
): SubscriptionReceipt {
  requireReceiptStatus(receipt, ["approved"], "sponsor");
  return withSubscriptionReceiptEvent(receipt, "sponsored", options.at, {
    status: "sponsored",
    sponsorshipId: options.sponsorshipId,
  });
}

export function submitReceipt(
  receipt: EscrowReceipt,
  options: TransitionOptions & { readonly transactionDigest: string },
): EscrowReceipt {
  requireReceiptStatus(receipt, ["sponsored"], "submit");
  return withReceiptEvent(receipt, "submitted", options.at, {
    status: "submitted",
    transactionDigest: options.transactionDigest,
  });
}

export function submitPayPerCallReceipt(
  receipt: PayPerCallReceipt,
  options: TransitionOptions & { readonly transactionDigest: string },
): PayPerCallReceipt {
  requireReceiptStatus(receipt, ["sponsored"], "submit");
  return withPayPerCallReceiptEvent(receipt, "submitted", options.at, {
    status: "submitted",
    transactionDigest: options.transactionDigest,
  });
}

export function submitDataLicenseReceipt(
  receipt: DataLicenseReceipt,
  options: TransitionOptions & { readonly transactionDigest: string },
): DataLicenseReceipt {
  requireReceiptStatus(receipt, ["sponsored"], "submit");
  return withDataLicenseReceiptEvent(receipt, "submitted", options.at, {
    status: "submitted",
    transactionDigest: options.transactionDigest,
  });
}

export function submitServiceBountyReceipt(
  receipt: ServiceBountyReceipt,
  options: TransitionOptions & { readonly transactionDigest: string },
): ServiceBountyReceipt {
  requireReceiptStatus(receipt, ["sponsored"], "submit");
  return withServiceBountyReceiptEvent(receipt, "submitted", options.at, {
    status: "submitted",
    transactionDigest: options.transactionDigest,
  });
}

export function submitReputationReceipt(
  receipt: ReputationReceipt,
  options: TransitionOptions & { readonly transactionDigest: string },
): ReputationReceipt {
  requireReceiptStatus(receipt, ["sponsored"], "submit");
  return withReputationReceiptEvent(receipt, "submitted", options.at, {
    status: "submitted",
    transactionDigest: options.transactionDigest,
  });
}

export function submitSubscriptionReceipt(
  receipt: SubscriptionReceipt,
  options: TransitionOptions & { readonly transactionDigest: string },
): SubscriptionReceipt {
  requireReceiptStatus(receipt, ["sponsored"], "submit");
  return withSubscriptionReceiptEvent(receipt, "submitted", options.at, {
    status: "submitted",
    transactionDigest: options.transactionDigest,
  });
}

export function completeEscrow(
  receipt: EscrowReceipt,
  options: TransitionOptions & { readonly evidenceHash: string },
): EscrowReceipt {
  requireReceiptStatus(receipt, ["submitted"], "complete");
  requireEscrowOpen(receipt, "complete");
  return withReceiptEvent(receipt, "completed", options.at, {
    status: "completed",
    evidenceHash: options.evidenceHash,
  });
}

export function completePayPerCallReceipt(
  receipt: PayPerCallReceipt,
  options: TransitionOptions & { readonly resultHash: string },
): PayPerCallReceipt {
  requireReceiptStatus(receipt, ["submitted"], "complete");
  return withPayPerCallReceiptEvent(receipt, "completed", options.at, {
    status: "completed",
    resultHash: options.resultHash,
  });
}

export function failPayPerCallReceipt(
  receipt: PayPerCallReceipt,
  options: TransitionOptions & { readonly reason: string },
): PayPerCallReceipt {
  requireReceiptStatus(receipt, ["attempted", "approved", "sponsored", "submitted"], "fail");
  return withPayPerCallReceiptEvent(receipt, "failed", options.at, {
    status: "failed",
    failureReason: options.reason,
  }, options.reason);
}

export function grantDataLicenseAccess(
  receipt: DataLicenseReceipt,
  options: TransitionOptions & { readonly accessProofHash: string; readonly expiresAt?: string },
): DataLicenseReceipt {
  requireReceiptStatus(receipt, ["submitted"], "grant access");
  requireNonEmpty(options.accessProofHash, "accessProofHash");
  return withDataLicenseReceiptEvent(receipt, "access_granted", options.at, {
    status: "completed",
    accessProofHash: options.accessProofHash,
    ...(options.expiresAt ? { expiresAt: options.expiresAt } : {}),
  });
}

export function failDataLicenseReceipt(
  receipt: DataLicenseReceipt,
  options: TransitionOptions & { readonly reason: string },
): DataLicenseReceipt {
  requireReceiptStatus(receipt, ["attempted", "approved", "sponsored", "submitted"], "fail");
  return withDataLicenseReceiptEvent(receipt, "failed", options.at, {
    status: "failed",
    failureReason: options.reason,
  }, options.reason);
}

export function completeServiceBountyReceipt(
  receipt: ServiceBountyReceipt,
  options: TransitionOptions & { readonly completionProofHash: string },
): ServiceBountyReceipt {
  requireReceiptStatus(receipt, ["submitted"], "complete");
  requireNonEmpty(options.completionProofHash, "completionProofHash");
  return withServiceBountyReceiptEvent(receipt, "completed", options.at, {
    status: "completed",
    completionProofHash: options.completionProofHash,
  });
}

export function releaseServiceBountyReceipt(
  receipt: ServiceBountyReceipt,
  options: TransitionOptions & { readonly releaseProofHash: string },
): ServiceBountyReceipt {
  requireReceiptStatus(receipt, ["completed"], "release");
  requireNonEmpty(options.releaseProofHash, "releaseProofHash");
  return withServiceBountyReceiptEvent(receipt, "released", options.at, {
    status: "released",
    releaseProofHash: options.releaseProofHash,
  });
}

export function failServiceBountyReceipt(
  receipt: ServiceBountyReceipt,
  options: TransitionOptions & { readonly reason: string },
): ServiceBountyReceipt {
  requireReceiptStatus(receipt, ["attempted", "approved", "sponsored", "submitted", "completed"], "fail");
  return withServiceBountyReceiptEvent(receipt, "failed", options.at, {
    status: "failed",
    failureReason: options.reason,
  }, options.reason);
}

export function completeReputationReceipt(
  receipt: ReputationReceipt,
  options: TransitionOptions & {
    readonly score: number;
    readonly evidenceHash: string;
    readonly attestationHash: string;
  },
): ReputationReceipt {
  requireReceiptStatus(receipt, ["submitted"], "complete");
  requireScore(options.score);
  requireNonEmpty(options.evidenceHash, "evidenceHash");
  requireNonEmpty(options.attestationHash, "attestationHash");
  return withReputationReceiptEvent(receipt, "completed", options.at, {
    status: "completed",
    score: options.score,
    evidenceHash: options.evidenceHash,
    attestationHash: options.attestationHash,
  });
}

export function failReputationReceipt(
  receipt: ReputationReceipt,
  options: TransitionOptions & { readonly reason: string },
): ReputationReceipt {
  requireReceiptStatus(receipt, ["attempted", "approved", "sponsored", "submitted"], "fail");
  return withReputationReceiptEvent(receipt, "failed", options.at, {
    status: "failed",
    failureReason: options.reason,
  }, options.reason);
}

export function activateSubscriptionReceipt(
  receipt: SubscriptionReceipt,
  options: TransitionOptions & { readonly activationProofHash: string },
): SubscriptionReceipt {
  requireReceiptStatus(receipt, ["submitted"], "activate");
  requireSafeHashReference(options.activationProofHash, "activationProofHash");
  return withSubscriptionReceiptEvent(receipt, "activated", options.at, {
    status: "active",
    activationProofHash: options.activationProofHash,
  });
}

export function renewSubscriptionReceipt(
  receipt: SubscriptionReceipt,
  options: TransitionOptions & {
    readonly periodEnd: string;
    readonly renewalProofHash: string;
    readonly sponsorshipId?: string;
    readonly transactionDigest?: string;
  },
): SubscriptionReceipt {
  requireReceiptStatus(receipt, ["active", "renewed"], "renew");
  requireNonEmpty(options.periodEnd, "periodEnd");
  requireSafeHashReference(options.renewalProofHash, "renewalProofHash");
  if (options.sponsorshipId !== undefined) requireNonEmpty(options.sponsorshipId, "sponsorshipId");
  if (options.transactionDigest !== undefined) requireNonEmpty(options.transactionDigest, "transactionDigest");
  requirePeriodAfter(receipt.periodEnd, options.periodEnd, "periodEnd");
  return withSubscriptionReceiptEvent(receipt, "renewed", options.at, {
    status: "renewed",
    periodEnd: options.periodEnd,
    renewalCount: receipt.renewalCount + 1,
    renewalProofHash: options.renewalProofHash,
    ...(options.sponsorshipId ? { renewalSponsorshipId: options.sponsorshipId } : {}),
    ...(options.transactionDigest ? { renewalTransactionDigest: options.transactionDigest } : {}),
  });
}

export function cancelSubscriptionReceipt(
  receipt: SubscriptionReceipt,
  options: TransitionOptions & { readonly reason: string },
): SubscriptionReceipt {
  requireReceiptStatus(receipt, ["active", "renewed"], "cancel");
  requireNonEmpty(options.reason, "reason");
  return withSubscriptionReceiptEvent(receipt, "canceled", options.at, {
    status: "canceled",
    cancellationReason: options.reason,
  }, options.reason);
}

export function failSubscriptionReceipt(
  receipt: SubscriptionReceipt,
  options: TransitionOptions & { readonly reason: string },
): SubscriptionReceipt {
  requireReceiptStatus(receipt, ["attempted", "approved", "sponsored", "submitted", "active", "renewed"], "fail");
  return withSubscriptionReceiptEvent(receipt, "failed", options.at, {
    status: "failed",
    failureReason: options.reason,
  }, options.reason);
}

export function revokeDataLicenseAccess(
  receipt: DataLicenseReceipt,
  options: TransitionOptions & { readonly reason: string },
): DataLicenseReceipt {
  requireReceiptStatus(receipt, ["completed"], "revoke access");
  return withDataLicenseReceiptEvent(receipt, "access_revoked", options.at, {
    status: "revoked",
    revocationReason: options.reason,
  }, options.reason);
}

export function releaseEscrow(
  receipt: EscrowReceipt,
  options: TransitionOptions & { readonly verifierId: string; readonly releaseProofHash: string },
): EscrowReceipt {
  requireVerifier(receipt, options.verifierId);
  requireReceiptStatus(receipt, ["completed"], "release");
  requireEscrowOpen(receipt, "release");
  return withReceiptEvent(receipt, "released", options.at, {
    status: "released",
    escrow: { ...receipt.escrow, status: "released" },
    releaseProofHash: options.releaseProofHash,
  });
}

export function refundEscrow(
  receipt: EscrowReceipt,
  options: TransitionOptions & { readonly reason: string },
): EscrowReceipt {
  requireReceiptStatus(receipt, ["attempted", "approved", "sponsored", "submitted", "completed"], "refund");
  requireEscrowOpen(receipt, "refund");
  return withReceiptEvent(receipt, "refunded", options.at, {
    status: "refunded",
    escrow: { ...receipt.escrow, status: "refunded" },
    refundReason: options.reason,
  }, options.reason);
}

export function expireEscrow(
  receipt: EscrowReceipt,
  options: TransitionOptions & { readonly reason: string },
): EscrowReceipt {
  requireReceiptStatus(receipt, ["attempted", "approved", "sponsored", "submitted", "completed"], "expire");
  requireEscrowOpen(receipt, "expire");
  return withReceiptEvent(receipt, "expired", options.at, {
    status: "refunded",
    escrow: { ...receipt.escrow, status: "expired" },
    refundReason: options.reason,
  }, options.reason);
}

export function recordEscrowSettlementOpen(
  receipt: EscrowReceipt,
  options: RecordEscrowSettlementOpenOptions,
): EscrowReceipt {
  requireReceiptStatus(receipt, ["sponsored"], "record escrow settlement open");
  if (receipt.escrowSettlement) {
    throw new ReceiptTransitionError("INVALID_TRANSITION", "Escrow settlement is already recorded.");
  }
  requireEscrowSettlementRail(options.settlementRail);
  requireEscrowSettlementReleaseMode(options.releaseMode);
  requireNonEmpty(options.escrowId, "escrowId");
  requireNonEmpty(options.invocationId, "invocationId");
  requireNonEmpty(options.actionId, "actionId");
  requireNonEmpty(options.actionContractId, "actionContractId");
  requireNonEmpty(options.actionContractVersion, "actionContractVersion");
  requireNonEmpty(options.transactionDigest, "transactionDigest");
  requireSafeSettlementReference(options.providerPayoutRef, "providerPayoutRef");
  requireSafeSettlementReference(options.platformFeeRef, "platformFeeRef");
  requireSafeSettlementReference(options.refundAuthorityRef, "refundAuthorityRef");
  requireSafeSettlementReference(options.refundDestinationRef, "refundDestinationRef");
  requireFeeSplit(receipt.amount, options.providerNetAmount, options.platformFeeAmount);
  requireSafeAssetType(options.assetType, "assetType");
  requireBaseUnitSplit(
    options.grossAmountBaseUnits,
    options.providerNetBaseUnits,
    options.platformFeeBaseUnits,
  );
  requireU64String(options.refundAfterEpochMs, "refundAfterEpochMs");
  if (typeof options.allowPayeeRelease !== "boolean") {
    throw new ReceiptInputError("FIELD_REQUIRED", "allowPayeeRelease is required.");
  }

  return withReceiptEvent(receipt, "submitted", options.at, {
    status: "submitted",
    transactionDigest: options.transactionDigest,
    escrowSettlement: {
      status: "open",
      settlementRail: options.settlementRail,
      escrowId: options.escrowId,
      releaseMode: options.releaseMode,
      invocationId: options.invocationId,
      actionId: options.actionId,
      actionContractId: options.actionContractId,
      actionContractVersion: options.actionContractVersion,
      providerPayoutRef: options.providerPayoutRef,
      platformFeeRef: options.platformFeeRef,
      refundAuthorityRef: options.refundAuthorityRef,
      refundDestinationRef: options.refundDestinationRef,
      providerNetAmount: options.providerNetAmount,
      platformFeeAmount: options.platformFeeAmount,
      assetType: options.assetType,
      grossAmountBaseUnits: options.grossAmountBaseUnits,
      providerNetBaseUnits: options.providerNetBaseUnits,
      platformFeeBaseUnits: options.platformFeeBaseUnits,
      refundAfterEpochMs: options.refundAfterEpochMs,
      allowPayeeRelease: options.allowPayeeRelease,
      openedTransactionDigest: options.transactionDigest,
    },
  });
}

export function recordEscrowSettlementRelease(
  receipt: EscrowReceipt,
  options: RecordEscrowSettlementReleaseOptions,
): EscrowReceipt {
  const settlement = requireOpenEscrowSettlement(receipt);
  requireSettlementBinding(settlement, options.escrowId, options.invocationId);
  requireSafeHashReference(options.releaseProofHash, "releaseProofHash");
  requireSafeHashReference(options.providerExecutionReceiptHash, "providerExecutionReceiptHash");
  requireSafeHashReference(options.evidenceAttestationHash, "evidenceAttestationHash");
  requireSafeHashReference(options.settlementReceiptHash, "settlementReceiptHash");
  requireSafeHashReference(options.buyerFacingReceiptHash, "buyerFacingReceiptHash");
  requireNonEmpty(options.transactionDigest, "transactionDigest");

  const released = releaseEscrow(receipt, {
    at: options.at,
    verifierId: options.verifierId,
    releaseProofHash: options.releaseProofHash,
  });
  return {
    ...released,
    escrowSettlement: {
      ...settlement,
      status: "released",
      releaseProofHash: options.releaseProofHash,
      providerExecutionReceiptHash: options.providerExecutionReceiptHash,
      evidenceAttestationHash: options.evidenceAttestationHash,
      settlementReceiptHash: options.settlementReceiptHash,
      buyerFacingReceiptHash: options.buyerFacingReceiptHash,
      settlementTransactionDigest: options.transactionDigest,
      platformFeePaid: true,
    },
  };
}

export function recordEscrowSettlementRefund(
  receipt: EscrowReceipt,
  options: RecordEscrowSettlementRefundOptions,
): EscrowReceipt {
  const settlement = requireOpenEscrowSettlement(receipt);
  requireSettlementBinding(settlement, options.escrowId, options.invocationId);
  requireNonEmpty(options.reason, "reason");
  requireSafeHashReference(options.settlementReceiptHash, "settlementReceiptHash");
  requireSafeHashReference(options.buyerFacingReceiptHash, "buyerFacingReceiptHash");
  requireNonEmpty(options.transactionDigest, "transactionDigest");

  const refunded = refundEscrow(receipt, {
    at: options.at,
    reason: options.reason,
  });
  return {
    ...refunded,
    escrowSettlement: {
      ...settlement,
      status: "refunded",
      settlementReceiptHash: options.settlementReceiptHash,
      buyerFacingReceiptHash: options.buyerFacingReceiptHash,
      settlementTransactionDigest: options.transactionDigest,
      refundReason: options.reason,
      platformFeePaid: false,
    },
  };
}

export function linkExternalPaymentState(receipt: EscrowReceipt, state: LinkedReceiptState): EscrowReceipt {
  return {
    ...receipt,
    externalPayment: state,
  };
}

export function linkIotaReceiptState(receipt: EscrowReceipt, state: LinkedReceiptState): EscrowReceipt {
  return {
    ...receipt,
    iotaReceipt: state,
  };
}

export * from "./x402Receipt.js";

function requireVerifier(receipt: EscrowReceipt, verifierId: string): void {
  if (receipt.escrow.verifierId !== verifierId) {
    throw new ReceiptTransitionError("UNAUTHORIZED_VERIFIER", "Only the configured verifier can release escrow.");
  }
}

function requireEscrowOpen(receipt: EscrowReceipt, action: string): void {
  if (receipt.escrow.status !== "open") {
    throw new ReceiptTransitionError("INVALID_TRANSITION", `Cannot ${action} escrow from ${receipt.escrow.status}.`);
  }
}

function requireOpenEscrowSettlement(receipt: EscrowReceipt): EscrowSettlementState {
  const settlement = receipt.escrowSettlement;
  if (!settlement || settlement.status !== "open") {
    throw new ReceiptTransitionError("INVALID_TRANSITION", "Escrow settlement must be open.");
  }
  return settlement;
}

function requireSettlementBinding(settlement: EscrowSettlementState, escrowId: string, invocationId: string): void {
  if (settlement.escrowId !== escrowId || settlement.invocationId !== invocationId) {
    throw new ReceiptInputError("FIELD_REQUIRED", "Escrow settlement binding does not match the receipt.");
  }
}

function requireEscrowSettlementRail(value: EscrowSettlementRail): void {
  if (!escrowSettlementRails.includes(value)) {
    throw new ReceiptInputError("FIELD_REQUIRED", "settlementRail must be a supported escrow settlement rail.");
  }
}

function requireEscrowSettlementReleaseMode(value: EscrowSettlementReleaseMode): void {
  if (!escrowSettlementReleaseModes.includes(value)) {
    throw new ReceiptInputError("FIELD_REQUIRED", "releaseMode must be a supported escrow settlement release mode.");
  }
}

function requireReceiptStatus(receipt: { readonly status: ReceiptStatus }, allowed: readonly ReceiptStatus[], action: string): void {
  if (!allowed.includes(receipt.status)) {
    throw new ReceiptTransitionError("INVALID_TRANSITION", `Cannot ${action} receipt from ${receipt.status}.`);
  }
}

function requireNonEmpty(value: unknown, field: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ReceiptInputError("FIELD_REQUIRED", `${field} is required.`);
  }
}

function requireSafeHashReference(value: string, field: string): void {
  requireNonEmpty(value, field);
  if (
    !/^sha256:[A-Za-z0-9._:-]+$/.test(value)
    || /(private prompt|review payload|bearer|access-token|signer_ref|payment credential|privateKey|mnemonic|seed)/i.test(value)
  ) {
    throw new ReceiptInputError("FIELD_REQUIRED", `${field} must be a safe sha256 reference.`);
  }
}

function requireSafeSettlementReference(value: string, field: string): void {
  requireNonEmpty(value, field);
  if (
    value.length > 160 ||
    !/^[A-Za-z0-9._:-]+$/.test(value) ||
    /^0x[a-f0-9]{16,}$/i.test(value) ||
    /^(iota|sui)1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{20,}$/i.test(value) ||
    /(private prompt|review payload|bearer|access-token|signer_ref|payment credential|privateKey|mnemonic|seed|raw transaction|user signature)/i.test(value)
  ) {
    throw new ReceiptInputError("FIELD_REQUIRED", `${field} must be an opaque public reference, not raw settlement material.`);
  }
}

function requireSafeAssetType(value: string, field: string): void {
  requireNonEmpty(value, field);
  if (
    value.length > 240 ||
    !/^[A-Za-z0-9_:<>.]+$/.test(value) ||
    !value.includes("::") ||
    /(private prompt|review payload|bearer|access-token|signer_ref|payment credential|privateKey|mnemonic|seed|raw transaction|user signature)/i.test(value)
  ) {
    throw new ReceiptInputError("FIELD_REQUIRED", `${field} must be a safe Move asset type.`);
  }
}

function requireBaseUnitSplit(gross: string, providerNet: string, platformFee: string): void {
  const grossUnits = requireU64String(gross, "grossAmountBaseUnits");
  const providerUnits = requireU64String(providerNet, "providerNetBaseUnits");
  const platformUnits = requireU64String(platformFee, "platformFeeBaseUnits");
  if (grossUnits === 0n) {
    throw new ReceiptInputError("FIELD_REQUIRED", "grossAmountBaseUnits must be positive.");
  }
  if (providerUnits + platformUnits !== grossUnits) {
    throw new ReceiptInputError("FIELD_REQUIRED", "Escrow base-unit split must equal the gross base-unit amount.");
  }
}

function requireU64String(value: string, field: string): bigint {
  requireNonEmpty(value, field);
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new ReceiptInputError("FIELD_REQUIRED", `${field} must be a non-negative u64 integer string.`);
  }
  const parsed = BigInt(value);
  if (parsed > 18446744073709551615n) {
    throw new ReceiptInputError("FIELD_REQUIRED", `${field} must fit in u64.`);
  }
  return parsed;
}

function requireFeeSplit(gross: ReceiptAmount, providerNet: ReceiptAmount, platformFee: ReceiptAmount): void {
  requireReceiptAmount(gross, "amount");
  requireReceiptAmount(providerNet, "providerNetAmount");
  requireReceiptAmount(platformFee, "platformFeeAmount");
  if (gross.asset !== providerNet.asset || gross.asset !== platformFee.asset) {
    throw new ReceiptInputError("FIELD_REQUIRED", "Escrow fee split assets must match the gross amount asset.");
  }
  const grossAmount = parseDecimalAmount(gross.amount, "amount");
  const providerNetAmount = parseDecimalAmount(providerNet.amount, "providerNetAmount");
  const platformFeeAmount = parseDecimalAmount(platformFee.amount, "platformFeeAmount");
  const scale = Math.max(grossAmount.scale, providerNetAmount.scale, platformFeeAmount.scale);
  const grossUnits = scaleDecimal(grossAmount, scale);
  const providerUnits = scaleDecimal(providerNetAmount, scale);
  const platformUnits = scaleDecimal(platformFeeAmount, scale);
  if (providerUnits + platformUnits !== grossUnits) {
    throw new ReceiptInputError("FIELD_REQUIRED", "Escrow fee split must equal the gross receipt amount.");
  }
}

function requireReceiptAmount(value: ReceiptAmount, field: string): void {
  if (!value || typeof value !== "object") {
    throw new ReceiptInputError("FIELD_REQUIRED", `${field} is required.`);
  }
  requireNonEmpty(value.amount, `${field}.amount`);
  requireNonEmpty(value.asset, `${field}.asset`);
}

function parseDecimalAmount(value: string, field: string): { readonly units: bigint; readonly scale: number } {
  if (value.length > 80) {
    throw new ReceiptInputError("FIELD_REQUIRED", `${field} is too large.`);
  }
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) {
    throw new ReceiptInputError("FIELD_REQUIRED", `${field} must be a non-negative decimal amount.`);
  }
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > 18) {
    throw new ReceiptInputError("FIELD_REQUIRED", `${field} has too many decimal places.`);
  }
  return {
    units: BigInt(`${whole}${fraction}`),
    scale: fraction.length,
  };
}

function scaleDecimal(value: { readonly units: bigint; readonly scale: number }, targetScale: number): bigint {
  return value.units * (10n ** BigInt(targetScale - value.scale));
}

function requireMatchingField(left: string, right: string, leftField: string, rightField: string): void {
  if (left !== right) {
    throw new ReceiptInputError("FIELD_REQUIRED", `${leftField} must match ${rightField}.`);
  }
}

function requirePeriodAfter(start: string, end: string, field: string): void {
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    throw new ReceiptInputError("FIELD_REQUIRED", `${field} must be after the current period end.`);
  }
}

function requireScore(score: number): void {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new ReceiptInputError("FIELD_REQUIRED", "score must be an integer between 1 and 5.");
  }
}

function withReceiptEvent(
  receipt: EscrowReceipt,
  eventType: ReceiptEvent["type"],
  at: Date,
  patch: Partial<EscrowReceipt>,
  reason?: string,
): EscrowReceipt {
  const timestamp = at.toISOString();
  return {
    ...receipt,
    ...patch,
    updatedAt: timestamp,
    events: [
      ...receipt.events,
      {
        type: eventType,
        at: timestamp,
        ...(reason ? { reason } : {}),
      },
    ],
  };
}

function withPayPerCallReceiptEvent(
  receipt: PayPerCallReceipt,
  eventType: ReceiptEvent["type"],
  at: Date,
  patch: Partial<PayPerCallReceipt>,
  reason?: string,
): PayPerCallReceipt {
  const timestamp = at.toISOString();
  return {
    ...receipt,
    ...patch,
    updatedAt: timestamp,
    events: [
      ...receipt.events,
      {
        type: eventType,
        at: timestamp,
        ...(reason ? { reason } : {}),
      },
    ],
  };
}

function withDataLicenseReceiptEvent(
  receipt: DataLicenseReceipt,
  eventType: ReceiptEvent["type"],
  at: Date,
  patch: Partial<DataLicenseReceipt>,
  reason?: string,
): DataLicenseReceipt {
  const timestamp = at.toISOString();
  return {
    ...receipt,
    ...patch,
    updatedAt: timestamp,
    events: [
      ...receipt.events,
      {
        type: eventType,
        at: timestamp,
        ...(reason ? { reason } : {}),
      },
    ],
  };
}

function withServiceBountyReceiptEvent(
  receipt: ServiceBountyReceipt,
  eventType: ReceiptEvent["type"],
  at: Date,
  patch: Partial<ServiceBountyReceipt>,
  reason?: string,
): ServiceBountyReceipt {
  const timestamp = at.toISOString();
  return {
    ...receipt,
    ...patch,
    updatedAt: timestamp,
    events: [
      ...receipt.events,
      {
        type: eventType,
        at: timestamp,
        ...(reason ? { reason } : {}),
      },
    ],
  };
}

function withReputationReceiptEvent(
  receipt: ReputationReceipt,
  eventType: ReceiptEvent["type"],
  at: Date,
  patch: Partial<ReputationReceipt>,
  reason?: string,
): ReputationReceipt {
  const timestamp = at.toISOString();
  return {
    ...receipt,
    ...patch,
    updatedAt: timestamp,
    events: [
      ...receipt.events,
      {
        type: eventType,
        at: timestamp,
        ...(reason ? { reason } : {}),
      },
    ],
  };
}

function withSubscriptionReceiptEvent(
  receipt: SubscriptionReceipt,
  eventType: ReceiptEvent["type"],
  at: Date,
  patch: Partial<SubscriptionReceipt>,
  reason?: string,
): SubscriptionReceipt {
  const timestamp = at.toISOString();
  return {
    ...receipt,
    ...patch,
    updatedAt: timestamp,
    events: [
      ...receipt.events,
      {
        type: eventType,
        at: timestamp,
        ...(reason ? { reason } : {}),
      },
    ],
  };
}
