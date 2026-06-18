import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
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

export interface LaunchReadinessArtifact {
  readonly schemaVersion: 1;
  readonly kind: "vallum.launch-readiness-report";
  readonly generatedAt: string;
  readonly launchReady: boolean;
  readonly localEvidenceOk: boolean;
  readonly provenLocalAreaIds: readonly string[];
  readonly blockedLiveAreaIds: readonly string[];
  readonly blockedProductionAreaIds: readonly string[];
  readonly deferredSafetyAreaIds: readonly string[];
  readonly blockerCodes: readonly string[];
  readonly areas: readonly LaunchReadinessArea[];
  readonly boundaries: readonly string[];
}

export interface LaunchReadinessOptions {
  readonly cwd?: string;
  readonly productStatus?: ProductStatusReport;
}

export interface WriteLaunchReadinessArtifactOptions extends LaunchReadinessOptions {
  readonly now?: Date;
  readonly outFile?: string;
}

const ARTIFACT_BOUNDARIES = [
  "This report is non-networked and does not run live proof commands.",
  "launchReady=false means at least one live, production, publication, custody, payment, marketplace, A2A, or safety gate remains blocked.",
  "Do not commit generated reports, live proof artifacts, credentials, tokens, private keys, raw transaction bytes, user signatures, response bodies, endpoint values, profile paths, full sponsor addresses, or secret local paths.",
  "Launch readiness requires product status completion plus local evidence; this artifact does not replace operator-approved live or production proof.",
] as const;

const usage = `usage: npm exec tsx -- scripts/check-launch-readiness.ts [--json] [--out <path>]

Reports current Vallum launch readiness without contacting live proof services.

Options:
  --json        Print a redacted machine-readable artifact.
  --out <path>  Write the same JSON artifact to a local file with mode 0600.
  --help        Show this help text.
`;

