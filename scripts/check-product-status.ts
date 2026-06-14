import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkLiveProofStatus, type LiveProofCheck } from "./check-live-proof-status.js";
import {
  checkPaymentProviderReadiness,
  type PaymentProviderReadinessReport,
} from "./check-payment-provider-readiness.js";
import {
  checkPackagePublicationReadiness,
  type PackagePublicationReadinessReport,
} from "./check-package-publication-readiness.js";
import {
  checkMarketplaceReadiness,
  type MarketplaceReadinessReport,
} from "./check-marketplace-readiness.js";
import {
  checkCustodyReadiness,
  type CustodyReadinessReport,
} from "./check-custody-readiness.js";
import {
  checkTestnetDigestProof,
  type TestnetDigestProofReport,
} from "./check-testnet-digest-proof.js";
import type {
  GasStationRuntimeCommandRunner,
  GasStationRuntimePreflightReport,
} from "./check-gas-station-runtime-preflight.js";

export type ProductEvidenceStatus =
  | "proven-local"
  | "ready-live"
  | "blocked-live"
  | "blocked-production"
  | "deferred-safety";

export interface ProductEvidenceCheck {
  readonly id: string;
  readonly status: ProductEvidenceStatus;
  readonly code: string;
  readonly message: string;
  readonly evidence?: string;
  readonly next?: string;
}

export interface ProductStatusReport {
  readonly complete: boolean;
  readonly localProofOk: boolean;
  readonly checks: readonly ProductEvidenceCheck[];
}

export interface ProductStatusArtifact {
  readonly schemaVersion: 1;
  readonly kind: "agentic-gaskit.product-status-report";
  readonly generatedAt: string;
  readonly complete: boolean;
  readonly localProofOk: boolean;
  readonly provenLocalCheckIds: readonly string[];
  readonly readyLiveCheckIds: readonly string[];
  readonly blockedCheckIds: readonly string[];
  readonly blockerCodes: readonly string[];
  readonly checks: readonly ProductEvidenceCheck[];
  readonly boundaries: readonly string[];
}

export interface ProductStatusOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly custodyReadiness?: CustodyReadinessReport;
  readonly gasStationRuntimeReport?: GasStationRuntimePreflightReport;
  readonly gasStationRuntimeRunner?: GasStationRuntimeCommandRunner;
  readonly marketplaceReadiness?: MarketplaceReadinessReport;
  readonly packagePublicationReadiness?: PackagePublicationReadinessReport;
  readonly paymentProviderReadiness?: PaymentProviderReadinessReport;
  readonly scripts?: Record<string, string | undefined>;
  readonly testnetDigestProof?: TestnetDigestProofReport;
}

export interface WriteProductStatusArtifactOptions extends ProductStatusOptions {
  readonly now?: Date;
  readonly outFile?: string;
}

const LOCAL_VERIFY_REQUIRED_PARTS = [
  "npm test",
  "npm run contracts:test",
  "npm run typecheck",
  "npm run smoke:local",
  "npm run smoke:demo-dapp",
  "npm run smoke:demo-browser",
  "npm run smoke:agent-escrow",
  "npm run smoke:paid-mcp-tool",
  "npm run smoke:data-license",
  "npm run smoke:service-bounty",
  "npm run smoke:reputation-receipt",
  "npm run smoke:subscription",
  "npm run smoke:a2a-well-known",
  "npm run smoke:a2a-signed-card",
  "npm run smoke:a2a-task-message",
  "npm run smoke:a2a-http",
  "npm run smoke:a2a-local-server",
  "npm run smoke:marketplace-read-model",
  "npm run readiness:testnet:example",
  "npm run proof:testnet-digest",
  "npm run pack:check",
  "npm run smoke:package-install",
  "npm run proof:a2a-public-readiness",
  "npm run proof:verification-profiles",
  "npm run proof:product-status",
  "npm run proof:launch-readiness",
  "npm run proof:operator-gates",
  "npm run docs:check",
  "npm run secrets:scan",
] as const;

const ARTIFACT_BOUNDARIES = [
  "This report is non-networked and does not run live proof commands.",
  "complete=false means at least one live, production, publication, custody, payment, marketplace, A2A, or safety gate remains blocked.",
  "Do not commit generated reports, live proof artifacts, credentials, tokens, private keys, raw transaction bytes, user signatures, response bodies, endpoint values, profile paths, full sponsor addresses, or secret local paths.",
  "Ready-live checks are readiness or report-valid states only; they still require operator review or explicit operator intent before live execution.",
] as const;

