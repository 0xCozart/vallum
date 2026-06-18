import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { collectPublishablePackages } from "./package-publish-dry-run.js";

export type OperatorReportTemplateKind =
  | "testnet-upstream"
  | "testnet-digest"
  | "iota-names-live"
  | "iota-identity-live"
  | "vc-validation-live"
  | "a2a-public-discovery"
  | "a2a-public-push-delivery"
  | "a2a-external-conformance"
  | "payment-provider-live"
  | "package-publication"
  | "marketplace-production"
  | "custody-production"
  | "device-access-safety";

export interface OperatorReportTemplate {
  readonly schemaVersion: 1;
  readonly kind: string;
  readonly result: "pending-operator-proof";
  readonly observedAt: string;
  readonly templateGeneratedAt: string;
  readonly checks?: readonly string[];
  readonly notes: readonly string[];
  readonly [key: string]: unknown;
}

export interface WriteOperatorReportTemplateOptions {
  readonly cwd?: string;
  readonly kind: OperatorReportTemplateKind;
  readonly now?: Date;
  readonly outFile?: string;
  readonly publicBaseUrl?: string;
  readonly publicAgentCardUrl?: string;
  readonly publicJwksUrl?: string;
  readonly taskAuthDecision?: "bearer" | "oauth2" | "mtls";
  readonly environment?: "testnet" | "production";
  readonly custodyMode?: "external-signer" | "kms";
  readonly deviceAccessMode?: "physical-approved";
}

interface CliOptions {
  readonly help: boolean;
  readonly kind?: OperatorReportTemplateKind;
  readonly outFile?: string;
  readonly observedAt?: string;
  readonly publicBaseUrl?: string;
  readonly publicAgentCardUrl?: string;
  readonly publicJwksUrl?: string;
  readonly taskAuthDecision?: "bearer" | "oauth2" | "mtls";
  readonly environment?: "testnet" | "production";
  readonly custodyMode?: "external-signer" | "kms";
  readonly deviceAccessMode?: "physical-approved";
}

const RESULT = "pending-operator-proof" as const;
const COMMON_NOTES = [
  "Template only. Replace result with passed only after a dedicated operator-approved proof run succeeds.",
  "Keep the completed report in an ignored local path and point the matching environment variable at that path.",
  "Do not include raw request or response bodies, authorization material, signer material, payment instruments, local paths to sensitive files, or account recovery material.",
] as const;

const TESTNET_UPSTREAM_NOTES = [
  ...COMMON_NOTES,
  "The --skip-reserve diagnostic is reachability triage only; it cannot clear reserve_gas compatibility, sponsored execution, or testnet-upstream readiness.",
] as const;

const TESTNET_UPSTREAM_CHECKS = [
  "managed-or-local-runtime-selection",
  "iota-rpc-json-rpc",
  "gas-station-root-or-health",
  "sponsor-funding-readiness",
  "reserve-gas-compatibility",
  "redaction-review",
] as const;

const TESTNET_DIGEST_NOTES = [
  ...COMMON_NOTES,
  "This template is not accepted as passing digest evidence; run the live digest proof command with --report to write the accepted report shape.",
  "The live digest proof command performs a read-only IOTA RPC lookup of a documented public digest; it does not sign, reserve gas, execute transactions, or spend sponsor gas.",
] as const;

const TESTNET_DIGEST_CHECKS = [
  "documented-digest-present",
  "read-only-live-lookup",
  "successful-effects-status",
  "fresh-observation-time",
  "redaction-review",
] as const;

const IOTA_NAMES_NOTES = [
  ...COMMON_NOTES,
  "This template is not accepted as passing IOTA Names evidence; run the live names smoke command with --report to write the accepted report shape.",
  "The live names smoke contacts the configured IOTA Names endpoint and must not print endpoint values, names, full addresses, raw responses, or local report paths.",
] as const;

