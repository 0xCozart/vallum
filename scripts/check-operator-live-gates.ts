import { fileURLToPath } from "node:url";

import {
  checkProductStatus,
  type ProductEvidenceCheck,
  type ProductStatusReport,
} from "./check-product-status.js";

export type OperatorGateStatus =
  | "proven-local"
  | "ready-to-run"
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

export interface OperatorLiveGateOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly productStatus?: ProductStatusReport;
}

const GATE_COMMANDS: Record<string, string | undefined> = {
  "local-verification": "npm run verify:local",
  "package-release-local": "npm run pack:check && npm run smoke:package-install && npm run publish:dry-run",
  "testnet-readiness": "npm run readiness:testnet",
  "testnet-upstream": "npm run diagnose:gas-station",
  "iota-names-live": "npm run smoke:iota-names-live",
  "iota-identity-live": "npm run smoke:iota-identity-live",
  "vc-validation-live": "npm run smoke:iota-identity-live",
  "npm-registry-publication": "operator-approved npm publish workflow",
  "public-a2a-hosting": "npm run proof:a2a-public-readiness && npm run smoke:a2a-public-discovery",
  "live-payment-provider": "dedicated payment-provider proof slice",
  "production-marketplace": "dedicated production marketplace readiness slice",
  "production-custody": "dedicated custody/security design slice",
  "physical-device-access": "dedicated physical device safety design slice",
};

const LIVE_SERVICE_GATES = new Set([
  "testnet-upstream",
  "iota-names-live",
  "iota-identity-live",
  "npm-registry-publication",
  "public-a2a-hosting",
  "live-payment-provider",
  "production-marketplace",
]);

const APPROVAL_REQUIRED_GATES = new Set([
  "testnet-upstream",
  "iota-names-live",
  "iota-identity-live",
  "npm-registry-publication",
  "public-a2a-hosting",
  "live-payment-provider",
  "production-marketplace",
  "production-custody",
  "physical-device-access",
]);

export async function checkOperatorLiveGates(
  options: OperatorLiveGateOptions = {},
): Promise<OperatorLiveGateReport> {
  const productStatus = options.productStatus ?? await checkProductStatus({
    cwd: options.cwd,
    env: options.env,
  });
  const gates = productStatus.checks.map(mapProductCheckToGate);

  return {
    allGatesClear: productStatus.complete && gates.every((gate) => gate.status === "proven-local"),
    localOnly: gates.every((gate) => !gate.contactsLiveService),
    gates,
  };
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
    command: GATE_COMMANDS[check.id],
    approvalRequired: approvalRequired(check),
    contactsLiveService: contactsLiveService(check),
    message: check.message,
    next: check.next ?? defaultNext(check),
  };
}

function classifyGate(check: ProductEvidenceCheck): OperatorGateStatus {
  if (check.status === "proven-local") return "proven-local";
  if (check.status === "deferred-safety") return "deferred-safety";
  if (check.status === "ready-live") {
    return APPROVAL_REQUIRED_GATES.has(check.id) ? "requires-approval" : "ready-to-run";
  }
  if (check.status === "blocked-live") return "blocked-config";
  if (check.status === "blocked-production") {
    return APPROVAL_REQUIRED_GATES.has(check.id) ? "requires-approval" : "blocked-production";
  }
  return "blocked-production";
}

function approvalRequired(check: ProductEvidenceCheck): boolean {
  if (check.id === "testnet-readiness" && check.status === "ready-live") return false;
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

async function main(): Promise<number> {
  const report = await checkOperatorLiveGates();
  console.log(formatOperatorLiveGateReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
