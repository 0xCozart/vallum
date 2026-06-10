import type { LinkedReceiptState } from "./index.js";

export interface X402VerifyEvidence {
  readonly isValid: boolean;
  readonly invalidReason?: string;
  readonly invalidMessage?: string;
  readonly payer?: string;
  readonly extensions?: Record<string, unknown>;
  readonly extra?: Record<string, unknown>;
}

export interface X402SettleEvidence {
  readonly success: boolean;
  readonly errorReason?: string;
  readonly errorMessage?: string;
  readonly payer?: string;
  readonly transaction: string;
  readonly network: string;
  readonly amount?: string;
  readonly extensions?: Record<string, unknown>;
  readonly extra?: Record<string, unknown>;
}

export interface CreateX402ExternalPaymentReceiptStateInput {
  readonly paymentId: string;
  readonly verify: X402VerifyEvidence;
  readonly settle?: X402SettleEvidence;
}

export interface X402ExternalPaymentReceiptState {
  readonly linkedState: LinkedReceiptState;
  readonly metadata: Record<string, string>;
}

export function createX402ExternalPaymentReceiptState(
  input: CreateX402ExternalPaymentReceiptStateInput,
): X402ExternalPaymentReceiptState {
  const settlementStatus = settlementStatusFor(input.verify, input.settle);
  const metadata: Record<string, string> = {
    x402PaymentId: input.paymentId,
    x402VerifyStatus: input.verify.isValid ? "valid" : "invalid",
    x402SettlementStatus: settlementStatus,
  };

  if (input.verify.invalidReason) metadata.x402VerifyInvalidReason = input.verify.invalidReason;
  if (input.settle?.errorReason) metadata.x402SettleErrorReason = input.settle.errorReason;
  if (input.settle?.network) metadata.x402Network = input.settle.network;
  if (input.settle?.transaction) metadata.x402Transaction = input.settle.transaction;
  if (input.settle?.amount) metadata.x402Amount = input.settle.amount;

  return {
    linkedState: {
      status: settlementStatus === "succeeded" ? "succeeded" : settlementStatus === "failed" ? "failed" : "pending",
      referenceId: `x402:${input.paymentId}`,
    },
    metadata,
  };
}

export function redactX402PaymentMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactX402PaymentMetadata(item));
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      isSensitiveX402MetadataKey(key) ? "[REDACTED]" : redactX402PaymentMetadata(child),
    ]),
  );
}

function settlementStatusFor(verify: X402VerifyEvidence, settle: X402SettleEvidence | undefined): "pending" | "succeeded" | "failed" {
  if (!verify.isValid) return "failed";
  if (!settle) return "pending";
  return settle.success ? "succeeded" : "failed";
}

function isSensitiveX402MetadataKey(key: string): boolean {
  return /^(payer.*|paymentPayload|payload|paymentCredential|.*signature.*|.*authorization.*|.*credential.*)$/i.test(key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
