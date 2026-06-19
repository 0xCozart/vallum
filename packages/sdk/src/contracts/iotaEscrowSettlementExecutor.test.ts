import assert from "node:assert/strict";
import { test } from "node:test";

import { Inputs } from "@iota/iota-sdk/transactions";
import {
  approveReceipt,
  completeEscrow,
  createEscrowReceipt,
  sponsorReceipt,
  type EscrowReceipt,
} from "@vallum/receipts";

import {
  createInMemoryEscrowSettlementStore,
  createIotaEscrowSettlementClient,
} from "./iotaEscrowSettlement.js";
import {
  LiveEscrowSettlementExecutorError,
  createSponsoredIotaEscrowSettlementExecutor,
  type IotaEscrowSettlementGateway,
  type IotaEscrowSettlementSigner,
  type IotaEscrowSettlementSignerResolverContext,
} from "./iotaEscrowSettlementExecutor.js";

const now = new Date("2026-06-19T00:00:00.000Z");
const packageId = hexAddress("1");
const paymentType = `${hexAddress("2")}::iota::IOTA`;
const ownerAddress = hexAddress("a11ce");
const providerAddress = hexAddress("b0b");
const verifierAddress = hexAddress("c0de");
const refundAuthorityAddress = hexAddress("cafe");
const refundDestinationAddress = hexAddress("f00d");
const platformFeeAddress = hexAddress("fee");
const sponsorAddress = hexAddress("5");
const escrowObjectId = hexAddress("e5c10");
const paymentObjectId = hexAddress("c01");

test("sponsored iota escrow executor opens, releases, and refunds through Vallum gateway", async () => {
  const gateway = fakeGateway();
  const built: Array<{
    readonly operation: string;
    readonly targets: readonly string[];
    readonly typeArguments: readonly (readonly string[])[];
    readonly objectInputs: readonly string[];
  }> = [];
  const signedLengths: number[] = [];
  const executor = createSponsoredIotaEscrowSettlementExecutor({
    gateway,
    resolveSigner: escrowOperationSigner(signedLengths),
    contract: {
      packageId,
      paymentType,
    },
    gasBudget: 50_000_000,
    reserveDurationSecs: 120,
    resolveParticipants: escrowParticipants,
    amountsToBaseUnits: escrowBaseUnitAmounts,
    resolvePaymentObject: () => paymentObjectId,
    allowUnsafeCustomTransactionBuilder: true,
    unsafeBuildTransactionBytesForTesting: (tx, context) => {
      const data = tx.getData();
      built.push({
        operation: context.operation,
        targets: data.commands
          .map(moveTargetFromCommand)
          .filter((target): target is string => typeof target === "string"),
        typeArguments: data.commands
          .map(moveTypeArgumentsFromCommand)
          .filter((typeArguments): typeArguments is readonly string[] => Array.isArray(typeArguments)),
        objectInputs: data.inputs.map((input) => JSON.stringify(input)),
      });
      return new Uint8Array([1, 2, 3, built.length]);
    },
  });
  const client = createIotaEscrowSettlementClient({
    executor,
    store: createInMemoryEscrowSettlementStore(),
    now: () => now,
  });

  const opened = await client.open(openInput());
  const completed = completeEscrow(opened.receipt, {
    at: now,
    evidenceHash: "sha256:provider-evidence",
  });
  const released = await client.release({
    receipt: completed,
    verifierId: "verifier:alice",
    escrowId: opened.escrowId,
    invocationId: "invocation:agent-action:1",
    releaseProofHash: "sha256:release-proof",
    providerExecutionReceiptHash: "sha256:provider-execution-receipt",
    evidenceAttestationHash: "sha256:evidence-attestation",
    settlementReceiptHash: "sha256:settlement-receipt",
    buyerFacingReceiptHash: "sha256:buyer-facing-receipt",
  });

  const secondClient = createIotaEscrowSettlementClient({
    executor,
    store: createInMemoryEscrowSettlementStore(),
    now: () => now,
  });
  const secondOpened = await secondClient.open({
    ...openInput(),
    receipt: sponsoredIotaEscrowReceipt({
      receiptId: "receipt_iota_escrow_2",
      idempotencyKey: "idem_iota_escrow_2",
    }),
    invocationId: "invocation:agent-action:2",
  });
  const refunded = await secondClient.refund({
    receipt: secondOpened.receipt,
    escrowId: secondOpened.escrowId,
    invocationId: "invocation:agent-action:2",
    reason: "invalid-evidence",
    settlementReceiptHash: "sha256:refund-settlement-receipt",
    buyerFacingReceiptHash: "sha256:refund-buyer-facing-receipt",
  });

  assert.equal(opened.escrowId, hexAddress("e5c101"));
  assert.equal(opened.receipt.escrowSettlement?.openedTransactionDigest, "digest-open_shared-1");
  assert.equal(opened.receipt.escrowSettlement?.assetType, paymentType);
  assert.equal(opened.receipt.escrowSettlement?.grossAmountBaseUnits, "10000000");
  assert.equal(opened.receipt.escrowSettlement?.providerNetBaseUnits, "9500000");
  assert.equal(opened.receipt.escrowSettlement?.platformFeeBaseUnits, "500000");
  assert.equal(opened.receipt.escrowSettlement?.refundAfterEpochMs, "4102444800000");
  assert.equal(opened.receipt.escrowSettlement?.allowPayeeRelease, false);
  assert.equal(released.receipt.escrowSettlement?.settlementTransactionDigest, "digest-release-2");
  assert.equal(refunded.receipt.escrowSettlement?.settlementTransactionDigest, "digest-refund-4");
  assert.equal(refunded.receipt.escrowSettlement?.platformFeePaid, false);
  assert.deepEqual(gateway.reserveCalls.map((call) => call.functionName), ["open_shared", "release", "open_shared", "refund"]);
  assert.deepEqual(gateway.reserveCalls.map((call) => call.walletAddress), [
    ownerAddress,
    verifierAddress,
    ownerAddress,
    refundAuthorityAddress,
  ]);
  assert.deepEqual(gateway.executeCalls.map((call) => call.transactionBytes), ["AQIDAQ==", "AQIDAg==", "AQIDAw==", "AQIDBA=="]);
  assert.deepEqual(gateway.executeCalls.map((call) => call.userSignature), ["signed-1", "signed-2", "signed-3", "signed-4"]);
  assert.deepEqual(built[0]?.targets, [
    `${packageId}::escrow::open_shared`,
  ]);
  assert.deepEqual(built[0]?.typeArguments, [
    [paymentType],
  ]);
  assert.deepEqual(built[1]?.targets, [`${packageId}::escrow::release`]);
  assert.deepEqual(built[3]?.targets, [`${packageId}::escrow::refund`]);
  assert.ok(built[0]?.objectInputs.some((input) => input.includes(paymentObjectId)));
  assert.ok(built[1]?.objectInputs.some((input) => input.includes(opened.escrowId)));
  assert.ok(built[3]?.objectInputs.some((input) => input.includes(secondOpened.escrowId)));
  assert.deepEqual(signedLengths, [4, 4, 4, 4]);
});