const usage = `usage: npm exec tsx -- scripts/check-product-status.ts [--json] [--out <path>]

Reports current Agentic GasKit product status without contacting live proof services.

Options:
  --json        Print a redacted machine-readable artifact.
  --out <path>  Write the same JSON artifact to a local file with mode 0600.
  --help        Show this help text.
`;

export async function checkProductStatus(options: ProductStatusOptions = {}): Promise<ProductStatusReport> {
  const cwd = options.cwd ?? process.cwd();
  const scripts = options.scripts ?? await loadPackageScripts(cwd);
  const liveStatus = await checkLiveProofStatus({
    cwd,
    env: options.env,
    gasStationRuntimeReport: options.gasStationRuntimeReport,
    gasStationRuntimeRunner: options.gasStationRuntimeRunner,
  });
  const paymentProviderReadiness = options.paymentProviderReadiness ?? await checkPaymentProviderReadiness({
    cwd,
    env: options.env,
  });
  const packagePublicationReadiness = options.packagePublicationReadiness ?? await checkPackagePublicationReadiness({
    cwd,
    env: options.env,
    scripts,
  });
  const marketplaceReadiness = options.marketplaceReadiness ?? await checkMarketplaceReadiness({
    cwd,
    env: options.env,
    scripts,
  });
  const custodyReadiness = options.custodyReadiness ?? await checkCustodyReadiness({
    cwd,
    env: options.env,
    scripts,
  });
  const testnetDigestProof = options.testnetDigestProof ?? await checkTestnetDigestProof({ cwd });
  const liveChecks = withSponsoredExecuteCheck(
    liveStatus.checks.map(mapLiveProofCheck),
    sponsoredExecuteCheck(testnetDigestProof),
  );

  const checks: ProductEvidenceCheck[] = [
    checkLocalVerificationCoverage(scripts),
    checkPackageReleaseCoverage(scripts),
    checkOperatorReportTemplateCoverage(scripts),
    ...liveChecks,
    ...productionBlockers(paymentProviderReadiness, packagePublicationReadiness, marketplaceReadiness, custodyReadiness),
  ];

  return {
    complete: checks.every((check) => check.status === "proven-local" || check.status === "ready-live"),
    localProofOk: checks
      .filter((check) => (
        check.id === "local-verification"
        || check.id === "package-release-local"
        || check.id === "operator-report-template"
      ))
      .every((check) => check.status === "proven-local"),
    checks,
  };
}

export function formatProductStatusReport(report: ProductStatusReport): string {
  const lines = [
    `Agentic GasKit product status ${report.complete ? "complete" : "not-complete"}`,
    `localProofOk=${report.localProofOk}`,
    `complete=${report.complete}`,
  ];

  for (const check of report.checks) {
    lines.push(`${check.status}: ${check.id}: code=${check.code}`);
    lines.push(`message=${check.message}`);
    if (check.evidence) lines.push(`evidence=${check.evidence}`);
    if (check.next) lines.push(`next=${check.next}`);
  }

  return lines.join("\n");
}

export function buildProductStatusArtifact(
  report: ProductStatusReport,
  now = new Date(),
): ProductStatusArtifact {
  const blockedChecks = report.checks.filter((check) => (
    check.status !== "proven-local" && check.status !== "ready-live"
  ));

  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.product-status-report",
    generatedAt: now.toISOString(),
    complete: report.complete,
    localProofOk: report.localProofOk,
    provenLocalCheckIds: report.checks
      .filter((check) => check.status === "proven-local")
      .map((check) => check.id),
    readyLiveCheckIds: report.checks
      .filter((check) => check.status === "ready-live")
      .map((check) => check.id),
    blockedCheckIds: blockedChecks.map((check) => check.id),
    blockerCodes: blockedChecks.map((check) => check.code),
    checks: report.checks,
    boundaries: ARTIFACT_BOUNDARIES,
  };
}

export async function writeProductStatusArtifact(
  options: WriteProductStatusArtifactOptions = {},
): Promise<ProductStatusArtifact> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkProductStatus(options);
  const artifact = buildProductStatusArtifact(report, options.now);
  if (options.outFile) {
    const outPath = resolveOutputPath(cwd, options.outFile);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, formatProductStatusArtifact(artifact), { mode: 0o600 });
    await chmod(outPath, 0o600);
  }
  return artifact;
}

