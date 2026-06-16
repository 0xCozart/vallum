import assert from "node:assert/strict";
import { test } from "node:test";

import { validateAgentTransactionManifest } from "./validate.js";
import {
  X402MappingError,
  mapX402PaymentRequiredToManifest,
  type X402PaymentRequired,
} from "./x402Mapping.js";

const now = new Date("2026-06-10T12:00:00.000Z");

test("x402 v2 payment requirements map to an Vallum manifest", () => {
  const manifest = mapX402PaymentRequiredToManifest(paymentRequiredFixture(), {
    agent: { id: "agent:x402-buyer" },
    owner: { id: "owner:alice" },
    wallet: {
      walletId: "wallet_x402_1",
      signerRef: "signer_ref_x402_1",
    },
    packageId: "0xpaypercallpackage",
    module: "pay_per_call",
    functionName: "request_call",
    templateId: "pay_per_call_v1",
    templateVersion: "1.0.0",
    maxGasBudget: 25_000_000,
    idempotencyKey: "pay_1234567890abcdef1234567890abcdef",
    now,
  });

  assert.equal(manifest.intent, "Pay x402 resource https://api.example.test/weather");
  assert.deepEqual(manifest.spend.maxPayment, {
    amount: "1000",
    asset: "eip155:84532/0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  });
  assert.equal(manifest.counterparty.id, "x402:0x1111111111111111111111111111111111111111");
  assert.equal(manifest.counterparty.address, "0x1111111111111111111111111111111111111111");
  assert.deepEqual(manifest.scope, [
    "standard:x402",
    "x402:scheme:exact",
    "x402:network:eip155:84532",
    "x402:resource:https://api.example.test/weather",
  ]);
  assert.equal(manifest.expiresAt, "2026-06-10T12:01:00.000Z");
  assert.equal(manifest.receipt.templateId, "receipt:x402:v2");
  assert.equal(manifest.metadata?.x402Version, "2");
  assert.equal(manifest.metadata?.x402ResourceUrl, "https://api.example.test/weather");
  assert.equal(manifest.metadata?.x402PayTo, "0x1111111111111111111111111111111111111111");

  const result = validateAgentTransactionManifest(manifest, { now });
  assert.equal(result.ok, true);
});

test("unsupported x402 protocol versions fail closed", () => {
  assert.throws(
    () => mapX402PaymentRequiredToManifest({ ...paymentRequiredFixture(), x402Version: 1 }, {
      agent: { id: "agent:x402-buyer" },
      owner: { id: "owner:alice" },
      packageId: "0xpaypercallpackage",
      functionName: "request_call",
      maxGasBudget: 25_000_000,
      idempotencyKey: "pay_1234567890abcdef1234567890abcdef",
      now,
    }),
    (error) => error instanceof X402MappingError && error.code === "UNSUPPORTED_X402_VERSION",
  );
});

test("missing accepted payment requirements fail closed", () => {
  assert.throws(
    () => mapX402PaymentRequiredToManifest({ ...paymentRequiredFixture(), accepts: [] }, {
      agent: { id: "agent:x402-buyer" },
      owner: { id: "owner:alice" },
      packageId: "0xpaypercallpackage",
      functionName: "request_call",
      maxGasBudget: 25_000_000,
      idempotencyKey: "pay_1234567890abcdef1234567890abcdef",
      now,
    }),
    (error) => error instanceof X402MappingError && error.code === "NO_SUPPORTED_PAYMENT_REQUIREMENT",
  );
});

test("unsupported x402 payment schemes fail closed unless explicitly enabled", () => {
  assert.throws(
    () => mapX402PaymentRequiredToManifest({
      ...paymentRequiredFixture(),
      accepts: [{
        ...paymentRequiredFixture().accepts[0],
        scheme: "upto",
      }],
    }, {
      agent: { id: "agent:x402-buyer" },
      owner: { id: "owner:alice" },
      packageId: "0xpaypercallpackage",
      functionName: "request_call",
      maxGasBudget: 25_000_000,
      idempotencyKey: "pay_1234567890abcdef1234567890abcdef",
      now,
    }),
    (error) => error instanceof X402MappingError && error.code === "UNSUPPORTED_X402_SCHEME",
  );
});

test("malformed x402 network ids and accepted indexes fail closed", () => {
  assert.throws(
    () => mapX402PaymentRequiredToManifest({
      ...paymentRequiredFixture(),
      accepts: [{
        ...paymentRequiredFixture().accepts[0],
        network: "base-sepolia",
      }],
    }, {
      agent: { id: "agent:x402-buyer" },
      owner: { id: "owner:alice" },
      packageId: "0xpaypercallpackage",
      functionName: "request_call",
      maxGasBudget: 25_000_000,
      idempotencyKey: "pay_1234567890abcdef1234567890abcdef",
      now,
    }),
    (error) => error instanceof X402MappingError && error.code === "INVALID_X402_REQUIREMENT",
  );

  assert.throws(
    () => mapX402PaymentRequiredToManifest(paymentRequiredFixture(), {
      agent: { id: "agent:x402-buyer" },
      owner: { id: "owner:alice" },
      packageId: "0xpaypercallpackage",
      functionName: "request_call",
      maxGasBudget: 25_000_000,
      idempotencyKey: "pay_1234567890abcdef1234567890abcdef",
      acceptedIndex: -1,
      now,
    }),
    (error) => error instanceof X402MappingError && error.code === "INVALID_X402_REQUIREMENT",
  );
});

function paymentRequiredFixture(): X402PaymentRequired {
  return {
    x402Version: 2,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url: "https://api.example.test/weather",
      description: "Weather data",
      mimeType: "application/json",
    },
    accepts: [{
      scheme: "exact",
      network: "eip155:84532",
      amount: "1000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      payTo: "0x1111111111111111111111111111111111111111",
      maxTimeoutSeconds: 60,
      extra: {
        name: "USDC",
        version: "2",
      },
    }],
    extensions: {
      "payment-identifier": {
        required: true,
      },
    },
  };
}