test("sponsored iota escrow executor policy metadata follows custom Move functions", async () => {
  const gateway = fakeGateway();
  const releaseObjectInputs: unknown[] = [];
  const executor = createSponsoredIotaEscrowSettlementExecutor({
    gateway,
    resolveSigner: escrowOperationSigner(),
    contract: {
      packageId,
      paymentType,
      moduleName: "agent_escrow",
      releaseFunction: "approve_release",
      refundFunction: "return_to_buyer",
      publishEscrowObject: "transfer-to-owner",
    },
    gasBudget: 100,
    resolveParticipants: escrowParticipants,
    amountsToBaseUnits: escrowBaseUnitAmounts,
    resolvePaymentObject: () => paymentObjectId,
    resolveEscrowObject: () => Inputs.ObjectRef({
      objectId: escrowObjectId,
      version: "7",
      digest: "escrowDigest",
    }),
    allowUnsafeCustomTransactionBuilder: true,
    unsafeBuildTransactionBytesForTesting: (tx, context) => {
      if (context.operation === "release") {
        releaseObjectInputs.push(tx.getData().inputs.find((input) => "Object" in input));
      }
      return new Uint8Array([5, 6, 7]);
    },
  });
  const client = createIotaEscrowSettlementClient({
    executor,
    store: createInMemoryEscrowSettlementStore(),
    now: () => now,
  });
  const opened = await client.open(openInput());
  const completed = completeEscrow(opened.receipt, {
    at: now,
    evidenceHash: "sha256:provider-evidence",
  });

  await client.release({
    receipt: completed,
    verifierId: "verifier:alice",
    escrowId: opened.escrowId,
    invocationId: "invocation:agent-action:1",
    releaseProofHash: "sha256:release-proof",
    providerExecutionReceiptHash: "sha256:provider-execution-receipt",
    evidenceAttestationHash: "sha256:evidence-attestation",
    settlementReceiptHash: "sha256:settlement-receipt",
    buyerFacingReceiptHash: "sha256:buyer-facing-receipt",
  });

  assert.equal(gateway.reserveCalls[1]?.packageId, packageId);
  assert.equal(gateway.reserveCalls[1]?.functionName, "approve_release");
  assert.ok(releaseObjectInputs.length > 0);
});

