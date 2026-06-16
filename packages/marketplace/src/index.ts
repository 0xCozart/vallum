import { createHash } from "node:crypto";

import {
  defaultContractTemplateRegistry,
  type ContractTemplateMetadata,
  type ContractTemplateRegistry,
} from "@vallum/contracts-metadata";
import { validManifestFixture, type AgentTransactionManifest } from "@vallum/manifest";
import {
  evaluateProfileCapabilityPolicy,
  type AgentCapabilityPolicyDecision,
  type AgentCapabilityRequirement,
} from "@vallum/policy-gateway";
import {
  approveServiceBountyReceipt,
  completeServiceBountyReceipt,
  createServiceBountyReceipt,
  releaseServiceBountyReceipt,
  sponsorServiceBountyReceipt,
  submitServiceBountyReceipt,
  type DataLicenseReceipt,
  type EscrowReceipt,
  type PayPerCallReceipt,
  type ReputationReceipt,
  type ServiceBountyReceipt,
  type SubscriptionReceipt,
} from "@vallum/receipts";
import {
  validateAgentProfile,
  validAgentProfileFixture,
  type AgentProfile,
  type AgentProfileStatus,
} from "@vallum/registry";

export type MarketplaceEvidenceLevel = "mock" | "local" | "testnet" | "live";
export type MarketplaceProfileLabel = AgentProfileStatus | "unverified";
export type MarketplaceRole = "buyer" | "provider" | "operator" | "reviewer";
export type MarketplaceReceipt =
  | EscrowReceipt
  | PayPerCallReceipt
  | DataLicenseReceipt
  | ServiceBountyReceipt
  | ReputationReceipt
  | SubscriptionReceipt;

export interface MarketplaceViewer {
  readonly principalId: string;
  readonly role: MarketplaceRole;
}

export interface MarketplaceStandardsEvidence {
  readonly protocol: "x402" | "ap2" | "a2a";
  readonly status: MarketplaceEvidenceLevel;
  readonly referenceId: string;
  readonly metadata?: Record<string, unknown>;
}

export interface MarketplaceProviderListingInput {
  readonly providerId: string;
  readonly profile: unknown;
  readonly capabilityRequirement: AgentCapabilityRequirement;
  readonly contractRegistry: ContractTemplateRegistry;
  readonly evidenceLevel?: MarketplaceEvidenceLevel;
  readonly standardsEvidence?: readonly MarketplaceStandardsEvidence[];
  readonly now?: Date;
}

export interface MarketplaceProviderListing {
  readonly providerId: string;
  readonly displayName: string;
  readonly profileLabel: MarketplaceProfileLabel;
  readonly providerVerification: "unverified";
  readonly verificationLabel: MarketplaceEvidenceLevel | "unverified";
  readonly capabilityIds: readonly string[];
  readonly endpointTypes: readonly string[];
  readonly policyCompatibility: AgentCapabilityPolicyDecision;
  readonly supportedTemplates: readonly Pick<
    ContractTemplateMetadata,
    "templateId" | "version" | "module" | "entryFunctions" | "riskCategory" | "refundDisputeBehavior"
  >[];
  readonly standardsEvidence: readonly Omit<MarketplaceStandardsEvidence, "metadata">[];
}

export type MarketplaceReceiptViewResult =
  | {
      readonly allowed: true;
      readonly view: MarketplaceReceiptView;
    }
  | {
      readonly allowed: false;
      readonly reasonCode: "MARKETPLACE_RECEIPT_ACCESS_DENIED";
      readonly message: string;
    };

export interface MarketplaceReceiptView {
  readonly receiptId: string;
  readonly manifestId: string;
  readonly status: MarketplaceReceipt["status"];
  readonly workflow: MarketplaceWorkflow;
  readonly parties: {
    readonly agentId: string;
    readonly ownerId: string;
    readonly providerId?: string;
    readonly requesterId?: string;
    readonly licenseeId?: string;
    readonly subscriberId?: string;
    readonly issuerId?: string;
    readonly subjectId?: string;
  };
  readonly amount: MarketplaceReceipt["amount"];
  readonly transactionDigest?: string;
  readonly sponsorshipId?: string;
  readonly events: readonly {
    readonly type: string;
    readonly at: string;
    readonly reason?: string;
  }[];
}

export interface CreateMarketplaceReceiptViewInput {
  readonly receipt: MarketplaceReceipt;
  readonly viewer: MarketplaceViewer;
}

