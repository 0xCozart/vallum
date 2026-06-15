import assert from "node:assert/strict";
import { test } from "node:test";

import { validateAgentTransactionManifest } from "./validate.js";
import {
  AP2MappingError,
  mapAP2MandatesToManifest,
  type AP2MandateBundle,
} from "./ap2Mapping.js";

const now = new Date("2026-06-10T12:00:00.000Z");

test("AP2 checkout and payment mandates map to an AgentRail manifest", () => {
  const manifest = mapAP2MandatesToManifest(ap2MandateBundleFixture(), {
    agent: { id: "agent:shopping-buyer" },
    owner: { id: "owner:alice" },
    wallet: {
      walletId: "wallet_ap2_1",
      signerRef: "signer_ref_ap2_1",
    },
    packageId: "0xap2package",
    module: "ap2_checkout",
    functionName: "execute_payment",
    templateId: "ap2_payment_v1",
    templateVersion: "1.0.0",
    maxGasBudget: 30_000_000,
    idempotencyKey: "ap2_checkout_hash_123_payment_456",
    now,
  });

  assert.equal(manifest.intent, "Execute AP2 payment mandate payment_txn_456 for checkout checkout_hash_123");
  assert.deepEqual(manifest.spend.maxPayment, {
    amount: "27999",
    asset: "USD",
  });
  assert.equal(manifest.counterparty.id, "ap2:merchant:running-store");
  assert.deepEqual(manifest.scope, [
    "standard:ap2",
    "ap2:mode:direct",
    "ap2:checkout:checkout_hash_123",
    "ap2:payment:payment_txn_456",
    "ap2:trusted-surface:non-agentic",
  ]);
  assert.equal(manifest.expiresAt, "2026-06-10T12:05:00.000Z");
  assert.deepEqual(manifest.humanMandate, {
    required: true,
    mandateId: "payment_txn_456",
  });
  assert.equal(manifest.receipt.templateId, "receipt:ap2:v1");
  assert.equal(manifest.metadata?.ap2CheckoutMandateVct, "mandate.checkout.1");
  assert.equal(manifest.metadata?.ap2PaymentMandateVct, "mandate.payment.1");
  assert.equal(manifest.metadata?.ap2TrustedSurfaceNonAgentic, "true");
  assert.equal(manifest.metadata?.ap2DisputeEvidenceReference, "ap2-dispute-evidence://case/checkout_hash_123");
  assert.equal(JSON.stringify(manifest).includes("checkout.jwt.private"), false);
  assert.equal(JSON.stringify(manifest).includes("instrument_card_1"), false);

  const result = validateAgentTransactionManifest(manifest, { now });
  assert.equal(result.ok, true);
});

test("unsupported AP2 mandate vct values fail closed", () => {
  assert.throws(
    () => mapAP2MandatesToManifest({
      ...ap2MandateBundleFixture(),
      paymentMandate: {
        ...ap2MandateBundleFixture().paymentMandate,
        vct: "mandate.payment.2",
      },
    }, baseContext()),
    (error) => error instanceof AP2MappingError && error.code === "UNSUPPORTED_AP2_MANDATE_VERSION",
  );
});

test("AP2 mapping fails closed when Trusted Surface is agentic", () => {
  assert.throws(
    () => mapAP2MandatesToManifest({
      ...ap2MandateBundleFixture(),
      trustedSurface: {
        id: "agent:shopping-agent",
        nonAgentic: false,
      },
    }, baseContext()),
    (error) => error instanceof AP2MappingError && error.code === "TRUSTED_SURFACE_MUST_BE_NON_AGENTIC",
  );
});

test("AP2 mapping fails closed when payment and checkout references diverge", () => {
  assert.throws(
    () => mapAP2MandatesToManifest({
      ...ap2MandateBundleFixture(),
      paymentMandate: {
        ...ap2MandateBundleFixture().paymentMandate,
        transaction_id: "different_checkout_hash",
      },
    }, baseContext()),
    (error) => error instanceof AP2MappingError && error.code === "MANDATE_REFERENCE_MISMATCH",
  );
});

function baseContext() {
  return {
    agent: { id: "agent:shopping-buyer" },
    owner: { id: "owner:alice" },
    packageId: "0xap2package",
    functionName: "execute_payment",
    maxGasBudget: 30_000_000,
    idempotencyKey: "ap2_checkout_hash_123_payment_456",
    now,
  };
}

function ap2MandateBundleFixture(): AP2MandateBundle {
  return {
    mode: "direct",
    checkoutMandate: {
      vct: "mandate.checkout.1",
      checkout_jwt: "checkout.jwt.private",
      checkout_hash: "checkout_hash_123",
      iat: 1_781_092_800,
      exp: 1_781_093_100,
    },
    paymentMandate: {
      vct: "mandate.payment.1",
      transaction_id: "checkout_hash_123",
      payment_mandate_id: "payment_txn_456",
      payee: {
        id: "merchant:running-store",
        name: "Running Store",
        website: "https://merchant.example.test",
      },
      payment_amount: {
        amount: 27_999,
        currency: "USD",
      },
      payment_instrument: {
        id: "instrument_card_1",
        type: "card",
        description: "Private card",
      },
      iat: 1_781_092_800,
      exp: 1_781_093_400,
      risk_data: {
        device: "private-device-fingerprint",
      },
    },
    trustedSurface: {
      id: "trusted-surface:web-checkout",
      nonAgentic: true,
    },
    disputeEvidenceReference: "ap2-dispute-evidence://case/checkout_hash_123",
  };
}
