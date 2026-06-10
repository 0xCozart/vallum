import {
  AGENT_TRANSACTION_MANIFEST_VERSION,
  type AgentTransactionManifest,
  type ManifestAction,
  type ManifestParty,
} from "./schema.js";

export const AP2_CHECKOUT_MANDATE_VCT = "mandate.checkout.1" as const;
export const AP2_PAYMENT_MANDATE_VCT = "mandate.payment.1" as const;

export interface AP2Merchant {
  readonly id: string;
  readonly name: string;
  readonly website?: string;
}

export interface AP2Amount {
  readonly amount: number;
  readonly currency: string;
}

export interface AP2PaymentInstrument {
  readonly id: string;
  readonly type: string;
  readonly description?: string;
}

export interface AP2CheckoutMandate {
  readonly vct: string;
  readonly checkout_jwt: string;
  readonly checkout_hash: string;
  readonly iat?: number;
  readonly exp?: number;
}

export interface AP2PaymentMandate {
  readonly vct: string;
  readonly transaction_id: string;
  readonly payment_mandate_id?: string;
  readonly payee: AP2Merchant;
  readonly payment_amount: AP2Amount;
  readonly payment_instrument: AP2PaymentInstrument;
  readonly execution_date?: string;
  readonly risk_data?: Record<string, unknown>;
  readonly iat?: number;
  readonly exp?: number;
}

export interface AP2TrustedSurface {
  readonly id: string;
  readonly nonAgentic: boolean;
}

export interface AP2MandateBundle {
  readonly mode: "direct" | "autonomous";
  readonly checkoutMandate: AP2CheckoutMandate;
  readonly paymentMandate: AP2PaymentMandate;
  readonly trustedSurface: AP2TrustedSurface;
  readonly disputeEvidenceReference?: string;
}

export interface AP2ManifestMappingContext {
  readonly agent: ManifestParty;
  readonly owner: ManifestParty;
  readonly wallet?: AgentTransactionManifest["wallet"];
  readonly packageId: string;
  readonly module?: string;
  readonly functionName: string;
  readonly templateId?: string;
  readonly templateVersion?: string;
  readonly displayName?: string;
  readonly maxGasBudget: number;
  readonly idempotencyKey: string;
  readonly now?: Date;
  readonly simulationHash?: string;
}

export type AP2MappingErrorCode =
  | "UNSUPPORTED_AP2_MANDATE_VERSION"
  | "TRUSTED_SURFACE_MUST_BE_NON_AGENTIC"
  | "MANDATE_REFERENCE_MISMATCH"
  | "AP2_MANDATE_EXPIRED"
  | "INVALID_AP2_MANDATE";

export class AP2MappingError extends Error {
  constructor(
    readonly code: AP2MappingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AP2MappingError";
  }
}

export function mapAP2MandatesToManifest(
  bundle: AP2MandateBundle,
  context: AP2ManifestMappingContext,
): AgentTransactionManifest {
  validateBundle(bundle, context.now ?? new Date());

  const action: ManifestAction = {
    packageId: context.packageId,
    ...(context.module ? { module: context.module } : {}),
    functionName: context.functionName,
    ...(context.templateId ? { templateId: context.templateId } : {}),
    ...(context.templateVersion ? { templateVersion: context.templateVersion } : {}),
    ...(context.displayName ? { displayName: context.displayName } : {}),
  };
  const paymentId = ap2PaymentMandateId(bundle.paymentMandate);

  return {
    version: AGENT_TRANSACTION_MANIFEST_VERSION,
    agent: context.agent,
    owner: context.owner,
    ...(context.wallet ? { wallet: context.wallet } : {}),
    intent: `Execute AP2 payment mandate ${paymentId} for checkout ${bundle.checkoutMandate.checkout_hash}`,
    spend: {
      maxGasBudget: context.maxGasBudget,
      maxPayment: {
        amount: String(bundle.paymentMandate.payment_amount.amount),
        asset: bundle.paymentMandate.payment_amount.currency,
      },
    },
    action,
    counterparty: {
      id: `ap2:${bundle.paymentMandate.payee.id}`,
    },
    scope: [
      "standard:ap2",
      `ap2:mode:${bundle.mode}`,
      `ap2:checkout:${bundle.checkoutMandate.checkout_hash}`,
      `ap2:payment:${paymentId}`,
      "ap2:trusted-surface:non-agentic",
    ],
    expiresAt: expiryFor(bundle).toISOString(),
    idempotencyKey: context.idempotencyKey,
    simulation: {
      required: true,
      status: "passed",
      hash: context.simulationHash ?? "sha256:ap2-mock-simulation",
    },
    receipt: {
      required: true,
      templateId: "receipt:ap2:v1",
    },
    humanMandate: {
      required: true,
      mandateId: paymentId,
    },
    refundPolicy: {
      type: "refund_to_owner",
    },
    metadata: {
      ap2CheckoutMandateVct: bundle.checkoutMandate.vct,
      ap2PaymentMandateVct: bundle.paymentMandate.vct,
      ap2Mode: bundle.mode,
      ap2CheckoutHash: bundle.checkoutMandate.checkout_hash,
      ap2PaymentMandateId: paymentId,
      ap2PaymentTransactionId: bundle.paymentMandate.transaction_id,
      ap2PayeeId: bundle.paymentMandate.payee.id,
      ap2TrustedSurfaceId: bundle.trustedSurface.id,
      ap2TrustedSurfaceNonAgentic: String(bundle.trustedSurface.nonAgentic),
      ...(bundle.disputeEvidenceReference ? { ap2DisputeEvidenceReference: bundle.disputeEvidenceReference } : {}),
    },
  };
}