test("sponsored iota escrow executor rejects policy target drift before reserving gas", async () => {
  const gateway = fakeGateway();
  const executor = createSponsoredIotaEscrowSettlementExecutor({
    gateway,
    signer: fakeSigner(),
    contract: { packageId, paymentType },
    gasBudget: 100,
    resolveParticipants: escrowParticipants,
    amountsToBaseUnits: escrowBaseUnitAmounts,
    resolvePaymentObject: () => paymentObjectId,
    policyTargetForOpen: () => ({ packageId: hexAddress("bad"), functionName: "open_shared" }),
    allowUnsafeCustomTransactionBuilder: true,
    unsafeBuildTransactionBytesForTesting: () => new Uint8Array([1]),
  });

  await assert.rejects(
    () => executor.open(openInput()),
    (error) => error instanceof LiveEscrowSettlementExecutorError
      && error.code === "ESCROW_EXECUTOR_CONFIG_INVALID",
  );
  assert.equal(gateway.reserveCalls.length, 0);
  assert.equal(gateway.executeCalls.length, 0);
});

test("sponsored iota escrow executor extracts the created escrow object id", async () => {
  const expectedEscrowId = hexAddress("e5c10aa");
  const gateway = fakeGateway({
    execute: () => ({
      digest: "digest-create-with-publish",
      raw: {
        objectChanges: [
          { type: "published", objectId: hexAddress("bad") },
          {
            type: "created",
            objectId: expectedEscrowId,
            objectType: `${packageId}::escrow::Escrow<${paymentType}>`,
          },
        ],
      },
    }),
  });
  const executor = createSponsoredIotaEscrowSettlementExecutor({
    gateway,
    signer: fakeSigner(),
    contract: { packageId, paymentType },
    gasBudget: 100,
    resolveParticipants: escrowParticipants,
    amountsToBaseUnits: escrowBaseUnitAmounts,
    resolvePaymentObject: () => paymentObjectId,
    allowUnsafeCustomTransactionBuilder: true,
    unsafeBuildTransactionBytesForTesting: () => new Uint8Array([1]),
  });

  const opened = await executor.open(openInput());

  assert.equal(opened.escrowId, expectedEscrowId);
});

test("sponsored iota escrow executor fails closed when typed created object is not escrow", async () => {
  const gateway = fakeGateway({
    execute: () => ({
      digest: "digest-created-non-escrow",
      raw: {
        objectChanges: [
          {
            type: "created",
            objectId: hexAddress("c0ffee"),
            objectType: `${packageId}::other::NotEscrow`,
          },
        ],
      },
    }),
  });
  const executor = createSponsoredIotaEscrowSettlementExecutor({
    gateway,
    signer: fakeSigner(),
    contract: { packageId, paymentType },
    gasBudget: 100,
    resolveParticipants: escrowParticipants,
    amountsToBaseUnits: escrowBaseUnitAmounts,
    resolvePaymentObject: () => paymentObjectId,
    allowUnsafeCustomTransactionBuilder: true,
    unsafeBuildTransactionBytesForTesting: () => new Uint8Array([1]),
  });

  await assert.rejects(
    () => executor.open(openInput()),
    (error) => error instanceof LiveEscrowSettlementExecutorError
      && error.code === "ESCROW_EXECUTOR_ESCROW_ID_MISSING",
  );
});

