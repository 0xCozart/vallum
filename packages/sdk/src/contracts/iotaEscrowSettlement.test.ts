import assert from "node:assert/strict";
import { test } from "node:test";

import {
  approveReceipt,
  completeEscrow,
  createEscrowReceipt,
  ReceiptInputError,
  ReceiptTransitionError,
  sponsorReceipt,
  type EscrowReceipt,
} from "@vallum/receipts";

import {
  EscrowSettlementError,
  createInMemoryEscrowSettlementStore,
  createIotaEscrowSettlementClient,
  type IotaEscrowSettlementExecutor,
} from "./iotaEscrowSettlement.js";

const now = new Date("2026-06-10T12:00:00.000Z");

test("iota escrow settlement client opens escrow with fee split and rejects replayed idempotency keys", async () => {
  const calls: string[] = [];
  const client = createIotaEscrowSettlementClient({
    executor: fakeExecutor(calls),
    store: createInMemoryEscrowSettlementStore(),
    now: () => now,
  });

  const opened = await client.open({
    receipt: sponsoredIotaEscrowReceipt(),
    settlementRail: "iota-testnet",
    releaseMode: "proof",
    invocationId: "invocation:agent-action:1",
    actionId: "action:agent-action",
    actionContractId: "action-contract:agent-action",
    actionContractVersion: "1.0.0",
    providerPayoutRef: "provider-payout:provider-wallet",
    platformFeeRef: "platform-fee:vallum",
    refundDestinationRef: "refund:buyer-wallet",
    providerNetAmount: { amount: "9.50", asset: "IOTA" },
    platformFeeAmount: { amount: "0.50", asset: "IOTA" },
  });

  assert.equal(opened.receipt.status, "submitted");
  assert.equal(opened.receipt.escrowSettlement?.escrowId, "escrow-1");
  assert.deepEqual(calls, ["open:invocation:agent-action:1"]);
  await assert.rejects(
    () => client.open({
      receipt: sponsoredIotaEscrowReceipt(),
      settlementRail: "iota-testnet",
      releaseMode: "proof",
      invocationId: "invocation:agent-action:1",
      actionId: "action:agent-action",
      actionContractId: "action-contract:agent-action",
      actionContractVersion: "1.0.0",
      providerPayoutRef: "provider-payout:provider-wallet",
      platformFeeRef: "platform-fee:vallum",
      refundDestinationRef: "refund:buyer-wallet",
      providerNetAmount: { amount: "9.50", asset: "IOTA" },
      platformFeeAmount: { amount: "0.50", asset: "IOTA" },
    }),
    (error) => error instanceof EscrowSettlementError && error.code === "IDEMPOTENCY_REPLAYED",
  );
});

test("iota escrow settlement client validates open input before executor side effects", async () => {
  const calls: string[] = [];
  const client = createIotaEscrowSettlementClient({
    executor: fakeExecutor(calls),
    store: createInMemoryEscrowSettlementStore(),
    now: () => now,
  });

  await assert.rejects(
    () => client.open({
      receipt: sponsoredIotaEscrowReceipt(),
      settlementRail: "iota-testnet",
      releaseMode: "proof",
      invocationId: "invocation:agent-action:invalid",
      actionId: "action:agent-action",
      actionContractId: "action-contract:agent-action",
      actionContractVersion: "1.0.0",
      providerPayoutRef: "provider-payout:provider-wallet",
      platformFeeRef: "platform-fee:vallum",
      refundDestinationRef: "refund:buyer-wallet",
      providerNetAmount: { amount: "9.00", asset: "IOTA" },
      platformFeeAmount: { amount: "0.50", asset: "IOTA" },
    }),
    (error) => error instanceof ReceiptInputError && error.code === "FIELD_REQUIRED",
  );
  assert.deepEqual(calls, []);
});

