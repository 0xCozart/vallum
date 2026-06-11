import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type VerificationProfileStatus = "proven-local" | "blocked-config" | "blocked-safety";

export interface VerificationProfileCheck {
  readonly id: string;
  readonly status: VerificationProfileStatus;
  readonly code: string;
  readonly message: string;
  readonly evidence?: string;
  readonly next?: string;
}

export interface VerificationProfileReport {
  readonly profilesOk: boolean;
  readonly fastProfileOk: boolean;
  readonly fullGatePreserved: boolean;
  readonly checks: readonly VerificationProfileCheck[];
}

export interface VerificationProfileOptions {
  readonly cwd?: string;
  readonly scripts?: Record<string, string | undefined>;
}

const FAST_REQUIRED_PARTS = [
  "npm run build",
  "npm test",
  "npm run docs:check",
  "npm run secrets:scan",
  "npm run proof:product-status",
  "npm run proof:launch-readiness",
  "npm run proof:operator-gates",
] as const;

const FAST_FORBIDDEN_PARTS = [
  "contracts:test",
  "smoke:local",
  "smoke:demo-dapp",
  "smoke:demo-browser",
  "smoke:agent-escrow",
  "smoke:paid-mcp-tool",
  "smoke:data-license",
  "smoke:service-bounty",
  "smoke:reputation-receipt",
  "smoke:subscription",
  "smoke:a2a-well-known",
  "smoke:a2a-signed-card",
  "smoke:a2a-task-message",
  "smoke:a2a-http",
  "smoke:a2a-local-server",
  "smoke:marketplace-read-model",
  "readiness:testnet:example",
  "proof:testnet-digest",
  "pack:check",
  "smoke:package-install",
  "proof:a2a-public-readiness",
  "publish:dry-run",
  "execute:testnet-demo",
  "proof:testnet-digest:live",
  "smoke:iota-names-live",
  "smoke:iota-identity-live",
] as const;

const FULL_GATE_REQUIRED_PARTS = [
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

export async function checkVerificationProfiles(
  options: VerificationProfileOptions = {},
): Promise<VerificationProfileReport> {
  const cwd = options.cwd ?? process.cwd();
  const scripts = options.scripts ?? await loadPackageScripts(cwd);
  const checks = [
    checkFastProfile(scripts),
    checkFullGate(scripts),
    checkGrantGate(scripts),
  ];

  const fastProfileOk = checks.find((check) => check.id === "verify-fast-profile")?.status === "proven-local";
  const fullGatePreserved = checks
    .filter((check) => check.id === "verify-local-full-gate" || check.id === "grant-check-full-gate")
    .every((check) => check.status === "proven-local");

  return {
    profilesOk: checks.every((check) => check.status === "proven-local"),
    fastProfileOk,
    fullGatePreserved,
    checks,
  };
}

export function formatVerificationProfileReport(report: VerificationProfileReport): string {
  const lines = [
    `Agentic GasKit verification profiles ${report.profilesOk ? "configured" : "blocked"}`,
    `fastProfileOk=${report.fastProfileOk}`,
    `fullGatePreserved=${report.fullGatePreserved}`,
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

function checkFastProfile(scripts: Record<string, string | undefined>): VerificationProfileCheck {
  const verifyFast = scripts["verify:fast"] ?? "";
  const missing = FAST_REQUIRED_PARTS.filter((part) => !verifyFast.includes(part));
  const forbidden = FAST_FORBIDDEN_PARTS.filter((part) => verifyFast.includes(part));

  if (!verifyFast) {
    return {
      id: "verify-fast-profile",
      status: "blocked-config",
      code: "VERIFY_FAST_MISSING",
      message: "The fast deterministic verification profile is not configured.",
      next: "Add npm run verify:fast as a bounded non-live iteration profile.",
    };
  }

  if (missing.length > 0 || forbidden.length > 0) {
    return {
      id: "verify-fast-profile",
      status: "blocked-config",
      code: "VERIFY_FAST_PROFILE_INVALID",
      message: "The fast verification profile must stay deterministic and bounded while retaining status and safety proofs.",
      evidence: [
        missing.length > 0 ? `missing=${missing.join(",")}` : undefined,
        forbidden.length > 0 ? `forbidden=${forbidden.join(",")}` : undefined,
      ].filter(Boolean).join(";"),
      next: "Restore the fast profile to build, test, docs, secrets, and non-networked status proofs only.",
    };
  }

  return {
    id: "verify-fast-profile",
    status: "proven-local",
    code: "VERIFY_FAST_PROFILE_CONFIGURED",
    message: "A fast deterministic profile exists for iteration without live services, package publication, Move tests, or product smokes.",
    evidence: "npm run verify:fast",
  };
}

function checkFullGate(scripts: Record<string, string | undefined>): VerificationProfileCheck {
  const verifyLocal = scripts["verify:local"] ?? "";
  const missing = FULL_GATE_REQUIRED_PARTS.filter((part) => !verifyLocal.includes(part));
  const forbidden = ["publish:dry-run", "execute:testnet-demo", "proof:testnet-digest:live", "smoke:iota-names-live", "smoke:iota-identity-live"]
    .filter((part) => verifyLocal.includes(part));

  if (missing.length > 0 || forbidden.length > 0) {
    return {
      id: "verify-local-full-gate",
      status: "blocked-safety",
      code: "VERIFY_LOCAL_FULL_GATE_INVALID",
      message: "The full local verification gate is incomplete or includes opt-in live/release commands.",
      evidence: [
        missing.length > 0 ? `missing=${missing.join(",")}` : undefined,
        forbidden.length > 0 ? `forbidden=${forbidden.join(",")}` : undefined,
      ].filter(Boolean).join(";"),
      next: "Restore verify:local as the complete deterministic local gate and keep live/release commands opt-in.",
    };
  }

  return {
    id: "verify-local-full-gate",
    status: "proven-local",
    code: "VERIFY_LOCAL_FULL_GATE_PRESERVED",
    message: "The full local verification gate remains the release and launch evidence surface.",
    evidence: "npm run verify:local",
  };
}

function checkGrantGate(scripts: Record<string, string | undefined>): VerificationProfileCheck {
  if (scripts["grant:check"] !== "npm run verify:local") {
    return {
      id: "grant-check-full-gate",
      status: "blocked-safety",
      code: "GRANT_CHECK_NOT_FULL_GATE",
      message: "Grant/reviewer verification must keep using the full local gate, not the fast iteration profile.",
      evidence: `grant:check=${scripts["grant:check"] ?? "missing"}`,
      next: "Restore grant:check to npm run verify:local.",
    };
  }

  return {
    id: "grant-check-full-gate",
    status: "proven-local",
    code: "GRANT_CHECK_FULL_GATE_PRESERVED",
    message: "Grant/reviewer verification still points to the full local verification gate.",
    evidence: "npm run grant:check",
  };
}

async function main(): Promise<number> {
  const report = await checkVerificationProfiles();
  console.log(formatVerificationProfileReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
