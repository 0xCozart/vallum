import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkProductStatus,
  type ProductEvidenceCheck,
  type ProductStatusReport,
} from "./check-product-status.js";

export type LaunchReadinessStatus =
  | "proven-local"
  | "blocked-live"
  | "blocked-production"
  | "deferred-safety";

export interface LaunchReadinessArea {
  readonly id: string;
  readonly status: LaunchReadinessStatus;
  readonly claim: string;
  readonly evidencePaths: readonly string[];
  readonly commands: readonly string[];
  readonly blockerCodes: readonly string[];
  readonly next: string;
}

export interface LaunchReadinessReport {
  readonly launchReady: boolean;
  readonly localEvidenceOk: boolean;
  readonly areas: readonly LaunchReadinessArea[];
}

export interface LaunchReadinessOptions {
  readonly cwd?: string;
  readonly productStatus?: ProductStatusReport;
}

const AREA_DEFINITIONS = [
  {
    id: "phase-1-sponsored-policy-mvp",
    claim: "Agents can use local/mock signer-reference wallets, manifests, policy-gated sponsorship, MCP tools, escrow, and receipts without secret exposure, with a non-networked custody readiness gate for production signer/custody review.",
    evidencePaths: [
      "packages/accounts/src/index.ts",
      "scripts/check-custody-readiness.ts",
      "packages/manifest/src/validate.ts",
      "packages/policy-gateway/src/evaluatePolicy.ts",
      "packages/sdk/src/requestSponsoredAction.ts",
      "packages/mcp-server/src/tools.ts",
      "packages/receipts/src/index.ts",
      "contracts/escrow_v1/Move.toml",
      "contracts/receipt_v1/Move.toml",
      "examples/agent-escrow/agent-escrow-demo.ts",
      "docs/testnet-attempts.md",
      "scripts/check-gas-station-runtime-preflight.ts",
      "scripts/check-testnet-digest-proof.ts",
    ],
    commands: [
      "npm test",
      "npm run proof:custody-readiness",
      "npm run contracts:test",
      "npm run smoke:agent-escrow",
      "npm run proof:testnet-digest",
      "npm run proof:testnet-digest:live",
      "npm run gas-station:runtime-preflight",
      "npm run diagnose:gas-station",
      "npm run execute:testnet-demo",
      "npm run verify:local",
    ],
    productCheckIds: ["gas-station-runtime", "testnet-upstream"],
    fallbackStatus: "proven-local",
    next: "Keep live IOTA execution behind configured testnet readiness, passing upstream diagnostics, operator approval, and separate production custody review.",
  },
  {
    id: "phase-2-identity-and-vc",
    claim: "Agent profiles, local resolvers, mock-tested Names/Identity adapters, cache behavior, and VC trust policy are locally proven; configured live proof is still required.",
    evidencePaths: [
      "packages/registry/src/profileSchema.ts",
      "packages/registry/src/iotaNamesAdapter.ts",
      "packages/registry/src/iotaIdentityAdapter.ts",
      "scripts/write-live-proof-plan.ts",
      "scripts/smoke-iota-names-live.ts",
      "scripts/smoke-iota-identity-live.ts",
      "docs/agentic-gaskit/live-proof-status.md",
    ],
    commands: [
      "npm test",
      "npm run proof:live-status",
      "npm run live:write-proof-plan",
      "npm run smoke:iota-names-live",
      "npm run smoke:iota-identity-live",
    ],
    productCheckIds: [
      "testnet-readiness",
      "iota-names-live",
      "iota-identity-live",
      "vc-validation-live",
    ],
    fallbackStatus: "proven-local",
    next: "Provide remaining operator-owned Names, Identity, and VC trust-policy configuration, then run the opt-in live proof commands.",
  },
  {
    id: "phase-3-contract-workflows",
    claim: "Escrow, receipt, pay-per-call, data-license, service-bounty, reputation-receipt, and subscription workflows are locally proven; physical device access remains safety-gated.",
    evidencePaths: [
      "contracts/pay_per_call_v1/Move.toml",
      "contracts/data_license_v1/Move.toml",
      "contracts/service_bounty_v1/Move.toml",
      "contracts/reputation_receipt_v1/Move.toml",
      "contracts/subscription_v1/Move.toml",
      "docs/agentic-gaskit/device-access-safety-gate.md",
    ],
    commands: [
      "npm run contracts:test",
      "npm run smoke:paid-mcp-tool",
      "npm run smoke:data-license",
      "npm run smoke:service-bounty",
      "npm run smoke:reputation-receipt",
      "npm run smoke:subscription",
    ],
    productCheckIds: ["physical-device-access"],
    fallbackStatus: "proven-local",
    next: "Keep physical-device workflows deferred until a separate safety design is approved.",
  },
  {
    id: "phase-4-standards-bridges",
    claim: "x402, AP2, and A2A mappings are locally proven with fail-closed behavior, including a non-networked payment-provider readiness gate, a redacted payment-provider proof-plan writer, local A2A authenticated extended cards, local public JWKS serving, local static discovery bundle generation, local static discovery artifact writing and validation, local static discovery loopback host smoke, local static hosting review, streaming, push configuration, injected push delivery, opt-in push HTTP transport, callback URL admission hardening, callback host allowlisting, local retry/attempt observability, local durable attempt evidence, local delivery queueing, a local injected-transport worker, redacted structured public discovery/push/conformance report classification, and an opt-in public discovery/JWKS smoke; live payment/provider and public A2A proofs remain blocked unless accepted operator reports are configured.",
    evidencePaths: [
      "packages/standards/src/x402.ts",
      "packages/standards/src/ap2.ts",
      "packages/standards/src/a2a.ts",
      "packages/standards/src/a2aHttp.ts",
      "packages/standards/src/a2aNodeServer.ts",
      "packages/standards/src/a2aPush.ts",
      "scripts/check-payment-provider-readiness.ts",
      "scripts/check-a2a-public-readiness.ts",
      "scripts/smoke-a2a-static-discovery-local.ts",
      "docs/agentic-gaskit/a2a-public-readiness.md",
      "scripts/smoke-a2a-local-server.ts",
    ],
    commands: [
      "npm test",
      "npm run smoke:a2a-well-known",
      "npm run smoke:a2a-signed-card",
      "npm run smoke:a2a-task-message",
      "npm run smoke:a2a-http",
      "npm run smoke:a2a-local-server",
      "npm run smoke:a2a-static-discovery-local",
      "npm run payment:write-provider-proof-plan",
      "npm run proof:payment-provider-readiness",
      "npm run proof:a2a-public-readiness",
    ],
    productCheckIds: ["public-a2a-hosting", "live-payment-provider"],
    fallbackStatus: "proven-local",
    next: "Run dedicated public A2A hosting/conformance and live payment/provider proof slices, then configure ignored structured reports before external interoperability claims.",
  },
  {
    id: "phase-5-marketplace-operator",
    claim: "Marketplace evidence is local read-only proof for labels, policy compatibility, receipt access, and dispute bundles, with a non-networked production marketplace readiness gate; production marketplace remains blocked.",
    evidencePaths: [
      "packages/marketplace/src/index.ts",
      "scripts/smoke-marketplace-read-model.ts",
      "scripts/check-marketplace-readiness.ts",
      "docs/marketplace-readiness.md",
    ],
    commands: [
      "npm test",
      "npm run smoke:marketplace-read-model",
      "npm run proof:marketplace-readiness",
    ],
    productCheckIds: ["production-marketplace"],
    fallbackStatus: "proven-local",
    next: "Run marketplace readiness, then resolve provider verification, moderation, session/API auth, live settlement, dispute workflow, and operational gates before production marketplace work.",
  },
  {
    id: "phase-6-package-release",
    claim: "Packages are locally packable, installable from tarballs, dry-run publishable, and checked by a non-networked publication-readiness gate; registry publication remains operator-gated.",
    evidencePaths: [
      "docs/agentic-gaskit/package-release-strategy.md",
      "scripts/package-publish-dry-run.ts",
      "scripts/smoke-package-install.ts",
      "scripts/check-package-publication-readiness.ts",
      "scripts/package-publish.test.ts",
      "scripts/package-install-smoke.test.ts",
    ],
    commands: [
      "npm run pack:check",
      "npm run smoke:package-install",
      "npm run publish:dry-run",
      "npm run proof:package-publication-readiness",
    ],
    productCheckIds: ["npm-registry-publication"],
    fallbackStatus: "proven-local",
    next: "Run package publication readiness, then run a dedicated release slice with registry credentials, provenance decisions, 2FA handling, registry install proof, and rollback notes before publication claims.",
  },
  {
    id: "packet-h-final-product-status",
    claim: "Final product launch readiness is not complete while product-status reports live, production, publication, custody, payment, A2A, marketplace, or safety blockers.",
    evidencePaths: [
      "docs/agentic-gaskit/product-status.md",
      "scripts/check-product-status.ts",
      "docs/agentic-gaskit/operator-live-gates.md",
      "scripts/check-operator-live-gates.ts",
      "docs/agentic-gaskit/verification-profiles.md",
      "scripts/check-verification-profiles.ts",
      "docs/agentic-gaskit/execution-slices.md",
      "docs/CODEBASE_MAP.md",
    ],
    commands: [
      "npm run verify:fast",
      "npm run proof:verification-profiles",
      "npm run proof:product-status",
      "npm run proof:launch-readiness",
      "npm run proof:operator-gates",
      "npm run verify:local",
    ],
    productCheckIds: [
      "testnet-readiness",
      "gas-station-runtime",
      "testnet-upstream",
      "npm-registry-publication",
      "public-a2a-hosting",
      "live-payment-provider",
      "production-marketplace",
      "production-custody",
      "physical-device-access",
    ],
    fallbackStatus: "proven-local",
    next: "Keep the goal active until live/operator-approved blockers are proven or explicitly accepted as out of scope by the owner.",
  },
] as const;

