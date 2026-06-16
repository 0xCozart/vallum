import type { AgentTransactionManifest } from "@vallum/manifest";
import {
  approveDataLicenseReceipt,
  createDataLicenseReceipt,
  denyDataLicenseReceipt,
  failDataLicenseReceipt,
  grantDataLicenseAccess,
  sponsorDataLicenseReceipt,
  submitDataLicenseReceipt,
  type DataLicenseReceipt,
  type ReceiptAmount,
} from "@vallum/receipts";

import { requestSponsoredAction } from "../requestSponsoredAction.js";
import type { SponsoredActionResult } from "../types.js";

export type DataLicenseAccessProof =
  | {
      readonly ok: true;
      readonly transactionDigest: string;
      readonly accessProofHash: string;
      readonly expiresAt?: string;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

export interface RequestDataLicenseOptions {
  readonly gatewayBaseUrl: string;
  readonly apiKey: string;
  readonly manifest: AgentTransactionManifest;
  readonly receiptId: string;
  readonly providerId: string;
  readonly licenseeId: string;
  readonly datasetId: string;
  readonly termsHash: string;
  readonly amount: ReceiptAmount;
  readonly requestAccess: () => Promise<DataLicenseAccessProof>;
  readonly now?: () => Date;
  readonly fetchImpl?: typeof fetch;
}

export type RequestDataLicenseResult =
  | {
      readonly granted: true;
      readonly sponsoredAction: Extract<SponsoredActionResult, { approved: true }>;
      readonly receipt: DataLicenseReceipt;
    }
  | {
      readonly granted: false;
      readonly sponsoredAction: SponsoredActionResult;
      readonly receipt: DataLicenseReceipt;
    };

export async function requestDataLicense(options: RequestDataLicenseOptions): Promise<RequestDataLicenseResult> {
  const now = options.now?.() ?? new Date();
  const attempted = createDataLicenseReceipt({
    receiptId: options.receiptId,
    manifestId: options.manifest.idempotencyKey,
    idempotencyKey: options.manifest.idempotencyKey,
    agentId: options.manifest.agent.id,
    ownerId: options.manifest.owner.id,
    providerId: options.providerId,
    licenseeId: options.licenseeId,
    datasetId: options.datasetId,
    termsHash: options.termsHash,
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
      granted: false,
      sponsoredAction,
      receipt: denyDataLicenseReceipt(attempted, {
        at: now,
        reason: sponsoredAction.decision.reasonCode,
      }),
    };
  }

  const sponsored = sponsorDataLicenseReceipt(approveDataLicenseReceipt(attempted, { at: now }), {
    at: now,
    sponsorshipId: sponsoredAction.mockSponsorshipId,
  });
  const access = await requestAccess(options.requestAccess);
  if (!access.ok) {
    return {
      granted: false,
      sponsoredAction,
      receipt: failDataLicenseReceipt(sponsored, {
        at: now,
        reason: access.reason,
      }),
    };
  }
  if (!isNonEmptyString(access.transactionDigest) || !isNonEmptyString(access.accessProofHash)) {
    return {
      granted: false,
      sponsoredAction,
      receipt: failDataLicenseReceipt(sponsored, {
        at: now,
        reason: "ACCESS_PROOF_INVALID",
      }),
    };
  }

  const submitted = submitDataLicenseReceipt(sponsored, {
    at: now,
    transactionDigest: access.transactionDigest,
  });

  return {
    granted: true,
    sponsoredAction,
    receipt: grantDataLicenseAccess(submitted, {
      at: now,
      accessProofHash: access.accessProofHash,
      ...(access.expiresAt ? { expiresAt: access.expiresAt } : {}),
    }),
  };
}

async function requestAccess(
  requestAccessFn: () => Promise<DataLicenseAccessProof>,
): Promise<DataLicenseAccessProof> {
  try {
    return await requestAccessFn();
  } catch {
    return { ok: false, reason: "ACCESS_REQUEST_FAILED" };
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}
