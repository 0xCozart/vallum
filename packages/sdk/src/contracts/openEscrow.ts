import type { AgentTransactionManifest } from "@agentrail/manifest";
import {
  approveReceipt,
  createEscrowReceipt,
  denyReceipt,
  sponsorReceipt,
  type EscrowReceipt,
  type ReceiptAmount,
} from "@agentrail/receipts";

import { requestSponsoredAction } from "../requestSponsoredAction.js";
import type { SponsoredActionResult } from "../types.js";

export interface OpenEscrowOptions {
  readonly gatewayBaseUrl: string;
  readonly apiKey: string;
  readonly manifest: AgentTransactionManifest;
  readonly receiptId: string;
  readonly providerId: string;
  readonly verifierId: string;
  readonly amount: ReceiptAmount;
  readonly now?: () => Date;
  readonly fetchImpl?: typeof fetch;
}

export interface OpenEscrowResult {
  readonly sponsoredAction: SponsoredActionResult;
  readonly receipt: EscrowReceipt;
}

export async function openEscrow(options: OpenEscrowOptions): Promise<OpenEscrowResult> {
  const now = options.now?.() ?? new Date();
  const attempted = createEscrowReceipt({
    receiptId: options.receiptId,
    manifestId: options.manifest.idempotencyKey,
    idempotencyKey: options.manifest.idempotencyKey,
    agentId: options.manifest.agent.id,
    ownerId: options.manifest.owner.id,
    providerId: options.providerId,
    verifierId: options.verifierId,
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
      sponsoredAction,
      receipt: denyReceipt(attempted, {
        at: now,
        reason: sponsoredAction.decision.reasonCode,
      }),
    };
  }

  return {
    sponsoredAction,
    receipt: sponsorReceipt(approveReceipt(attempted, { at: now }), {
      at: now,
      sponsorshipId: sponsoredAction.mockSponsorshipId,
    }),
  };
}