export interface CreateDisputeEvidenceBundleInput {
  readonly receipt: MarketplaceReceipt;
  readonly manifest: AgentTransactionManifest;
  readonly template?: ContractTemplateMetadata;
  readonly standardsEvidence?: readonly MarketplaceStandardsEvidence[];
  readonly viewer: MarketplaceViewer;
}

export interface MarketplaceDisputeEvidenceBundle {
  readonly bundleHash: string;
  readonly visibility: "party" | "operator" | "reviewer";
  readonly links: {
    readonly manifestId: string;
    readonly receiptId: string;
    readonly templateId?: string;
    readonly templateVersion?: string;
    readonly transactionDigest?: string;
    readonly standardsEvidence: readonly Omit<MarketplaceStandardsEvidence, "metadata">[];
  };
  readonly manifest: {
    readonly agentId: string;
    readonly ownerId: string;
    readonly counterpartyId: string;
    readonly action: {
      readonly packageId: string;
      readonly module?: string;
      readonly functionName: string;
      readonly templateId?: string;
      readonly templateVersion?: string;
    };
    readonly scope: readonly string[];
    readonly simulationRequired: boolean;
    readonly receiptRequired: boolean;
  };
  readonly receipt: MarketplaceReceiptView;
  readonly template?: Pick<
    ContractTemplateMetadata,
    "templateId" | "version" | "module" | "entryFunctions" | "riskCategory" | "refundDisputeBehavior"
  >;
}

export interface MarketplaceReadModelDemoResult {
  readonly providerProfileLabel: MarketplaceProfileLabel;
  readonly policyAllowed: boolean;
  readonly buyerReceiptAllowed: boolean;
  readonly strangerReceiptAllowed: boolean;
  readonly disputeBundleHash: string;
  readonly logLeaksSecretMaterial: boolean;
}

type MarketplaceWorkflow =
  | "escrow"
  | "pay_per_call"
  | "data_license"
  | "service_bounty"
  | "reputation_receipt"
  | "subscription";

export function createMarketplaceProviderListing(
  input: MarketplaceProviderListingInput,
): MarketplaceProviderListing {
  const validation = validateAgentProfile(input.profile, { now: input.now });
  const profile = validation.ok ? validation.profile : undefined;
  const profileLabel: MarketplaceProfileLabel = validation.ok ? validation.profile.status : validation.status ?? "unverified";
  const policyCompatibility = validation.ok
    ? evaluateProfileCapabilityPolicy(profile, input.capabilityRequirement, { now: input.now })
    : {
        allowed: false as const,
        reasonCode: "PROFILE_INVALID" as const,
        message: "Agent profile failed validation.",
      };

  return {
    providerId: input.providerId,
    displayName: profile?.name ?? input.providerId,
    profileLabel,
    providerVerification: "unverified",
    verificationLabel: validation.ok ? input.evidenceLevel ?? "mock" : "unverified",
    capabilityIds: profile?.capabilities.map((capability) => capability.id) ?? [],
    endpointTypes: profile?.endpoints.map((endpoint) => endpoint.type) ?? [],
    policyCompatibility,
    supportedTemplates: supportedTemplates(profile, input.contractRegistry),
    standardsEvidence: (input.standardsEvidence ?? []).map(stripStandardsMetadata),
  };
}

export function createMarketplaceReceiptView(
  input: CreateMarketplaceReceiptViewInput,
): MarketplaceReceiptViewResult {
  if (!canViewReceipt(input.viewer, input.receipt)) {
    return {
      allowed: false,
      reasonCode: "MARKETPLACE_RECEIPT_ACCESS_DENIED",
      message: "Marketplace receipt is not visible to this viewer.",
    };
  }
  return {
    allowed: true,
    view: receiptView(input.receipt),
  };
}

