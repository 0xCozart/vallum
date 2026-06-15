import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkLiveProofStatus,
  type CheckLiveProofStatusOptions,
  type LiveProofCheck,
  writeLiveProofStatusArtifact,
} from "./check-live-proof-status.js";
import { writeLiveProofPlan } from "./write-live-proof-plan.js";
import { writeOperatorReportTemplate } from "./write-operator-report-template.js";

export interface IdentityProofBundleTemplate {
  readonly id: "iota-names-live" | "iota-identity-live" | "vc-validation-live";
  readonly path: string;
  readonly acceptedReportEnv: string;
}

export interface IdentityProofBundleStep {
  readonly id: string;
  readonly command: string;
  readonly contactsLiveService: boolean;
  readonly requiresOperatorApproval: boolean;
  readonly dependsOn?: readonly string[];
}

export interface IdentityProofBundle {
  readonly schemaVersion: 1;
  readonly kind: "agentrail.identity-proof-bundle";
  readonly generatedAt: string;
  readonly status: "blocked" | "ready";
  readonly ready: boolean;
  readonly templateArtifacts: readonly IdentityProofBundleTemplate[];
  readonly planArtifact: string;
  readonly liveStatusArtifact: string;
  readonly blockerCodes: readonly string[];
  readonly readyCodes: readonly string[];
  readonly checks: readonly IdentityProofBundleCheck[];
  readonly requiredOperatorInputs: readonly string[];
  readonly requiredEvidenceArtifacts: readonly string[];
  readonly steps: readonly IdentityProofBundleStep[];
  readonly boundaries: readonly string[];
}

export interface IdentityProofBundleCheck {
  readonly id: "iota-names-live" | "iota-identity-live" | "vc-validation-live";
  readonly status: LiveProofCheck["status"];
  readonly code: string;
  readonly missing?: readonly string[];
  readonly evidence?: string;
  readonly next?: string;
}

export interface WriteIdentityProofBundleOptions extends CheckLiveProofStatusOptions {
  readonly now?: Date;
  readonly outFile?: string;
  readonly planOutFile?: string;
  readonly liveStatusOutFile?: string;
  readonly namesTemplateOutFile?: string;
  readonly identityTemplateOutFile?: string;
  readonly vcTemplateOutFile?: string;
}

interface CliOptions {
  readonly help: boolean;
  readonly outFile: string;
  readonly planOutFile: string;
  readonly liveStatusOutFile: string;
  readonly namesTemplateOutFile: string;
  readonly identityTemplateOutFile: string;
  readonly vcTemplateOutFile: string;
}

type MutableCliOptions = {
  -readonly [Key in keyof CliOptions]: CliOptions[Key];
};

const DEFAULT_OUT_FILE = "tmp/agentrail/identity-proof-bundle.json";
const DEFAULT_PLAN_OUT_FILE = "tmp/agentrail/live-proof-plan.json";
const DEFAULT_LIVE_STATUS_OUT_FILE = "tmp/agentrail/live-proof-status.json";
const DEFAULT_NAMES_TEMPLATE_OUT_FILE = "tmp/agentrail/iota-names-live-report-template.json";
const DEFAULT_IDENTITY_TEMPLATE_OUT_FILE = "tmp/agentrail/iota-identity-live-report-template.json";
const DEFAULT_VC_TEMPLATE_OUT_FILE = "tmp/agentrail/vc-validation-live-report-template.json";

const IDENTITY_CHECK_IDS = new Set(["iota-names-live", "iota-identity-live", "vc-validation-live"]);

const REQUIRED_OPERATOR_INPUTS = [
  "IOTA_NAMES_GRAPHQL_URL",
  "IOTA_NAMES_NAME",
  "IOTA_NAMES_EXPECTED_ADDRESS",
  "IOTA_NAMES_LIVE_REPORT",
  "IOTA_IDENTITY_PROOF_ENDPOINT",
  "IOTA_IDENTITY_PROFILE_PATH",
  "IOTA_IDENTITY_LIVE_REPORT",
  "IOTA_IDENTITY_TRUSTED_ISSUER_DIDS",
  "IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS",
  "IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES",
  "IOTA_IDENTITY_ACCEPTED_STATUS_TYPES",
  "IOTA_IDENTITY_CACHE_TTL_MS",
] as const;