const AREA_DEFINITIONS = [
  {
    id: "phase-1-sponsored-policy-mvp",
    claim: "Agents can use local/mock signer-reference wallets, manifests, policy-gated sponsorship, MCP tools, escrow, and receipts without secret exposure, with a non-networked custody readiness gate, redacted custody production proof-plan writer, and redacted custody production proof-bundle writer for production signer/custody review.",
    evidencePaths: [
      "packages/accounts/src/index.ts",
      "scripts/check-custody-readiness.ts",
      "scripts/write-custody-production-proof-plan.ts",
      "scripts/write-custody-production-proof-bundle.ts",
      "packages/manifest/src/validate.ts",
      "packages/policy-gateway/src/evaluatePolicy.ts",
      "packages/sdk/src/requestSponsoredAction.ts",
      "packages/mcp-server/src/tools.ts",
      "packages/receipts/src/index.ts",
      "contracts/escrow_v1/Move.toml",
      "contracts/receipt_v1/Move.toml",
      "examples/agent-escrow/agent-escrow-demo.ts",
      "docs/testnet-attempts.md",
      "docs/vallum/live-proof-status.md",
      "scripts/check-gas-station-runtime-preflight.ts",
      "scripts/write-sponsor-funding-request.ts",
      "scripts/request-sponsor-faucet-funds.ts",
      "scripts/check-sponsor-funding.ts",
      "scripts/check-testnet-digest-proof.ts",
    ],
    commands: [
      "npm test",
      "npm run operator:write-report-template -- --kind custody-production --out tmp/vallum/custody-production-report-template.json",
      "npm run custody:write-production-proof-bundle -- --out tmp/vallum/custody-production-proof-bundle.json",
      "npm run custody:write-production-proof-plan",
      "npm run proof:custody-readiness",
      "npm run contracts:test",
      "npm run smoke:agent-escrow",
      "npm run proof:testnet-digest",
      "npm run operator:write-report-template -- --kind testnet-digest --out tmp/vallum/testnet-digest-report-template.json",
      "npm run proof:testnet-digest:live -- --report tmp/vallum/testnet-digest-proof.json",
      "npm run gas-station:runtime-preflight",
      "npm run sponsor:write-funding-request -- --out tmp/vallum/sponsor-funding-request.json",
      "npm run sponsor:request-faucet-funds -- --execute --out tmp/vallum/sponsor-faucet-request.json",
      "npm run sponsor:write-funding-request -- --faucet-report tmp/vallum/sponsor-faucet-request.json --out tmp/vallum/sponsor-funding-request.json",
      "npm run proof:live-status",
      "npm run sponsor:check-funding -- --report tmp/vallum/sponsor-funding-report.json",
      "npm run operator:write-report-template -- --kind testnet-upstream --out tmp/vallum/testnet-upstream-report-template.json",
      "npm run diagnose:gas-station -- --skip-reserve --report tmp/vallum/testnet-upstream-diagnostic.json",
      "npm run diagnose:gas-station -- --report tmp/vallum/testnet-upstream-diagnostic.json",
      "npm run execute:testnet-demo",
      "npm run verify:local",
    ],
    productCheckIds: ["gas-station-runtime", "sponsor-funding", "testnet-upstream", "testnet-sponsored-execute"],
    fallbackStatus: "proven-local",
    next: "Use the ignored sponsor funding request plus any bounded faucet context to fund the sponsor, rerun sponsor funding, then run the full upstream diagnostic only after funding is ready.",
    readyNext: "Fresh sponsor funding, upstream reserve compatibility, and sponsored testnet execute proof are documented; keep the public digest current when rerunning live proof.",
  },
  {
    id: "phase-2-identity-and-vc",
    claim: "Agent profiles, local resolvers, mock-tested Names/Identity adapters, cache behavior, and VC trust policy are locally proven; configured live proof is still required.",
    evidencePaths: [
      "packages/registry/src/profileSchema.ts",
      "packages/registry/src/iotaNamesAdapter.ts",
      "packages/registry/src/iotaIdentityAdapter.ts",
      "scripts/write-live-proof-plan.ts",
      "scripts/write-identity-proof-bundle.ts",
      "scripts/smoke-iota-names-live.ts",
      "scripts/smoke-iota-identity-live.ts",
      "docs/vallum/live-proof-status.md",
    ],
    commands: [
      "npm test",
      "npm run proof:live-status",
      "npm run live:write-proof-plan",
      "npm run live:write-identity-proof-bundle -- --out tmp/vallum/identity-proof-bundle.json",
      "npm run operator:write-report-template -- --kind iota-names-live --out tmp/vallum/iota-names-live-report-template.json",
      "npm run smoke:iota-names-live -- --report tmp/vallum/iota-names-live-report.json",
      "npm run operator:write-report-template -- --kind iota-identity-live --out tmp/vallum/iota-identity-live-report-template.json",
      "npm run smoke:iota-identity-live -- --report tmp/vallum/iota-identity-live-report.json",
      "npm run operator:write-report-template -- --kind vc-validation-live --out tmp/vallum/vc-validation-live-report-template.json",
    ],
    productCheckIds: [
      "testnet-readiness",
      "iota-names-live",
      "iota-identity-live",
      "vc-validation-live",
    ],
    fallbackStatus: "proven-local",
    next: "Run npm run live:write-identity-proof-bundle -- --out tmp/vallum/identity-proof-bundle.json, provide remaining operator-owned Names, Identity, and VC trust-policy configuration outside committed files, then run the opt-in live proof commands.",
  },
  {
    id: "phase-3-contract-workflows",
    claim: "Escrow, receipt, pay-per-call, data-license, service-bounty, reputation-receipt, and subscription workflows are locally proven; physical device access remains safety-gated behind a non-networked readiness gate, proof-plan writer, and proof-bundle writer.",
    evidencePaths: [
      "contracts/pay_per_call_v1/Move.toml",
      "contracts/data_license_v1/Move.toml",
      "contracts/service_bounty_v1/Move.toml",
      "contracts/reputation_receipt_v1/Move.toml",
      "contracts/subscription_v1/Move.toml",
      "docs/vallum/device-access-safety-gate.md",
      "scripts/check-device-access-safety-readiness.ts",
      "scripts/write-device-access-safety-proof-plan.ts",
      "scripts/write-device-access-safety-proof-bundle.ts",
    ],
    commands: [
      "npm run contracts:test",
      "npm run smoke:paid-mcp-tool",
      "npm run smoke:data-license",
      "npm run smoke:service-bounty",
      "npm run smoke:reputation-receipt",
      "npm run smoke:subscription",
      "npm run operator:write-report-template -- --kind device-access-safety --out tmp/vallum/device-access-safety-report-template.json",
      "npm run device-access:write-safety-proof-bundle -- --out tmp/vallum/device-access-safety-proof-bundle.json",
      "npm run device-access:write-safety-proof-plan",
      "npm run proof:device-access-safety-readiness",
    ],
    productCheckIds: ["physical-device-access"],
    fallbackStatus: "proven-local",
    next: "Run npm run device-access:write-safety-proof-bundle -- --out <ignored-json-path>, then keep physical-device workflows deferred until a separate owner-approved safety design and structured report exist.",
  },
  {
    id: "phase-4-standards-bridges",
    claim: "x402, AP2, and A2A mappings are locally proven with fail-closed behavior, including a non-networked payment-provider readiness gate, a redacted payment-provider proof-plan writer, a redacted payment-provider proof-bundle writer, local A2A authenticated extended cards, local public JWKS serving, local static discovery bundle generation, local static discovery artifact writing and validation, local static discovery loopback host smoke, local static hosting review, streaming, push configuration, injected push delivery, opt-in push HTTP transport, callback URL admission hardening, callback host allowlisting, local retry/attempt observability, local durable attempt evidence, local delivery queueing, a local injected-transport worker, redacted structured public discovery/push/conformance report classification, an opt-in public discovery/JWKS smoke, an opt-in public push delivery smoke, and an opt-in external conformance smoke; live payment/provider and public A2A proofs remain blocked unless accepted operator reports are configured.",
    evidencePaths: [
      "packages/standards/src/x402.ts",
      "packages/standards/src/ap2.ts",
      "packages/standards/src/a2a.ts",
      "packages/standards/src/a2aHttp.ts",
      "packages/standards/src/a2aNodeServer.ts",
      "packages/standards/src/a2aPush.ts",
      "scripts/check-payment-provider-readiness.ts",
      "scripts/check-a2a-public-readiness.ts",
      "scripts/write-a2a-public-proof-bundle.ts",
      "scripts/smoke-a2a-public-push-delivery.ts",
      "scripts/smoke-a2a-external-conformance.ts",
      "scripts/smoke-a2a-static-discovery-local.ts",
      "docs/vallum/a2a-public-readiness.md",
      "scripts/smoke-a2a-local-server.ts",
      "scripts/write-payment-provider-proof-bundle.ts",
    ],
    commands: [
      "npm test",
      "npm run smoke:a2a-well-known",
      "npm run smoke:a2a-signed-card",
      "npm run smoke:a2a-task-message",
      "npm run smoke:a2a-http",
      "npm run smoke:a2a-local-server",
      "npm run smoke:a2a-static-discovery-local",
      "npm run operator:write-report-template -- --kind payment-provider-live --out tmp/vallum/payment-provider-live-report-template.json",
      "npm run payment:write-provider-proof-bundle -- --out tmp/vallum/payment-provider-proof-bundle.json",
      "npm run payment:write-provider-proof-plan",
      "npm run proof:payment-provider-readiness",
      "npm run operator:write-report-template -- --kind a2a-public-discovery --out tmp/vallum/a2a-public-discovery-report-template.json",
      "npm run operator:write-report-template -- --kind a2a-public-push-delivery --out tmp/vallum/a2a-public-push-delivery-report-template.json",
      "npm run operator:write-report-template -- --kind a2a-external-conformance --out tmp/vallum/a2a-external-conformance-report-template.json",
      "npm run a2a:write-public-proof-bundle -- --out tmp/vallum/a2a-public-proof-bundle.json",
      "npm run a2a:write-public-proof-plan",
      "npm run smoke:a2a-public-push-delivery",
      "npm run smoke:a2a-external-conformance -- --report <ignored-json-path>",
      "npm run a2a:wrap-tck-conformance -- --compatibility <reports/compatibility.json> --out <ignored-json-path> --public-agent-card-url <url> --public-base-url <url>",
      "npm run proof:a2a-public-readiness",
    ],
    productCheckIds: ["public-a2a-hosting", "live-payment-provider"],
    fallbackStatus: "proven-local",
    next: "Run npm run a2a:write-public-proof-bundle -- --out <ignored-json-path> and npm run payment:write-provider-proof-bundle -- --out <ignored-json-path>, then complete dedicated public A2A hosting/conformance and live payment/provider proof slices before external interoperability claims.",
  },
  {
    id: "phase-5-marketplace-operator",
    claim: "Marketplace evidence is local read-only proof for labels, policy compatibility, receipt access, and dispute bundles, with a non-networked production marketplace readiness gate, redacted marketplace production proof-plan writer, and redacted marketplace production proof-bundle writer; production marketplace remains blocked.",
    evidencePaths: [
      "packages/marketplace/src/index.ts",
      "scripts/smoke-marketplace-read-model.ts",
      "scripts/check-marketplace-readiness.ts",
      "scripts/write-marketplace-production-proof-plan.ts",
      "scripts/write-marketplace-production-proof-bundle.ts",
      "docs/marketplace-readiness.md",
    ],
    commands: [
      "npm test",
      "npm run smoke:marketplace-read-model",
      "npm run operator:write-report-template -- --kind marketplace-production --out tmp/vallum/marketplace-production-report-template.json",
      "npm run marketplace:write-production-proof-bundle -- --out tmp/vallum/marketplace-production-proof-bundle.json",
      "npm run marketplace:write-production-proof-plan",
      "npm run proof:marketplace-readiness",
    ],
    productCheckIds: ["production-marketplace"],
    fallbackStatus: "proven-local",
    next: "Run npm run marketplace:write-production-proof-bundle -- --out <ignored-json-path>, then resolve provider verification, moderation, session/API auth, live settlement, dispute workflow, and operational gates before production marketplace work.",
  },
  {
    id: "phase-6-package-release",
    claim: "Packages are locally packable, installable from tarballs, dry-run publishable, and checked by a non-networked publication-readiness gate; registry publication remains operator-gated.",
    evidencePaths: [
      "docs/vallum/package-release-strategy.md",
      "scripts/package-publish-dry-run.ts",
      "scripts/smoke-package-install.ts",
      "scripts/check-package-publication-readiness.ts",
      "scripts/write-package-publication-proof-plan.ts",
      "scripts/write-package-publication-proof-bundle.ts",
      "scripts/package-publish.test.ts",
      "scripts/package-install-smoke.test.ts",
    ],
    commands: [
      "npm run pack:check",
      "npm run smoke:package-install",
      "npm run publish:dry-run",
      "npm run operator:write-report-template -- --kind package-publication --out tmp/vallum/package-publication-report-template.json",
      "npm run package:write-publication-proof-bundle -- --out tmp/vallum/package-publication-proof-bundle.json",
      "npm run package:write-publication-proof-plan",
      "npm run proof:package-publication-readiness",
    ],
    productCheckIds: ["npm-registry-publication"],
    fallbackStatus: "proven-local",
    next: "Run npm run package:write-publication-proof-bundle -- --out <ignored-json-path>, then run a dedicated release slice with registry credentials, provenance decisions, 2FA handling, registry install proof, and rollback notes before publication claims.",
  },
  {
    id: "packet-h-final-product-status",
    claim: "Final product launch readiness is not complete while product-status reports live, production, publication, custody, payment, A2A, marketplace, or safety blockers.",
    evidencePaths: [
      "docs/vallum/product-status.md",
      "scripts/check-product-status.ts",
      "docs/vallum/operator-live-gates.md",
      "scripts/check-operator-live-gates.ts",
      "scripts/write-operator-report-template.ts",
      "scripts/check-device-access-safety-readiness.ts",
      "scripts/write-device-access-safety-proof-bundle.ts",
      "docs/vallum/verification-profiles.md",
      "scripts/check-verification-profiles.ts",
      "scripts/check-roadmap-completion.ts",
      "scripts/write-roadmap-execution-proof-bundle.ts",
      "docs/vallum/execution-slices.md",
      "docs/CODEBASE_MAP.md",
    ],
    commands: [
      "npm run verify:fast",
      "npm run proof:verification-profiles",
      "npm run proof:product-status",
      "npm run proof:launch-readiness",
      "npm run proof:operator-gates",
      "npm run proof:roadmap-completion",
      "npm run roadmap:write-execution-proof-bundle -- --out tmp/vallum/roadmap-execution-proof-bundle.json",
      "npm run operator:write-report-template -- --kind <kind> --out <ignored-report-template.json>",
      "npm run verify:local",
    ],
    productCheckIds: [
      "testnet-readiness",
      "gas-station-runtime",
      "sponsor-funding",
      "testnet-upstream",
      "testnet-sponsored-execute",
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
    `Vallum launch readiness ${report.launchReady ? "ready" : "not-ready"}`,
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

export function buildLaunchReadinessArtifact(
  report: LaunchReadinessReport,
  now = new Date(),
): LaunchReadinessArtifact {
  return {
    schemaVersion: 1,
    kind: "vallum.launch-readiness-report",
    generatedAt: now.toISOString(),
    launchReady: report.launchReady,
    localEvidenceOk: report.localEvidenceOk,
    provenLocalAreaIds: report.areas
      .filter((area) => area.status === "proven-local")
      .map((area) => area.id),
    blockedLiveAreaIds: report.areas
      .filter((area) => area.status === "blocked-live")
      .map((area) => area.id),
    blockedProductionAreaIds: report.areas
      .filter((area) => area.status === "blocked-production")
      .map((area) => area.id),
    deferredSafetyAreaIds: report.areas
      .filter((area) => area.status === "deferred-safety")
      .map((area) => area.id),
    blockerCodes: [...new Set(report.areas.flatMap((area) => area.blockerCodes))],
    areas: report.areas,
    boundaries: ARTIFACT_BOUNDARIES,
  };
}

export async function writeLaunchReadinessArtifact(
  options: WriteLaunchReadinessArtifactOptions = {},
): Promise<LaunchReadinessArtifact> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkLaunchReadiness(options);
  const artifact = buildLaunchReadinessArtifact(report, options.now);
  if (options.outFile) {
    const outPath = resolveOutputPath(cwd, options.outFile);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, formatLaunchReadinessArtifact(artifact), { mode: 0o600 });
    await chmod(outPath, 0o600);
  }
  return artifact;
}

export function formatLaunchReadinessArtifact(artifact: LaunchReadinessArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
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
    next: blockerCodes.length === 0 && "readyNext" in definition
      ? definition.readyNext
      : definition.next,
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

interface CliOptions {
  readonly help: boolean;
  readonly json: boolean;
  readonly outFile?: string;
}

function parseArgs(args: readonly string[]): CliOptions {
  let help = false;
  let json = false;
  let outFile: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--out") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--out requires a path.");
      }
      outFile = value;
      index += 1;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }

  return { help, json, outFile };
}

function resolveOutputPath(cwd: string, outFile: string): string {
  return isAbsolute(outFile) ? outFile : resolve(cwd, outFile);
}

async function main(args = process.argv.slice(2)): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage);
    return 1;
  }

  if (options.help) {
    console.log(usage.trimEnd());
    return 0;
  }

  if (options.json || options.outFile) {
    const artifact = await writeLaunchReadinessArtifact({ outFile: options.outFile });
    console.log(formatLaunchReadinessArtifact(artifact).trimEnd());
    return 0;
  }

  const report = await checkLaunchReadiness();
  console.log(formatLaunchReadinessReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
