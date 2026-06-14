import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkLaunchReadiness,
  type LaunchReadinessReport,
} from "./check-launch-readiness.js";
import {
  checkOperatorLiveGates,
  type OperatorLiveGateReport,
} from "./check-operator-live-gates.js";
import {
  checkProductStatus,
  type ProductStatusReport,
} from "./check-product-status.js";

export type RoadmapCompletionBlockerSource =
  | "product-status"
  | "launch-readiness"
  | "operator-live-gates";

export interface RoadmapCompletionBlocker {
  readonly source: RoadmapCompletionBlockerSource;
  readonly id: string;
  readonly status: string;
  readonly code: string;
  readonly next?: string;
}

export interface RoadmapCompletionPhaseSummary {
  readonly id: string;
  readonly status: string;
  readonly blockerCodes: readonly string[];
}

export interface RoadmapCompletionGateSummary {
  readonly id: string;
  readonly status: string;
  readonly code: string;
  readonly approvalRequired?: boolean;
  readonly contactsLiveService?: boolean;
}

export interface RoadmapCompletionReport {
  readonly roadmapComplete: boolean;
  readonly localProofOk: boolean;
  readonly productComplete: boolean;
  readonly launchReady: boolean;
  readonly operatorGatesClear: boolean;
  readonly completionBlockers: readonly RoadmapCompletionBlocker[];
  readonly nextCommands: readonly string[];
  readonly productChecks: readonly RoadmapCompletionGateSummary[];
  readonly launchAreas: readonly RoadmapCompletionPhaseSummary[];
  readonly operatorGates: readonly RoadmapCompletionGateSummary[];
}

export interface RoadmapCompletionArtifact extends RoadmapCompletionReport {
  readonly schemaVersion: 1;
  readonly kind: "agentic-gaskit.roadmap-completion-audit";
  readonly generatedAt: string;
  readonly blockerCodes: readonly string[];
  readonly blockedProductCheckIds: readonly string[];
  readonly blockedLaunchAreaIds: readonly string[];
  readonly blockedOperatorGateIds: readonly string[];
  readonly approvalRequiredGateIds: readonly string[];
  readonly liveServiceGateIds: readonly string[];
  readonly boundaries: readonly string[];
}

export interface RoadmapCompletionOptions {
  readonly cwd?: string;
  readonly productStatus?: ProductStatusReport;
  readonly launchReadiness?: LaunchReadinessReport;
  readonly operatorLiveGates?: OperatorLiveGateReport;
}

export interface WriteRoadmapCompletionArtifactOptions extends RoadmapCompletionOptions {
  readonly now?: Date;
  readonly outFile?: string;
}

interface CliOptions {
  readonly help: boolean;
  readonly json: boolean;
  readonly outFile?: string;
}