const REQUIRED_EVIDENCE_ARTIFACTS = [
  "sanitized IOTA Names live smoke report",
  "sanitized IOTA Identity live smoke report with credential evidence",
  "VC trust-policy variables configured outside committed files",
] as const;

const BOUNDARIES = [
  "This bundle writer is non-networked and only writes ignored local templates, a live proof plan, a live proof status artifact, and a bundle summary.",
  "The generated templates are pending-operator-proof artifacts; they do not clear readiness by themselves.",
  "IOTA Names and IOTA Identity smoke commands contact live operator-configured services and require explicit operator approval.",
  "VC validation depends on a current passing IOTA Identity live smoke report with credential evidence and configured trust policy.",
  "Do not commit generated bundle artifacts, endpoint values, profile paths, names, addresses, DIDs, credential refs, proof responses, credentials, tokens, private keys, raw transaction bytes, user signatures, or local secret paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-identity-proof-bundle.ts [--out <path>]

Writes a non-networked ignored local bundle for the linked IOTA Names, IOTA Identity, and VC trust-policy live proof gates.
The command writes report templates plus a live-proof plan and live-proof status artifact, then summarizes only blocker codes, missing variable names, command order, and safety boundaries.`;

export async function writeIdentityProofBundle(
  options: WriteIdentityProofBundleOptions = {},
): Promise<IdentityProofBundle> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const outFile = options.outFile ?? DEFAULT_OUT_FILE;
  const planOutFile = options.planOutFile ?? DEFAULT_PLAN_OUT_FILE;
  const liveStatusOutFile = options.liveStatusOutFile ?? DEFAULT_LIVE_STATUS_OUT_FILE;
  const namesTemplateOutFile = options.namesTemplateOutFile ?? DEFAULT_NAMES_TEMPLATE_OUT_FILE;
  const identityTemplateOutFile = options.identityTemplateOutFile ?? DEFAULT_IDENTITY_TEMPLATE_OUT_FILE;
  const vcTemplateOutFile = options.vcTemplateOutFile ?? DEFAULT_VC_TEMPLATE_OUT_FILE;

  await writeOperatorReportTemplate({
    cwd,
    kind: "iota-names-live",
    now,
    outFile: namesTemplateOutFile,
  });
  await writeOperatorReportTemplate({
    cwd,
    kind: "iota-identity-live",
    now,
    outFile: identityTemplateOutFile,
  });
  await writeOperatorReportTemplate({
    cwd,
    kind: "vc-validation-live",
    now,
    outFile: vcTemplateOutFile,
  });
  await writeLiveProofPlan({
    ...options,
    cwd,
    now,
    outFile: planOutFile,
  });
  await writeLiveProofStatusArtifact({
    ...options,
    cwd,
    now,
    outFile: liveStatusOutFile,
  });

  const status = await checkLiveProofStatus({ ...options, cwd });
  const checks = status.checks
    .filter((check): check is LiveProofCheck & { id: IdentityProofBundleCheck["id"] } => IDENTITY_CHECK_IDS.has(check.id))
    .map((check) => stripCheck(check));
  const ready = checks.every((check) => check.status === "ready");
  const bundle: IdentityProofBundle = {
    schemaVersion: 1,
    kind: "agentrail.identity-proof-bundle",
    generatedAt: now.toISOString(),
    status: ready ? "ready" : "blocked",
    ready,
    templateArtifacts: [
      {
        id: "iota-names-live",
        path: namesTemplateOutFile,
        acceptedReportEnv: "IOTA_NAMES_LIVE_REPORT",
      },
      {
        id: "iota-identity-live",
        path: identityTemplateOutFile,
        acceptedReportEnv: "IOTA_IDENTITY_LIVE_REPORT",
      },
      {
        id: "vc-validation-live",
        path: vcTemplateOutFile,
        acceptedReportEnv: "IOTA_IDENTITY_LIVE_REPORT",
      },
    ],
    planArtifact: planOutFile,
    liveStatusArtifact: liveStatusOutFile,
    blockerCodes: checks.filter((check) => check.status === "blocked").map((check) => check.code),
    readyCodes: checks.filter((check) => check.status === "ready").map((check) => check.code),
    checks,
    requiredOperatorInputs: REQUIRED_OPERATOR_INPUTS,
    requiredEvidenceArtifacts: REQUIRED_EVIDENCE_ARTIFACTS,
    steps: buildSteps({
      namesTemplateOutFile,
      identityTemplateOutFile,
      vcTemplateOutFile,
      planOutFile,
    }),
    boundaries: BOUNDARIES,
  };

  await writeJsonFile(cwd, outFile, bundle);
  return bundle;
}

function stripCheck(check: LiveProofCheck & { id: IdentityProofBundleCheck["id"] }): IdentityProofBundleCheck {
  return {
    id: check.id,
    status: check.status,
    code: check.code,
    missing: check.missing,
    evidence: check.evidence,
    next: check.next,
  };
}

function buildSteps(input: {
  readonly namesTemplateOutFile: string;
  readonly identityTemplateOutFile: string;
  readonly vcTemplateOutFile: string;
  readonly planOutFile: string;
}): readonly IdentityProofBundleStep[] {
  return [
    {
      id: "write-live-proof-plan",
      command: `npm run live:write-proof-plan -- --out ${input.planOutFile}`,
      contactsLiveService: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-iota-names-template",
      command: `npm run operator:write-report-template -- --kind iota-names-live --out ${input.namesTemplateOutFile}`,
      contactsLiveService: false,
      requiresOperatorApproval: false,
    },
    {
      id: "run-iota-names-smoke",
      command: "npm run smoke:iota-names-live -- --report tmp/agentrail/iota-names-live-report.json",
      contactsLiveService: true,
      requiresOperatorApproval: true,
      dependsOn: ["write-iota-names-template"],
    },
    {
      id: "write-iota-identity-template",
      command: `npm run operator:write-report-template -- --kind iota-identity-live --out ${input.identityTemplateOutFile}`,
      contactsLiveService: false,
      requiresOperatorApproval: false,
    },
    {
      id: "run-iota-identity-smoke",
      command: "npm run smoke:iota-identity-live -- --report tmp/agentrail/iota-identity-live-report.json",
      contactsLiveService: true,
      requiresOperatorApproval: true,
      dependsOn: ["write-iota-identity-template"],
    },
    {
      id: "write-vc-validation-template",
      command: `npm run operator:write-report-template -- --kind vc-validation-live --out ${input.vcTemplateOutFile}`,
      contactsLiveService: false,
      requiresOperatorApproval: false,
      dependsOn: ["run-iota-identity-smoke"],
    },
    {
      id: "check-live-proof-status",
      command: "npm run proof:live-status -- --out tmp/agentrail/live-proof-status.json",
      contactsLiveService: false,
      requiresOperatorApproval: false,
      dependsOn: ["run-iota-names-smoke", "run-iota-identity-smoke", "write-vc-validation-template"],
    },
  ];
}

async function writeJsonFile(cwd: string, path: string, value: unknown): Promise<void> {
  const outFile = isAbsolute(path) ? path : resolve(cwd, path);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(outFile, 0o600);
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: MutableCliOptions = {
    help: false,
    outFile: DEFAULT_OUT_FILE,
    planOutFile: DEFAULT_PLAN_OUT_FILE,
    liveStatusOutFile: DEFAULT_LIVE_STATUS_OUT_FILE,
    namesTemplateOutFile: DEFAULT_NAMES_TEMPLATE_OUT_FILE,
    identityTemplateOutFile: DEFAULT_IDENTITY_TEMPLATE_OUT_FILE,
    vcTemplateOutFile: DEFAULT_VC_TEMPLATE_OUT_FILE,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--out") {
      options.outFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--plan-out") {
      options.planOutFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--live-status-out") {
      options.liveStatusOutFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--names-template-out") {
      options.namesTemplateOutFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--identity-template-out") {
      options.identityTemplateOutFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--vc-template-out") {
      options.vcTemplateOutFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function readArg(argv: readonly string[], index: number, name: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
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

  const bundle = await writeIdentityProofBundle({
    outFile: options.outFile,
    planOutFile: options.planOutFile,
    liveStatusOutFile: options.liveStatusOutFile,
    namesTemplateOutFile: options.namesTemplateOutFile,
    identityTemplateOutFile: options.identityTemplateOutFile,
    vcTemplateOutFile: options.vcTemplateOutFile,
  });
  console.log(JSON.stringify(bundle, null, 2));
  console.log("wroteBundle=true");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