export function formatProductStatusArtifact(artifact: ProductStatusArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

async function loadPackageScripts(cwd: string): Promise<Record<string, string | undefined>> {
  const packageJson = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  return packageJson.scripts ?? {};
}

function checkLocalVerificationCoverage(scripts: Record<string, string | undefined>): ProductEvidenceCheck {
  const verifyLocal = scripts["verify:local"] ?? "";
  const missing = LOCAL_VERIFY_REQUIRED_PARTS.filter((part) => !verifyLocal.includes(part));
  if (missing.length > 0) {
    return {
      id: "local-verification",
      status: "blocked-production",
      code: "LOCAL_VERIFY_SURFACE_INCOMPLETE",
      message: "The local verification script is missing required deterministic proof commands.",
      evidence: `missing=${missing.join(",")}`,
      next: "Restore the missing local verification commands before accepting the product evidence surface.",
    };
  }

  return {
    id: "local-verification",
    status: "proven-local",
    code: "LOCAL_VERIFY_SURFACE_CONFIGURED",
    message: "The local verification script covers deterministic tests, Move tests, local smokes, package checks, verification-profile audit, docs, secrets, and this product-status gate.",
    evidence: "npm run verify:local",
  };
}

function checkPackageReleaseCoverage(scripts: Record<string, string | undefined>): ProductEvidenceCheck {
  const packCheck = scripts["pack:check"] ?? "";
  const installSmoke = scripts["smoke:package-install"] ?? "";
  const publishDryRun = scripts["publish:dry-run"] ?? "";
  const verifyLocal = scripts["verify:local"] ?? "";
  const missing: string[] = [];

  if (!packCheck.includes("npm pack --dry-run")) missing.push("pack:check");
  if (!installSmoke.includes("scripts/smoke-package-install.ts")) missing.push("smoke:package-install");
  if (!publishDryRun.includes("scripts/package-publish-dry-run.ts")) missing.push("publish:dry-run");
  if (verifyLocal.includes("publish:dry-run")) missing.push("publish:dry-run must stay opt-in");

  if (missing.length > 0) {
    return {
      id: "package-release-local",
      status: "blocked-production",
      code: "PACKAGE_RELEASE_GATES_INCOMPLETE",
      message: "Local package release proof gates are incomplete or wired unsafely.",
      evidence: `missing=${missing.join(",")}`,
      next: "Restore pack dry-run, package install smoke, and opt-in publish dry-run wiring.",
    };
  }

  return {
    id: "package-release-local",
    status: "proven-local",
    code: "PACKAGE_RELEASE_GATES_CONFIGURED",
    message: "Local package dry-run, local tarball install smoke, and opt-in publish dry-run gates are configured without real publication.",
    evidence: "npm run pack:check; npm run smoke:package-install; npm run publish:dry-run",
  };
}

function checkOperatorReportTemplateCoverage(scripts: Record<string, string | undefined>): ProductEvidenceCheck {
  const writer = scripts["operator:write-report-template"] ?? "";
  const verifyFast = scripts["verify:fast"] ?? "";
  const verifyLocal = scripts["verify:local"] ?? "";
  const grantCheck = scripts["grant:check"] ?? "";
  const missing: string[] = [];

  if (!writer.includes("scripts/write-operator-report-template.ts")) missing.push("operator:write-report-template");
  if (verifyFast.includes("write-report-template")) missing.push("operator report template must stay out of verify:fast");
  if (verifyLocal.includes("write-report-template")) missing.push("operator report template must stay out of verify:local");
  if (grantCheck.includes("write-report-template")) missing.push("operator report template must stay out of grant:check");

  if (missing.length > 0) {
    return {
      id: "operator-report-template",
      status: "blocked-production",
      code: "OPERATOR_REPORT_TEMPLATE_WIRING_INCOMPLETE",
      message: "Operator structured report template wiring is missing or included in automatic verification.",
      evidence: `missing=${missing.join(",")}`,
      next: "Restore the opt-in operator report-template writer and keep it outside default local verification.",
    };
  }

  return {
    id: "operator-report-template",
    status: "proven-local",
    code: "OPERATOR_REPORT_TEMPLATE_WRITER_CONFIGURED",
    message: "Operator structured report templates can be generated as ignored local artifacts without being accepted as passing evidence.",
    evidence: "npm run operator:write-report-template -- --kind <kind> --out <ignored-report-template.json>",
  };
}

function mapLiveProofCheck(check: LiveProofCheck): ProductEvidenceCheck {
  return {
    id: check.id,
    status: check.status === "ready" ? "ready-live" : "blocked-live",
    code: check.code,
    message: check.message,
    evidence: liveProofEvidence(check),
    next: check.next,
  };
}

function liveProofEvidence(check: LiveProofCheck): string {
  if (check.evidence) return check.evidence;
  if (check.status === "ready") return "configuration-present-non-networked";
  if (check.missing && check.missing.length > 0) return `missing=${check.missing.join(",")}`;
  return `blocked=${check.code}`;
}

function withSponsoredExecuteCheck(
  liveChecks: readonly ProductEvidenceCheck[],
  sponsoredExecute: ProductEvidenceCheck,
): readonly ProductEvidenceCheck[] {
  const upstreamIndex = liveChecks.findIndex((check) => check.id === "testnet-upstream");
  if (upstreamIndex === -1) return [...liveChecks, sponsoredExecute];
  return [
    ...liveChecks.slice(0, upstreamIndex + 1),
    sponsoredExecute,
    ...liveChecks.slice(upstreamIndex + 1),
  ];
}

function sponsoredExecuteCheck(proof: TestnetDigestProofReport): ProductEvidenceCheck {
  if (proof.status === "verified-testnet") {
    return {
      id: "testnet-sponsored-execute",
      status: "ready-live",
      code: "TESTNET_SPONSORED_EXECUTE_DIGEST_VERIFIED",
      message: "Fresh sponsored IOTA testnet execute digest is documented and read-only live lookup verified success.",
      evidence: "testnet-digest-verified-redacted",
      next: "Keep the documented public digest current when rerunning npm run execute:testnet-demo.",
    };
  }

  if (proof.status === "documented-local") {
    return {
      id: "testnet-sponsored-execute",
      status: "ready-live",
      code: "TESTNET_SPONSORED_EXECUTE_DIGEST_DOCUMENTED",
      message: "Fresh sponsored IOTA testnet execute digest is documented in required repo evidence docs.",
      evidence: "testnet-digest-documented-redacted",
      next: "Run npm run proof:testnet-digest:live for read-only lookup, or rerun npm run execute:testnet-demo only with explicit operator intent when refreshing proof.",
    };
  }

  return {
    id: "testnet-sponsored-execute",
    status: "blocked-live",
    code: proof.blocker ?? "TESTNET_SPONSORED_EXECUTE_DIGEST_MISSING",
    message: "Fresh sponsored IOTA testnet execute evidence is missing or not locally documented.",
    evidence: `blocked=${proof.blocker ?? "TESTNET_SPONSORED_EXECUTE_DIGEST_MISSING"}`,
    next: "Run npm run execute:testnet-demo only with explicit operator intent, document the public digest, then rerun npm run proof:testnet-digest.",
  };
}

function productionBlockers(
  paymentProviderReadiness: PaymentProviderReadinessReport,
  packagePublicationReadiness: PackagePublicationReadinessReport,
  marketplaceReadiness: MarketplaceReadinessReport,
  custodyReadiness: CustodyReadinessReport,
): readonly ProductEvidenceCheck[] {
  return [
    packagePublicationCheck(packagePublicationReadiness),
    {
      id: "public-a2a-hosting",
      status: "blocked-production",
      code: "PUBLIC_A2A_HOSTING_UNPROVEN",
      message: "A2A discovery, local public JWKS serving, local static discovery bundle generation, local static discovery artifact writing, local static discovery artifact validation, local static discovery loopback host smoke, local static hosting review, task routes, authenticated extended Agent Card access, SSE streaming, push notification configuration, injected push delivery, opt-in push HTTP transport, callback URL admission hardening, callback host allowlisting, local retry/attempt observability, local durable attempt evidence, local delivery queueing, and a local injected-transport worker are proven locally and over loopback/local handler or mocked paths only; public readiness is reported locally and opt-in artifact/local-host/public-discovery commands can prepare, validate, loopback-smoke, and write a redacted hosting-review packet for static files plus produce structured discovery evidence, but no public hosting run, production key distribution acceptance, valid operator-supplied structured public discovery report, valid structured public push delivery report, or valid structured external conformance proof is complete.",
      evidence: "npm run proof:a2a-public-readiness",
      next: "Run npm run a2a:write-public-proof-plan -- --out <ignored-json-path> to prepare redacted operator steps, use npm run proof:a2a-public-readiness to inspect blockers, then run npm run smoke:a2a-public-discovery only with operator-approved public A2A config.",
    },
    paymentProviderCheck(paymentProviderReadiness),
    marketplaceCheck(marketplaceReadiness),
    custodyCheck(custodyReadiness),
    {
      id: "physical-device-access",
      status: "deferred-safety",
      code: "DEVICE_ACCESS_SAFETY_DEFERRED",
      message: "Physical device access remains safety-gated; only virtual or simulated resource proof is allowed until a separate safety design is approved.",
      next: "Replace the safety gate only after physical safety, provider accountability, revocation, emergency stop, privacy, and incident response are approved.",
    },
  ];
}

function custodyCheck(readiness: CustodyReadinessReport): ProductEvidenceCheck {
  if (readiness.productionReady) {
    return {
      id: "production-custody",
      status: "ready-live",
      code: "CUSTODY_PRODUCTION_REPORT_VALID",
      message: "Local signer-reference proof exists and an operator-supplied structured production custody report is valid for manual review.",
      evidence: "npm run proof:custody-readiness",
      next: "Manually review the ignored structured report before accepting production custody, KMS, recovery, staking, bonding, slashing, or signer-operation claims.",
    };
  }

  if (!readiness.localProofOk) {
    const local = readiness.checks.find((check) => check.id === "local-signer-reference-proof");
    return {
      id: "production-custody",
      status: "blocked-production",
      code: local?.code ?? "CUSTODY_LOCAL_PROOF_INCOMPLETE",
      message: "Local signer-reference account source, docs, tests, or script coverage is incomplete, so production custody readiness cannot be evaluated.",
      evidence: "npm run proof:custody-readiness",
      next: local?.next ?? "Restore local signer-reference proof, then rerun custody readiness.",
    };
  }

  const live = readiness.checks.find((check) => check.id === "production-custody-report");
  return {
    id: "production-custody",
    status: "blocked-production",
    code: "PRODUCTION_CUSTODY_OUT_OF_SCOPE",
    message: `Agent wallets use signer references locally; production custody, KMS, recovery export, staking, bonding, and slashing remain blocked by ${live?.code ?? "CUSTODY_PRODUCTION_REPORT_MISSING"}.`,
    evidence: "npm run proof:custody-readiness",
    next: "Run npm run custody:write-production-proof-plan, complete a dedicated operator-approved custody, KMS, recovery, legal, and incident-response review, save a redacted structured report outside tracked files, set CUSTODY_PRODUCTION_REPORT, and rerun readiness/status gates.",
  };
}

function marketplaceCheck(readiness: MarketplaceReadinessReport): ProductEvidenceCheck {
  if (readiness.productionReady) {
    return {
      id: "production-marketplace",
      status: "ready-live",
      code: "MARKETPLACE_PRODUCTION_REPORT_VALID",
      message: "Local marketplace read-model proof exists and an operator-supplied structured production marketplace report is valid for manual review.",
      evidence: "npm run proof:marketplace-readiness",
      next: "Manually review the ignored structured report before accepting production marketplace, provider verification, moderation, auth, settlement, or operations claims.",
    };
  }

  if (!readiness.localProofOk) {
    const local = readiness.checks.find((check) => check.id === "local-marketplace-read-model-proof");
    return {
      id: "production-marketplace",
      status: "blocked-production",
      code: local?.code ?? "MARKETPLACE_LOCAL_PROOF_INCOMPLETE",
      message: "Local marketplace read-model source, docs, test, or script coverage is incomplete, so production marketplace readiness cannot be evaluated.",
      evidence: "npm run proof:marketplace-readiness",
      next: local?.next ?? "Restore local marketplace proof, then rerun marketplace readiness.",
    };
  }

  const live = readiness.checks.find((check) => check.id === "production-marketplace-report");
  return {
    id: "production-marketplace",
    status: "blocked-production",
    code: "PRODUCTION_MARKETPLACE_BLOCKED",
    message: `Marketplace work is limited to local read-model evidence; production provider onboarding, moderation, public scoring, custody, and settlement remain blocked by ${live?.code ?? "MARKETPLACE_PRODUCTION_REPORT_MISSING"}.`,
    evidence: "npm run proof:marketplace-readiness",
    next: "Run npm run marketplace:write-production-proof-plan, complete a dedicated operator-approved production marketplace review, save a redacted structured report outside tracked files, set MARKETPLACE_PRODUCTION_REPORT, and rerun readiness/status gates.",
  };
}

function packagePublicationCheck(readiness: PackagePublicationReadinessReport): ProductEvidenceCheck {
  if (readiness.liveReady) {
    return {
      id: "npm-registry-publication",
      status: "ready-live",
      code: "PACKAGE_PUBLICATION_REPORT_VALID",
      message: "Local package release proof exists and an operator-supplied structured npm publication report is valid for manual review.",
      evidence: "npm run proof:package-publication-readiness",
      next: "Manually review the ignored structured report before accepting npm publication and registry installability claims.",
    };
  }

  if (!readiness.localProofOk) {
    const local = readiness.checks.find((check) => check.id === "local-package-publication-proof");
    return {
      id: "npm-registry-publication",
      status: "blocked-production",
      code: local?.code ?? "PACKAGE_PUBLICATION_LOCAL_PROOF_INCOMPLETE",
      message: "Local package publication source, script, or package coverage is incomplete, so npm registry readiness cannot be evaluated.",
      evidence: "npm run proof:package-publication-readiness",
      next: local?.next ?? "Restore local package release proof, then rerun package publication readiness.",
    };
  }

  const live = readiness.checks.find((check) => check.id === "npm-registry-publication-report");
  return {
    id: "npm-registry-publication",
    status: "blocked-production",
    code: "NPM_PUBLICATION_UNRUN",
    message: `Packages are locally packable, installable from tarballs, and dry-run publishable; npm registry publication proof remains blocked by ${live?.code ?? "PACKAGE_PUBLICATION_REPORT_MISSING"}.`,
    evidence: "npm run proof:package-publication-readiness",
    next: "Run npm run package:write-publication-proof-plan, complete a dedicated operator-approved npm publication proof, save a redacted structured report outside tracked files, set PACKAGE_PUBLICATION_REPORT, and rerun readiness/status gates.",
  };
}

function paymentProviderCheck(readiness: PaymentProviderReadinessReport): ProductEvidenceCheck {
  if (readiness.liveReady) {
    return {
      id: "live-payment-provider",
      status: "ready-live",
      code: "PAYMENT_PROVIDER_LIVE_REPORT_VALID",
      message: "Local x402/AP2 proof exists and an operator-supplied structured payment-provider report is valid for manual review.",
      evidence: "npm run proof:payment-provider-readiness",
      next: "Manually review the ignored structured report before accepting live facilitator, processor, or settlement claims.",
    };
  }

  if (!readiness.localProofOk) {
    const local = readiness.checks.find((check) => check.id === "local-standards-proof");
    return {
      id: "live-payment-provider",
      status: "blocked-production",
      code: local?.code ?? "PAYMENT_PROVIDER_LOCAL_PROOF_INCOMPLETE",
      message: "Local x402/AP2 source or test evidence is incomplete, so payment-provider readiness cannot be evaluated.",
      evidence: "npm run proof:payment-provider-readiness",
      next: local?.next ?? "Restore local x402/AP2 proof, then rerun payment-provider readiness.",
    };
  }

  const live = readiness.checks.find((check) => check.id === "live-payment-provider-report");
  return {
    id: "live-payment-provider",
    status: "blocked-production",
    code: "LIVE_PAYMENT_PROVIDER_UNPROVEN",
    message: `x402 and AP2 flows are locally proven only; live facilitator, processor, or settlement proof remains blocked by ${live?.code ?? "PAYMENT_PROVIDER_LIVE_REPORT_MISSING"}.`,
    evidence: "npm run proof:payment-provider-readiness",
    next: "Run npm run payment:write-provider-proof-plan, complete a dedicated operator-approved payment-provider proof, save a redacted structured report outside tracked files, set PAYMENT_PROVIDER_LIVE_REPORT, and rerun readiness/status gates.",
  };
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
    const artifact = await writeProductStatusArtifact({ outFile: options.outFile });
    console.log(formatProductStatusArtifact(artifact).trimEnd());
    return 0;
  }

  const report = await checkProductStatus();
  console.log(formatProductStatusReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
