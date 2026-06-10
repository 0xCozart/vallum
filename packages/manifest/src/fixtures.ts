import { AGENT_TRANSACTION_MANIFEST_VERSION, type AgentTransactionManifest } from "./schema.js";

export function validManifestFixture(): AgentTransactionManifest {
  return {
    version: AGENT_TRANSACTION_MANIFEST_VERSION,
    agent: {
      id: "agent:quote-bot",
      address: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
    owner: {
      id: "owner:alice",
    },
    wallet: {
      walletId: "wallet_demo_1",
      signerRef: "signer_ref_demo_1",
    },
    intent: "Open a verifier-release escrow for quote fulfillment.",
    spend: {
      maxGasBudget: 50_000_000,
      maxPayment: {
        amount: "10.00",
        asset: "USD",
      },
    },
    action: {
      packageId: "0x2222222222222222222222222222222222222222222222222222222222222222",
      module: "escrow",
      functionName: "open_escrow",
      displayName: "Open escrow",
    },
    counterparty: {
      id: "provider:quote-service",
      address: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
    scope: ["contract:escrow", "action:open_escrow"],
    expiresAt: "2026-06-10T13:00:00.000Z",
    idempotencyKey: "idem_quote_bot_20260610_0001",
    simulation: {
      required: true,
      status: "passed",
      hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
    receipt: {
      required: true,
      templateId: "receipt:escrow:v1",
    },
    humanMandate: {
      required: false,
    },
    refundPolicy: {
      type: "refund_to_owner",
    },
    metadata: {
      purpose: "test-fixture",
    },
  };
}