export async function checkLaunchReadiness(
  options: LaunchReadinessOptions = {},
): Promise<LaunchReadinessReport> {
  const cwd = options.cwd ?? process.cwd();
  const productStatus = options.productStatus ?? await checkProductStatus({ cwd });
  const areas = await Promise.all(AREA_DEFINITIONS.map((area) => buildArea(cwd, productStatus, area)));
  const localEvidenceOk = productStatus.localProofOk
    && areas.every((area) => !area.blockerCodes.some((code) => code.startsWith("EVIDENCE_PATH_MISSING:")));

  return {
    launchReady: localEvidenceOk && productStatus.complete && areas.every((area) => area.status === "proven-local"),
    localEvidenceOk,
    areas,
  };
}

export function formatLaunchReadinessReport(report: LaunchReadinessReport): string {
  const lines = [
    `Agentic GasKit launch readiness ${report.launchReady ? "ready" : "not-ready"}`,
    `localEvidenceOk=${report.localEvidenceOk}`,
    `launchReady=${report.launchReady}`,
  ];
  for (const area of report.areas) {
    lines.push(`${area.status}: ${area.id}`);
    lines.push(`claim=${area.claim}`);
    lines.push(`evidencePaths=${area.evidencePaths.join(",")}`);
    lines.push(`commands=${area.commands.join(",")}`);
    if (area.blockerCodes.length > 0) lines.push(`blockers=${area.blockerCodes.join(",")}`);
    lines.push(`next=${area.next}`);
  }
  return lines.join("\n");
}

