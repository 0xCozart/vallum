import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  writeRoadmapExecutionProofBundle,
  type RoadmapExecutionProofBundle,
  type RoadmapExecutionProofBundleArtifactRef,
} from "./write-roadmap-execution-proof-bundle.js";

export type BlockerResolutionPlanStatus = "blocked" | "ready-for-approval";

export interface BlockerResolutionPlanConditionalInput {
  readonly input: string;
  readonly requiredWhen: string;
  readonly secret: boolean;
}

export interface BlockerResolutionPlanGroup {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly bundlePath: string;
  readonly blockerCodes: readonly string[];
  readonly readyCodes: readonly string[];
  readonly acceptedReportEnvs: readonly string[];
  readonly requiredOperatorInputs: readonly string[];
  readonly conditionalOperatorInputs: readonly BlockerResolutionPlanConditionalInput[];
  readonly requiredStructuredReportFields: readonly string[];
  readonly requiredEvidenceArtifacts: readonly string[];
  readonly nonNetworkedCommands: readonly string[];
  readonly approvalRequiredCommands: readonly string[];
  readonly boundaries: readonly string[];
}

export interface BlockerResolutionPlanArtifactRef {
  readonly id: string;
  readonly kind: string;
  readonly path: string;
  readonly blockerCodes: readonly string[];
  readonly readyCodes: readonly string[];
}

export interface BlockerResolutionPlan {
  readonly schemaVersion: 1;
  readonly kind: "vallum.blocker-resolution-plan";
  readonly generatedAt: string;
  readonly status: BlockerResolutionPlanStatus;
  readonly localProofOk: boolean;
  readonly roadmapComplete: boolean;
  readonly productComplete: boolean;
  readonly launchReady: boolean;
  readonly operatorGatesClear: boolean;
  readonly artifactDir: string;
  readonly roadmapBundlePath: string;
  readonly statusArtifacts: readonly BlockerResolutionPlanArtifactRef[];
  readonly blockerCodes: readonly string[];
  readonly readyApprovalGateIds: readonly string[];
  readonly approvalRequiredGateIds: readonly string[];
  readonly liveServiceGateIds: readonly string[];
  readonly blockerGroups: readonly BlockerResolutionPlanGroup[];
  readonly nextCommands: readonly string[];
  readonly boundaries: readonly string[];
}

export interface WriteBlockerResolutionPlanOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly now?: Date;
  readonly outFile?: string;
  readonly artifactDir?: string;
}

interface CliOptions {
  readonly help: boolean;
  readonly outFile: string;
  readonly artifactDir: string;
}

type MutableCliOptions = {
  -readonly [Key in keyof CliOptions]: CliOptions[Key];
};

interface GeneratedProofBundle {
  readonly kind?: string;
  readonly status?: string;
  readonly blockerCodes?: readonly unknown[];
  readonly readyCodes?: readonly unknown[];
  readonly readyApprovalCodes?: readonly unknown[];
  readonly templateArtifacts?: readonly unknown[];
  readonly requiredOperatorInputs?: readonly unknown[];
  readonly conditionalOperatorInputs?: readonly unknown[];
  readonly requiredStructuredReportFields?: readonly unknown[];
  readonly requiredEvidenceArtifacts?: readonly unknown[];
  readonly steps?: readonly unknown[];
  readonly boundaries?: readonly unknown[];
}

interface GeneratedProofBundleTemplate {
  readonly acceptedReportEnv?: unknown;
}

interface GeneratedProofBundleStep {
  readonly command?: unknown;
  readonly requiresOperatorApproval?: unknown;
  readonly contactsLiveService?: unknown;
  readonly contactsPublicNetwork?: unknown;
  readonly contactsPaymentProvider?: unknown;
  readonly dependsOn?: unknown;
}

