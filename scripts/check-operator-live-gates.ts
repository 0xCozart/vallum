import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkProductStatus,
  type ProductEvidenceCheck,
  type ProductStatusReport,
} from "./check-product-status.js";
import type {
  GasStationRuntimeCommandRunner,
  GasStationRuntimePreflightReport,
} from "./check-gas-station-runtime-preflight.js";

export type OperatorGateStatus =
  | "proven-local"
  | "ready-to-run"
  | "ready-approval"
  | "blocked-config"
  | "requires-approval"
  | "blocked-production"
  | "deferred-safety";

export interface OperatorLiveGate {
  readonly id: string;
  readonly status: OperatorGateStatus;
  readonly code: string;
  readonly command?: string;
  readonly approvalRequired: boolean;
  readonly contactsLiveService: boolean;
  readonly message: string;
  readonly next: string;
}

export interface OperatorLiveGateReport {
  readonly allGatesClear: boolean;
  readonly localOnly: boolean;
  readonly gates: readonly OperatorLiveGate[];
}

export interface OperatorLiveGateArtifact {
  readonly schemaVersion: 1;
  readonly kind: "agentic-gaskit.operator-live-gate-report";
  readonly generatedAt: string;
  readonly allGatesClear: boolean;
  readonly localOnly: boolean;
  readonly blockerCodes: readonly string[];
  readonly readyApprovalGateIds: readonly string[];
  readonly approvalRequiredGateIds: readonly string[];
  readonly liveServiceGateIds: readonly string[];
  readonly gates: readonly OperatorLiveGate[];
  readonly boundaries: readonly string[];
}

export interface OperatorLiveGateOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly gasStationRuntimeReport?: GasStationRuntimePreflightReport;
  readonly gasStationRuntimeRunner?: GasStationRuntimeCommandRunner;
  readonly productStatus?: ProductStatusReport;
}

export interface WriteOperatorLiveGateArtifactOptions extends OperatorLiveGateOptions {
  readonly now?: Date;
  readonly outFile?: string;
}

interface CliOptions {
  readonly help: boolean;
  readonly json: boolean;
  readonly outFile?: string;
}

const GATE_COMMANDS: Record<string, string | undefined> = {
  "local-verification": "npm run verify:local",
  "package-release-local": "npm run pack:check && npm run smoke:package-install && npm run publish:dry-run",
  "operator-report-template": "npm run operator:write-report-template -- --kind <kind> --out <ignored-report-template.json>",
  "testnet-readiness": "npm run readiness:testnet",
  "gas-station-runtime": "npm run gas-station:runtime-preflight",
  "sponsor-funding": "npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json",
  "testnet-upstream": "npm run operator:write-report-template -- --kind testnet-upstream --out tmp/gaskit/testnet-upstream-report-template.json && npm run live:write-proof-plan && npm run diagnose:gas-station -- --report <ignored-json-path>",
  "iota-names-live": "npm run operator:write-report-template -- --kind iota-names-live --out tmp/gaskit/iota-names-live-report-template.json && npm run live:write-proof-plan && npm run smoke:iota-names-live -- --report <ignored-json-path>",
  "iota-identity-live": "npm run operator:write-report-template -- --kind iota-identity-live --out tmp/gaskit/iota-identity-live-report-template.json && npm run live:write-proof-plan && npm run smoke:iota-identity-live -- --report <ignored-json-path>",
  "vc-validation-live": "npm run operator:write-report-template -- --kind vc-validation-live --out tmp/gaskit/vc-validation-live-report-template.json && npm run live:write-proof-plan && npm run smoke:iota-identity-live -- --report <ignored-json-path>",
  "npm-registry-publication": "npm run operator:write-report-template -- --kind package-publication --out tmp/gaskit/package-publication-report-template.json && npm run package:write-publication-proof-plan && npm run proof:package-publication-readiness && operator-approved npm publish workflow",
  "public-a2a-hosting": "npm run operator:write-report-template -- --kind a2a-public-discovery --out tmp/gaskit/a2a-public-discovery-report-template.json && npm run operator:write-report-template -- --kind a2a-public-push-delivery --out tmp/gaskit/a2a-public-push-delivery-report-template.json && npm run operator:write-report-template -- --kind a2a-external-conformance --out tmp/gaskit/a2a-external-conformance-report-template.json && npm run a2a:write-public-proof-plan && npm run proof:a2a-public-readiness && npm run smoke:a2a-public-discovery",
  "live-payment-provider": "npm run operator:write-report-template -- --kind payment-provider-live --out tmp/gaskit/payment-provider-live-report-template.json && npm run payment:write-provider-proof-plan && npm run proof:payment-provider-readiness",
  "production-marketplace": "npm run operator:write-report-template -- --kind marketplace-production --out tmp/gaskit/marketplace-production-report-template.json && npm run marketplace:write-production-proof-plan && npm run proof:marketplace-readiness && dedicated production marketplace readiness slice",
  "production-custody": "npm run operator:write-report-template -- --kind custody-production --out tmp/gaskit/custody-production-report-template.json && npm run custody:write-production-proof-plan && npm run proof:custody-readiness && dedicated custody/security design slice",
  "physical-device-access": "dedicated physical device safety design slice",
};