async function buildArea(
  cwd: string,
  productStatus: ProductStatusReport,
  definition: typeof AREA_DEFINITIONS[number],
): Promise<LaunchReadinessArea> {
  const missingPaths = await missingEvidencePaths(cwd, definition.evidencePaths);
  const checks = definition.productCheckIds
    .map((id) => productStatus.checks.find((check) => check.id === id))
    .filter((check): check is ProductEvidenceCheck => Boolean(check));
  const productBlockers = checks
    .filter((check) => check.status !== "proven-local" && check.status !== "ready-live")
    .map((check) => check.code);
  const blockerCodes = [
    ...missingPaths.map((path) => `EVIDENCE_PATH_MISSING:${path}`),
    ...productBlockers,
  ];

  return {
    id: definition.id,
    status: missingPaths.length > 0
      ? "blocked-production"
      : strongestStatus(checks, definition.fallbackStatus),
    claim: definition.claim,
    evidencePaths: definition.evidencePaths,
    commands: definition.commands,
    blockerCodes,
    next: definition.next,
  };
}

async function missingEvidencePaths(cwd: string, paths: readonly string[]): Promise<string[]> {
  const missing: string[] = [];
  for (const path of paths) {
    try {
      await access(resolve(cwd, path));
    } catch {
      missing.push(path);
    }
  }
  return missing;
}

function strongestStatus(
  checks: readonly ProductEvidenceCheck[],
  fallbackStatus: LaunchReadinessStatus,
): LaunchReadinessStatus {
  if (checks.some((check) => check.status === "deferred-safety")) return "deferred-safety";
  if (checks.some((check) => check.status === "blocked-production")) return "blocked-production";
  if (checks.some((check) => check.status === "blocked-live")) return "blocked-live";
  return fallbackStatus;
}

async function main(): Promise<number> {
  const report = await checkLaunchReadiness();
  console.log(formatLaunchReadinessReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
