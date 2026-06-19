import { toBase64 } from "@iota/bcs";
import type { IotaClient } from "@iota/iota-sdk/client";
import { Transaction, type TransactionObjectInput } from "@iota/iota-sdk/transactions";

import type {
  ExecuteSponsoredTransactionRequest,
  ExecuteSponsoredTransactionResponse,
  ReserveGasRequest,
  ReserveGasResponse,
} from "../types.js";
import type {
  IotaEscrowOpenExecutionRequest,
  IotaEscrowOpenExecutionResult,
  IotaEscrowRefundExecutionRequest,
  IotaEscrowReleaseExecutionRequest,
  IotaEscrowSettlementExecutionResult,
  IotaEscrowSettlementExecutor,
} from "./iotaEscrowSettlement.js";

export type LiveEscrowSettlementExecutorErrorCode =
  | "ESCROW_EXECUTOR_CONFIG_INVALID"
  | "ESCROW_EXECUTOR_RESERVE_RESPONSE_INVALID"
  | "ESCROW_EXECUTOR_EXECUTE_RESPONSE_INVALID"
  | "ESCROW_EXECUTOR_ESCROW_ID_MISSING";

export class LiveEscrowSettlementExecutorError extends Error {
  constructor(
    readonly code: LiveEscrowSettlementExecutorErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LiveEscrowSettlementExecutorError";
  }
}

export interface IotaEscrowSettlementSigner {
  readonly address: string;
  readonly signTransaction: (bytes: Uint8Array) => Promise<{ readonly signature: string }> | { readonly signature: string };
}

export interface IotaEscrowSettlementGateway {
  readonly reserveGas: (request: ReserveGasRequest) => Promise<ReserveGasResponse>;
  readonly executeSponsoredTransaction: (
    request: ExecuteSponsoredTransactionRequest,
  ) => Promise<ExecuteSponsoredTransactionResponse>;
}

export interface IotaEscrowSettlementMoveContract {
  readonly packageId: string;
  readonly moduleName?: string;
  readonly openFunction?: string;
  readonly releaseFunction?: string;
  readonly refundFunction?: string;
  readonly escrowTypeName?: string;
  /**
   * Shared escrows can be released or refunded by the verifier/owner signer.
   * Transfer-to-owner is available for deployments that wrap release/refund in
   * a different access pattern.
   */
  readonly publishEscrowObject?: "share" | "transfer-to-owner" | "none";
}

export interface IotaEscrowSettlementParticipants {
  readonly ownerAddress: string;
  readonly providerAddress: string;
  readonly verifierAddress: string;
}

export type IotaEscrowSettlementParticipantResolver = (
  request: IotaEscrowOpenExecutionRequest,
) => IotaEscrowSettlementParticipants | Promise<IotaEscrowSettlementParticipants>;

export type IotaEscrowSettlementAmountResolver = (
  request: IotaEscrowOpenExecutionRequest,
) => bigint | number | string | Promise<bigint | number | string>;

export type IotaEscrowSettlementObjectResolver = (
  request: IotaEscrowReleaseExecutionRequest | IotaEscrowRefundExecutionRequest,
) => TransactionObjectInput | Promise<TransactionObjectInput>;

export interface IotaEscrowSettlementExecutionContext {
  readonly operation: "open" | "release" | "refund";
  readonly reservation: ReserveGasResponse;
  readonly execution: ExecuteSponsoredTransactionResponse;
}

export type IotaEscrowSettlementEscrowIdExtractor = (
  context: IotaEscrowSettlementExecutionContext & { readonly request: IotaEscrowOpenExecutionRequest },
) => string | undefined;

export interface IotaEscrowSettlementPolicyTarget {
  readonly packageId?: string;
  readonly functionName?: string;
}

export type IotaEscrowSettlementPolicyTargetResolver<Request> = (
  request: Request,
) => IotaEscrowSettlementPolicyTarget | Promise<IotaEscrowSettlementPolicyTarget>;