const LIVE_SERVICE_GATES = new Set([
  "sponsor-funding",
  "testnet-upstream",
  "testnet-sponsored-execute",
  "iota-names-live",
  "iota-identity-live",
  "vc-validation-live",
  "npm-registry-publication",
  "public-a2a-hosting",
  "live-payment-provider",
  "production-marketplace",
]);

const APPROVAL_REQUIRED_GATES = new Set([
  "sponsor-funding",
  "testnet-upstream",
  "testnet-sponsored-execute",
  "iota-names-live",
  "iota-identity-live",
  "vc-validation-live",
  "npm-registry-publication",
  "public-a2a-hosting",
  "live-payment-provider",
  "production-marketplace",
  "production-custody",
  "physical-device-access",
]);

const ARTIFACT_BOUNDARIES = [
  "This report is non-networked and does not run live proof commands.",
  "Gates with contactsLiveService=true require explicit operator approval before execution.",
  "ready-approval means a valid structured report or ready-live gate is present for manual review; it is not permission to run a live command.",
  "Do not commit generated reports, live proof artifacts, credentials, tokens, private keys, raw transaction bytes, user signatures, response bodies, or secret local paths.",
  "allGatesClear=false means the product is not launch-ready.",
] as const;

const usage = `usage: npm exec tsx -- scripts/check-operator-live-gates.ts [--json] [--out <path>]

Reports the current non-networked operator live gates.
--json prints a redacted machine-readable artifact.
--out writes the same JSON artifact to a local file with mode 0600.`;

export async function checkOperatorLiveGates(
  options: OperatorLiveGateOptions = {},
): Promise<OperatorLiveGateReport> {
  const productStatus = options.productStatus ?? await checkProductStatus({
    cwd: options.cwd,
    env: options.env,
    gasStationRuntimeReport: options.gasStationRuntimeReport,
    gasStationRuntimeRunner: options.gasStationRuntimeRunner,
  });
  const gates = productStatus.checks.map(mapProductCheckToGate);

  return {
    allGatesClear: productStatus.complete && gates.every(isClearGateStatus),
    localOnly: gates.every((gate) => !gate.contactsLiveService),
    gates,
  };
}

export async function writeOperatorLiveGateArtifact(
  options: WriteOperatorLiveGateArtifactOptions = {},
): Promise<OperatorLiveGateArtifact> {
  const cwd = options.cwd ?? process.cwd();
  const report = await checkOperatorLiveGates(options);
  const artifact = buildOperatorLiveGateArtifact(report, options.now ?? new Date());
  if (options.outFile) {
    const outFile = isAbsolute(options.outFile) ? options.outFile : resolve(cwd, options.outFile);
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, `${formatOperatorLiveGateArtifact(artifact)}\n`, { mode: 0o600 });
  }
  return artifact;
}

export function buildOperatorLiveGateArtifact(
  report: OperatorLiveGateReport,
  now: Date = new Date(),
): OperatorLiveGateArtifact {
  const blockedGates = report.gates.filter((gate) => gate.status !== "proven-local" && gate.status !== "ready-to-run");

  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.operator-live-gate-report",
    generatedAt: now.toISOString(),
    allGatesClear: report.allGatesClear,
    localOnly: report.localOnly,
    blockerCodes: blockedGates.filter((gate) => gate.status !== "ready-approval").map((gate) => gate.code),
    readyApprovalGateIds: report.gates.filter((gate) => gate.status === "ready-approval").map((gate) => gate.id),
    approvalRequiredGateIds: report.gates.filter((gate) => gate.approvalRequired).map((gate) => gate.id),
    liveServiceGateIds: report.gates.filter((gate) => gate.contactsLiveService).map((gate) => gate.id),
    gates: report.gates,
    boundaries: ARTIFACT_BOUNDARIES,
  };
}

