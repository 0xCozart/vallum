import {
  recordEscrowSettlementOpen,
  recordEscrowSettlementRefund,
  recordEscrowSettlementRelease,
  type EscrowReceipt,
  type EscrowSettlementRail,
  type EscrowSettlementReleaseMode,
  type ReceiptAmount,
} from "@vallum/receipts";

export type EscrowSettlementErrorCode =
  | "IDEMPOTENCY_REPLAYED"
  | "ESCROW_BINDING_MISMATCH"
  | "ESCROW_SETTLEMENT_NOT_OPEN"
  | "ESCROW_STORE_CONFLICT";

export class EscrowSettlementError extends Error {
  constructor(
    readonly code: EscrowSettlementErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EscrowSettlementError";
  }
}

export interface IotaEscrowOpenExecutionRequest {
  readonly receipt: EscrowReceipt;
  readonly settlementRail: EscrowSettlementRail;
  readonly releaseMode: EscrowSettlementReleaseMode;
  readonly invocationId: string;
  readonly actionId: string;
  readonly actionContractId: string;
  readonly actionContractVersion: string;
  readonly providerPayoutRef: string;
  readonly platformFeeRef: string;
  readonly refundDestinationRef: string;
  readonly providerNetAmount: ReceiptAmount;
  readonly platformFeeAmount: ReceiptAmount;
}

export interface IotaEscrowReleaseExecutionRequest {
  readonly receipt: EscrowReceipt;
  readonly verifierId: string;
  readonly escrowId: string;
  readonly invocationId: string;
  readonly releaseProofHash: string;
  readonly providerExecutionReceiptHash: string;
  readonly evidenceAttestationHash: string;
  readonly settlementReceiptHash: string;
  readonly buyerFacingReceiptHash: string;
}

export interface IotaEscrowRefundExecutionRequest {
  readonly receipt: EscrowReceipt;
  readonly escrowId: string;
  readonly invocationId: string;
  readonly reason: string;
  readonly settlementReceiptHash: string;
  readonly buyerFacingReceiptHash: string;
}

export interface IotaEscrowOpenExecutionResult {
  readonly escrowId: string;
  readonly transactionDigest: string;
}

export interface IotaEscrowSettlementExecutionResult {
  readonly transactionDigest: string;
}

export interface IotaEscrowSettlementExecutor {
  readonly open: (request: IotaEscrowOpenExecutionRequest) => Promise<IotaEscrowOpenExecutionResult>;
  readonly release: (request: IotaEscrowReleaseExecutionRequest) => Promise<IotaEscrowSettlementExecutionResult>;
  readonly refund: (request: IotaEscrowRefundExecutionRequest) => Promise<IotaEscrowSettlementExecutionResult>;
}

export interface EscrowSettlementStoreRecord {
  readonly idempotencyKey: string;
  readonly receiptId: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly providerId: string;
  readonly verifierId: string;
  readonly escrowId: string;
  readonly invocationId: string;
  readonly status: "open" | "released" | "refunded";
}

export interface EscrowSettlementStore {
  readonly getByIdempotencyKey: (idempotencyKey: string) => Promise<EscrowSettlementStoreRecord | undefined>;
  readonly getByEscrowId: (escrowId: string) => Promise<EscrowSettlementStoreRecord | undefined>;
  /**
   * Must reject conflicting idempotency-key or escrow-id bindings. A live executor
   * should back this with a durable conditional write before funds can move.
   */
  readonly put: (record: EscrowSettlementStoreRecord) => Promise<void>;
}

export interface IotaEscrowSettlementClientOptions {
  readonly executor: IotaEscrowSettlementExecutor;
  readonly store?: EscrowSettlementStore;
  readonly now?: () => Date;
}

export type IotaEscrowOpenInput = IotaEscrowOpenExecutionRequest;
export type IotaEscrowReleaseInput = IotaEscrowReleaseExecutionRequest;
export type IotaEscrowRefundInput = IotaEscrowRefundExecutionRequest;

export interface IotaEscrowSettlementClientResult {
  readonly receipt: EscrowReceipt;
}

export interface IotaEscrowOpenResult extends IotaEscrowSettlementClientResult {
  readonly escrowId: string;
  readonly transactionDigest: string;
}