export interface CreateSponsoredIotaEscrowSettlementExecutorOptions {
  readonly gateway: IotaEscrowSettlementGateway;
  readonly contract: IotaEscrowSettlementMoveContract;
  readonly signer: IotaEscrowSettlementSigner;
  readonly iotaClient?: IotaClient;
  readonly gasBudget: number;
  readonly reserveDurationSecs?: number;
  readonly resolveParticipants: IotaEscrowSettlementParticipantResolver;
  readonly amountToBaseUnits: IotaEscrowSettlementAmountResolver;
  readonly resolveEscrowObject?: IotaEscrowSettlementObjectResolver;
  readonly extractEscrowId?: IotaEscrowSettlementEscrowIdExtractor;
  readonly policyTargetForOpen?: IotaEscrowSettlementPolicyTargetResolver<IotaEscrowOpenExecutionRequest>;
  readonly policyTargetForRelease?: IotaEscrowSettlementPolicyTargetResolver<IotaEscrowReleaseExecutionRequest>;
  readonly policyTargetForRefund?: IotaEscrowSettlementPolicyTargetResolver<IotaEscrowRefundExecutionRequest>;
  /**
   * Unit-test escape hatch for deterministic transaction bytes.
   *
   * Live executors should pass `iotaClient` and let the IOTA SDK build bytes
   * from the configured Move call. This hook can bypass that boundary, so it
   * also requires `allowUnsafeCustomTransactionBuilder: true`.
   */
  readonly unsafeBuildTransactionBytesForTesting?: (
    tx: Transaction,
    context: { readonly operation: "open" | "release" | "refund" },
  ) => Promise<Uint8Array> | Uint8Array;
  readonly allowUnsafeCustomTransactionBuilder?: boolean;
}

type GasCoinRef = {
  readonly objectId: string;
  readonly version: string | number;
  readonly digest: string;
};

const DEFAULT_MODULE = "escrow";
const DEFAULT_OPEN_FUNCTION = "create";
const DEFAULT_RELEASE_FUNCTION = "release";
const DEFAULT_REFUND_FUNCTION = "refund";
const DEFAULT_ESCROW_TYPE = "Escrow";
const MAX_U64 = (1n << 64n) - 1n;