export function formatOperatorLiveGateArtifact(artifact: OperatorLiveGateArtifact): string {
  return JSON.stringify(artifact, null, 2);
}

export function formatOperatorLiveGateReport(report: OperatorLiveGateReport): string {
  const lines = [
    `Agentic GasKit operator live gates ${report.allGatesClear ? "clear" : "blocked"}`,
    `allGatesClear=${report.allGatesClear}`,
    `localOnly=${report.localOnly}`,
  ];

  for (const gate of report.gates) {
    lines.push(`${gate.status}: ${gate.id}: code=${gate.code}`);
    lines.push(`approvalRequired=${gate.approvalRequired}`);
    lines.push(`contactsLiveService=${gate.contactsLiveService}`);
    if (gate.command) lines.push(`command=${gate.command}`);
    lines.push(`message=${gate.message}`);
    lines.push(`next=${gate.next}`);
  }

  return lines.join("\n");
}

function mapProductCheckToGate(check: ProductEvidenceCheck): OperatorLiveGate {
  return {
    id: check.id,
    status: classifyGate(check),
    code: check.code,
    command: commandForGate(check),
    approvalRequired: approvalRequired(check),
    contactsLiveService: contactsLiveService(check),
    message: check.message,
    next: check.next ?? defaultNext(check),
  };
}

function commandForGate(check: ProductEvidenceCheck): string | undefined {
  if (check.id === "testnet-sponsored-execute") {
    return check.status === "blocked-live"
      ? "npm run operator:write-report-template -- --kind testnet-digest --out tmp/gaskit/testnet-digest-report-template.json && npm run execute:testnet-demo"
      : "npm run operator:write-report-template -- --kind testnet-digest --out tmp/gaskit/testnet-digest-report-template.json && npm run proof:testnet-digest:live -- --report tmp/gaskit/testnet-digest-proof.json";
  }
  return GATE_COMMANDS[check.id];
}

function classifyGate(check: ProductEvidenceCheck): OperatorGateStatus {
  if (check.status === "proven-local") return "proven-local";
  if (check.status === "deferred-safety") return "deferred-safety";
  if (check.status === "ready-live") {
    return APPROVAL_REQUIRED_GATES.has(check.id) ? "ready-approval" : "ready-to-run";
  }
  if (check.status === "blocked-live") return "blocked-config";
  if (check.status === "blocked-production") {
    return APPROVAL_REQUIRED_GATES.has(check.id) ? "requires-approval" : "blocked-production";
  }
  return "blocked-production";
}

function isClearGateStatus(gate: OperatorLiveGate): boolean {
  return gate.status === "proven-local" || gate.status === "ready-to-run" || gate.status === "ready-approval";
}

function approvalRequired(check: ProductEvidenceCheck): boolean {
  if (check.id === "testnet-readiness" && check.status === "ready-live") return false;
  if (check.id === "gas-station-runtime") return false;
  return APPROVAL_REQUIRED_GATES.has(check.id) || check.status === "ready-live";
}

function contactsLiveService(check: ProductEvidenceCheck): boolean {
  if (check.id === "testnet-readiness") return false;
  return LIVE_SERVICE_GATES.has(check.id);
}

function defaultNext(check: ProductEvidenceCheck): string {
  if (check.status === "proven-local") {
    return "No live action is required for this local proof gate.";
  }
  if (check.status === "blocked-live") {
    return "Provide operator-owned local configuration outside committed files, then rerun this gate report.";
  }
  if (check.status === "ready-live") {
    return "Run only after explicit operator intent confirms the live proof should execute.";
  }
  return "Keep this gate open until a dedicated approved slice records stronger evidence.";
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: { help: boolean; json: boolean; outFile?: string } = {
    help: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
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

  if (options.json || options.outFile) {
    const artifact = await writeOperatorLiveGateArtifact({ outFile: options.outFile });
    console.log(formatOperatorLiveGateArtifact(artifact));
    if (options.outFile) console.log("wroteReport=true");
    return 0;
  }

  const report = await checkOperatorLiveGates();
  console.log(formatOperatorLiveGateReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
