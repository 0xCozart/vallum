import type { AgentTransactionManifest } from "@sacredlabs/agentrail-manifest";
import {
  approveServiceBountyReceipt,
  completeServiceBountyReceipt,
  createServiceBountyReceipt,
  denyServiceBountyReceipt,
  failServiceBountyReceipt,
  releaseServiceBountyReceipt,
  sponsorServiceBountyReceipt,
  submitServiceBountyReceipt,
  type ReceiptAmount,
  type ServiceBountyReceipt,
} from "@sacredlabs/agentrail-receipts";

import { requestSponsoredAction } from "../requestSponsoredAction.js";
import type { SponsoredActionResult } from "../types.js";

export type ServiceBountyCompletionProof =
  | {
      readonly ok: true;
      readonly transactionDigest: string;
      readonly completionProofHash: string;
      readonly releaseProofHash: string;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

export interface FulfillServiceBountyOptions {
  readonly gatewayBaseUrl: string;
  readonly apiKey: string;
  readonly manifest: AgentTransactionManifest;
  readonly receiptId: string;
  readonly requesterId: string;
  readonly providerId: string;
  readonly bountyId: string;
  readonly deliverableHash: string;
  readonly amount: ReceiptAmount;
  readonly completeWork: () => Promise<ServiceBountyCompletionProof>;
  readonly now?: () => Date;
  readonly fetchImpl?: typeof fetch;
}

export type FulfillServiceBountyResult =
  | {
      readonly released: true;
      readonly sponsoredAction: Extract<SponsoredActionResult, { approved: true }>;
      readonly receipt: ServiceBountyReceipt;
    }
  | {
      readonly released: false;
      readonly sponsoredAction: SponsoredActionResult;
      readonly receipt: ServiceBountyReceipt;
    };

export async function fulfillServiceBounty(
  options: FulfillServiceBountyOptions,
): Promise<FulfillServiceBountyResult> {
  const now = options.now?.() ?? new Date();
  const attempted = createServiceBountyReceipt({
    receiptId: options.receiptId,
    manifestId: options.manifest.idempotencyKey,
    idempotencyKey: options.manifest.idempotencyKey,
    agentId: options.manifest.agent.id,
    ownerId: options.manifest.owner.id,
    requesterId: options.requesterId,
    providerId: options.providerId,
    bountyId: options.bountyId,
    deliverableHash: options.deliverableHash,
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
      released: false,
      sponsoredAction,
      receipt: denyServiceBountyReceipt(attempted, {
        at: now,
        reason: sponsoredAction.decision.reasonCode,
      }),
    };
  }

  const sponsored = sponsorServiceBountyReceipt(approveServiceBountyReceipt(attempted, { at: now }), {
    at: now,
    sponsorshipId: sponsoredAction.mockSponsorshipId,
  });
  const proof = await completeWork(options.completeWork);
  if (!proof.ok) {
    return {
      released: false,
      sponsoredAction,
      receipt: failServiceBountyReceipt(sponsored, {
        at: now,
        reason: proof.reason,
      }),
    };
  }
  if (
    !isNonEmptyString(proof.transactionDigest)
    || !isNonEmptyString(proof.completionProofHash)
    || !isNonEmptyString(proof.releaseProofHash)
  ) {
    return {
      released: false,
      sponsoredAction,
      receipt: failServiceBountyReceipt(sponsored, {
        at: now,
        reason: "COMPLETION_PROOF_INVALID",
      }),
    };
  }

  const submitted = submitServiceBountyReceipt(sponsored, {
    at: now,
    transactionDigest: proof.transactionDigest,
  });
  const completed = completeServiceBountyReceipt(submitted, {
    at: now,
    completionProofHash: proof.completionProofHash,
  });

  return {
    released: true,
    sponsoredAction,
    receipt: releaseServiceBountyReceipt(completed, {
      at: now,
      releaseProofHash: proof.releaseProofHash,
    }),
  };
}

async function completeWork(
  completeWorkFn: () => Promise<ServiceBountyCompletionProof>,
): Promise<ServiceBountyCompletionProof> {
  try {
    return await completeWorkFn();
  } catch {
    return { ok: false, reason: "COMPLETION_PROOF_FAILED" };
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}