export function createSponsoredIotaEscrowSettlementExecutor(
  options: CreateSponsoredIotaEscrowSettlementExecutorOptions,
): IotaEscrowSettlementExecutor {
  validateExecutorOptions(options);

  return {
    async open(request): Promise<IotaEscrowOpenExecutionResult> {
      const participants = await options.resolveParticipants(request);
      requireParticipants(participants);
      const amount = normalizeU64BaseUnits(await options.amountToBaseUnits(request));
      const tx = new Transaction();
      const contract = normalizeContract(options.contract);
      const createdEscrow = tx.moveCall({
        target: moveTarget(contract.packageId, contract.moduleName, contract.openFunction),
        arguments: [
          tx.pure.address(participants.ownerAddress),
          tx.pure.address(participants.providerAddress),
          tx.pure.address(participants.verifierAddress),
          tx.pure.u64(amount),
          tx.pure.vector("u8", utf8Bytes(request.providerNetAmount.asset)),
          tx.pure.vector("u8", utf8Bytes(request.receipt.idempotencyKey)),
          tx.pure.vector("u8", utf8Bytes(request.receipt.receiptId)),
        ],
      });

      if (contract.publishEscrowObject === "share") {
        tx.moveCall({
          target: "0x2::transfer::share_object",
          typeArguments: [escrowType(contract)],
          arguments: [createdEscrow],
        });
      } else if (contract.publishEscrowObject === "transfer-to-owner") {
        tx.transferObjects([createdEscrow], tx.pure.address(participants.ownerAddress));
      }

      const policyTarget = await resolvePolicyTarget(
        options.policyTargetForOpen,
        request,
        contract.packageId,
        contract.openFunction,
      );
      const executed = await executeSponsoredTransaction(options, tx, {
        operation: "open",
        policyTarget,
      });
      const escrowId = options.extractEscrowId ? options.extractEscrowId({
        operation: "open",
        request,
        reservation: executed.reservation,
        execution: executed.execution,
      }) : defaultEscrowIdExtractor({
        operation: "open",
        reservation: executed.reservation,
        execution: executed.execution,
      }, escrowType(contract));
      if (!escrowId) {
        throw new LiveEscrowSettlementExecutorError(
          "ESCROW_EXECUTOR_ESCROW_ID_MISSING",
          "Live escrow open executed but no escrow object id was available in the bounded response.",
        );
      }
      return { escrowId, transactionDigest: executed.digest };
    },

    async release(request): Promise<IotaEscrowSettlementExecutionResult> {
      const contract = normalizeContract(options.contract);
      const escrowObject = await resolveEscrowObject(options, request);
      const tx = new Transaction();
      tx.moveCall({
        target: moveTarget(contract.packageId, contract.moduleName, contract.releaseFunction),
        arguments: [
          tx.object(escrowObject),
          tx.pure.vector("u8", utf8Bytes(request.releaseProofHash)),
        ],
      });
      const policyTarget = await resolvePolicyTarget(
        options.policyTargetForRelease,
        request,
        contract.packageId,
        contract.releaseFunction,
      );
      const executed = await executeSponsoredTransaction(options, tx, {
        operation: "release",
        policyTarget,
      });
      return { transactionDigest: executed.digest };
    },

    async refund(request): Promise<IotaEscrowSettlementExecutionResult> {
      const contract = normalizeContract(options.contract);
      const escrowObject = await resolveEscrowObject(options, request);
      const tx = new Transaction();
      tx.moveCall({
        target: moveTarget(contract.packageId, contract.moduleName, contract.refundFunction),
        arguments: [
          tx.object(escrowObject),
          tx.pure.vector("u8", utf8Bytes(request.reason)),
        ],
      });
      const policyTarget = await resolvePolicyTarget(
        options.policyTargetForRefund,
        request,
        contract.packageId,
        contract.refundFunction,
      );
      const executed = await executeSponsoredTransaction(options, tx, {
        operation: "refund",
        policyTarget,
      });
      return { transactionDigest: executed.digest };
    },
  };
}

function validateExecutorOptions(options: CreateSponsoredIotaEscrowSettlementExecutorOptions): void {
  if (!options.gateway) {
    throw new LiveEscrowSettlementExecutorError("ESCROW_EXECUTOR_CONFIG_INVALID", "A sponsorship gateway client is required.");
  }
  if (!options.contract?.packageId) {
    throw new LiveEscrowSettlementExecutorError("ESCROW_EXECUTOR_CONFIG_INVALID", "An escrow Move package id is required.");
  }
  if (!Number.isSafeInteger(options.gasBudget) || options.gasBudget <= 0) {
    throw new LiveEscrowSettlementExecutorError("ESCROW_EXECUTOR_CONFIG_INVALID", "A positive safe gas budget is required.");
  }
  if (!options.signer?.address || !options.signer.signTransaction) {
    throw new LiveEscrowSettlementExecutorError("ESCROW_EXECUTOR_CONFIG_INVALID", "A settlement signer address and signTransaction method are required.");
  }
  if (options.unsafeBuildTransactionBytesForTesting && options.allowUnsafeCustomTransactionBuilder !== true) {
    throw new LiveEscrowSettlementExecutorError(
      "ESCROW_EXECUTOR_CONFIG_INVALID",
      "Unsafe custom transaction builder requires allowUnsafeCustomTransactionBuilder: true.",
    );
  }
  if (!options.iotaClient && !options.unsafeBuildTransactionBytesForTesting) {
    throw new LiveEscrowSettlementExecutorError("ESCROW_EXECUTOR_CONFIG_INVALID", "An IOTA client is required for live transaction building.");
  }
}