export function createInMemoryEscrowSettlementStore(): EscrowSettlementStore {
  const byIdempotencyKey = new Map<string, EscrowSettlementStoreRecord>();
  const byEscrowId = new Map<string, EscrowSettlementStoreRecord>();
  return {
    async getByIdempotencyKey(idempotencyKey) {
      return byIdempotencyKey.get(idempotencyKey);
    },
    async getByEscrowId(escrowId) {
      return byEscrowId.get(escrowId);
    },
    async put(record) {
      const existingByIdempotencyKey = byIdempotencyKey.get(record.idempotencyKey);
      if (existingByIdempotencyKey && !hasSameEscrowStoreBinding(existingByIdempotencyKey, record)) {
        throw new EscrowSettlementError("ESCROW_STORE_CONFLICT", "Escrow idempotency key is already bound to another settlement.");
      }
      const existingByEscrowId = byEscrowId.get(record.escrowId);
      if (existingByEscrowId && !hasSameEscrowStoreBinding(existingByEscrowId, record)) {
        throw new EscrowSettlementError("ESCROW_STORE_CONFLICT", "Escrow id is already bound to another receipt.");
      }
      byIdempotencyKey.set(record.idempotencyKey, record);
      byEscrowId.set(record.escrowId, record);
    },
  };
}

export function createIotaEscrowSettlementClient(options: IotaEscrowSettlementClientOptions) {
  const store = options.store ?? createInMemoryEscrowSettlementStore();
  const now = () => options.now?.() ?? new Date();
  const openingIdempotencyKeys = new Set<string>();

  return {
    async open(input: IotaEscrowOpenInput): Promise<IotaEscrowOpenResult> {
      const idempotencyKey = input.receipt.idempotencyKey;
      if (openingIdempotencyKeys.has(idempotencyKey)) {
        throw new EscrowSettlementError("IDEMPOTENCY_REPLAYED", "Escrow idempotency key has already been used.");
      }
      openingIdempotencyKeys.add(idempotencyKey);
      try {
        const existing = await store.getByIdempotencyKey(idempotencyKey);
        if (existing) {
          throw new EscrowSettlementError("IDEMPOTENCY_REPLAYED", "Escrow idempotency key has already been used.");
        }
        preflightEscrowSettlementOpen(input);
        const opened = await options.executor.open(input);
        const receipt = recordEscrowSettlementOpen(input.receipt, {
          at: now(),
          settlementRail: input.settlementRail,
          escrowId: opened.escrowId,
          releaseMode: input.releaseMode,
          invocationId: input.invocationId,
          actionId: input.actionId,
          actionContractId: input.actionContractId,
          actionContractVersion: input.actionContractVersion,
          providerPayoutRef: input.providerPayoutRef,
          platformFeeRef: input.platformFeeRef,
          refundDestinationRef: input.refundDestinationRef,
          providerNetAmount: input.providerNetAmount,
          platformFeeAmount: input.platformFeeAmount,
          transactionDigest: opened.transactionDigest,
        });
        await store.put(toEscrowSettlementStoreRecord({
          receipt: input.receipt,
          escrowId: opened.escrowId,
          invocationId: input.invocationId,
          status: "open",
        }));
        return {
          receipt,
          escrowId: opened.escrowId,
          transactionDigest: opened.transactionDigest,
        };
      } finally {
        openingIdempotencyKeys.delete(idempotencyKey);
      }
    },

    async release(input: IotaEscrowReleaseInput): Promise<IotaEscrowSettlementClientResult> {
      const record = await requireOpenStoreRecord(store, input.escrowId, input.invocationId);
      requireStoreReceiptBinding(record, input.receipt);
      requireReceiptBinding(input.receipt, input.escrowId, input.invocationId);
      preflightEscrowSettlementRelease(input);
      const released = await options.executor.release(input);
      const receipt = recordEscrowSettlementRelease(input.receipt, {
        at: now(),
        verifierId: input.verifierId,
        escrowId: input.escrowId,
        invocationId: input.invocationId,
        releaseProofHash: input.releaseProofHash,
        providerExecutionReceiptHash: input.providerExecutionReceiptHash,
        evidenceAttestationHash: input.evidenceAttestationHash,
        settlementReceiptHash: input.settlementReceiptHash,
        buyerFacingReceiptHash: input.buyerFacingReceiptHash,
        transactionDigest: released.transactionDigest,
      });
      await store.put(toEscrowSettlementStoreRecord({
        receipt: input.receipt,
        escrowId: input.escrowId,
        invocationId: input.invocationId,
        status: "released",
      }));
      return { receipt };
    },

    async refund(input: IotaEscrowRefundInput): Promise<IotaEscrowSettlementClientResult> {
      const record = await requireOpenStoreRecord(store, input.escrowId, input.invocationId);
      requireStoreReceiptBinding(record, input.receipt);
      requireReceiptBinding(input.receipt, input.escrowId, input.invocationId);
      preflightEscrowSettlementRefund(input);
      const refunded = await options.executor.refund(input);
      const receipt = recordEscrowSettlementRefund(input.receipt, {
        at: now(),
        escrowId: input.escrowId,
        invocationId: input.invocationId,
        reason: input.reason,
        settlementReceiptHash: input.settlementReceiptHash,
        buyerFacingReceiptHash: input.buyerFacingReceiptHash,
        transactionDigest: refunded.transactionDigest,
      });
      await store.put(toEscrowSettlementStoreRecord({
        receipt: input.receipt,
        escrowId: input.escrowId,
        invocationId: input.invocationId,
        status: "refunded",
      }));
      return { receipt };
    },
  };
}

