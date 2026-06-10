import type { AgentTransactionManifest } from "@iota-gaskit/manifest";
import {
  approveReputationReceipt,
  completeReputationReceipt,
  createReputationReceipt,
  denyReputationReceipt,
  failReputationReceipt,
  sponsorReputationReceipt,
  submitReputationReceipt,
  type ReceiptAmount,
  type ReputationReceipt,
} from "@iota-gaskit/receipts";

import { requestSponsoredAction } from "../requestSponsoredAction.js";
import type { SponsoredActionResult } from "../types.js";

export type ReputationEvidence =
  | {
      readonly ok: true;
      readonly transactionDigest: string;
      readonly score: number;
      readonly evidenceHash: string;
      readonly attestationHash: string;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

export interface AttestReputationOptions {
  readonly gatewayBaseUrl: string;
  readonly apiKey: string;
  readonly manifest: AgentTransactionManifest;
  readonly receiptId: string;
  readonly issuerId: string;
  readonly subjectId: string;
  readonly interactionId: string;
  readonly criteriaHash: string;
  readonly amount: ReceiptAmount;
  readonly collectEvidence: () => Promise<ReputationEvidence>;
  readonly now?: () => Date;
  readonly fetchImpl?: typeof fetch;
}

export type AttestReputationResult =
  | {
      readonly attested: true;
      readonly sponsoredAction: Extract<SponsoredActionResult, { approved: true }>;
      readonly receipt: ReputationReceipt;
    }
  | {
      readonly attested: false;
      readonly sponsoredAction: SponsoredActionResult;
      readonly receipt: ReputationReceipt;
    };

export async function attestReputation(
  options: AttestReputationOptions,
): Promise<AttestReputationResult> {
  const now = options.now?.() ?? new Date();
  const attempted = createReputationReceipt({
    receiptId: options.receiptId,
    manifestId: options.manifest.idempotencyKey,
    idempotencyKey: options.manifest.idempotencyKey,
    agentId: options.manifest.agent.id,
    ownerId: options.manifest.owner.id,
    issuerId: options.issuerId,
    subjectId: options.subjectId,
    interactionId: options.interactionId,
    criteriaHash: options.criteriaHash,
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
      attested: false,
      sponsoredAction,
      receipt: denyReputationReceipt(attempted, {
        at: now,
        reason: sponsoredAction.decision.reasonCode,
      }),
    };
  }

  const sponsored = sponsorReputationReceipt(approveReputationReceipt(attempted, { at: now }), {
    at: now,
    sponsorshipId: sponsoredAction.mockSponsorshipId,
  });
  const evidence = await collectEvidence(options.collectEvidence);
  if (!evidence.ok) {
    return {
      attested: false,
      sponsoredAction,
      receipt: failReputationReceipt(sponsored, {
        at: now,
        reason: evidence.reason,
      }),
    };
  }
  if (
    !Number.isInteger(evidence.score)
    || evidence.score < 1
    || evidence.score > 5
    || !isNonEmptyString(evidence.transactionDigest)
    || !isSafeHashReference(evidence.evidenceHash)
    || !isSafeHashReference(evidence.attestationHash)
  ) {
    return {
      attested: false,
      sponsoredAction,
      receipt: failReputationReceipt(sponsored, {
        at: now,
        reason: "REPUTATION_EVIDENCE_INVALID",
      }),
    };
  }

  const submitted = submitReputationReceipt(sponsored, {
    at: now,
    transactionDigest: evidence.transactionDigest,
  });

  return {
    attested: true,
    sponsoredAction,
    receipt: completeReputationReceipt(submitted, {
      at: now,
      score: evidence.score,
      evidenceHash: evidence.evidenceHash,
      attestationHash: evidence.attestationHash,
    }),
  };
}

async function collectEvidence(
  collectEvidenceFn: () => Promise<ReputationEvidence>,
): Promise<ReputationEvidence> {
  try {
    return await collectEvidenceFn();
  } catch {
    return { ok: false, reason: "REPUTATION_EVIDENCE_FAILED" };
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isSafeHashReference(value: unknown): value is string {
  return isNonEmptyString(value)
    && /^sha256:[A-Za-z0-9._:-]+$/.test(value)
    && !/(private prompt|review payload|bearer|signer_ref|payment credential|privateKey|mnemonic|seed)/i.test(value);
}