const IOTA_NAMES_CHECKS = [
  "endpoint-safety",
  "name-resolution",
  "expected-address-match",
  "fresh-observation-time",
  "redaction-review",
] as const;

const IOTA_IDENTITY_NOTES = [
  ...COMMON_NOTES,
  "This template is not accepted as passing IOTA Identity evidence; run the live identity smoke command with --report to write the accepted report shape.",
  "The live identity smoke contacts the configured proof endpoint and must not print endpoint values, profile paths, DIDs, credential refs, proof bodies, or local report paths.",
] as const;

const IOTA_IDENTITY_CHECKS = [
  "endpoint-safety",
  "agent-profile-validation",
  "did-resolution",
  "credential-evidence-validation",
  "revocation-and-expiry-review",
  "redaction-review",
] as const;

const VC_VALIDATION_NOTES = [
  ...COMMON_NOTES,
  "VC validation live evidence uses the accepted IOTA Identity live smoke report plus trust-policy configuration; this template is not accepted as passing evidence.",
  "The accepted report must prove credential evidence was checked and must not include endpoint values, profile paths, DIDs, credential refs, proof bodies, or local report paths.",
] as const;

const VC_VALIDATION_CHECKS = [
  "trusted-issuer-policy",
  "allowed-verification-methods",
  "required-credential-types",
  "credential-status-revocation",
  "credential-cache-ttl",
  "credential-evidence-present",
  "redaction-review",
] as const;

const PAYMENT_CHECKS = [
  "x402-verify",
  "x402-settle",
  "x402-payment-response",
  "ap2-mandate-chain",
  "ap2-checkout-receipt",
  "ap2-payment-receipt",
  "ap2-accountability-review",
  "redaction-review",
] as const;

const PACKAGE_CHECKS = [
  "npm-pack-dry-run",
  "local-tarball-install",
  "npm-publish-dry-run",
  "npm-registry-paid-mcp-consumer",
  "npm-registry-mcp-stdio-consumer",
  "registry-install",
  "provenance-review",
  "rollback-review",
] as const;

const MARKETPLACE_CHECKS = [
  "provider-onboarding-review",
  "provider-verification-review",
  "provider-capability-review",
  "moderation-abuse-review",
  "session-auth-review",
  "receipt-access-review",
  "payment-settlement-review",
  "settlement-reconciliation-review",
  "dispute-workflow-review",
  "operations-incident-review",
  "incident-response-review",
  "redaction-review",
] as const;

const CUSTODY_CHECKS = [
  "signer-reference-contract-review",
  "no-agent-secret-exposure-review",
  "kms-external-signer-review",
  "cryptographic-module-validation-review",
  "operator-access-review",
  "key-lifecycle-review",
  "recovery-export-review",
  "backup-restore-review",
  "rotation-revocation-review",
  "audit-logging-review",
  "legal-security-review",
  "incident-response-review",
  "redaction-review",
] as const;

