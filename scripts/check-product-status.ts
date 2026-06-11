import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkLiveProofStatus, type LiveProofCheck } from "./check-live-proof-status.js";

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

export interface ProductStatusOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly scripts?: Record<string, string | undefined>;
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

export async function checkProductStatus(options: ProductStatusOptions = {}): Promise<ProductStatusReport> {
  const cwd = options.cwd ?? process.cwd();
  const scripts = options.scripts ?? await loadPackageScripts(cwd);
  const liveStatus = await checkLiveProofStatus({ cwd, env: options.env });

  const checks: ProductEvidenceCheck[] = [
    checkLocalVerificationCoverage(scripts),
    checkPackageReleaseCoverage(scripts),
    ...liveStatus.checks.map(mapLiveProofCheck),
    ...productionBlockers(),
  ];

  return {
    complete: checks.every((check) => check.status === "proven-local" || check.status === "ready-live"),
    localProofOk: checks
      .filter((check) => check.id === "local-verification" || check.id === "package-release-local")
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

function mapLiveProofCheck(check: LiveProofCheck): ProductEvidenceCheck {
  return {
    id: check.id,
    status: check.status === "ready" ? "ready-live" : "blocked-live",
    code: check.code,
    message: check.message,
    evidence: check.status === "ready" ? "configuration-present-non-networked" : `missing=${check.missing?.join(",") ?? "see-status"}`,
    next: check.next,
  };
}

function productionBlockers(): readonly ProductEvidenceCheck[] {
  return [
    {
      id: "npm-registry-publication",
      status: "blocked-production",
      code: "NPM_PUBLICATION_UNRUN",
      message: "Packages are locally packable and installable from tarballs, but no npm registry publication or registry install proof has been run.",
      next: "Run a dedicated operator-approved release slice with registry credentials, provenance decisions, 2FA handling, and rollback notes.",
    },
    {
      id: "public-a2a-hosting",
      status: "blocked-production",
      code: "PUBLIC_A2A_HOSTING_UNPROVEN",
      message: "A2A discovery, task routes, authenticated extended Agent Card access, SSE streaming, push notification configuration, injected push delivery, opt-in push HTTP transport, and local retry/attempt observability are proven locally and over loopback/local handler or mocked paths only; public readiness is reported locally, but no public hosting, production key distribution, operator-supplied public push delivery report, or external conformance proof is complete.",
      evidence: "npm run proof:a2a-public-readiness",
      next: "Use npm run proof:a2a-public-readiness to inspect exact public A2A blockers before any operator-approved public hosting/conformance slice.",
    },
    {
      id: "live-payment-provider",
      status: "blocked-production",
      code: "LIVE_PAYMENT_PROVIDER_UNPROVEN",
      message: "x402 and AP2 flows are local/mock only; no real facilitator, payment processor, or provider settlement proof is recorded.",
      next: "Use operator-approved credentials in a payment-provider proof slice before claiming live settlement.",
    },
    {
      id: "production-marketplace",
      status: "blocked-production",
      code: "PRODUCTION_MARKETPLACE_BLOCKED",
      message: "Marketplace work is limited to local read-model evidence; production provider onboarding, moderation, public scoring, custody, and settlement remain blocked.",
      next: "Resolve the marketplace readiness gates before production marketplace UI/API work.",
    },
    {
      id: "production-custody",
      status: "blocked-production",
      code: "PRODUCTION_CUSTODY_OUT_OF_SCOPE",
      message: "Agent wallets use signer references locally; production custody, KMS, recovery export, staking, bonding, and slashing are out of scope without explicit approval.",
      next: "Create a separate custody/security design before adding production signer custody or recovery workflows.",
    },
    {
      id: "physical-device-access",
      status: "deferred-safety",
      code: "DEVICE_ACCESS_SAFETY_DEFERRED",
      message: "Physical device access remains safety-gated; only virtual or simulated resource proof is allowed until a separate safety design is approved.",
      next: "Replace the safety gate only after physical safety, provider accountability, revocation, emergency stop, privacy, and incident response are approved.",
    },
  ];
}

async function main(): Promise<number> {
  const report = await checkProductStatus();
  console.log(formatProductStatusReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
