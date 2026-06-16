import type { AgentTransactionManifest } from "@sacredlabs/agentrail-manifest";
import {
  approvePayPerCallReceipt,
  completePayPerCallReceipt,
  createPayPerCallReceipt,
  denyPayPerCallReceipt,
  failPayPerCallReceipt,
  sponsorPayPerCallReceipt,
  submitPayPerCallReceipt,
  type PayPerCallReceipt,
  type ReceiptAmount,
} from "@sacredlabs/agentrail-receipts";

import { requestSponsoredAction } from "../requestSponsoredAction.js";
import type { SponsoredActionResult } from "../types.js";

export type PaidToolPaymentConfirmation =
  | {
      readonly ok: true;
      readonly transactionDigest: string;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

export interface PaidToolInvocation<T> {
  readonly result: T;
  readonly resultHash: string;
}

export interface CallPaidToolOptions<T> {
  readonly gatewayBaseUrl: string;
  readonly apiKey: string;
  readonly manifest: AgentTransactionManifest;
  readonly receiptId: string;
  readonly providerId: string;
  readonly toolName: string;
  readonly amount: ReceiptAmount;
  readonly confirmPayment: () => Promise<PaidToolPaymentConfirmation>;
  readonly invokeTool: () => Promise<PaidToolInvocation<T>>;
  readonly now?: () => Date;
  readonly fetchImpl?: typeof fetch;
}

export type CallPaidToolResult<T> =
  | {
      readonly paid: true;
      readonly sponsoredAction: Extract<SponsoredActionResult, { approved: true }>;
      readonly receipt: PayPerCallReceipt;
      readonly result: T;
    }
  | {
      readonly paid: false;
      readonly sponsoredAction: SponsoredActionResult;
      readonly receipt: PayPerCallReceipt;
    };

export async function callPaidTool<T>(options: CallPaidToolOptions<T>): Promise<CallPaidToolResult<T>> {
  const now = options.now?.() ?? new Date();
  const attempted = createPayPerCallReceipt({
    receiptId: options.receiptId,
    manifestId: options.manifest.idempotencyKey,
    idempotencyKey: options.manifest.idempotencyKey,
    agentId: options.manifest.agent.id,
    ownerId: options.manifest.owner.id,
    providerId: options.providerId,
    toolName: options.toolName,
    amount: options.amount,
    createdAt: now,
  });

  const sponsoredAction = await requestSponsoredAction({
    baseUrl: options.gatewayBaseUrl,
    apiKey: options.apiKey,
    fetchImpl: options.fetchImpl,
    manifest: options.manifest,
  });

  if (!sponsoredAction.approved) {
    return {
      paid: false,
      sponsoredAction,
      receipt: denyPayPerCallReceipt(attempted, {
        at: now,
        reason: sponsoredAction.decision.reasonCode,
      }),
    };
  }

  const sponsored = sponsorPayPerCallReceipt(approvePayPerCallReceipt(attempted, { at: now }), {
    at: now,
    sponsorshipId: sponsoredAction.mockSponsorshipId,
  });
  const payment = await confirmPayment(options.confirmPayment);
  if (!payment.ok) {
    return {
      paid: false,
      sponsoredAction,
      receipt: failPayPerCallReceipt(sponsored, {
        at: now,
        reason: payment.reason,
      }),
    };
  }
  if (!isNonEmptyString(payment.transactionDigest)) {
    return {
      paid: false,
      sponsoredAction,
      receipt: failPayPerCallReceipt(sponsored, {
        at: now,
        reason: "PAYMENT_CONFIRMATION_INVALID",
      }),
    };
  }

  const submitted = submitPayPerCallReceipt(sponsored, {
    at: now,
    transactionDigest: payment.transactionDigest,
  });
  const invocation = await invokeTool(options.invokeTool);
  if (!invocation.ok) {
    return {
      paid: false,
      sponsoredAction,
      receipt: failPayPerCallReceipt(submitted, {
        at: now,
        reason: invocation.reason,
      }),
    };
  }
  if (!isNonEmptyString(invocation.result.resultHash)) {
    return {
      paid: false,
      sponsoredAction,
      receipt: failPayPerCallReceipt(submitted, {
        at: now,
        reason: "TOOL_RESULT_HASH_INVALID",
      }),
    };
  }

  return {
    paid: true,
    sponsoredAction,
    result: invocation.result.result,
    receipt: completePayPerCallReceipt(submitted, {
      at: now,
      resultHash: invocation.result.resultHash,
    }),
  };
}

async function confirmPayment(
  confirmPaymentFn: () => Promise<PaidToolPaymentConfirmation>,
): Promise<PaidToolPaymentConfirmation> {
  try {
    return await confirmPaymentFn();
  } catch {
    return { ok: false, reason: "PAYMENT_CONFIRMATION_FAILED" };
  }
}

async function invokeTool<T>(
  invokeToolFn: () => Promise<PaidToolInvocation<T>>,
): Promise<
  | { readonly ok: true; readonly result: PaidToolInvocation<T> }
  | { readonly ok: false; readonly reason: string }
> {
  try {
    return { ok: true, result: await invokeToolFn() };
  } catch {
    return { ok: false, reason: "TOOL_INVOCATION_FAILED" };
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}
