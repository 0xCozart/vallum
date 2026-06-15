import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
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

export interface VerificationProfileArtifact {
  readonly schemaVersion: 1;
  readonly kind: "agentrail.verification-profile-report";
  readonly generatedAt: string;
  readonly profilesOk: boolean;
  readonly fastProfileOk: boolean;
  readonly fullGatePreserved: boolean;
  readonly provenLocalCheckIds: readonly string[];
  readonly blockedCheckIds: readonly string[];
  readonly blockerCodes: readonly string[];
  readonly checks: readonly VerificationProfileCheck[];
  readonly boundaries: readonly string[];
}

export interface VerificationProfileOptions {
  readonly cwd?: string;
  readonly scripts?: Record<string, string | undefined>;
}

export interface WriteVerificationProfileArtifactOptions extends VerificationProfileOptions {
  readonly now?: Date;
  readonly outFile?: string;
}

const ARTIFACT_BOUNDARIES = [
  "This report is non-networked and does not run live proof commands.",
  "profilesOk=false means the fast/full/grant verification profile wiring is unsafe or incomplete.",
  "Do not commit generated reports, live proof artifacts, credentials, tokens, private keys, raw transaction bytes, user signatures, response bodies, endpoint values, profile paths, full sponsor addresses, or secret local paths.",
  "The fast profile is iteration evidence only; verify:local remains the full reviewer, release, and launch evidence gate.",
] as const;

const usage = `usage: npm exec tsx -- scripts/check-verification-profiles.ts [--json] [--out <path>]

Reports current AgentRail verification profile wiring without contacting live proof services.

Options:
  --json        Print a redacted machine-readable artifact.
  --out <path>  Write the same JSON artifact to a local file with mode 0600.
  --help        Show this help text.
`;

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
    `AgentRail verification profiles ${report.profilesOk ? "configured" : "blocked"}`,
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

export function buildVerificationProfileArtifact(
  report: VerificationProfileReport,
  now = new Date(),
): VerificationProfileArtifact {
  const blockedChecks = report.checks.filter((check) => check.status !== "proven-local");

  return {
    schemaVersion: 1,
    kind: "agentrail.verification-profile-report",
    generatedAt: now.toISOString(),
    profilesOk: report.profilesOk,
    fastProfileOk: report.fastProfileOk,
    fullGatePreserved: report.fullGatePreserved,
    provenLocalCheckIds: report.checks
      .filter((check) => check.status === "proven-local")
      .map((check) => check.id),
    blockedCheckIds: blockedChecks.map((check) => check.id),
    blockerCodes: blockedChecks.map((check) => check.code),
    checks: report.checks,
    boundaries: ARTIFACT_BOUNDARIES,
  };
}

export async function writeVerificationProfileArtifact(
  options: WriteVerificationProfileArtifactOptions = {},
): Promise<VerificationProfileArtifact> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkVerificationProfiles(options);
  const artifact = buildVerificationProfileArtifact(report, options.now);
  if (options.outFile) {
    const outPath = resolveOutputPath(cwd, options.outFile);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, formatVerificationProfileArtifact(artifact), { mode: 0o600 });
    await chmod(outPath, 0o600);
  }
  return artifact;
}

export function formatVerificationProfileArtifact(artifact: VerificationProfileArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
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
    const artifact = await writeVerificationProfileArtifact({ outFile: options.outFile });
    console.log(formatVerificationProfileArtifact(artifact).trimEnd());
    return 0;
  }

  const report = await checkVerificationProfiles();
  console.log(formatVerificationProfileReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