function normalizeContract(contract: IotaEscrowSettlementMoveContract): Required<IotaEscrowSettlementMoveContract> {
  return {
    packageId: contract.packageId,
    moduleName: contract.moduleName ?? DEFAULT_MODULE,
    openFunction: contract.openFunction ?? DEFAULT_OPEN_FUNCTION,
    releaseFunction: contract.releaseFunction ?? DEFAULT_RELEASE_FUNCTION,
    refundFunction: contract.refundFunction ?? DEFAULT_REFUND_FUNCTION,
    escrowTypeName: contract.escrowTypeName ?? DEFAULT_ESCROW_TYPE,
    publishEscrowObject: contract.publishEscrowObject ?? "share",
  };
}

function requireParticipants(participants: IotaEscrowSettlementParticipants): void {
  if (!participants.ownerAddress || !participants.providerAddress || !participants.verifierAddress) {
    throw new LiveEscrowSettlementExecutorError(
      "ESCROW_EXECUTOR_CONFIG_INVALID",
      "Escrow participant resolver must return owner, provider, and verifier addresses.",
    );
  }
}

async function executeSponsoredTransaction(
  options: CreateSponsoredIotaEscrowSettlementExecutorOptions,
  tx: Transaction,
  input: {
    readonly operation: "open" | "release" | "refund";
    readonly policyTarget: IotaEscrowSettlementPolicyTarget;
  },
): Promise<{
  readonly reservation: ReserveGasResponse;
  readonly execution: ExecuteSponsoredTransactionResponse;
  readonly digest: string;
}> {
  const reservation = await options.gateway.reserveGas({
    gasBudget: options.gasBudget,
    reserveDurationSecs: options.reserveDurationSecs,
    walletAddress: options.signer.address,
    packageId: input.policyTarget.packageId,
    functionName: input.policyTarget.functionName,
  });
  const gasCoin = firstGasCoin(reservation);
  if (!reservation.sponsorAddress || !gasCoin) {
    throw new LiveEscrowSettlementExecutorError(
      "ESCROW_EXECUTOR_RESERVE_RESPONSE_INVALID",
      "Reserve response did not include sponsor gas details required for sponsored execution.",
    );
  }

  tx.setSender(options.signer.address);
  tx.setGasOwner(reservation.sponsorAddress);
  tx.setGasBudget(options.gasBudget);
  tx.setGasPayment([gasCoin]);

  const transactionBytes = await buildTransactionBytes(options, tx, input.operation);
  const { signature } = await options.signer.signTransaction(transactionBytes);
  const execution = await options.gateway.executeSponsoredTransaction({
    reservationId: reservation.reservationId,
    agentRailTransactionId: reservation.agentRailTransactionId,
    transactionBytes: toBase64(transactionBytes),
    userSignature: signature,
  });
  if (!execution.digest) {
    throw new LiveEscrowSettlementExecutorError(
      "ESCROW_EXECUTOR_EXECUTE_RESPONSE_INVALID",
      "Vallum execute response did not include a transaction digest.",
    );
  }
  return { reservation, execution, digest: execution.digest };
}

async function buildTransactionBytes(
  options: CreateSponsoredIotaEscrowSettlementExecutorOptions,
  tx: Transaction,
  operation: "open" | "release" | "refund",
): Promise<Uint8Array> {
  if (options.unsafeBuildTransactionBytesForTesting) {
    return options.unsafeBuildTransactionBytesForTesting(tx, { operation });
  }
  if (!options.iotaClient) {
    throw new LiveEscrowSettlementExecutorError("ESCROW_EXECUTOR_CONFIG_INVALID", "An IOTA client is required for live transaction building.");
  }
  return tx.build({ client: options.iotaClient });
}

function normalizeU64BaseUnits(value: bigint | number | string): bigint | number | string {
  if (typeof value === "bigint") {
    requireU64Range(value);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw invalidAmountError();
    }
    requireU64Range(BigInt(value));
    return value;
  }
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw invalidAmountError();
  }
  requireU64Range(BigInt(value));
  return value;
}

