import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkA2APublicReadiness,
  type A2APublicReadinessCheck,
  type A2APublicReadinessReport,
} from "./check-a2a-public-readiness.js";

export interface A2APublicProofPlanCommand {
  readonly id: string;
  readonly command: string;
  readonly contactsPublicNetwork: boolean;
  readonly requiresOperatorApproval: boolean;
}

export interface A2APublicProofPlanCheck {
  readonly id: string;
  readonly status: A2APublicReadinessCheck["status"];
  readonly code: string;
  readonly next: string;
}

export interface A2APublicProofPlan {
  readonly schemaVersion: 1;
  readonly kind: "vallum.a2a-public-proof-plan";
  readonly generatedAt: string;
  readonly localProofOk: boolean;
  readonly publicReady: boolean;
  readonly status: "blocked" | "ready-for-approval";
  readonly commands: readonly A2APublicProofPlanCommand[];
  readonly blockerCodes: readonly string[];
  readonly readyApprovalCodes: readonly string[];
  readonly checks: readonly A2APublicProofPlanCheck[];
  readonly boundaries: readonly string[];
  readonly requiredOperatorInputs: readonly string[];
}

interface CliOptions {
  readonly help: boolean;
  readonly outFile?: string;
}

export interface WriteA2APublicProofPlanOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly now?: Date;
  readonly outFile?: string;
  readonly scripts?: Record<string, string | undefined>;
}

const REQUIRED_OPERATOR_INPUTS = [
  "A2A_PUBLIC_AGENT_CARD_URL",
  "A2A_PUBLIC_BASE_URL",
  "A2A_PUBLIC_JWKS_URL",
  "A2A_PUBLIC_TASK_AUTH_DECISION",
  "A2A_PUBLIC_DISCOVERY_REPORT",
  "A2A_PUBLIC_PUSH_DELIVERY_REPORT",
  "A2A_EXTERNAL_CONFORMANCE_REPORT",
] as const;

const PLAN_COMMANDS: readonly A2APublicProofPlanCommand[] = [
  {
    id: "write-static-discovery-bundle",
    command: "npm run a2a:write-static-discovery-bundle -- --agent-card <signed-card.json> --jwks <jwks.json> --public-base-url <url> --public-jwks-url <url> --out-dir <dir>",
    contactsPublicNetwork: false,
    requiresOperatorApproval: false,
  },
  {
    id: "check-static-discovery-bundle",
    command: "npm run a2a:check-static-discovery-bundle -- --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url>",
    contactsPublicNetwork: false,
    requiresOperatorApproval: false,
  },
  {
    id: "smoke-static-discovery-local",
    command: "npm run smoke:a2a-static-discovery-local -- --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url>",
    contactsPublicNetwork: false,
    requiresOperatorApproval: false,
  },
  {
    id: "write-static-hosting-review",
    command: "npm run a2a:write-static-hosting-review -- --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url> --out <review.json>",
    contactsPublicNetwork: false,
    requiresOperatorApproval: false,
  },
  {
    id: "smoke-public-discovery",
    command: "npm run smoke:a2a-public-discovery -- --report <local-report-path>",
    contactsPublicNetwork: true,
    requiresOperatorApproval: true,
  },
  {
    id: "smoke-public-push-delivery",
    command: "npm run smoke:a2a-public-push-delivery -- --report <local-report-path>",
    contactsPublicNetwork: true,
    requiresOperatorApproval: true,
  },
  {
    id: "check-public-readiness",
    command: "npm run proof:a2a-public-readiness",
    contactsPublicNetwork: false,
    requiresOperatorApproval: false,
  },
] as const;

const BOUNDARIES = [
  "This plan is non-networked and does not prove public hosting.",
  "Only smoke-public-discovery and smoke-public-push-delivery contact public A2A endpoints or callbacks, and both require operator approval.",
  "Do not commit report files, public proof outputs, credentials, private keys, bearer tokens, webhook secrets, raw payloads, or response bodies.",
  "ready-for-approval means the evidence packet is reviewable; it is not production A2A conformance by itself.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-a2a-public-proof-plan.ts [--out <path>]

Writes a redacted non-networked public A2A proof plan from current readiness gates.
The plan prints command names, blocker codes, and operator input names only.`;

export async function writeA2APublicProofPlan(
  options: WriteA2APublicProofPlanOptions = {},
): Promise<A2APublicProofPlan> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkA2APublicReadiness({
    cwd,
    env: options.env,
    now: options.now,
    scripts: options.scripts,
  });
  const plan = buildA2APublicProofPlan(report, options.now ?? new Date());
  if (options.outFile) {
    const outFile = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, `${formatA2APublicProofPlan(plan)}\n`, { mode: 0o600 });
  }
  return plan;
}

export function buildA2APublicProofPlan(
  report: A2APublicReadinessReport,
  now: Date = new Date(),
): A2APublicProofPlan {
  const checks = report.checks.map((check) => ({
    id: check.id,
    status: check.status,
    code: check.code,
    next: check.next,
  }));
  const blockers = checks.filter((check) => check.status !== "proven-local" && check.status !== "ready-approval");
  const readyApproval = checks.filter((check) => check.status === "ready-approval");

  return {
    schemaVersion: 1,
    kind: "vallum.a2a-public-proof-plan",
    generatedAt: now.toISOString(),
    localProofOk: report.localProofOk,
    publicReady: report.publicReady,
    status: report.publicReady ? "ready-for-approval" : "blocked",
    commands: PLAN_COMMANDS,
    blockerCodes: blockers.map((check) => check.code),
    readyApprovalCodes: readyApproval.map((check) => check.code),
    checks,
    boundaries: BOUNDARIES,
    requiredOperatorInputs: REQUIRED_OPERATOR_INPUTS,
  };
}

export function formatA2APublicProofPlan(plan: A2APublicProofPlan): string {
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

  const plan = await writeA2APublicProofPlan({ outFile: options.outFile });
  console.log(formatA2APublicProofPlan(plan));
  if (options.outFile) {
    console.log("wrotePlan=true");
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