test("iota escrow settlement client releases only when proof binding matches receipt", async () => {
  const client = createIotaEscrowSettlementClient({
    executor: fakeExecutor([]),
    store: createInMemoryEscrowSettlementStore(),
    now: () => now,
  });
  const opened = await openReceipt(client);
  const completed = completeEscrow(opened.receipt, {
    at: now,
    evidenceHash: "sha256:provider-evidence",
  });

  await assert.rejects(
    () => client.release({
      receipt: completed,
      verifierId: "verifier:alice",
      escrowId: "escrow-1",
      invocationId: "invocation:wrong",
      releaseProofHash: "sha256:release-proof",
      providerExecutionReceiptHash: "sha256:provider-execution-receipt",
      evidenceAttestationHash: "sha256:evidence-attestation",
      settlementReceiptHash: "sha256:settlement-receipt",
      buyerFacingReceiptHash: "sha256:buyer-facing-receipt",
    }),
    (error) => error instanceof EscrowSettlementError && error.code === "ESCROW_BINDING_MISMATCH",
  );

  const released = await client.release({
    receipt: completed,
    verifierId: "verifier:alice",
    escrowId: "escrow-1",
    invocationId: "invocation:agent-action:1",
    releaseProofHash: "sha256:release-proof",
    providerExecutionReceiptHash: "sha256:provider-execution-receipt",
    evidenceAttestationHash: "sha256:evidence-attestation",
    settlementReceiptHash: "sha256:settlement-receipt",
    buyerFacingReceiptHash: "sha256:buyer-facing-receipt",
  });

  assert.equal(released.receipt.status, "released");
  assert.equal(released.receipt.escrowSettlement?.platformFeePaid, true);
  assert.equal(released.receipt.escrowSettlement?.settlementTransactionDigest, "digest-release-1");
});

test("iota escrow settlement client validates release input before executor side effects", async () => {
  const calls: string[] = [];
  const client = createIotaEscrowSettlementClient({
    executor: fakeExecutor(calls),
    store: createInMemoryEscrowSettlementStore(),
    now: () => now,
  });
  const opened = await openReceipt(client);
  const completed = completeEscrow(opened.receipt, {
    at: now,
    evidenceHash: "sha256:provider-evidence",
  });
  calls.length = 0;

  await assert.rejects(
    () => client.release({
      receipt: completed,
      verifierId: "verifier:wrong",
      escrowId: "escrow-1",
      invocationId: "invocation:agent-action:1",
      releaseProofHash: "sha256:release-proof",
      providerExecutionReceiptHash: "sha256:provider-execution-receipt",
      evidenceAttestationHash: "sha256:evidence-attestation",
      settlementReceiptHash: "sha256:settlement-receipt",
      buyerFacingReceiptHash: "sha256:buyer-facing-receipt",
    }),
    (error) => error instanceof ReceiptTransitionError && error.code === "UNAUTHORIZED_VERIFIER",
  );
  assert.deepEqual(calls, []);
});

test("iota escrow settlement client rejects forged receipt bindings before executor side effects", async () => {
  const calls: string[] = [];
  const client = createIotaEscrowSettlementClient({
    executor: fakeExecutor(calls),
    store: createInMemoryEscrowSettlementStore(),
    now: () => now,
  });
  const opened = await openReceipt(client);
  const completed = completeEscrow(opened.receipt, {
    at: now,
    evidenceHash: "sha256:provider-evidence",
  });
  const forgedReceipt: EscrowReceipt = {
    ...completed,
    receiptId: "receipt_forged_escrow_1",
    idempotencyKey: "idem_forged_escrow_1",
    ownerId: "owner:mallory",
  };
  calls.length = 0;

  await assert.rejects(
    () => client.release({
      receipt: forgedReceipt,
      verifierId: "verifier:alice",
      escrowId: "escrow-1",
      invocationId: "invocation:agent-action:1",
      releaseProofHash: "sha256:release-proof",
      providerExecutionReceiptHash: "sha256:provider-execution-receipt",
      evidenceAttestationHash: "sha256:evidence-attestation",
      settlementReceiptHash: "sha256:settlement-receipt",
      buyerFacingReceiptHash: "sha256:buyer-facing-receipt",
    }),
    (error) => error instanceof EscrowSettlementError && error.code === "ESCROW_BINDING_MISMATCH",
  );
  assert.deepEqual(calls, []);
});