function requireU64Range(value: bigint): void {
  if (value < 0n || value > MAX_U64) {
    throw invalidAmountError();
  }
}

function invalidAmountError(): LiveEscrowSettlementExecutorError {
  return new LiveEscrowSettlementExecutorError(
    "ESCROW_EXECUTOR_CONFIG_INVALID",
    "Escrow amount resolver must return a non-negative u64-safe integer base-unit amount.",
  );
}

function firstGasCoin(reservation: ReserveGasResponse): GasCoinRef | undefined {
  const coin = reservation.gasCoins?.[0];
  if (!isRecord(coin)) return undefined;
  const objectId = stringField(coin, "objectId");
  const digest = stringField(coin, "digest");
  const version = coin["version"];
  if (!objectId || !digest || (typeof version !== "string" && typeof version !== "number")) return undefined;
  return { objectId, version, digest };
}

function defaultEscrowIdExtractor(context: IotaEscrowSettlementExecutionContext, expectedObjectType: string): string | undefined {
  const raw = context.execution.raw;
  const record = isRecord(raw) ? raw : {};
  const explicit = stringField(record, "escrowId") ?? stringField(record, "escrow_id");
  if (explicit) return explicit;

  const objectChanges = Array.isArray(record["objectChanges"]) ? record["objectChanges"] : [];
  let firstCreatedObjectId: string | undefined;
  let sawTypedCreatedObject = false;
  for (const change of objectChanges) {
    if (!isRecord(change) || change["type"] !== "created") continue;
    const objectId = stringField(change, "objectId") ?? stringField(change, "object_id");
    if (!objectId) continue;
    if (!firstCreatedObjectId) firstCreatedObjectId = objectId;
    const objectType = stringField(change, "objectType") ?? stringField(change, "object_type");
    if (objectType) sawTypedCreatedObject = true;
    if (objectType === expectedObjectType) return objectId;
  }
  if (!sawTypedCreatedObject && firstCreatedObjectId) return firstCreatedObjectId;

  const effects = isRecord(record["effects"]) ? record["effects"] : {};
  const created = Array.isArray(effects["created"]) ? effects["created"] : [];
  for (const createdObject of created) {
    const objectId = objectIdFromCreatedObject(createdObject);
    if (objectId) return objectId;
  }
  return undefined;
}

function objectIdFromCreatedObject(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const direct = stringField(value, "objectId") ?? stringField(value, "object_id");
  if (direct) return direct;
  const reference = isRecord(value["reference"]) ? value["reference"] : undefined;
  if (reference) return stringField(reference, "objectId") ?? stringField(reference, "object_id");
  return undefined;
}

async function resolveEscrowObject(
  options: CreateSponsoredIotaEscrowSettlementExecutorOptions,
  request: IotaEscrowReleaseExecutionRequest | IotaEscrowRefundExecutionRequest,
): Promise<TransactionObjectInput> {
  return options.resolveEscrowObject ? options.resolveEscrowObject(request) : request.escrowId;
}

async function resolvePolicyTarget<Request>(
  resolver: IotaEscrowSettlementPolicyTargetResolver<Request> | undefined,
  request: Request,
  packageId: string,
  functionName: string,
): Promise<IotaEscrowSettlementPolicyTarget> {
  const target = resolver ? await resolver(request) : {};
  return {
    packageId: target.packageId ?? packageId,
    functionName: target.functionName ?? functionName,
  };
}

function moveTarget(packageId: string, moduleName: string, functionName: string): `${string}::${string}::${string}` {
  return `${packageId}::${moduleName}::${functionName}`;
}

function escrowType(contract: Required<IotaEscrowSettlementMoveContract>): `${string}::${string}::${string}` {
  return `${contract.packageId}::${contract.moduleName}::${contract.escrowTypeName}`;
}

function utf8Bytes(value: string): number[] {
  return Array.from(new TextEncoder().encode(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