const ARTIFACT_BOUNDARIES = [
  "This report is non-networked and only aggregates existing local readiness reports.",
  "roadmapComplete=false means at least one product-status, launch-readiness, or operator live gate remains open.",
  "Operator report templates, proof plans, and redacted local artifacts are not passing evidence by themselves.",
  "Do not commit generated reports, live proof artifacts, credentials, tokens, private keys, raw transaction bytes, user signatures, response bodies, endpoint values, profile paths, full sponsor addresses, or secret local paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/check-roadmap-completion.ts [--json] [--out <path>]

Aggregates product-status, launch-readiness, and operator live-gate reports into one redacted roadmap completion audit.
This command does not contact live services, publish packages, reserve gas, sign transactions, or execute transactions.

Options:
  --json        Print a redacted machine-readable artifact.
  --out <path>  Write the same JSON artifact to a local file with mode 0600.
  --help        Show this help text.
`;

export async function checkRoadmapCompletion(
  options: RoadmapCompletionOptions = {},
): Promise<RoadmapCompletionReport> {
  const cwd = options.cwd ?? process.cwd();
  const productStatus = options.productStatus ?? await checkProductStatus({ cwd });
  const launchReadiness = options.launchReadiness ?? await checkLaunchReadiness({
    cwd,
    productStatus,
  });
  const operatorLiveGates = options.operatorLiveGates ?? await checkOperatorLiveGates({
    cwd,
    productStatus,
  });

  return buildRoadmapCompletionReport({
    productStatus,
    launchReadiness,
    operatorLiveGates,
  });
}

export function buildRoadmapCompletionReport(input: {
  readonly productStatus: ProductStatusReport;
  readonly launchReadiness: LaunchReadinessReport;
  readonly operatorLiveGates: OperatorLiveGateReport;
}): RoadmapCompletionReport {
  const completionBlockers = completionBlockersFor(input);
  return {
    roadmapComplete: input.productStatus.complete
      && input.launchReadiness.launchReady
      && input.operatorLiveGates.allGatesClear,
    localProofOk: input.productStatus.localProofOk && input.launchReadiness.localEvidenceOk,
    productComplete: input.productStatus.complete,
    launchReady: input.launchReadiness.launchReady,
    operatorGatesClear: input.operatorLiveGates.allGatesClear,
    completionBlockers,
    nextCommands: firstUnique(
      completionBlockers
        .map((blocker) => blocker.next)
        .filter((next): next is string => Boolean(next)),
      12,
    ),
    productChecks: input.productStatus.checks.map((check) => ({
      id: check.id,
      status: check.status,
      code: check.code,
    })),
    launchAreas: input.launchReadiness.areas.map((area) => ({
      id: area.id,
      status: area.status,
      blockerCodes: area.blockerCodes,
    })),
    operatorGates: input.operatorLiveGates.gates.map((gate) => ({
      id: gate.id,
      status: gate.status,
      code: gate.code,
      approvalRequired: gate.approvalRequired,
      contactsLiveService: gate.contactsLiveService,
    })),
  };
}

export function buildRoadmapCompletionArtifact(
  report: RoadmapCompletionReport,
  now = new Date(),
): RoadmapCompletionArtifact {
  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.roadmap-completion-audit",
    generatedAt: now.toISOString(),
    ...report,
    blockerCodes: firstUnique(report.completionBlockers.map((blocker) => blocker.code)),
    blockedProductCheckIds: firstUnique(report.completionBlockers
      .filter((blocker) => blocker.source === "product-status")
      .map((blocker) => blocker.id)),
    blockedLaunchAreaIds: firstUnique(report.completionBlockers
      .filter((blocker) => blocker.source === "launch-readiness")
      .map((blocker) => blocker.id)),
    blockedOperatorGateIds: firstUnique(report.completionBlockers
      .filter((blocker) => blocker.source === "operator-live-gates")
      .map((blocker) => blocker.id)),
    approvalRequiredGateIds: report.operatorGates
      .filter((gate) => gate.approvalRequired)
      .map((gate) => gate.id),
    liveServiceGateIds: report.operatorGates
      .filter((gate) => gate.contactsLiveService)
      .map((gate) => gate.id),
    boundaries: ARTIFACT_BOUNDARIES,
  };
}

export async function writeRoadmapCompletionArtifact(
  options: WriteRoadmapCompletionArtifactOptions = {},
): Promise<RoadmapCompletionArtifact> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkRoadmapCompletion(options);
  const artifact = buildRoadmapCompletionArtifact(report, options.now);
  if (options.outFile) {
    const outPath = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, formatRoadmapCompletionArtifact(artifact), { mode: 0o600 });
    await chmod(outPath, 0o600);
  }
  return artifact;
}

export function formatRoadmapCompletionArtifact(artifact: RoadmapCompletionArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

export function formatRoadmapCompletionReport(report: RoadmapCompletionReport): string {
  const lines = [
    `Agentic GasKit roadmap completion ${report.roadmapComplete ? "complete" : "not-complete"}`,
    `roadmapComplete=${report.roadmapComplete}`,
    `localProofOk=${report.localProofOk}`,
    `productComplete=${report.productComplete}`,
    `launchReady=${report.launchReady}`,
    `operatorGatesClear=${report.operatorGatesClear}`,
  ];
  for (const blocker of report.completionBlockers) {
    lines.push(`blocked: ${blocker.source}: ${blocker.id}: status=${blocker.status}: code=${blocker.code}`);
    if (blocker.next) lines.push(`next=${blocker.next}`);
  }
  return lines.join("\n");
}

function completionBlockersFor(input: {
  readonly productStatus: ProductStatusReport;
  readonly launchReadiness: LaunchReadinessReport;
  readonly operatorLiveGates: OperatorLiveGateReport;
}): readonly RoadmapCompletionBlocker[] {
  return [
    ...input.productStatus.checks
      .filter((check) => check.status !== "proven-local" && check.status !== "ready-live")
      .map((check) => ({
        source: "product-status" as const,
        id: check.id,
        status: check.status,
        code: check.code,
        next: check.next,
      })),
    ...input.launchReadiness.areas.flatMap((area) => (
      area.blockerCodes.map((code) => ({
        source: "launch-readiness" as const,
        id: area.id,
        status: area.status,
        code,
        next: area.next,
      }))
    )),
    ...input.operatorLiveGates.gates
      .filter((gate) => gate.status !== "proven-local" && gate.status !== "ready-to-run" && gate.status !== "ready-approval")
      .map((gate) => ({
        source: "operator-live-gates" as const,
        id: gate.id,
        status: gate.status,
        code: gate.code,
        next: gate.next,
      })),
  ];
}

function firstUnique(values: readonly string[], limit = Number.POSITIVE_INFINITY): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
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
      if (!value || value.startsWith("--")) throw new Error("--out requires a path.");
      outFile = value;
      index += 1;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }

  return { help, json, outFile };
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
    const artifact = await writeRoadmapCompletionArtifact({ outFile: options.outFile });
    console.log(formatRoadmapCompletionArtifact(artifact).trimEnd());
    return 0;
  }

  const report = await checkRoadmapCompletion();
  console.log(formatRoadmapCompletionReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