function hasSameEscrowStoreBinding(
  left: EscrowSettlementStoreRecord,
  right: EscrowSettlementStoreRecord,
): boolean {
  return left.idempotencyKey === right.idempotencyKey
    && left.receiptId === right.receiptId
    && left.agentId === right.agentId
    && left.ownerId === right.ownerId
    && left.providerId === right.providerId
    && left.verifierId === right.verifierId
    && left.escrowId === right.escrowId
    && left.invocationId === right.invocationId;
}

function toEscrowSettlementStoreRecord(input: {
  readonly receipt: EscrowReceipt;
  readonly escrowId: string;
  readonly invocationId: string;
  readonly status: EscrowSettlementStoreRecord["status"];
}): EscrowSettlementStoreRecord {
  return {
    idempotencyKey: input.receipt.idempotencyKey,
    receiptId: input.receipt.receiptId,
    agentId: input.receipt.agentId,
    ownerId: input.receipt.ownerId,
    providerId: input.receipt.escrow.providerId,
    verifierId: input.receipt.escrow.verifierId,
    escrowId: input.escrowId,
    invocationId: input.invocationId,
    status: input.status,
  };
}

function preflightEscrowSettlementOpen(input: IotaEscrowOpenInput): void {
  recordEscrowSettlementOpen(input.receipt, {
    at: new Date(0),
    settlementRail: input.settlementRail,
    escrowId: "preflight-escrow",
    releaseMode: input.releaseMode,
    invocationId: input.invocationId,
    actionId: input.actionId,
    actionContractId: input.actionContractId,
    actionContractVersion: input.actionContractVersion,
    providerPayoutRef: input.providerPayoutRef,
    platformFeeRef: input.platformFeeRef,
    refundDestinationRef: input.refundDestinationRef,
    providerNetAmount: input.providerNetAmount,
    platformFeeAmount: input.platformFeeAmount,
    transactionDigest: "preflight-digest",
  });
}

function preflightEscrowSettlementRelease(input: IotaEscrowReleaseInput): void {
  recordEscrowSettlementRelease(input.receipt, {
    at: new Date(0),
    verifierId: input.verifierId,
    escrowId: input.escrowId,
    invocationId: input.invocationId,
    releaseProofHash: input.releaseProofHash,
    providerExecutionReceiptHash: input.providerExecutionReceiptHash,
    evidenceAttestationHash: input.evidenceAttestationHash,
    settlementReceiptHash: input.settlementReceiptHash,
    buyerFacingReceiptHash: input.buyerFacingReceiptHash,
    transactionDigest: "preflight-digest",
  });
}

function preflightEscrowSettlementRefund(input: IotaEscrowRefundInput): void {
  recordEscrowSettlementRefund(input.receipt, {
    at: new Date(0),
    escrowId: input.escrowId,
    invocationId: input.invocationId,
    reason: input.reason,
    settlementReceiptHash: input.settlementReceiptHash,
    buyerFacingReceiptHash: input.buyerFacingReceiptHash,
    transactionDigest: "preflight-digest",
  });
}

async function requireOpenStoreRecord(
  store: EscrowSettlementStore,
  escrowId: string,
  invocationId: string,
): Promise<EscrowSettlementStoreRecord> {
  const record = await store.getByEscrowId(escrowId);
  if (!record || record.status !== "open") {
    throw new EscrowSettlementError("ESCROW_SETTLEMENT_NOT_OPEN", "Escrow settlement is not open.");
  }
  if (record.invocationId !== invocationId) {
    throw new EscrowSettlementError("ESCROW_BINDING_MISMATCH", "Escrow invocation binding does not match.");
  }
  return record;
}

function requireStoreReceiptBinding(record: EscrowSettlementStoreRecord, receipt: EscrowReceipt): void {
  if (
    record.idempotencyKey !== receipt.idempotencyKey ||
    record.receiptId !== receipt.receiptId ||
    record.agentId !== receipt.agentId ||
    record.ownerId !== receipt.ownerId ||
    record.providerId !== receipt.escrow.providerId ||
    record.verifierId !== receipt.escrow.verifierId
  ) {
    throw new EscrowSettlementError("ESCROW_BINDING_MISMATCH", "Escrow receipt binding does not match the stored settlement.");
  }
}

function requireReceiptBinding(receipt: EscrowReceipt, escrowId: string, invocationId: string): void {
  if (receipt.escrowSettlement?.escrowId !== escrowId || receipt.escrowSettlement.invocationId !== invocationId) {
    throw new EscrowSettlementError("ESCROW_BINDING_MISMATCH", "Escrow proof binding does not match the receipt.");
  }
}