test("iota escrow settlement client blocks concurrent duplicate opens before duplicate executor calls", async () => {
  const calls: string[] = [];
  const client = createIotaEscrowSettlementClient({
    executor: delayedExecutor(calls),
    store: createInMemoryEscrowSettlementStore(),
    now: () => now,
  });

  const results = await Promise.allSettled([
    client.open(openInput()),
    client.open(openInput()),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(calls.filter((call) => call === "open:invocation:agent-action:1").length, 1);
  assert.ok(
    rejected[0]?.status === "rejected"
    && rejected[0].reason instanceof EscrowSettlementError
    && rejected[0].reason.code === "IDEMPOTENCY_REPLAYED",
  );
});

test("iota escrow settlement store rejects reused escrow ids without overwriting the original binding", async () => {
  const store = createInMemoryEscrowSettlementStore();
  const client = createIotaEscrowSettlementClient({
    executor: fakeExecutor([]),
    store,
    now: () => now,
  });
  const opened = await client.open(openInput());

  await assert.rejects(
    () => client.open({
      ...openInput(),
      receipt: sponsoredIotaEscrowReceipt({
        receiptId: "receipt_iota_escrow_2",
        idempotencyKey: "idem_iota_escrow_2",
        ownerId: "owner:bob",
      }),
      invocationId: "invocation:agent-action:2",
    }),
    (error) => error instanceof EscrowSettlementError && error.code === "ESCROW_STORE_CONFLICT",
  );
  assert.deepEqual(await store.getByEscrowId("escrow-1"), {
    idempotencyKey: "idem_iota_escrow_1",
    receiptId: "receipt_iota_escrow_1",
    agentId: "agent:quote-bot",
    ownerId: "owner:alice",
    providerId: "provider:quote-service",
    verifierId: "verifier:alice",
    escrowId: "escrow-1",
    invocationId: "invocation:agent-action:1",
    status: "open",
  });
  assert.equal(opened.receipt.escrowSettlement?.escrowId, "escrow-1");
});

test("iota escrow settlement client refunds invalid evidence without paying platform fee", async () => {
  const client = createIotaEscrowSettlementClient({
    executor: fakeExecutor([]),
    store: createInMemoryEscrowSettlementStore(),
    now: () => now,
  });
  const opened = await openReceipt(client);

  const refunded = await client.refund({
    receipt: opened.receipt,
    escrowId: "escrow-1",
    invocationId: "invocation:agent-action:1",
    reason: "invalid-evidence",
    settlementReceiptHash: "sha256:refund-settlement-receipt",
    buyerFacingReceiptHash: "sha256:refund-buyer-facing-receipt",
  });

  assert.equal(refunded.receipt.status, "refunded");
  assert.equal(refunded.receipt.escrowSettlement?.platformFeePaid, false);
  assert.equal(refunded.receipt.escrowSettlement?.settlementTransactionDigest, "digest-refund-1");
});

async function openReceipt(client: ReturnType<typeof createIotaEscrowSettlementClient>) {
  return client.open(openInput());
}

function openInput() {
  return {
    receipt: sponsoredIotaEscrowReceipt(),
    settlementRail: "iota-testnet",
    releaseMode: "proof",
    invocationId: "invocation:agent-action:1",
    actionId: "action:agent-action",
    actionContractId: "action-contract:agent-action",
    actionContractVersion: "1.0.0",
    providerPayoutRef: "provider-payout:provider-wallet",
    platformFeeRef: "platform-fee:vallum",
    refundDestinationRef: "refund:buyer-wallet",
    providerNetAmount: { amount: "9.50", asset: "IOTA" },
    platformFeeAmount: { amount: "0.50", asset: "IOTA" },
  } as const;
}

function sponsoredIotaEscrowReceipt(overrides: Partial<{
  readonly receiptId: string;
  readonly idempotencyKey: string;
  readonly ownerId: string;
}> = {}): EscrowReceipt {
  const idempotencyKey = overrides.idempotencyKey ?? "idem_iota_escrow_1";
  const approved = approveReceipt(createEscrowReceipt({
    receiptId: overrides.receiptId ?? "receipt_iota_escrow_1",
    manifestId: idempotencyKey,
    idempotencyKey,
    agentId: "agent:quote-bot",
    ownerId: overrides.ownerId ?? "owner:alice",
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

function fakeExecutor(calls: string[]): IotaEscrowSettlementExecutor {
  return {
    open: async (request) => {
      calls.push(`open:${request.invocationId}`);
      return { escrowId: "escrow-1", transactionDigest: "digest-open-1" };
    },
    release: async (request) => {
      calls.push(`release:${request.invocationId}`);
      return { transactionDigest: "digest-release-1" };
    },
    refund: async (request) => {
      calls.push(`refund:${request.invocationId}`);
      return { transactionDigest: "digest-refund-1" };
    },
  };
}

function delayedExecutor(calls: string[]): IotaEscrowSettlementExecutor {
  return {
    open: async (request) => {
      calls.push(`open:${request.invocationId}`);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { escrowId: "escrow-1", transactionDigest: "digest-open-1" };
    },
    release: async (request) => {
      calls.push(`release:${request.invocationId}`);
      return { transactionDigest: "digest-release-1" };
    },
    refund: async (request) => {
      calls.push(`refund:${request.invocationId}`);
      return { transactionDigest: "digest-refund-1" };
    },
  };
}
