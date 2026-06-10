export * from "./ap2Receipt.js";

export type ReceiptStatus =
  | "attempted"
  | "denied"
  | "approved"
  | "sponsored"
  | "submitted"
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
    | "approved"
    | "denied"
    | "sponsored"
    | "submitted"
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

export interface TransitionOptions {
  readonly at: Date;
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

function requireReceiptStatus(receipt: { readonly status: ReceiptStatus }, allowed: readonly ReceiptStatus[], action: string): void {
  if (!allowed.includes(receipt.status)) {
    throw new ReceiptTransitionError("INVALID_TRANSITION", `Cannot ${action} receipt from ${receipt.status}.`);
  }
}

function requireNonEmpty(value: string, field: string): void {
  if (value.trim() === "") {
    throw new ReceiptInputError("FIELD_REQUIRED", `${field} is required.`);
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