export function createDisputeEvidenceBundle(
  input: CreateDisputeEvidenceBundleInput,
): MarketplaceDisputeEvidenceBundle {
  const receipt = createMarketplaceReceiptView({
    receipt: input.receipt,
    viewer: input.viewer,
  });
  if (!receipt.allowed) {
    throw new MarketplaceAccessError(receipt.reasonCode, receipt.message);
  }

  const bundleWithoutHash = {
    visibility: visibility(input.viewer),
    links: {
      manifestId: input.receipt.manifestId,
      receiptId: input.receipt.receiptId,
      ...(input.template ? {
        templateId: input.template.templateId,
        templateVersion: input.template.version,
      } : {}),
      ...("transactionDigest" in input.receipt && input.receipt.transactionDigest
        ? { transactionDigest: input.receipt.transactionDigest }
        : {}),
      standardsEvidence: (input.standardsEvidence ?? []).map(stripStandardsMetadata),
    },
    manifest: {
      agentId: input.manifest.agent.id,
      ownerId: input.manifest.owner.id,
      counterpartyId: input.manifest.counterparty.id,
      action: {
        packageId: input.manifest.action.packageId,
        ...(input.manifest.action.module ? { module: input.manifest.action.module } : {}),
        functionName: input.manifest.action.functionName,
        ...(input.manifest.action.templateId ? { templateId: input.manifest.action.templateId } : {}),
        ...(input.manifest.action.templateVersion ? { templateVersion: input.manifest.action.templateVersion } : {}),
      },
      scope: input.manifest.scope,
      simulationRequired: input.manifest.simulation.required,
      receiptRequired: input.manifest.receipt.required,
    },
    receipt: receipt.view,
    ...(input.template ? { template: templateSummary(input.template) } : {}),
  } satisfies Omit<MarketplaceDisputeEvidenceBundle, "bundleHash">;

  const redacted = redactMarketplaceEvidence(bundleWithoutHash) as Omit<MarketplaceDisputeEvidenceBundle, "bundleHash">;
  return {
    bundleHash: `sha256:${sha256(stableStringify(redacted))}`,
    ...redacted,
  };
}

export function runMarketplaceReadModelDemo(): MarketplaceReadModelDemoResult {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const receipt = appendMarketplaceDiagnosticEvent(createReleasedServiceBountyReceipt({
    receiptId: "receipt_marketplace_demo_1",
    manifestId: "manifest_marketplace_demo_1",
    idempotencyKey: "idem_marketplace_demo_1",
    agentId: "agent:quote-bot",
    ownerId: "owner:alice",
    requesterId: "owner:alice",
    providerId: "provider:quote-service",
    bountyId: "bounty:demo",
    deliverableHash: "sha256:deliverable",
    amount: { amount: "10.00", asset: "USD" },
    transactionDigest: "digest_marketplace_demo",
    sponsorshipId: "mock_sponsorship_marketplace",
    now,
  }), now);
  const listing = createMarketplaceProviderListing({
    providerId: "provider:quote-service",
    profile: {
      ...validProfile(),
      capabilities: [{
        id: "research.summary",
        contracts: ["escrow:v1"],
        scopes: ["contract:escrow"],
      }],
    },
    capabilityRequirement: {
      capabilityId: "research.summary",
      scope: "contract:escrow",
      contract: "escrow:v1",
    },
    contractRegistry: defaultContractTemplateRegistry,
    evidenceLevel: "local",
    standardsEvidence: [{ protocol: "a2a", status: "local", referenceId: "a2a-local-server-smoke" }],
    now,
  });
  const buyer = createMarketplaceReceiptView({
    receipt,
    viewer: { principalId: "owner:alice", role: "buyer" },
  });
  const stranger = createMarketplaceReceiptView({
    receipt,
    viewer: { principalId: "agent:unrelated", role: "buyer" },
  });
  const bundle = createDisputeEvidenceBundle({
    receipt,
    manifest: {
      ...validManifestFixture(),
      intent: "Use private prompt with Bearer abc.def.ghi",
    },
    template: defaultContractTemplateRegistry.findTemplate("service_bounty_v1", "1.0.0"),
    standardsEvidence: [{ protocol: "a2a", status: "local", referenceId: "a2a-local-server-smoke" }],
    viewer: { principalId: "operator:demo", role: "operator" },
  });
  const serialized = JSON.stringify({ listing, buyer, stranger, bundle });

  return {
    providerProfileLabel: listing.profileLabel,
    policyAllowed: listing.policyCompatibility.allowed,
    buyerReceiptAllowed: buyer.allowed,
    strangerReceiptAllowed: stranger.allowed,
    disputeBundleHash: bundle.bundleHash,
    logLeaksSecretMaterial: responseLeaks(serialized),
  };
}

