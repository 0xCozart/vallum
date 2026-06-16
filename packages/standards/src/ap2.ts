import {
  ap2PaymentMandateId,
  mapAP2MandatesToManifest,
  type AP2ManifestMappingContext,
  type AP2MandateBundle,
  type AgentTransactionManifest,
} from "@sacredlabs/agentrail-manifest";
import {
  evaluateAgentActionPolicy,
  type AgentActionPolicy,
  type AgentPolicyDecision,
} from "@sacredlabs/agentrail-policy-gateway";
import {
  createAP2MandateReceiptState,
  redactAP2MandateMetadata,
  type AP2MandateReceiptState,
  type AP2ReceiptBundle,
} from "@sacredlabs/agentrail-receipts";

export type { AP2ManifestMappingContext, AP2MandateBundle, AP2ReceiptBundle };

export interface RunAP2MockMandateFlowOptions {
  readonly mandateBundle: AP2MandateBundle;
  readonly manifestContext: AP2ManifestMappingContext;
  readonly policy: AgentActionPolicy;
  readonly issueReceipts: (manifest: AgentTransactionManifest) => Promise<AP2ReceiptBundle> | AP2ReceiptBundle;
  readonly execute: (manifest: AgentTransactionManifest) => Promise<Record<string, unknown>> | Record<string, unknown>;
  readonly now?: Date;
}

export type AP2MockMandateFlowResult =
  | {
      readonly approved: true;
      readonly manifest: AgentTransactionManifest;
      readonly receipt: AP2MandateReceiptState;
      readonly toolResult: Record<string, unknown>;
      readonly logSafeMandateMetadata: unknown;
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
      readonly paymentFailure: AP2PaymentFailure;
      readonly receipt: AP2MandateReceiptState;
      readonly logSafeMandateMetadata: unknown;
    };

export interface AP2PaymentFailure {
  readonly reasonCode: "AP2_CHECKOUT_RECEIPT_FAILED" | "AP2_PAYMENT_RECEIPT_FAILED";
  readonly message: string;
}

export async function runAP2MockMandateFlow(
  options: RunAP2MockMandateFlowOptions,
): Promise<AP2MockMandateFlowResult> {
  const manifest = mapAP2MandatesToManifest(options.mandateBundle, {
    ...options.manifestContext,
    now: options.now ?? options.manifestContext.now,
  });
  const policyDecision = evaluateAgentActionPolicy(options.policy, manifest, { now: options.now });
  if (!policyDecision.allowed) return { approved: false, manifest, denial: policyDecision, stage: "policy" };

  const receipts = await options.issueReceipts(manifest);
  const receipt = createAP2MandateReceiptState({
    manifestId: manifest.idempotencyKey,
    checkoutHash: options.mandateBundle.checkoutMandate.checkout_hash,
    paymentMandateId: ap2PaymentMandateId(options.mandateBundle.paymentMandate),
    disputeEvidenceReference: options.mandateBundle.disputeEvidenceReference,
    checkoutReceipt: receipts.checkoutReceipt,
    paymentReceipt: receipts.paymentReceipt,
  });
  const logSafeMandateMetadata = redactAP2MandateLogMetadata(options.mandateBundle);

  if (receipts.checkoutReceipt.status !== "Success") {
    return {
      approved: false,
      manifest,
      receipt,
      paymentFailure: {
        reasonCode: "AP2_CHECKOUT_RECEIPT_FAILED",
        message: receipts.checkoutReceipt.error ?? "AP2 checkout receipt failed.",
      },
      logSafeMandateMetadata,
    };
  }
  if (receipts.paymentReceipt.status !== "Success") {
    return {
      approved: false,
      manifest,
      receipt,
      paymentFailure: {
        reasonCode: "AP2_PAYMENT_RECEIPT_FAILED",
        message: receipts.paymentReceipt.error ?? "AP2 payment receipt failed.",
      },
      logSafeMandateMetadata,
    };
  }

  return {
    approved: true,
    manifest,
    receipt,
    toolResult: await options.execute(manifest),
    logSafeMandateMetadata,
  };
}

export function redactAP2MandateLogMetadata(bundle: AP2MandateBundle): unknown {
  return redactAP2MandateMetadata(bundle);
}
