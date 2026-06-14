import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkLiveProofStatus,
  type CheckLiveProofStatusOptions,
  type LiveProofCheck,
  type LiveProofStatusReport,
} from "./check-live-proof-status.js";

export interface LiveProofPlanCommand {
  readonly id: string;
  readonly command: string;
  readonly contactsLiveService: boolean;
  readonly requiresOperatorApproval: boolean;
}

export interface LiveProofPlanCheck {
  readonly id: string;
  readonly status: LiveProofCheck["status"];
  readonly code: string;
  readonly missing?: readonly string[];
  readonly next?: string;
}

export interface LiveProofPlan {
  readonly schemaVersion: 1;
  readonly kind: "agentic-gaskit.live-proof-plan";
  readonly generatedAt: string;
  readonly liveProofReady: boolean;
  readonly status: "blocked" | "ready-to-run";
  readonly commands: readonly LiveProofPlanCommand[];
  readonly blockerCodes: readonly string[];
  readonly readyCodes: readonly string[];
  readonly checks: readonly LiveProofPlanCheck[];
  readonly boundaries: readonly string[];
  readonly requiredOperatorInputs: readonly string[];
  readonly requiredEvidenceArtifacts: readonly string[];
}

export interface WriteLiveProofPlanOptions extends CheckLiveProofStatusOptions {
  readonly now?: Date;
  readonly outFile?: string;
}

interface CliOptions {
  readonly help: boolean;
  readonly outFile?: string;
}

const REQUIRED_OPERATOR_INPUTS = [
  "GASKIT_TESTNET_UPSTREAM_REPORT",
  "IOTA_NAMES_GRAPHQL_URL",
  "IOTA_NAMES_NAME",
  "IOTA_NAMES_EXPECTED_ADDRESS",
  "IOTA_IDENTITY_PROOF_ENDPOINT",
  "IOTA_IDENTITY_PROFILE_PATH",
  "IOTA_IDENTITY_TRUSTED_ISSUER_DIDS",
  "IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS",
  "IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES",
  "IOTA_IDENTITY_ACCEPTED_STATUS_TYPES",
  "IOTA_IDENTITY_CACHE_TTL_MS",
] as const;

const REQUIRED_EVIDENCE_ARTIFACTS = [
  "sanitized testnet upstream diagnostic report",
  "IOTA Names live smoke output",
  "IOTA Identity live proof smoke output",
  "VC trust-policy configuration review",
] as const;

const PLAN_COMMANDS: readonly LiveProofPlanCommand[] = [
  {
    id: "check-testnet-readiness",
    command: "npm run readiness:testnet",
    contactsLiveService: false,
    requiresOperatorApproval: false,
  },
  {
    id: "render-gas-station-config",
    command: "npm run gas-station:render-config",
    contactsLiveService: false,
    requiresOperatorApproval: false,
  },
  {
    id: "check-gas-station-runtime",
    command: "npm run gas-station:runtime-preflight",
    contactsLiveService: false,
    requiresOperatorApproval: false,
  },
  {
    id: "optional-docker-direct-dry-run",
    command: "npm run gas-station:docker-direct -- --dry-run",
    contactsLiveService: false,
    requiresOperatorApproval: false,
  },
  {
    id: "diagnose-testnet-upstream",
    command: "npm run diagnose:gas-station -- --report <ignored-json-path>",
    contactsLiveService: true,
    requiresOperatorApproval: true,
  },
  {
    id: "smoke-iota-names-live",
    command: "npm run smoke:iota-names-live",
    contactsLiveService: true,
    requiresOperatorApproval: true,
  },
  {
    id: "smoke-iota-identity-live",
    command: "npm run smoke:iota-identity-live",
    contactsLiveService: true,
    requiresOperatorApproval: true,
  },
  {
    id: "check-live-proof-status",
    command: "npm run proof:live-status",
    contactsLiveService: false,
    requiresOperatorApproval: false,
  },
] as const;

const BOUNDARIES = [
  "This plan is non-networked and does not contact IOTA RPC, Gas Station HTTP, IOTA Names, or IOTA Identity.",
  "Only diagnose-testnet-upstream and the live smoke commands contact live services, and they require explicit operator approval.",
  "Do not commit reports, endpoint values, profile paths, names, addresses, credentials, tokens, private keys, raw transaction bytes, user signatures, response bodies, credential payloads, or local secret paths.",
  "ready-to-run means the live proof commands are configured for operator review; it is not production, mainnet, custody, marketplace, or payment approval.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-live-proof-plan.ts [--out <path>]

Writes a redacted non-networked live-proof plan from current readiness gates.
The plan prints command names, blocker codes, missing input names, and safety boundaries only.`;

export async function writeLiveProofPlan(
  options: WriteLiveProofPlanOptions = {},
): Promise<LiveProofPlan> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkLiveProofStatus(options);
  const plan = buildLiveProofPlan(report, options.now ?? new Date());
  if (options.outFile) {
    const outFile = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, `${formatLiveProofPlan(plan)}\n`, { mode: 0o600 });
  }
  return plan;
}

export function buildLiveProofPlan(
  report: LiveProofStatusReport,
  now: Date = new Date(),
): LiveProofPlan {
  const checks = report.checks.map((check) => ({
    id: check.id,
    status: check.status,
    code: check.code,
    missing: check.missing,
    next: check.next,
  }));
  const blockers = checks.filter((check) => check.status !== "ready");
  const ready = checks.filter((check) => check.status === "ready");

  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.live-proof-plan",
    generatedAt: now.toISOString(),
    liveProofReady: report.ok,
    status: report.ok ? "ready-to-run" : "blocked",
    commands: PLAN_COMMANDS,
    blockerCodes: blockers.map((check) => check.code),
    readyCodes: ready.map((check) => check.code),
    checks,
    boundaries: BOUNDARIES,
    requiredOperatorInputs: REQUIRED_OPERATOR_INPUTS,
    requiredEvidenceArtifacts: REQUIRED_EVIDENCE_ARTIFACTS,
  };
}

export function formatLiveProofPlan(plan: LiveProofPlan): string {
  return JSON.stringify(plan, null, 2);
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: { help: boolean; outFile?: string } = { help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error("--out requires a path.");
      options.outFile = value;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
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

  const plan = await writeLiveProofPlan({ outFile: options.outFile });
  console.log(formatLiveProofPlan(plan));
  if (options.outFile) {
    console.log("wrotePlan=true");
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
