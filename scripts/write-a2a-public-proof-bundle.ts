import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkA2APublicReadiness,
  type A2APublicReadinessCheck,
  type A2APublicReadinessOptions,
  writeA2APublicReadinessArtifact,
} from "./check-a2a-public-readiness.js";
import { writeA2APublicProofPlan } from "./write-a2a-public-proof-plan.js";
import { writeOperatorReportTemplate } from "./write-operator-report-template.js";

export interface A2APublicProofBundleTemplate {
  readonly id: "a2a-public-discovery" | "a2a-public-push-delivery" | "a2a-external-conformance";
  readonly path: string;
  readonly acceptedReportEnv: string;
}

export interface A2APublicProofBundleStep {
  readonly id: string;
  readonly command: string;
  readonly contactsPublicNetwork: boolean;
  readonly requiresOperatorApproval: boolean;
  readonly dependsOn?: readonly string[];
}

export interface A2APublicProofBundleCheck {
  readonly id: string;
  readonly status: A2APublicReadinessCheck["status"];
  readonly code: string;
  readonly evidence?: string;
  readonly next: string;
}

export interface A2APublicProofBundle {
  readonly schemaVersion: 1;
  readonly kind: "agentic-gaskit.a2a-public-proof-bundle";
  readonly generatedAt: string;
  readonly status: "blocked" | "ready-for-approval";
  readonly localProofOk: boolean;
  readonly publicReady: boolean;
  readonly templateArtifacts: readonly A2APublicProofBundleTemplate[];
  readonly planArtifact: string;
  readonly readinessArtifact: string;
  readonly blockerCodes: readonly string[];
  readonly readyApprovalCodes: readonly string[];
  readonly checks: readonly A2APublicProofBundleCheck[];
  readonly requiredOperatorInputs: readonly string[];
  readonly requiredEvidenceArtifacts: readonly string[];
  readonly steps: readonly A2APublicProofBundleStep[];
  readonly boundaries: readonly string[];
}

export interface WriteA2APublicProofBundleOptions extends A2APublicReadinessOptions {
  readonly now?: Date;
  readonly outFile?: string;
  readonly planOutFile?: string;
  readonly readinessOutFile?: string;
  readonly discoveryTemplateOutFile?: string;
  readonly pushTemplateOutFile?: string;
  readonly conformanceTemplateOutFile?: string;
}

interface CliOptions {
  readonly help: boolean;
  readonly outFile: string;
  readonly planOutFile: string;
  readonly readinessOutFile: string;
  readonly discoveryTemplateOutFile: string;
  readonly pushTemplateOutFile: string;
  readonly conformanceTemplateOutFile: string;
}

type MutableCliOptions = {
  -readonly [Key in keyof CliOptions]: CliOptions[Key];
};

const DEFAULT_OUT_FILE = "tmp/gaskit/a2a-public-proof-bundle.json";
const DEFAULT_PLAN_OUT_FILE = "tmp/gaskit/a2a-public-proof-plan.json";
const DEFAULT_READINESS_OUT_FILE = "tmp/gaskit/a2a-public-readiness.json";
const DEFAULT_DISCOVERY_TEMPLATE_OUT_FILE = "tmp/gaskit/a2a-public-discovery-report-template.json";
const DEFAULT_PUSH_TEMPLATE_OUT_FILE = "tmp/gaskit/a2a-public-push-delivery-report-template.json";
const DEFAULT_CONFORMANCE_TEMPLATE_OUT_FILE = "tmp/gaskit/a2a-external-conformance-report-template.json";

const REQUIRED_OPERATOR_INPUTS = [
  "A2A_PUBLIC_AGENT_CARD_URL",
  "A2A_PUBLIC_BASE_URL",
  "A2A_PUBLIC_JWKS_URL",
  "A2A_PUBLIC_TASK_AUTH_DECISION",
  "A2A_PUBLIC_DISCOVERY_REPORT",
  "A2A_PUBLIC_PUSH_DELIVERY_REPORT",
  "A2A_EXTERNAL_CONFORMANCE_REPORT",
] as const;

