import {
  mapX402PaymentRequiredToManifest,
  type AgentTransactionManifest,
  type X402ManifestMappingContext,
  type X402PaymentRequired,
  type X402PaymentRequirements,
} from "@iota-gaskit/manifest";
import {
  evaluateAgentActionPolicy,
  type AgentActionPolicy,
  type AgentPolicyDecision,
} from "@iota-gaskit/policy-gateway";
import {
  createX402ExternalPaymentReceiptState,
  redactX402PaymentMetadata,
  type X402ExternalPaymentReceiptState,
  type X402SettleEvidence,
  type X402VerifyEvidence,
} from "@iota-gaskit/receipts";

export type { X402ManifestMappingContext, X402PaymentRequired, X402PaymentRequirements };

export interface X402MockFacilitator {
  readonly verify: (request: X402FacilitatorRequest) => Promise<X402VerifyEvidence> | X402VerifyEvidence;
  readonly settle: (request: X402FacilitatorRequest) => Promise<X402SettleEvidence> | X402SettleEvidence;
}

export interface X402FacilitatorRequest {
  readonly x402Version: 2;
  readonly paymentPayload: X402PaymentPayload;
  readonly paymentRequirements: X402PaymentRequirements;
}

export interface X402PaymentPayload {
  readonly x402Version: 2;
  readonly resource?: X402PaymentRequired["resource"];
  readonly accepted: X402PaymentRequirements;
  readonly payload: Record<string, unknown>;
  readonly extensions?: Record<string, unknown>;
}

export interface RunX402MockFacilitatorFlowOptions {
  readonly paymentRequired: X402PaymentRequired;
  readonly manifestContext: X402ManifestMappingContext;
  readonly policy: AgentActionPolicy;
  readonly facilitator: X402MockFacilitator;
  readonly invokeTool: () => Promise<Record<string, unknown>> | Record<string, unknown>;
  readonly now?: Date;
  readonly paymentPayload?: Record<string, unknown>;
}

export type X402MockFacilitatorFlowResult =
  | {
      readonly approved: true;
      readonly manifest: AgentTransactionManifest;
      readonly receipt: X402ExternalPaymentReceiptState;
      readonly toolResult: Record<string, unknown>;
      readonly logSafePaymentMetadata: unknown;
    }
  | {
      readonly approved: false;
      readonly manifest: AgentTransactionManifest;
      readonly denial: Exclude<AgentPolicyDecision, { allowed: true }>;
      readonly stage: "policy";
    }
  | {
      readonly approved: false;
      readonly manifest: AgentTransactionManifest;
      readonly paymentFailure: X402PaymentFailure;
      readonly receipt: X402ExternalPaymentReceiptState;
      readonly logSafePaymentMetadata: unknown;
    };

export interface X402PaymentFailure {
  readonly stage: "verify" | "settle";
  readonly reasonCode: "X402_VERIFY_FAILED" | "X402_SETTLE_FAILED";
  readonly message: string;
}

export interface X402PaymentLogMetadataInput {
  readonly paymentId: string;
  readonly paymentPayload: X402PaymentPayload;
  readonly verify?: X402VerifyEvidence;
  readonly settle?: X402SettleEvidence;
}

export function redactX402PaymentLogMetadata(input: X402PaymentLogMetadataInput): unknown {
  return redactX402PaymentMetadata(input);
}

export async function runX402MockFacilitatorFlow(
  options: RunX402MockFacilitatorFlowOptions,
): Promise<X402MockFacilitatorFlowResult> {
  const manifest = mapX402PaymentRequiredToManifest(options.paymentRequired, {
    ...options.manifestContext,
    now: options.now ?? options.manifestContext.now,
  });
  const policyDecision = evaluateAgentActionPolicy(options.policy, manifest, { now: options.now });
  if (!policyDecision.allowed) return { approved: false, manifest, denial: policyDecision, stage: "policy" };

  const accepted = options.paymentRequired.accepts.at(options.manifestContext.acceptedIndex ?? 0);
  if (!accepted) {
    throw new Error("x402 flow cannot start without an accepted payment requirement.");
  }
  const paymentId = manifest.idempotencyKey;
  const paymentPayload: X402PaymentPayload = {
    x402Version: 2,
    resource: options.paymentRequired.resource,
    accepted,
    payload: options.paymentPayload ?? {
      paymentId,
      paymentSignature: "0xpayment-signature",
    },
    extensions: {
      "payment-identifier": {
        id: paymentId,
      },
    },
  };
  const facilitatorRequest: X402FacilitatorRequest = {
    x402Version: 2,
    paymentPayload,
    paymentRequirements: accepted,
  };

  const verify = await options.facilitator.verify(facilitatorRequest);
  if (!verify.isValid) {
    const receipt = createX402ExternalPaymentReceiptState({ paymentId, verify });
    return {
      approved: false,
      manifest,
      receipt,
      paymentFailure: {
        stage: "verify",
        reasonCode: "X402_VERIFY_FAILED",
        message: verify.invalidMessage ?? verify.invalidReason ?? "x402 verification failed.",
      },
      logSafePaymentMetadata: redactX402PaymentLogMetadata({ paymentId, paymentPayload, verify }),
    };
  }

  const settle = await options.facilitator.settle(facilitatorRequest);
  const receipt = createX402ExternalPaymentReceiptState({ paymentId, verify, settle });
  if (!settle.success) {
    return {
      approved: false,
      manifest,
      receipt,
      paymentFailure: {
        stage: "settle",
        reasonCode: "X402_SETTLE_FAILED",
        message: settle.errorMessage ?? settle.errorReason ?? "x402 settlement failed.",
      },
      logSafePaymentMetadata: redactX402PaymentLogMetadata({ paymentId, paymentPayload, verify, settle }),
    };
  }

  return {
    approved: true,
    manifest,
    receipt,
    toolResult: await options.invokeTool(),
    logSafePaymentMetadata: redactX402PaymentLogMetadata({ paymentId, paymentPayload, verify, settle }),
  };
}