const DEFAULT_ARTIFACT_DIR = "tmp/vallum/blocker-resolution";
const DEFAULT_OUT_FILE = "tmp/vallum/blocker-resolution-plan.json";
const ROADMAP_BUNDLE_FILE = "roadmap-execution-proof-bundle.json";

const BOUNDARIES = [
  "This plan writer is non-networked and composes existing ignored local status artifacts and proof-preparation bundles.",
  "It lists environment variable names, command names, report kinds, blocker codes, and ignored artifact paths only; it does not print configured endpoint values or secrets.",
  "Generated templates, plans, readiness artifacts, and proof bundles are not passing live or production evidence by themselves.",
  "Only explicit operator-approved proof steps may contact IOTA, npm, public A2A endpoints, payment providers, marketplace systems, custody systems, KMS providers, or physical devices.",
  "Do not commit generated blocker-resolution artifacts, report contents, credentials, tokens, private keys, raw request or response bodies, payment instruments, endpoint values, local report paths, or local secret paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-blocker-resolution-plan.ts [--out <path>] [--artifact-dir <path>]

Writes one non-networked ignored local plan that cross-references the current roadmap blockers with the exact proof bundles, operator inputs, and approval-required commands needed to resolve them.`;

export async function writeBlockerResolutionPlan(
  options: WriteBlockerResolutionPlanOptions = {},
): Promise<BlockerResolutionPlan> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const artifactDir = options.artifactDir ?? DEFAULT_ARTIFACT_DIR;
  const outFile = options.outFile ?? DEFAULT_OUT_FILE;
  const roadmapBundlePath = join(artifactDir, ROADMAP_BUNDLE_FILE);

  const roadmap = await writeRoadmapExecutionProofBundle({
    cwd,
    env: options.env,
    now,
    artifactDir,
    outFile: roadmapBundlePath,
  });
  const blockerGroups = await buildBlockerGroups(cwd, roadmap.proofBundles);

  const plan: BlockerResolutionPlan = {
    schemaVersion: 1,
    kind: "vallum.blocker-resolution-plan",
    generatedAt: now.toISOString(),
    status: roadmap.roadmapComplete ? "ready-for-approval" : "blocked",
    localProofOk: roadmap.localProofOk,
    roadmapComplete: roadmap.roadmapComplete,
    productComplete: roadmap.productComplete,
    launchReady: roadmap.launchReady,
    operatorGatesClear: roadmap.operatorGatesClear,
    artifactDir,
    roadmapBundlePath,
    statusArtifacts: roadmap.statusArtifacts.map(toArtifactRef),
    blockerCodes: roadmap.blockerCodes,
    readyApprovalGateIds: roadmap.readyApprovalGateIds,
    approvalRequiredGateIds: roadmap.approvalRequiredGateIds,
    liveServiceGateIds: roadmap.liveServiceGateIds,
    blockerGroups,
    nextCommands: firstUnique([
      ...blockerGroups.flatMap((group) => group.nonNetworkedCommands),
      ...roadmap.nextCommands,
      ...blockerGroups.flatMap((group) => group.approvalRequiredCommands),
      "npm run proof:product-status",
      "npm run proof:launch-readiness",
      "npm run proof:operator-gates",
      "npm run proof:roadmap-completion",
    ]),
    boundaries: BOUNDARIES,
  };

  await writeJsonFile(cwd, outFile, plan);
  return plan;
}

async function buildBlockerGroups(
  cwd: string,
  proofBundles: readonly RoadmapExecutionProofBundleArtifactRef[],
): Promise<readonly BlockerResolutionPlanGroup[]> {
  const groups: BlockerResolutionPlanGroup[] = [];
  for (const artifact of proofBundles) {
    if (artifact.blockerCodes.length === 0) continue;
    const bundle = await readJsonFile<GeneratedProofBundle>(cwd, artifact.path);
    groups.push({
      id: artifact.id,
      kind: readString(bundle.kind, artifact.kind),
      status: readString(bundle.status, artifact.status ?? "blocked"),
      bundlePath: artifact.path,
      blockerCodes: readStringArray(bundle.blockerCodes, artifact.blockerCodes),
      readyCodes: firstUnique([
        ...artifact.readyCodes,
        ...readStringArray(bundle.readyCodes, []),
        ...readStringArray(bundle.readyApprovalCodes, []),
      ]),
      acceptedReportEnvs: readAcceptedReportEnvs(bundle.templateArtifacts),
      requiredOperatorInputs: readStringArray(bundle.requiredOperatorInputs, []),
      conditionalOperatorInputs: readConditionalInputs(bundle.conditionalOperatorInputs),
      requiredStructuredReportFields: readStringArray(bundle.requiredStructuredReportFields, []),
      requiredEvidenceArtifacts: readStringArray(bundle.requiredEvidenceArtifacts, []),
      nonNetworkedCommands: readStepCommands(bundle.steps, "non-networked"),
      approvalRequiredCommands: readStepCommands(bundle.steps, "approval-required"),
      boundaries: readStringArray(bundle.boundaries, []),
    });
  }
  return groups;
}

function toArtifactRef(artifact: RoadmapExecutionProofBundleArtifactRef): BlockerResolutionPlanArtifactRef {
  return {
    id: artifact.id,
    kind: artifact.kind,
    path: artifact.path,
    blockerCodes: artifact.blockerCodes,
    readyCodes: artifact.readyCodes,
  };
}

function readAcceptedReportEnvs(value: readonly unknown[] | undefined): readonly string[] {
  if (!Array.isArray(value)) return [];
  return firstUnique(
    value
      .map((item) => (isRecord(item) ? (item as GeneratedProofBundleTemplate).acceptedReportEnv : undefined))
      .filter(isString),
  );
}

function readConditionalInputs(value: readonly unknown[] | undefined): readonly BlockerResolutionPlanConditionalInput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const input = item.input;
    const requiredWhen = item.requiredWhen;
    const secret = item.secret;
    if (!isString(input) || !isString(requiredWhen) || typeof secret !== "boolean") return [];
    return [{ input, requiredWhen, secret }];
  });
}

function readStepCommands(
  value: readonly unknown[] | undefined,
  mode: "non-networked" | "approval-required",
): readonly string[] {
  if (!Array.isArray(value)) return [];
  return firstUnique(
    value.flatMap((item) => {
      if (!isRecord(item)) return [];
      const step = item as GeneratedProofBundleStep;
      if (!isString(step.command)) return [];
      const approvalRequired = step.requiresOperatorApproval === true
        || step.contactsLiveService === true
        || step.contactsPublicNetwork === true
        || step.contactsPaymentProvider === true;
      if (mode === "approval-required") return approvalRequired ? [step.command] : [];
      return approvalRequired ? [] : [step.command];
    }),
  );
}

function readStringArray(value: readonly unknown[] | undefined, fallback: readonly string[]): readonly string[] {
  if (!Array.isArray(value)) return fallback;
  return firstUnique(value.filter(isString));
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

async function readJsonFile<T>(cwd: string, path: string): Promise<T> {
  const file = isAbsolute(path) ? path : resolve(cwd, path);
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function writeJsonFile(cwd: string, path: string, value: unknown): Promise<void> {
  const outFile = isAbsolute(path) ? path : resolve(cwd, path);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(outFile, 0o600);
}

function firstUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: MutableCliOptions = {
    help: false,
    outFile: DEFAULT_OUT_FILE,
    artifactDir: DEFAULT_ARTIFACT_DIR,
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
    if (arg === "--artifact-dir") {
      options.artifactDir = readArg(argv, index, arg);
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

  const plan = await writeBlockerResolutionPlan({
    outFile: options.outFile,
    artifactDir: options.artifactDir,
  });
  console.log(JSON.stringify(plan, null, 2));
  console.log("wrotePlan=true");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
