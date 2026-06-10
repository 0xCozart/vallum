import {
  AGENT_TRANSACTION_MANIFEST_VERSION,
  type AgentTransactionManifest,
  type ManifestAction,
  type ManifestParty,
} from "./schema.js";

export const X402_SUPPORTED_VERSION = 2 as const;

export interface X402ResourceInfo {
  readonly url: string;
  readonly description?: string;
  readonly mimeType?: string;
  readonly serviceName?: string;
  readonly tags?: readonly string[];
  readonly iconUrl?: string;
}

export interface X402PaymentRequirements {
  readonly scheme: string;
  readonly network: string;
  readonly asset: string;
  readonly amount: string;
  readonly payTo: string;
  readonly maxTimeoutSeconds: number;
  readonly extra: Record<string, unknown>;
}

export interface X402PaymentRequired {
  readonly x402Version: number;
  readonly error?: string;
  readonly resource: X402ResourceInfo;
  readonly accepts: readonly X402PaymentRequirements[];
  readonly extensions?: Record<string, unknown>;
}

export interface X402ManifestMappingContext {
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
  readonly acceptedIndex?: number;
  readonly supportedSchemes?: readonly string[];
  readonly simulationHash?: string;
}

export type X402MappingErrorCode =
  | "UNSUPPORTED_X402_VERSION"
  | "UNSUPPORTED_X402_SCHEME"
  | "NO_SUPPORTED_PAYMENT_REQUIREMENT"
  | "INVALID_X402_REQUIREMENT";

export class X402MappingError extends Error {
  constructor(
    readonly code: X402MappingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "X402MappingError";
  }
}

export function mapX402PaymentRequiredToManifest(
  paymentRequired: X402PaymentRequired,
  context: X402ManifestMappingContext,
): AgentTransactionManifest {
  if (paymentRequired.x402Version !== X402_SUPPORTED_VERSION) {
    throw new X402MappingError(
      "UNSUPPORTED_X402_VERSION",
      `Unsupported x402 protocol version: ${paymentRequired.x402Version}.`,
    );
  }

  const acceptedIndex = context.acceptedIndex ?? 0;
  if (!Number.isInteger(acceptedIndex) || acceptedIndex < 0) {
    throw new X402MappingError("INVALID_X402_REQUIREMENT", "x402 accepted payment requirement index is invalid.");
  }
  const requirement = paymentRequired.accepts.at(acceptedIndex);
  if (!requirement) {
    throw new X402MappingError("NO_SUPPORTED_PAYMENT_REQUIREMENT", "x402 response did not include a payment requirement.");
  }
  validateRequirement(paymentRequired.resource, requirement);
  validateSupportedScheme(requirement, context.supportedSchemes ?? ["exact"]);

  const action: ManifestAction = {
    packageId: context.packageId,
    ...(context.module ? { module: context.module } : {}),
    functionName: context.functionName,
    ...(context.templateId ? { templateId: context.templateId } : {}),
    ...(context.templateVersion ? { templateVersion: context.templateVersion } : {}),
    ...(context.displayName ? { displayName: context.displayName } : {}),
  };
  const now = context.now ?? new Date();

  return {
    version: AGENT_TRANSACTION_MANIFEST_VERSION,
    agent: context.agent,
    owner: context.owner,
    ...(context.wallet ? { wallet: context.wallet } : {}),
    intent: `Pay x402 resource ${paymentRequired.resource.url}`,
    spend: {
      maxGasBudget: context.maxGasBudget,
      maxPayment: {
        amount: requirement.amount,
        asset: `${requirement.network}/${requirement.asset}`,
      },
    },
    action,
    counterparty: {
      id: `x402:${requirement.payTo}`,
      address: requirement.payTo,
    },
    scope: [
      "standard:x402",
      `x402:scheme:${requirement.scheme}`,
      `x402:network:${requirement.network}`,
      `x402:resource:${paymentRequired.resource.url}`,
    ],
    expiresAt: new Date(now.getTime() + requirement.maxTimeoutSeconds * 1000).toISOString(),
    idempotencyKey: context.idempotencyKey,
    simulation: {
      required: true,
      status: "passed",
      hash: context.simulationHash ?? "sha256:x402-mock-simulation",
    },
    receipt: {
      required: true,
      templateId: "receipt:x402:v2",
    },
    humanMandate: {
      required: false,
    },
    refundPolicy: {
      type: "refund_to_owner",
    },
    metadata: {
      x402Version: String(paymentRequired.x402Version),
      x402Scheme: requirement.scheme,
      x402Network: requirement.network,
      x402Asset: requirement.asset,
      x402ResourceUrl: paymentRequired.resource.url,
      x402PayTo: requirement.payTo,
      x402PaymentAmount: requirement.amount,
    },
  };
}

function validateRequirement(resource: X402ResourceInfo, requirement: X402PaymentRequirements): void {
  requireNonEmpty(resource.url, "resource.url");
  requireNonEmpty(requirement.scheme, "accepts[].scheme");
  requireNonEmpty(requirement.network, "accepts[].network");
  requireNonEmpty(requirement.asset, "accepts[].asset");
  requireNonEmpty(requirement.amount, "accepts[].amount");
  requireNonEmpty(requirement.payTo, "accepts[].payTo");
  if (!/^[a-z0-9]+:[A-Za-z0-9.-]+$/.test(requirement.network)) {
    throw new X402MappingError(
      "INVALID_X402_REQUIREMENT",
      "x402 payment requirement network must be a CAIP-2 network identifier.",
    );
  }
  if (!Number.isFinite(requirement.maxTimeoutSeconds) || requirement.maxTimeoutSeconds <= 0) {
    throw new X402MappingError(
      "INVALID_X402_REQUIREMENT",
      "x402 payment requirement maxTimeoutSeconds must be a positive number.",
    );
  }
}

function validateSupportedScheme(
  requirement: X402PaymentRequirements,
  supportedSchemes: readonly string[],
): void {
  if (!supportedSchemes.includes(requirement.scheme)) {
    throw new X402MappingError(
      "UNSUPPORTED_X402_SCHEME",
      `Unsupported x402 payment scheme: ${requirement.scheme}.`,
    );
  }
}

function requireNonEmpty(value: string, path: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new X402MappingError("INVALID_X402_REQUIREMENT", `x402 payment requirement ${path} is required.`);
  }
}
