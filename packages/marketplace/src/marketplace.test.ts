import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultContractTemplateRegistry } from "@agentrail/contracts-metadata";
import { validManifestFixture } from "@agentrail/manifest";
import {
  approveServiceBountyReceipt,
  completeServiceBountyReceipt,
  createServiceBountyReceipt,
  releaseServiceBountyReceipt,
  sponsorServiceBountyReceipt,
  submitServiceBountyReceipt,
} from "@agentrail/receipts";
import { validAgentProfileFixture } from "@agentrail/registry";

import {
  createDisputeEvidenceBundle,
  createMarketplaceProviderListing,
  createMarketplaceReceiptView,
  formatMarketplaceReadModelDemoResult,
  runMarketplaceReadModelDemo,
} from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");

test("provider listing consumes registry profile policy compatibility and contract metadata without private fields", () => {
  const listing = createMarketplaceProviderListing({
    providerId: "provider:quote-service",
    profile: {
      ...validAgentProfileFixture(),
      capabilities: [{
        id: "research.summary",
        contracts: ["escrow:v1"],
        scopes: ["contract:escrow", "action:open_escrow"],
      }],
    },
    capabilityRequirement: {
      capabilityId: "research.summary",
      scope: "contract:escrow",
      contract: "escrow:v1",
    },
    contractRegistry: defaultContractTemplateRegistry,
    evidenceLevel: "local",
    standardsEvidence: [{
      protocol: "a2a",
      status: "local",
      referenceId: "a2a-local-server-smoke",
    }],
    now,
  });

  const serialized = JSON.stringify(listing);
  assert.equal(listing.profileLabel, "active");
  assert.equal(listing.verificationLabel, "local");
  assert.equal(listing.policyCompatibility.allowed, true);
  assert.ok(listing.supportedTemplates.some((template) => template.templateId === "escrow_v1"));
  assert.equal(listing.standardsEvidence[0]?.protocol, "a2a");
  assert.doesNotMatch(serialized, /signer_ref|wallet_researcher_demo|credential:research-summary|payment address/i);
});

test("provider listing labels revoked expired and unverified profiles without claiming provider verification", () => {
  const revoked = createMarketplaceProviderListing({
    providerId: "provider:revoked",
    profile: {
      ...validAgentProfileFixture(),
      status: "revoked",
      revocation: { revoked: true, reason: "operator-disabled" },
    },
    capabilityRequirement: { capabilityId: "research.summary" },
    contractRegistry: defaultContractTemplateRegistry,
    now,
  });
  const unverified = createMarketplaceProviderListing({
    providerId: "provider:unverified",
    profile: { unknown: true },
    capabilityRequirement: { capabilityId: "research.summary" },
    contractRegistry: defaultContractTemplateRegistry,
    now,
  });

  assert.equal(revoked.profileLabel, "revoked");
  assert.equal(revoked.policyCompatibility.allowed, false);
  assert.equal(revoked.providerVerification, "unverified");
  assert.equal(unverified.profileLabel, "unverified");
  assert.equal(unverified.policyCompatibility.allowed, false);
});

test("receipt views enforce party access and redact private evidence", () => {
  const receipt = serviceBountyReceipt();

  const buyer = createMarketplaceReceiptView({
    receipt,
    viewer: { principalId: "owner:alice", role: "buyer" },
  });
  const provider = createMarketplaceReceiptView({
    receipt,
    viewer: { principalId: "provider:quote-service", role: "provider" },
  });
  const stranger = createMarketplaceReceiptView({
    receipt,
    viewer: { principalId: "agent:unrelated", role: "buyer" },
  });

  assert.equal(buyer.allowed, true);
  assert.equal(provider.allowed, true);
  assert.equal(stranger.allowed, false);
  if (!buyer.allowed) throw new Error("buyer receipt view should be allowed");
  const serialized = JSON.stringify(buyer.view);
  assert.equal(buyer.view.receiptId, "receipt_service_bounty_marketplace_1");
  assert.doesNotMatch(serialized, /private prompt|Bearer abc|signer_ref|wallet_demo|payment-secret/i);
});