const REQUIRED_EVIDENCE_ARTIFACTS = [
  "sanitized public A2A discovery smoke report",
  "sanitized public A2A push-delivery report",
  "sanitized external A2A conformance report",
  "static discovery hosting review artifact",
] as const;

const BOUNDARIES = [
  "This bundle writer is non-networked and only writes ignored local templates, a public A2A proof plan, a readiness artifact, and a bundle summary.",
  "The generated templates are pending-operator-proof artifacts; they do not clear public A2A readiness by themselves.",
  "Public discovery smoke, public push delivery, and external conformance checks contact operator-configured public systems and require explicit operator approval.",
  "Do not commit generated bundle artifacts, public endpoint values, report paths, credentials, private keys, bearer tokens, webhook secrets, raw payloads, response bodies, or local secret paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-a2a-public-proof-bundle.ts [--out <path>]

Writes a non-networked ignored local bundle for public A2A hosting, discovery, push delivery, and external conformance proof gates.
The command writes report templates plus a proof plan and readiness artifact, then summarizes only blocker codes, command order, operator input names, and safety boundaries.`;

export async function writeA2APublicProofBundle(
  options: WriteA2APublicProofBundleOptions = {},
): Promise<A2APublicProofBundle> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const outFile = options.outFile ?? DEFAULT_OUT_FILE;
  const planOutFile = options.planOutFile ?? DEFAULT_PLAN_OUT_FILE;
  const readinessOutFile = options.readinessOutFile ?? DEFAULT_READINESS_OUT_FILE;
  const discoveryTemplateOutFile = options.discoveryTemplateOutFile ?? DEFAULT_DISCOVERY_TEMPLATE_OUT_FILE;
  const pushTemplateOutFile = options.pushTemplateOutFile ?? DEFAULT_PUSH_TEMPLATE_OUT_FILE;
  const conformanceTemplateOutFile = options.conformanceTemplateOutFile ?? DEFAULT_CONFORMANCE_TEMPLATE_OUT_FILE;

  await writeOperatorReportTemplate({
    cwd,
    kind: "a2a-public-discovery",
    now,
    outFile: discoveryTemplateOutFile,
  });
  await writeOperatorReportTemplate({
    cwd,
    kind: "a2a-public-push-delivery",
    now,
    outFile: pushTemplateOutFile,
  });
  await writeOperatorReportTemplate({
    cwd,
    kind: "a2a-external-conformance",
    now,
    outFile: conformanceTemplateOutFile,
  });
  await writeA2APublicProofPlan({
    ...options,
    cwd,
    now,
    outFile: planOutFile,
  });
  await writeA2APublicReadinessArtifact({
    ...options,
    cwd,
    now,
    outFile: readinessOutFile,
  });

  const readiness = await checkA2APublicReadiness({ ...options, cwd, now });
  const checks = readiness.checks.map((check) => stripCheck(check));
  const blockers = checks.filter((check) => check.status !== "proven-local" && check.status !== "ready-approval");
  const readyApproval = checks.filter((check) => check.status === "ready-approval");

  const bundle: A2APublicProofBundle = {
    schemaVersion: 1,
    kind: "agentic-gaskit.a2a-public-proof-bundle",
    generatedAt: now.toISOString(),
    status: readiness.publicReady ? "ready-for-approval" : "blocked",
    localProofOk: readiness.localProofOk,
    publicReady: readiness.publicReady,
    templateArtifacts: [
      {
        id: "a2a-public-discovery",
        path: discoveryTemplateOutFile,
        acceptedReportEnv: "A2A_PUBLIC_DISCOVERY_REPORT",
      },
      {
        id: "a2a-public-push-delivery",
        path: pushTemplateOutFile,
        acceptedReportEnv: "A2A_PUBLIC_PUSH_DELIVERY_REPORT",
      },
      {
        id: "a2a-external-conformance",
        path: conformanceTemplateOutFile,
        acceptedReportEnv: "A2A_EXTERNAL_CONFORMANCE_REPORT",
      },
    ],
    planArtifact: planOutFile,
    readinessArtifact: readinessOutFile,
    blockerCodes: blockers.map((check) => check.code),
    readyApprovalCodes: readyApproval.map((check) => check.code),
    checks,
    requiredOperatorInputs: REQUIRED_OPERATOR_INPUTS,
    requiredEvidenceArtifacts: REQUIRED_EVIDENCE_ARTIFACTS,
    steps: buildSteps({
      planOutFile,
      readinessOutFile,
      discoveryTemplateOutFile,
      pushTemplateOutFile,
      conformanceTemplateOutFile,
    }),
    boundaries: BOUNDARIES,
  };

  await writeJsonFile(cwd, outFile, bundle);
  return bundle;
}

function stripCheck(check: A2APublicReadinessCheck): A2APublicProofBundleCheck {
  return {
    id: check.id,
    status: check.status,
    code: check.code,
    evidence: check.evidence,
    next: check.next,
  };
}

function buildSteps(input: {
  readonly planOutFile: string;
  readonly readinessOutFile: string;
  readonly discoveryTemplateOutFile: string;
  readonly pushTemplateOutFile: string;
  readonly conformanceTemplateOutFile: string;
}): readonly A2APublicProofBundleStep[] {
  return [
    {
      id: "write-public-proof-plan",
      command: `npm run a2a:write-public-proof-plan -- --out ${input.planOutFile}`,
      contactsPublicNetwork: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-public-readiness-artifact",
      command: `npm run proof:a2a-public-readiness -- --out ${input.readinessOutFile}`,
      contactsPublicNetwork: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-public-discovery-template",
      command: `npm run operator:write-report-template -- --kind a2a-public-discovery --out ${input.discoveryTemplateOutFile}`,
      contactsPublicNetwork: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-public-push-delivery-template",
      command: `npm run operator:write-report-template -- --kind a2a-public-push-delivery --out ${input.pushTemplateOutFile}`,
      contactsPublicNetwork: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-external-conformance-template",
      command: `npm run operator:write-report-template -- --kind a2a-external-conformance --out ${input.conformanceTemplateOutFile}`,
      contactsPublicNetwork: false,
      requiresOperatorApproval: false,
    },
    {
      id: "run-public-discovery-smoke",
      command: "npm run smoke:a2a-public-discovery -- --report tmp/gaskit/a2a-public-discovery-report.json",
      contactsPublicNetwork: true,
      requiresOperatorApproval: true,
      dependsOn: ["write-public-discovery-template"],
    },
    {
      id: "check-public-readiness",
      command: `npm run proof:a2a-public-readiness -- --out ${input.readinessOutFile}`,
      contactsPublicNetwork: false,
      requiresOperatorApproval: false,
      dependsOn: [
        "run-public-discovery-smoke",
        "write-public-push-delivery-template",
        "write-external-conformance-template",
      ],
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
    readinessOutFile: DEFAULT_READINESS_OUT_FILE,
    discoveryTemplateOutFile: DEFAULT_DISCOVERY_TEMPLATE_OUT_FILE,
    pushTemplateOutFile: DEFAULT_PUSH_TEMPLATE_OUT_FILE,
    conformanceTemplateOutFile: DEFAULT_CONFORMANCE_TEMPLATE_OUT_FILE,
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
    if (arg === "--readiness-out") {
      options.readinessOutFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--discovery-template-out") {
      options.discoveryTemplateOutFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--push-template-out") {
      options.pushTemplateOutFile = readArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--conformance-template-out") {
      options.conformanceTemplateOutFile = readArg(argv, index, arg);
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

  const bundle = await writeA2APublicProofBundle({
    outFile: options.outFile,
    planOutFile: options.planOutFile,
    readinessOutFile: options.readinessOutFile,
    discoveryTemplateOutFile: options.discoveryTemplateOutFile,
    pushTemplateOutFile: options.pushTemplateOutFile,
    conformanceTemplateOutFile: options.conformanceTemplateOutFile,
  });
  console.log(JSON.stringify(bundle, null, 2));
  console.log("wroteBundle=true");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