test("sponsored iota escrow executor fails closed on unusable live responses", async () => {
  const missingDigestGateway = fakeGateway({
    execute: () => ({ raw: {} }),
  });
  const executor = createSponsoredIotaEscrowSettlementExecutor({
    gateway: missingDigestGateway,
    signer: fakeSigner(),
    contract: { packageId, paymentType },
    gasBudget: 100,
    resolveParticipants: escrowParticipants,
    amountsToBaseUnits: escrowBaseUnitAmounts,
    resolvePaymentObject: () => paymentObjectId,
    allowUnsafeCustomTransactionBuilder: true,
    unsafeBuildTransactionBytesForTesting: () => new Uint8Array([1]),
  });

  await assert.rejects(
    () => executor.open(openInput()),
    (error) => error instanceof LiveEscrowSettlementExecutorError
      && error.code === "ESCROW_EXECUTOR_EXECUTE_RESPONSE_INVALID",
  );

  assert.throws(
    () => createSponsoredIotaEscrowSettlementExecutor({
      gateway: fakeGateway(),
      signer: fakeSigner(),
      contract: { packageId, paymentType },
      gasBudget: 0,
      resolveParticipants: escrowParticipants,
      amountsToBaseUnits: escrowBaseUnitAmounts,
      resolvePaymentObject: () => paymentObjectId,
    }),
    (error) => error instanceof LiveEscrowSettlementExecutorError
      && error.code === "ESCROW_EXECUTOR_CONFIG_INVALID",
  );
});

test("sponsored iota escrow executor requires explicit opt-in for unsafe byte builders", () => {
  assert.throws(
    () => createSponsoredIotaEscrowSettlementExecutor({
      gateway: fakeGateway(),
      signer: fakeSigner(),
      contract: { packageId, paymentType },
      gasBudget: 100,
      resolveParticipants: escrowParticipants,
      amountsToBaseUnits: escrowBaseUnitAmounts,
      resolvePaymentObject: () => paymentObjectId,
      unsafeBuildTransactionBytesForTesting: () => new Uint8Array([1]),
    }),
    (error) => error instanceof LiveEscrowSettlementExecutorError
      && error.code === "ESCROW_EXECUTOR_CONFIG_INVALID",
  );
});

test("sponsored iota escrow executor rejects invalid base-unit amounts before reserving gas", async () => {
  const invalidAmounts = ["1.5", -1, "18446744073709551616"] as const;

  for (const amount of invalidAmounts) {
    const gateway = fakeGateway();
    const executor = createSponsoredIotaEscrowSettlementExecutor({
      gateway,
      signer: fakeSigner(),
      contract: { packageId, paymentType },
      gasBudget: 100,
      resolveParticipants: escrowParticipants,
      amountsToBaseUnits: () => ({
        grossAmount: amount,
        providerNetAmount: 9_500_000n,
        platformFeeAmount: 500_000n,
      }),
      resolvePaymentObject: () => paymentObjectId,
      allowUnsafeCustomTransactionBuilder: true,
      unsafeBuildTransactionBytesForTesting: () => new Uint8Array([1]),
    });

    await assert.rejects(
      () => executor.open(openInput()),
      (error) => error instanceof LiveEscrowSettlementExecutorError
        && error.code === "ESCROW_EXECUTOR_CONFIG_INVALID",
    );
    assert.equal(gateway.reserveCalls.length, 0);
  }
});

test("sponsored iota escrow executor rejects open signer that does not match payer", async () => {
  const gateway = fakeGateway();
  const executor = createSponsoredIotaEscrowSettlementExecutor({
    gateway,
    signer: fakeSigner(verifierAddress),
    contract: { packageId, paymentType },
    gasBudget: 100,
    resolveParticipants: escrowParticipants,
    amountsToBaseUnits: escrowBaseUnitAmounts,
    resolvePaymentObject: () => paymentObjectId,
    allowUnsafeCustomTransactionBuilder: true,
    unsafeBuildTransactionBytesForTesting: () => new Uint8Array([1]),
  });

  await assert.rejects(
    () => executor.open(openInput()),
    (error) => error instanceof LiveEscrowSettlementExecutorError
      && error.code === "ESCROW_EXECUTOR_CONFIG_INVALID",
  );
  assert.equal(gateway.reserveCalls.length, 0);
});

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
    refundAuthorityRef: "refund-authority:buyer-agent",
    refundDestinationRef: "refund:buyer-wallet",
    providerNetAmount: { amount: "9.50", asset: "IOTA" },
    platformFeeAmount: { amount: "0.50", asset: "IOTA" },
    refundAfterEpochMs: "4102444800000",
    allowPayeeRelease: false,
  } as const;
}

