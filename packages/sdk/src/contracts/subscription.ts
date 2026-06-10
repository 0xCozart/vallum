import type { AgentTransactionManifest } from "@iota-gaskit/manifest";
import {
  activateSubscriptionReceipt,
  approveSubscriptionReceipt,
  createSubscriptionReceipt,
  denySubscriptionReceipt,
  failSubscriptionReceipt,
  renewSubscriptionReceipt as renewSubscriptionReceiptState,
  sponsorSubscriptionReceipt,
  submitSubscriptionReceipt,
  type ReceiptAmount,
  type SubscriptionReceipt,
} from "@iota-gaskit/receipts";

import { requestSponsoredAction } from "../requestSponsoredAction.js";
import type { SponsoredActionResult } from "../types.js";

export type SubscriptionActivationProof =
  | {
      readonly ok: true;
      readonly transactionDigest: string;
      readonly activationProofHash: string;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

export type SubscriptionRenewalProof =
  | {
      readonly ok: true;
      readonly transactionDigest: string;
      readonly renewalProofHash: string;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

export interface StartSubscriptionOptions {
  readonly gatewayBaseUrl: string;
  readonly apiKey: string;
  readonly manifest: AgentTransactionManifest;
  readonly receiptId: string;
  readonly subscriberId: string;
  readonly providerId: string;
  readonly planId: string;
  readonly termsHash: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly amount: ReceiptAmount;
  readonly activate: () => Promise<SubscriptionActivationProof>;
  readonly now?: () => Date;
  readonly fetchImpl?: typeof fetch;
}

export interface RenewSubscriptionOptions {
  readonly gatewayBaseUrl: string;
  readonly apiKey: string;
  readonly manifest: AgentTransactionManifest;
  readonly receipt: SubscriptionReceipt;
  readonly periodEnd: string;
  readonly renew: () => Promise<SubscriptionRenewalProof>;
  readonly now?: () => Date;
  readonly fetchImpl?: typeof fetch;
}

export type StartSubscriptionResult =
  | {
      readonly active: true;
      readonly sponsoredAction: Extract<SponsoredActionResult, { approved: true }>;
      readonly receipt: SubscriptionReceipt;
    }
  | {
      readonly active: false;
      readonly sponsoredAction: SponsoredActionResult;
      readonly receipt: SubscriptionReceipt;
    };

export type RenewSubscriptionResult =
  | {
      readonly renewed: true;
      readonly sponsoredAction: Extract<SponsoredActionResult, { approved: true }>;
      readonly receipt: SubscriptionReceipt;
    }
  | {
      readonly renewed: false;
      readonly sponsoredAction: SponsoredActionResult;
      readonly receipt: SubscriptionReceipt;
    };

export async function startSubscription(options: StartSubscriptionOptions): Promise<StartSubscriptionResult> {
  const now = options.now?.() ?? new Date();
  const attempted = createSubscriptionReceipt({
    receiptId: options.receiptId,
    manifestId: options.manifest.idempotencyKey,
    idempotencyKey: options.manifest.idempotencyKey,
    agentId: options.manifest.agent.id,
    ownerId: options.manifest.owner.id,
    subscriberId: options.subscriberId,
    providerId: options.providerId,
    planId: options.planId,
    termsHash: options.termsHash,
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
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
      active: false,
      sponsoredAction,
      receipt: denySubscriptionReceipt(attempted, {
        at: now,
        reason: sponsoredAction.decision.reasonCode,
      }),
    };
  }

  const sponsored = sponsorSubscriptionReceipt(approveSubscriptionReceipt(attempted, { at: now }), {
    at: now,
    sponsorshipId: sponsoredAction.mockSponsorshipId,
  });
  const proof = await collectActivationProof(options.activate);
  if (!proof.ok) {
    return {
      active: false,
      sponsoredAction,
      receipt: failSubscriptionReceipt(sponsored, {
        at: now,
        reason: proof.reason,
      }),
    };
  }
  if (!isNonEmptyString(proof.transactionDigest) || !isSafeHashReference(proof.activationProofHash)) {
    return {
      active: false,
      sponsoredAction,
      receipt: failSubscriptionReceipt(sponsored, {
        at: now,
        reason: "SUBSCRIPTION_PROOF_INVALID",
      }),
    };
  }

  const submitted = submitSubscriptionReceipt(sponsored, {
    at: now,
    transactionDigest: proof.transactionDigest,
  });
  return {
    active: true,
    sponsoredAction,
    receipt: activateSubscriptionReceipt(submitted, {
      at: now,
      activationProofHash: proof.activationProofHash,
    }),
  };
}

export async function renewSubscription(options: RenewSubscriptionOptions): Promise<RenewSubscriptionResult> {
  const now = options.now?.() ?? new Date();
  const sponsoredAction = await requestSponsoredAction({
    baseUrl: options.gatewayBaseUrl,
    apiKey: options.apiKey,
    fetchImpl: options.fetchImpl,
    manifest: options.manifest,
  });

  if (!sponsoredAction.approved) {
    return {
      renewed: false,
      sponsoredAction,
      receipt: failSubscriptionReceipt(options.receipt, {
        at: now,
        reason: sponsoredAction.decision.reasonCode,
      }),
    };
  }

  const proof = await collectRenewalProof(options.renew);
  if (!proof.ok) {
    return {
      renewed: false,
      sponsoredAction,
      receipt: failSubscriptionReceipt(options.receipt, {
        at: now,
        reason: proof.reason,
      }),
    };
  }
  if (!isNonEmptyString(proof.transactionDigest) || !isSafeHashReference(proof.renewalProofHash)) {
    return {
      renewed: false,
      sponsoredAction,
      receipt: failSubscriptionReceipt(options.receipt, {
        at: now,
        reason: "SUBSCRIPTION_PROOF_INVALID",
      }),
    };
  }

  return {
    renewed: true,
    sponsoredAction,
    receipt: renewSubscriptionReceiptState(options.receipt, {
      at: now,
      periodEnd: options.periodEnd,
      renewalProofHash: proof.renewalProofHash,
      sponsorshipId: sponsoredAction.mockSponsorshipId,
      transactionDigest: proof.transactionDigest,
    }),
  };
}

async function collectActivationProof(
  activate: () => Promise<SubscriptionActivationProof>,
): Promise<SubscriptionActivationProof> {
  try {
    return await activate();
  } catch {
    return { ok: false, reason: "SUBSCRIPTION_PROOF_FAILED" };
  }
}

async function collectRenewalProof(renew: () => Promise<SubscriptionRenewalProof>): Promise<SubscriptionRenewalProof> {
  try {
    return await renew();
  } catch {
    return { ok: false, reason: "SUBSCRIPTION_PROOF_FAILED" };
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isSafeHashReference(value: unknown): value is string {
  return isNonEmptyString(value)
    && /^sha256:[A-Za-z0-9._:-]+$/.test(value)
    && !/(private prompt|review payload|bearer|access-token|signer_ref|payment credential|privateKey|mnemonic|seed)/i.test(value);
}