const DEVICE_ACCESS_SAFETY_CHECKS = [
  "device-class-hazard-analysis",
  "provider-accountability-review",
  "requester-authorization-review",
  "revocation-emergency-stop-review",
  "network-failure-expiry-review",
  "audit-privacy-review",
  "dispute-incident-response-review",
  "credential-storage-rotation-review",
  "no-real-world-motion-test-path-review",
  "legal-regulatory-review",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-operator-report-template.ts --kind <kind> [--out <path>]

Writes a non-networked redacted JSON template for operator-owned structured reports.
The template remains result=pending-operator-proof until a real approved proof run fills it in.

kinds:
  testnet-upstream
  testnet-digest
  iota-names-live
  iota-identity-live
  vc-validation-live
  a2a-public-discovery
  a2a-public-push-delivery
  a2a-external-conformance
  payment-provider-live
  package-publication
  marketplace-production
  custody-production
  device-access-safety`;

export async function writeOperatorReportTemplate(
  options: WriteOperatorReportTemplateOptions,
): Promise<OperatorReportTemplate> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const template = await buildOperatorReportTemplate({ ...options, cwd, now });

  if (options.outFile) {
    const outFile = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, `${formatOperatorReportTemplate(template)}\n`, { mode: 0o600 });
  }

  return template;
}

export async function buildOperatorReportTemplate(
  options: WriteOperatorReportTemplateOptions,
): Promise<OperatorReportTemplate> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const observedAt = now.toISOString();
  const base = {
    schemaVersion: 1 as const,
    result: RESULT,
    observedAt,
    templateGeneratedAt: observedAt,
    notes: COMMON_NOTES,
  } satisfies Omit<OperatorReportTemplate, "kind">;

  switch (options.kind) {
    case "testnet-upstream":
      return {
        ...base,
        kind: "vallum.testnet-upstream-proof-template",
        diagnosticReportKind: "vallum.testnet-upstream-diagnostic",
        acceptedReportEnv: "VALLUM_TESTNET_UPSTREAM_REPORT",
        sponsorFundingReportEnv: "VALLUM_SPONSOR_FUNDING_REPORT",
        runtimeModeEnv: "VALLUM_GAS_STATION_RUNTIME_MODE",
        supportedRuntimeModes: ["local-docker", "managed-upstream"],
        requiredEnv: [
          "IOTA_RPC_URL",
          "GAS_STATION_URL",
          "GAS_STATION_BEARER_TOKEN",
        ],
        commands: [
          "npm run gas-station:runtime-preflight",
          "npm run gas-station:docker-direct -- --status",
          "npm run sponsor:write-funding-request -- --out tmp/vallum/sponsor-funding-request.json",
          "npm run sponsor:request-faucet-funds -- --execute --out tmp/vallum/sponsor-faucet-request.json",
          "npm run sponsor:check-funding -- --report tmp/vallum/sponsor-funding-report.json",
          "npm run diagnose:gas-station -- --skip-reserve --report <ignored-json-path>",
          "npm run diagnose:gas-station -- --report <ignored-json-path>",
          "npm run proof:live-status",
          "npm run execute:testnet-demo",
        ],
        checks: TESTNET_UPSTREAM_CHECKS,
        notes: TESTNET_UPSTREAM_NOTES,
      };
    case "testnet-digest":
      return {
        ...base,
        kind: "vallum.testnet-digest-proof-template",
        acceptedReportKind: "vallum.testnet-digest-proof-report",
        acceptedReportEnv: "VALLUM_TESTNET_DIGEST_REPORT",
        requiredEnv: [
          "IOTA_RPC_URL",
        ],
        commands: [
          "npm run proof:testnet-digest",
          "npm run proof:testnet-digest:live -- --report tmp/vallum/testnet-digest-proof.json",
          "npm run proof:live-status",
          "npm run proof:product-status",
          "npm run proof:operator-gates",
        ],
        checks: TESTNET_DIGEST_CHECKS,
        notes: TESTNET_DIGEST_NOTES,
      };
    case "iota-names-live":
      return {
        ...base,
        kind: "vallum.iota-names-live-smoke-template",
        acceptedReportKind: "vallum.iota-names-live-smoke-report",
        acceptedReportEnv: "IOTA_NAMES_LIVE_REPORT",
        requiredEnv: [
          "IOTA_NAMES_GRAPHQL_URL",
          "IOTA_NAMES_NAME",
          "IOTA_NAMES_EXPECTED_ADDRESS",
        ],
        commands: [
          "npm run live:write-proof-plan",
          "npm run smoke:iota-names-live -- --report tmp/vallum/iota-names-live-report.json",
          "npm run proof:live-status",
          "npm run proof:product-status",
          "npm run proof:operator-gates",
        ],
        checks: IOTA_NAMES_CHECKS,
        notes: IOTA_NAMES_NOTES,
      };
    case "iota-identity-live":
      return {
        ...base,
        kind: "vallum.iota-identity-live-smoke-template",
        acceptedReportKind: "vallum.iota-identity-live-smoke-report",
        acceptedReportEnv: "IOTA_IDENTITY_LIVE_REPORT",
        requiredEnv: [
          "IOTA_IDENTITY_PROOF_ENDPOINT",
          "IOTA_IDENTITY_PROFILE_PATH",
          "IOTA_IDENTITY_TRUSTED_ISSUER_DIDS",
          "IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS",
          "IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES",
          "IOTA_IDENTITY_ACCEPTED_STATUS_TYPES",
          "IOTA_IDENTITY_CACHE_TTL_MS",
        ],
        commands: [
          "npm run live:write-proof-plan",
          "npm run smoke:iota-identity-live -- --report tmp/vallum/iota-identity-live-report.json",
          "npm run proof:live-status",
          "npm run proof:product-status",
          "npm run proof:operator-gates",
        ],
        checks: IOTA_IDENTITY_CHECKS,
        notes: IOTA_IDENTITY_NOTES,
      };
    case "vc-validation-live":
      return {
        ...base,
        kind: "vallum.vc-validation-live-template",
        acceptedReportKind: "vallum.iota-identity-live-smoke-report",
        acceptedReportEnv: "IOTA_IDENTITY_LIVE_REPORT",
        requiredEnv: [
          "IOTA_IDENTITY_TRUSTED_ISSUER_DIDS",
          "IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS",
          "IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES",
          "IOTA_IDENTITY_ACCEPTED_STATUS_TYPES",
          "IOTA_IDENTITY_CACHE_TTL_MS",
          "IOTA_IDENTITY_PROOF_ENDPOINT",
          "IOTA_IDENTITY_PROFILE_PATH",
        ],
        commands: [
          "npm run live:write-proof-plan",
          "npm run smoke:iota-identity-live -- --report tmp/vallum/iota-identity-live-report.json",
          "npm run proof:live-status",
          "npm run proof:product-status",
          "npm run proof:operator-gates",
        ],
        checks: VC_VALIDATION_CHECKS,
        notes: VC_VALIDATION_NOTES,
      };
    case "a2a-public-discovery":
      return stripUndefined({
        ...base,
        kind: "a2a-public-discovery",
        publicBaseUrl: options.publicBaseUrl,
        publicAgentCardUrl: options.publicAgentCardUrl,
        publicJwksUrl: options.publicJwksUrl,
        taskAuthDecision: options.taskAuthDecision,
      });
    case "a2a-public-push-delivery":
      return stripUndefined({
        ...base,
        kind: "a2a-public-push-delivery",
        publicBaseUrl: options.publicBaseUrl,
      });
    case "a2a-external-conformance":
      return stripUndefined({
        ...base,
        kind: "a2a-external-conformance",
        publicBaseUrl: options.publicBaseUrl,
        publicAgentCardUrl: options.publicAgentCardUrl,
        acceptedReportEnv: "A2A_EXTERNAL_CONFORMANCE_REPORT",
        acceptedRunners: ["vallum-public-task-route-smoke", "a2a-tck"],
        checks: ["agent-card", "message-send", "official-a2a-tck", "http-json-must", "redaction-review"],
        tckCompatibility: {
          reportFormat: "a2a-tck reports/compatibility.json summary",
          requiredTransport: "HTTP+JSON",
          requiredMustCompatibility: "100.0%",
          requiredMustRequirements: ["CORE-SEND-001", "CORE-SEND-003"],
          forbiddenFields: ["authorization", "bearerToken", "credentials", "requestBody", "responseBody"],
        },
      });
    case "payment-provider-live":
      return {
        ...base,
        kind: "vallum.payment-provider-live-proof",
        environment: options.environment ?? "testnet",
        providerKinds: ["x402", "ap2"],
        checks: PAYMENT_CHECKS,
        x402Proof: {
          facilitator: "provider-reviewed-redacted",
          verifyResult: "pending",
          settleResult: "pending",
          paymentResponse: "pending",
        },
        ap2Proof: {
          mandateChain: "pending",
          checkoutReceipt: "pending",
          paymentReceipt: "pending",
          accountabilityReview: "pending",
        },
      };
    case "package-publication":
      return {
        ...base,
        kind: "vallum.package-publication-proof",
        registry: "npm",
        packageNames: (await collectPublishablePackages(cwd)).map((packageInfo) => packageInfo.name),
        checks: PACKAGE_CHECKS,
      };
    case "marketplace-production":
      return {
        ...base,
        kind: "vallum.marketplace-production-proof",
        environment: options.environment ?? "testnet",
        checks: MARKETPLACE_CHECKS,
        providerReview: {
          onboarding: "pending",
          verification: "pending",
          capabilityReview: "pending",
        },
        moderationReview: {
          abuseControls: "pending",
          escalationPath: "pending",
          redaction: "pending",
        },
        accessReview: {
          apiAccess: "pending",
          receiptAccess: "pending",
          leastPrivilege: "pending",
        },
        settlementReview: {
          paymentSettlement: "pending",
          reconciliation: "pending",
        },
        disputeReview: {
          workflow: "pending",
          evidencePack: "pending",
        },
        operationsReview: {
          incidentRunbook: "pending",
          monitoring: "pending",
          rollback: "pending",
        },
      };
    case "custody-production":
      return {
        ...base,
        kind: "vallum.custody-production-proof",
        custodyMode: options.custodyMode ?? "external-signer",
        checks: CUSTODY_CHECKS,
        signerReferenceReview: {
          scopedHandles: "pending",
          nonBearer: "pending",
          policyBoundary: "pending",
        },
        custodyControlReview: {
          providerMode: "pending",
          moduleValidation: "pending",
          operatorAccess: "pending",
        },
        lifecycleReview: {
          generation: "pending",
          rotation: "pending",
          revocation: "pending",
          destruction: "pending",
        },
        recoveryReview: {
          backupPlan: "pending",
          restoreDrill: "pending",
          exportControls: "pending",
          zeroization: "pending",
        },
        auditReview: {
          accessLogs: "pending",
          operationLogs: "pending",
          retention: "pending",
        },
        incidentReview: {
          detection: "pending",
          response: "pending",
          recovery: "pending",
        },
        complianceReview: {
          legalSecurity: "pending",
          redaction: "pending",
          segregation: "pending",
        },
      };
    case "device-access-safety":
      return {
        ...base,
        kind: "vallum.device-access-safety-proof",
        deviceAccessMode: options.deviceAccessMode ?? "physical-approved",
        checks: DEVICE_ACCESS_SAFETY_CHECKS,
        hazardReview: {
          deviceClass: "pending",
          hazardAnalysis: "pending",
          safetyBoundary: "pending",
        },
        accountabilityReview: {
          providerIdentity: "pending",
          providerLiability: "pending",
          operatorOwnership: "pending",
        },
        authorizationReview: {
          requesterAuthorization: "pending",
          leastPrivilege: "pending",
          humanApproval: "pending",
        },
        revocationReview: {
          revocation: "pending",
          emergencyStop: "pending",
          failClosed: "pending",
        },
        expiryReview: {
          leaseExpiry: "pending",
          networkFailure: "pending",
          clockSkew: "pending",
        },
        auditPrivacyReview: {
          auditRetention: "pending",
          privacyMinimization: "pending",
          accessLogs: "pending",
        },
        incidentReview: {
          disputeProcess: "pending",
          incidentResponse: "pending",
          escalationPath: "pending",
        },
        credentialReview: {
          storage: "pending",
          rotation: "pending",
          revocation: "pending",
        },
        proofPathReview: {
          simulatedOnly: "pending",
          noRealWorldMotion: "pending",
          testIsolation: "pending",
        },
        legalReview: {
          regulatoryOwner: "pending",
          jurisdiction: "pending",
          terms: "pending",
        },
      };
  }
}

export function formatOperatorReportTemplate(template: OperatorReportTemplate): string {
  return JSON.stringify(template, null, 2);
}

function stripUndefined(value: Record<string, unknown>): OperatorReportTemplate {
  return Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== undefined)) as OperatorReportTemplate;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: {
    help: boolean;
    kind?: OperatorReportTemplateKind;
    outFile?: string;
    observedAt?: string;
    publicBaseUrl?: string;
    publicAgentCardUrl?: string;
    publicJwksUrl?: string;
    taskAuthDecision?: "bearer" | "oauth2" | "mtls";
    environment?: "testnet" | "production";
    custodyMode?: "external-signer" | "kms";
  } = { help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--kind") {
      options.kind = parseKind(readArg(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--out") {
      options.outFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--observed-at") {
      options.observedAt = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--public-base-url") {
      options.publicBaseUrl = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--public-agent-card-url") {
      options.publicAgentCardUrl = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--public-jwks-url") {
      options.publicJwksUrl = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--task-auth-decision") {
      options.taskAuthDecision = parseTaskAuthDecision(readArg(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--environment") {
      options.environment = parseEnvironment(readArg(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--custody-mode") {
      options.custodyMode = parseCustodyMode(readArg(argv, index, arg));
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function readArg(argv: readonly string[], index: number, name: string): string {
  const value = argv[index + 1];
  if (!value) throw new Error(`${name} requires a value.`);
  return value;
}

function parseKind(value: string): OperatorReportTemplateKind {
  const allowed = new Set<OperatorReportTemplateKind>([
    "testnet-upstream",
    "testnet-digest",
    "iota-names-live",
    "iota-identity-live",
    "vc-validation-live",
    "a2a-public-discovery",
    "a2a-public-push-delivery",
    "a2a-external-conformance",
    "payment-provider-live",
    "package-publication",
    "marketplace-production",
    "custody-production",
    "device-access-safety",
  ]);
  if (!allowed.has(value as OperatorReportTemplateKind)) {
    throw new Error(`Unsupported report template kind: ${value}`);
  }
  return value as OperatorReportTemplateKind;
}

function parseTaskAuthDecision(value: string): "bearer" | "oauth2" | "mtls" {
  if (value !== "bearer" && value !== "oauth2" && value !== "mtls") {
    throw new Error("--task-auth-decision must be bearer, oauth2, or mtls.");
  }
  return value;
}

function parseEnvironment(value: string): "testnet" | "production" {
  if (value !== "testnet" && value !== "production") {
    throw new Error("--environment must be testnet or production.");
  }
  return value;
}

function parseCustodyMode(value: string): "external-signer" | "kms" {
  if (value !== "external-signer" && value !== "kms") {
    throw new Error("--custody-mode must be external-signer or kms.");
  }
  return value;
}

async function main(): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid arguments.");
    return 2;
  }

  if (options.help) {
    console.log(usage);
    return 0;
  }

  if (!options.kind) {
    console.error("--kind is required.");
    return 2;
  }

  const now = options.observedAt ? new Date(options.observedAt) : new Date();
  if (Number.isNaN(now.getTime())) {
    console.error("--observed-at must be a valid date.");
    return 2;
  }

  const template = await writeOperatorReportTemplate({
    kind: options.kind,
    now,
    outFile: options.outFile,
    publicBaseUrl: options.publicBaseUrl,
    publicAgentCardUrl: options.publicAgentCardUrl,
    publicJwksUrl: options.publicJwksUrl,
    taskAuthDecision: options.taskAuthDecision,
    environment: options.environment,
    custodyMode: options.custodyMode,
  });
  console.log(formatOperatorReportTemplate(template));
  if (options.outFile) console.log("wroteTemplate=true");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