export function formatMarketplaceReadModelDemoResult(result: MarketplaceReadModelDemoResult): string {
  return [
    "Marketplace read-model demo passed",
    `provider.profileLabel=${result.providerProfileLabel}`,
    `policy.allowed=${result.policyAllowed}`,
    `buyerReceipt.allowed=${result.buyerReceiptAllowed}`,
    `strangerReceipt.allowed=${result.strangerReceiptAllowed}`,
    `dispute.bundleHash=${result.disputeBundleHash}`,
    `logLeaksSecretMaterial=${result.logLeaksSecretMaterial}`,
  ].join("\n");
}

export class MarketplaceAccessError extends Error {
  constructor(
    readonly code: "MARKETPLACE_RECEIPT_ACCESS_DENIED",
    message: string,
  ) {
    super(message);
    this.name = "MarketplaceAccessError";
  }
}

export function redactMarketplaceEvidence(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactMarketplaceEvidence);
  if (!isRecord(value)) return typeof value === "string" ? redactString(value) : value;

  const redacted: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (isSecretKey(key)) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = redactMarketplaceEvidence(nested);
    }
  }
  return redacted;
}

function receiptView(receipt: MarketplaceReceipt): MarketplaceReceiptView {
  const record = receipt as unknown as Record<string, unknown>;
  return redactMarketplaceEvidence({
    receiptId: receipt.receiptId,
    manifestId: receipt.manifestId,
    status: receipt.status,
    workflow: workflow(receipt),
    parties: {
      agentId: receipt.agentId,
      ownerId: receipt.ownerId,
      ...pickString(record, "providerId"),
      ...pickString(record, "requesterId"),
      ...pickString(record, "licenseeId"),
      ...pickString(record, "subscriberId"),
      ...pickString(record, "issuerId"),
      ...pickString(record, "subjectId"),
    },
    amount: receipt.amount,
    ...("transactionDigest" in receipt && receipt.transactionDigest
      ? { transactionDigest: receipt.transactionDigest }
      : {}),
    ...("sponsorshipId" in receipt && receipt.sponsorshipId ? { sponsorshipId: receipt.sponsorshipId } : {}),
    events: receipt.events.map((event) => ({
      type: event.type,
      at: event.at,
      ...(event.reason ? { reason: event.reason } : {}),
    })),
  }) as MarketplaceReceiptView;
}

function canViewReceipt(viewer: MarketplaceViewer, receipt: MarketplaceReceipt): boolean {
  if (viewer.role === "operator" || viewer.role === "reviewer") return true;
  const parties = partyIds(receipt);
  if (viewer.role === "provider") return parties.providers.includes(viewer.principalId);
  return parties.buyers.includes(viewer.principalId);
}

function partyIds(receipt: MarketplaceReceipt): {
  readonly buyers: readonly string[];
  readonly providers: readonly string[];
} {
  const record = receipt as unknown as Record<string, unknown>;
  const buyers = [
    receipt.agentId,
    receipt.ownerId,
    stringValue(record.requesterId),
    stringValue(record.licenseeId),
    stringValue(record.subscriberId),
    stringValue(record.issuerId),
  ].filter(isString);
  const providers = [
    stringValue(record.providerId),
    stringValue(record.subjectId),
    isEscrowReceipt(receipt) ? receipt.escrow.providerId : undefined,
    isEscrowReceipt(receipt) ? receipt.escrow.verifierId : undefined,
  ].filter(isString);
  return { buyers, providers };
}

function workflow(receipt: MarketplaceReceipt): MarketplaceWorkflow {
  if ("toolName" in receipt) return "pay_per_call";
  if ("datasetId" in receipt) return "data_license";
  if ("bountyId" in receipt) return "service_bounty";
  if ("interactionId" in receipt) return "reputation_receipt";
  if ("planId" in receipt) return "subscription";
  return "escrow";
}

function createReleasedServiceBountyReceipt(input: {
  readonly receiptId: string;
  readonly manifestId: string;
  readonly idempotencyKey: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly requesterId: string;
  readonly providerId: string;
  readonly bountyId: string;
  readonly deliverableHash: string;
  readonly amount: ServiceBountyReceipt["amount"];
  readonly transactionDigest: string;
  readonly sponsorshipId: string;
  readonly now: Date;
}): ServiceBountyReceipt {
  const approved = approveServiceBountyReceipt(createServiceBountyReceipt({
    receiptId: input.receiptId,
    manifestId: input.manifestId,
    idempotencyKey: input.idempotencyKey,
    agentId: input.agentId,
    ownerId: input.ownerId,
    requesterId: input.requesterId,
    providerId: input.providerId,
    bountyId: input.bountyId,
    deliverableHash: input.deliverableHash,
    amount: input.amount,
    createdAt: input.now,
  }), { at: input.now });
  const sponsored = sponsorServiceBountyReceipt(approved, {
    at: input.now,
    sponsorshipId: input.sponsorshipId,
  });
  const submitted = submitServiceBountyReceipt(sponsored, {
    at: input.now,
    transactionDigest: input.transactionDigest,
  });
  const completed = completeServiceBountyReceipt(submitted, {
    at: input.now,
    completionProofHash: "sha256:completion",
  });
  return releaseServiceBountyReceipt(completed, {
    at: input.now,
    releaseProofHash: "sha256:release",
  });
}