test("dispute evidence bundle links manifest receipt template and standards evidence with stable redacted hash", () => {
  const receipt = serviceBountyReceipt();
  const manifest = {
    ...validManifestFixture(),
    intent: "Use private prompt: investigate provider work with Bearer abc.def.ghi",
    metadata: {
      privatePrompt: "secret provider instruction",
      signerRef: "signer_ref_marketplace_secret",
    },
  };

  const first = createDisputeEvidenceBundle({
    receipt,
    manifest,
    template: defaultContractTemplateRegistry.findTemplate("service_bounty_v1", "1.0.0"),
    standardsEvidence: [{
      protocol: "ap2",
      status: "local",
      referenceId: "ap2-local-mandate-proof",
      metadata: {
        bearerToken: "Bearer abc.def.ghi",
        safe: "linked",
      },
    }],
    viewer: { principalId: "operator:1", role: "operator" },
  });
  const second = createDisputeEvidenceBundle({
    receipt,
    manifest,
    template: defaultContractTemplateRegistry.findTemplate("service_bounty_v1", "1.0.0"),
    standardsEvidence: [{
      protocol: "ap2",
      status: "local",
      referenceId: "ap2-local-mandate-proof",
      metadata: {
        bearerToken: "Bearer abc.def.ghi",
        safe: "linked",
      },
    }],
    viewer: { principalId: "operator:1", role: "operator" },
  });

  const serialized = JSON.stringify(first);
  assert.match(first.bundleHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.bundleHash, second.bundleHash);
  assert.equal(first.links.manifestId, receipt.manifestId);
  assert.equal(first.links.receiptId, receipt.receiptId);
  assert.equal(first.links.templateId, "service_bounty_v1");
  assert.equal(first.links.standardsEvidence[0]?.referenceId, "ap2-local-mandate-proof");
  assert.doesNotMatch(serialized, /private prompt|Bearer abc|signer_ref|payment-secret|secret provider/i);
});

test("marketplace read-model demo proves local access and dispute evidence without leaking secrets", () => {
  const result = runMarketplaceReadModelDemo();
  const formatted = formatMarketplaceReadModelDemoResult(result);

  assert.equal(result.providerProfileLabel, "active");
  assert.equal(result.policyAllowed, true);
  assert.equal(result.buyerReceiptAllowed, true);
  assert.equal(result.strangerReceiptAllowed, false);
  assert.match(result.disputeBundleHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.logLeaksSecretMaterial, false);
  assert.doesNotMatch(formatted, /private prompt|Bearer abc|signer_ref|wallet_demo|payment-secret/i);
});

function serviceBountyReceipt() {
  const created = createServiceBountyReceipt({
    receiptId: "receipt_service_bounty_marketplace_1",
    manifestId: "manifest_service_bounty_marketplace_1",
    idempotencyKey: "idem_service_bounty_marketplace_1",
    agentId: "agent:quote-bot",
    ownerId: "owner:alice",
    requesterId: "owner:alice",
    providerId: "provider:quote-service",
    bountyId: "bounty:marketplace-1",
    deliverableHash: "sha256:deliverable",
    amount: { amount: "10.00", asset: "USD" },
    createdAt: now,
  });
  const approved = approveServiceBountyReceipt(created, { at: now });
  const sponsored = sponsorServiceBountyReceipt(approved, {
    at: now,
    sponsorshipId: "mock_sponsorship_marketplace",
  });
  const submitted = submitServiceBountyReceipt(sponsored, {
    at: now,
    transactionDigest: "digest_marketplace_demo",
  });
  const completed = completeServiceBountyReceipt(submitted, {
    at: now,
    completionProofHash: "sha256:completion",
  });
  const released = releaseServiceBountyReceipt(completed, {
    at: now,
    releaseProofHash: "sha256:release",
  });
  return {
    ...released,
    events: [
      ...released.events,
      { type: "sponsored" as const, at: now.toISOString(), reason: "Bearer abc.def.ghi private prompt" },
    ],
  };
}