export function ap2PaymentMandateId(mandate: AP2PaymentMandate): string {
  return mandate.payment_mandate_id ?? mandate.transaction_id;
}

function validateBundle(bundle: AP2MandateBundle, now: Date): void {
  if (bundle.checkoutMandate.vct !== AP2_CHECKOUT_MANDATE_VCT) {
    throw new AP2MappingError(
      "UNSUPPORTED_AP2_MANDATE_VERSION",
      `Unsupported AP2 mandate version: ${bundle.checkoutMandate.vct}.`,
    );
  }
  if (bundle.paymentMandate.vct !== AP2_PAYMENT_MANDATE_VCT) {
    throw new AP2MappingError(
      "UNSUPPORTED_AP2_MANDATE_VERSION",
      `Unsupported AP2 mandate version: ${bundle.paymentMandate.vct}.`,
    );
  }
  if (bundle.trustedSurface.nonAgentic !== true) {
    throw new AP2MappingError(
      "TRUSTED_SURFACE_MUST_BE_NON_AGENTIC",
      "AP2 Trusted Surface must be represented as non-agentic.",
    );
  }
  if (bundle.paymentMandate.transaction_id !== bundle.checkoutMandate.checkout_hash) {
    throw new AP2MappingError(
      "MANDATE_REFERENCE_MISMATCH",
      "AP2 payment mandate transaction_id must match the checkout mandate hash.",
    );
  }
  validateRequiredFields(bundle);
  if (expiryFor(bundle).getTime() <= now.getTime()) {
    throw new AP2MappingError("AP2_MANDATE_EXPIRED", "AP2 mandate expiry is in the past.");
  }
}

function validateRequiredFields(bundle: AP2MandateBundle): void {
  requireNonEmpty(bundle.checkoutMandate.checkout_jwt, "checkoutMandate.checkout_jwt");
  requireNonEmpty(bundle.checkoutMandate.checkout_hash, "checkoutMandate.checkout_hash");
  requireNonEmpty(bundle.paymentMandate.transaction_id, "paymentMandate.transaction_id");
  requireNonEmpty(bundle.paymentMandate.payee?.id, "paymentMandate.payee.id");
  requireNonEmpty(bundle.paymentMandate.payee?.name, "paymentMandate.payee.name");
  requireNonEmpty(bundle.paymentMandate.payment_instrument?.id, "paymentMandate.payment_instrument.id");
  requireNonEmpty(bundle.paymentMandate.payment_instrument?.type, "paymentMandate.payment_instrument.type");
  requireNonEmpty(bundle.paymentMandate.payment_amount?.currency, "paymentMandate.payment_amount.currency");
  if (
    typeof bundle.paymentMandate.payment_amount?.amount !== "number" ||
    !Number.isInteger(bundle.paymentMandate.payment_amount.amount) ||
    bundle.paymentMandate.payment_amount.amount < 0
  ) {
    throw new AP2MappingError("INVALID_AP2_MANDATE", "AP2 payment amount must be a non-negative integer.");
  }
  if (!/^[A-Z]{3}$/.test(bundle.paymentMandate.payment_amount.currency)) {
    throw new AP2MappingError("INVALID_AP2_MANDATE", "AP2 payment currency must be an ISO-4217 code.");
  }
}

function expiryFor(bundle: AP2MandateBundle): Date {
  const expiries = [bundle.checkoutMandate.exp, bundle.paymentMandate.exp]
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (expiries.length === 0) {
    throw new AP2MappingError("INVALID_AP2_MANDATE", "AP2 mandates must include an expiry.");
  }
  return new Date(Math.min(...expiries) * 1000);
}

function requireNonEmpty(value: unknown, path: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AP2MappingError("INVALID_AP2_MANDATE", `AP2 mandate field ${path} is required.`);
  }
}
