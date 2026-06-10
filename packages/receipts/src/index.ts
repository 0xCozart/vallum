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
    | "approved"
    | "denied"
    | "sponsored"
    | "submitted"
    | "completed"
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

export function approveReceipt(receipt: EscrowReceipt, options: TransitionOptions): EscrowReceipt {
  requireReceiptStatus(receipt, ["attempted"], "approve");
  return withReceiptEvent(receipt, "approved", options.at, { status: "approved" });
}

export function denyReceipt(receipt: EscrowReceipt, options: TransitionOptions & { readonly reason: string }): EscrowReceipt {
  requireReceiptStatus(receipt, ["attempted"], "deny");
  return withReceiptEvent(receipt, "denied", options.at, {
    status: "denied",
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

function requireReceiptStatus(receipt: EscrowReceipt, allowed: readonly ReceiptStatus[], action: string): void {
  if (!allowed.includes(receipt.status)) {
    throw new ReceiptTransitionError("INVALID_TRANSITION", `Cannot ${action} receipt from ${receipt.status}.`);
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
