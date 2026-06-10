import type { LinkedReceiptState } from "./index.js";

export type AP2ReceiptStatus = "Success" | "Error";

export interface AP2CheckoutReceipt {
  readonly status: AP2ReceiptStatus;
  readonly iss: string;
  readonly iat: number;
  readonly reference: string;
  readonly error?: string;
  readonly error_description?: string;
  readonly order_id?: string;
}

export interface AP2PaymentReceipt {
  readonly status: AP2ReceiptStatus;
  readonly iss: string;
  readonly iat: number;
  readonly reference: string;
  readonly error?: string;
  readonly error_description?: string;
  readonly payment_id: string;
  readonly psp_confirmation_id?: string;
  readonly network_confirmation_id?: string;
}

export interface AP2ReceiptBundle {
  readonly checkoutReceipt: AP2CheckoutReceipt;
  readonly paymentReceipt: AP2PaymentReceipt;
}

export interface CreateAP2MandateReceiptStateInput extends AP2ReceiptBundle {
  readonly manifestId: string;
  readonly checkoutHash: string;
  readonly paymentMandateId: string;
  readonly disputeEvidenceReference?: string;
}

export interface AP2MandateReceiptState {
  readonly linkedState: LinkedReceiptState;
  readonly metadata: Record<string, string>;
}

export type AP2ReceiptErrorCode = "INVALID_AP2_RECEIPT_STATUS" | "AP2_RECEIPT_REFERENCE_MISMATCH";

export class AP2ReceiptError extends Error {
  constructor(
    readonly code: AP2ReceiptErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AP2ReceiptError";
  }
}

export function createAP2MandateReceiptState(
  input: CreateAP2MandateReceiptStateInput,
): AP2MandateReceiptState {
  validateReceiptReferences(input);
  const status = input.checkoutReceipt.status === "Success" && input.paymentReceipt.status === "Success"
    ? "succeeded"
    : "failed";
  const metadata: Record<string, string> = {
    ap2ManifestId: input.manifestId,
    ap2CheckoutHash: input.checkoutHash,
    ap2PaymentMandateId: input.paymentMandateId,
    ap2CheckoutReference: input.checkoutReceipt.reference,
    ap2PaymentReference: input.paymentReceipt.reference,
    ap2CheckoutReceiptStatus: input.checkoutReceipt.status,
    ap2PaymentReceiptStatus: input.paymentReceipt.status,
    ap2PaymentId: input.paymentReceipt.payment_id,
  };

  if (input.disputeEvidenceReference) metadata.ap2DisputeEvidenceReference = input.disputeEvidenceReference;
  if (input.checkoutReceipt.order_id) metadata.ap2OrderId = input.checkoutReceipt.order_id;
  if (input.checkoutReceipt.error) metadata.ap2CheckoutError = input.checkoutReceipt.error;
  if (input.paymentReceipt.error) metadata.ap2PaymentError = input.paymentReceipt.error;
  if (input.paymentReceipt.psp_confirmation_id) metadata.ap2PspConfirmationId = input.paymentReceipt.psp_confirmation_id;
  if (input.paymentReceipt.network_confirmation_id) {
    metadata.ap2NetworkConfirmationId = input.paymentReceipt.network_confirmation_id;
  }

  return {
    linkedState: {
      status,
      referenceId: `ap2:${input.paymentReceipt.payment_id}`,
    },
    metadata,
  };
}

function validateReceiptReferences(input: CreateAP2MandateReceiptStateInput): void {
  requireReceiptStatus(input.checkoutReceipt.status);
  requireReceiptStatus(input.paymentReceipt.status);
  if (input.checkoutReceipt.reference !== input.checkoutHash) {
    throw new AP2ReceiptError(
      "AP2_RECEIPT_REFERENCE_MISMATCH",
      "AP2 checkout receipt reference must match the checkout mandate hash.",
    );
  }
  if (input.paymentReceipt.reference !== input.paymentMandateId) {
    throw new AP2ReceiptError(
      "AP2_RECEIPT_REFERENCE_MISMATCH",
      "AP2 payment receipt reference must match the payment mandate id.",
    );
  }
}

function requireReceiptStatus(status: string): void {
  if (status !== "Success" && status !== "Error") {
    throw new AP2ReceiptError("INVALID_AP2_RECEIPT_STATUS", "AP2 receipt status is unsupported.");
  }
}

export function redactAP2MandateMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactAP2MandateMetadata(item));
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      isSensitiveAP2MetadataKey(key) ? "[REDACTED]" : redactAP2MandateMetadata(child),
    ]),
  );
}

function isSensitiveAP2MetadataKey(key: string): boolean {
  return /^(checkout_jwt|payment_instrument|risk_data|.*authorization.*|.*credential.*|.*signature.*|.*token.*|.*card.*|.*bank.*)$/i.test(key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