function escrowParticipants() {
  return {
    ownerAddress,
    providerAddress,
    verifierAddress,
    refundAuthorityAddress,
    refundDestinationAddress,
    platformFeeAddress,
  };
}

function escrowBaseUnitAmounts() {
  return {
    grossAmount: 10_000_000n,
    providerNetAmount: 9_500_000n,
    platformFeeAmount: 500_000n,
  };
}

function sponsoredIotaEscrowReceipt(overrides: Partial<{
  readonly receiptId: string;
  readonly idempotencyKey: string;
}> = {}): EscrowReceipt {
  const idempotencyKey = overrides.idempotencyKey ?? "idem_iota_escrow_1";
  const approved = approveReceipt(createEscrowReceipt({
    receiptId: overrides.receiptId ?? "receipt_iota_escrow_1",
    manifestId: idempotencyKey,
    idempotencyKey,
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

function escrowOperationSigner(signedLengths: number[] = []) {
  return ({ operation }: IotaEscrowSettlementSignerResolverContext) => {
    if (operation === "open") return fakeSigner(ownerAddress, signedLengths);
    if (operation === "release") return fakeSigner(verifierAddress, signedLengths);
    return fakeSigner(refundAuthorityAddress, signedLengths);
  };
}

function fakeSigner(address = ownerAddress, signedLengths: number[] = []): IotaEscrowSettlementSigner & { readonly signedLengths: number[] } {
  return {
    address,
    signedLengths,
    async signTransaction(bytes) {
      signedLengths.push(bytes.length);
      return { signature: `signed-${signedLengths.length}` };
    },
  };
}

function fakeGateway(overrides: {
  readonly execute?: (callNumber: number) => { readonly digest?: string; readonly raw: unknown };
} = {}): IotaEscrowSettlementGateway & {
  readonly reserveCalls: Array<{
    readonly gasBudget: number;
    readonly walletAddress?: string;
    readonly packageId?: string;
    readonly functionName?: string;
  }>;
  readonly executeCalls: Array<{
    readonly transactionBytes: string;
    readonly userSignature: string;
  }>;
} {
  const reserveCalls: Array<{
    readonly gasBudget: number;
    readonly walletAddress?: string;
    readonly packageId?: string;
    readonly functionName?: string;
  }> = [];
  const executeCalls: Array<{
    readonly transactionBytes: string;
    readonly userSignature: string;
  }> = [];
  return {
    reserveCalls,
    executeCalls,
    async reserveGas(request) {
      reserveCalls.push({
        gasBudget: request.gasBudget,
        walletAddress: request.walletAddress,
        packageId: request.packageId,
        functionName: request.functionName,
      });
      return {
        reservationId: `reservation-${reserveCalls.length}`,
        agentRailTransactionId: `vallum-${reserveCalls.length}`,
        sponsorAddress,
        gasCoins: [{ objectId: hexAddress(`6a5${reserveCalls.length}`), version: "1", digest: "gasDigest" }],
        raw: {},
      };
    },
    async executeSponsoredTransaction(request) {
      executeCalls.push({
        transactionBytes: request.transactionBytes,
        userSignature: request.userSignature,
      });
      if (overrides.execute) return overrides.execute(executeCalls.length);
      const operation = reserveCalls.at(-1)?.functionName ?? "execute";
      return {
        digest: `digest-${operation}-${executeCalls.length}`,
        raw: {
          objectChanges: [{ type: "created", objectId: hexAddress(`e5c10${executeCalls.length}`) }],
        },
      };
    },
  };
}

function hexAddress(suffix: string): `0x${string}` {
  return `0x${suffix.padStart(64, "0")}`;
}

function moveTargetFromCommand(command: {
  readonly $kind?: string;
  readonly MoveCall?: {
    readonly package: string;
    readonly module: string;
    readonly function: string;
  };
}): string | undefined {
  const moveCall = command.MoveCall;
  if (command.$kind !== "MoveCall" || !moveCall) return undefined;
  return `${moveCall.package}::${moveCall.module}::${moveCall.function}`;
}

function moveTypeArgumentsFromCommand(command: {
  readonly $kind?: string;
  readonly MoveCall?: {
    readonly typeArguments?: readonly string[];
  };
}): readonly string[] | undefined {
  const moveCall = command.MoveCall;
  if (command.$kind !== "MoveCall" || !moveCall) return undefined;
  return moveCall.typeArguments ?? [];
}