function appendMarketplaceDiagnosticEvent(receipt: ServiceBountyReceipt, at: Date): ServiceBountyReceipt {
  return {
    ...receipt,
    events: [
      ...receipt.events,
      { type: "sponsored", at: at.toISOString(), reason: "private prompt Bearer abc.def.ghi" },
    ],
  };
}

function supportedTemplates(
  profile: AgentProfile | undefined,
  registry: ContractTemplateRegistry,
): MarketplaceProviderListing["supportedTemplates"] {
  const supported = new Set(profile?.supportedContracts?.map((contract) => contract.id) ?? []);
  const allTemplates = registry.templates.map(templateSummary);
  if (supported.size === 0) return allTemplates;
  return allTemplates.filter((template) => supported.has(template.templateId) || supported.has(templateIdAlias(template.templateId)));
}

function templateSummary(template: ContractTemplateMetadata): MarketplaceProviderListing["supportedTemplates"][number] {
  return {
    templateId: template.templateId,
    version: template.version,
    module: template.module,
    entryFunctions: template.entryFunctions,
    riskCategory: template.riskCategory,
    refundDisputeBehavior: template.refundDisputeBehavior,
  };
}

function stripStandardsMetadata(
  evidence: MarketplaceStandardsEvidence,
): Omit<MarketplaceStandardsEvidence, "metadata"> {
  return {
    protocol: evidence.protocol,
    status: evidence.status,
    referenceId: evidence.referenceId,
  };
}

function visibility(viewer: MarketplaceViewer): MarketplaceDisputeEvidenceBundle["visibility"] {
  if (viewer.role === "operator") return "operator";
  if (viewer.role === "reviewer") return "reviewer";
  return "party";
}

function pickString(record: Record<string, unknown>, key: string): Record<string, string> {
  const value = stringValue(record[key]);
  return value ? { [key]: value } : {};
}

function templateIdAlias(templateId: string): string {
  return templateId.replace(/_v(\d+)$/, ":v$1");
}

function isEscrowReceipt(receipt: MarketplaceReceipt): receipt is EscrowReceipt {
  return "escrow" in receipt;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function isString(value: string | undefined): value is string {
  return typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSecretKey(key: string): boolean {
  return /^(seed|mnemonic|privateKey|private_key|rawKeypair|raw_keypair|rawTransactionBytes|raw_transaction_bytes|userSignature|user_signature|sponsorKey|sponsor_key|appApiKey|app_api_key|bearerToken|bearer_token|paymentCredential|payment_credential|signerSecret|signer_secret|signerRef|signer_ref|walletId|wallet_id|credentialRefs|credential_refs|metadata|privatePrompt|private_prompt|prompt|paymentPayload|payment_payload)$/i.test(key);
}

function redactString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "[REDACTED]")
    .replace(/private prompt[^,.]*/gi, "[REDACTED]")
    .replace(/signer_ref[\w:-]*/gi, "[REDACTED]")
    .replace(/wallet_[\w:-]*/gi, "[REDACTED]")
    .replace(/payment-secret/gi, "[REDACTED]");
}

function responseLeaks(text: string): boolean {
  return /private prompt|Bearer abc|signer_ref|wallet_demo|payment-secret|secret provider|PRIVATE KEY|BEGIN PRIVATE/i.test(text);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validProfile(): AgentProfile {
  return {
    ...validAgentProfileFixture(),
    capabilities: [{
      id: "research.summary",
      contracts: ["escrow:v1"],
      scopes: ["contract:escrow"],
    }],
    endpoints: [
      { type: "mcp", url: "https://agent.example.test/mcp" },
      { type: "agent_card", url: "https://agent.example.test/.well-known/agent-card.json" },
    ],
    supportedContracts: [{ id: "escrow:v1" }],
  };
}
