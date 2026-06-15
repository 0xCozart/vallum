import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  GasStationRuntimeCommandRunner,
  GasStationRuntimePreflightReport,
} from "./check-gas-station-runtime-preflight.js";
import {
  writeLaunchReadinessArtifact,
  type LaunchReadinessArtifact,
} from "./check-launch-readiness.js";
import {
  writeOperatorLiveGateArtifact,
  type OperatorLiveGateArtifact,
} from "./check-operator-live-gates.js";
import {
  writeProductStatusArtifact,
  type ProductStatusArtifact,
} from "./check-product-status.js";
import {
  writeRoadmapCompletionArtifact,
  type RoadmapCompletionArtifact,
} from "./check-roadmap-completion.js";
import {
  writeA2APublicProofBundle,
  type A2APublicProofBundle,
} from "./write-a2a-public-proof-bundle.js";
import {
  writeCustodyProductionProofBundle,
  type CustodyProductionProofBundle,
} from "./write-custody-production-proof-bundle.js";
import {
  writeIdentityProofBundle,
  type IdentityProofBundle,
} from "./write-identity-proof-bundle.js";
import {
  writeMarketplaceProductionProofBundle,
  type MarketplaceProductionProofBundle,
} from "./write-marketplace-production-proof-bundle.js";
import {
  writePackagePublicationProofBundle,
  type PackagePublicationProofBundle,
} from "./write-package-publication-proof-bundle.js";
import {
  writePaymentProviderProofBundle,
  type PaymentProviderProofBundle,
} from "./write-payment-provider-proof-bundle.js";

export type RoadmapExecutionProofBundleStatus = "blocked" | "ready-for-approval";

export interface RoadmapExecutionProofBundleArtifactRef {
  readonly id: string;
  readonly kind: string;
  readonly path: string;
  readonly status?: string;
  readonly blockerCodes: readonly string[];
  readonly readyCodes: readonly string[];
}

export interface RoadmapExecutionProofBundleStep {
  readonly id: string;
  readonly command: string;
  readonly contactsLiveService: boolean;
  readonly requiresOperatorApproval: boolean;
  readonly dependsOn?: readonly string[];
}

export interface RoadmapExecutionProofBundle {
  readonly schemaVersion: 1;
  readonly kind: "agentrail.roadmap-execution-proof-bundle";
  readonly generatedAt: string;
  readonly status: RoadmapExecutionProofBundleStatus;
  readonly roadmapComplete: boolean;
  readonly localProofOk: boolean;
  readonly productComplete: boolean;
  readonly launchReady: boolean;
  readonly operatorGatesClear: boolean;
  readonly artifactDir: string;
  readonly statusArtifacts: readonly RoadmapExecutionProofBundleArtifactRef[];
  readonly proofBundles: readonly RoadmapExecutionProofBundleArtifactRef[];
  readonly blockerCodes: readonly string[];
  readonly readyApprovalGateIds: readonly string[];
  readonly approvalRequiredGateIds: readonly string[];
  readonly liveServiceGateIds: readonly string[];
  readonly nextCommands: readonly string[];
  readonly steps: readonly RoadmapExecutionProofBundleStep[];
  readonly boundaries: readonly string[];
}

export interface WriteRoadmapExecutionProofBundleOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly now?: Date;
  readonly outFile?: string;
  readonly artifactDir?: string;
  readonly gasStationRuntimeReport?: GasStationRuntimePreflightReport;
  readonly gasStationRuntimeRunner?: GasStationRuntimeCommandRunner;
}

interface CliOptions {
  readonly help: boolean;
  readonly outFile?: string;
  readonly artifactDir: string;
}

const DEFAULT_ARTIFACT_DIR = "tmp/agentrail/roadmap-execution";
const DEFAULT_OUT_FILE = "tmp/agentrail/roadmap-execution-proof-bundle.json";

const BOUNDARIES = [
  "This bundle writer is non-networked and only writes ignored local status artifacts and proof-preparation bundle summaries.",
  "Generated status artifacts, report templates, proof plans, readiness artifacts, and bundles are not passing live or production evidence by themselves.",
  "Only explicit operator-approved proof steps may contact IOTA Names, IOTA Identity, IOTA RPC, Gas Station, npm, public A2A endpoints, payment providers, marketplace systems, custody systems, KMS providers, or physical devices.",
  "Do not commit generated bundle artifacts, credentials, tokens, private keys, raw transaction bytes, user signatures, response bodies, endpoint values, profile paths, full addresses, report contents, or local secret paths.",
] as const;

const usage = `usage: npm exec tsx -- scripts/write-roadmap-execution-proof-bundle.ts [--out <path>] [--artifact-dir <path>]

Writes one non-networked ignored local bundle for the remaining AgentRail roadmap/operator proof gates.
The command composes existing status artifacts and proof-bundle writers; it does not contact live services, publish packages, reserve gas, sign transactions, or execute transactions.`;

export async function writeRoadmapExecutionProofBundle(
  options: WriteRoadmapExecutionProofBundleOptions = {},
): Promise<RoadmapExecutionProofBundle> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const artifactDir = options.artifactDir ?? DEFAULT_ARTIFACT_DIR;
  const outFile = options.outFile ?? DEFAULT_OUT_FILE;

  const paths = artifactPaths(artifactDir);
  const identity = await writeIdentityProofBundle({
    cwd,
    env: options.env,
    gasStationRuntimeReport: options.gasStationRuntimeReport,
    gasStationRuntimeRunner: options.gasStationRuntimeRunner,
    now,
    outFile: paths.identityBundle,
    namesTemplateOutFile: paths.iotaNamesTemplate,
    identityTemplateOutFile: paths.iotaIdentityTemplate,
    vcTemplateOutFile: paths.vcValidationTemplate,
    planOutFile: paths.liveProofPlan,
    liveStatusOutFile: paths.liveProofStatus,
  });
  const packagePublication = await writePackagePublicationProofBundle({
    cwd,
    env: options.env,
    now,
    outFile: paths.packagePublicationBundle,
    planOutFile: paths.packagePublicationPlan,
    readinessOutFile: paths.packagePublicationReadiness,
    templateOutFile: paths.packagePublicationTemplate,
  });
  const a2aPublic = await writeA2APublicProofBundle({
    cwd,
    env: options.env,
    now,
    outFile: paths.a2aPublicBundle,
    planOutFile: paths.a2aPublicPlan,
    readinessOutFile: paths.a2aPublicReadiness,
    discoveryTemplateOutFile: paths.a2aDiscoveryTemplate,
    pushTemplateOutFile: paths.a2aPushTemplate,
    conformanceTemplateOutFile: paths.a2aConformanceTemplate,
  });
  const paymentProvider = await writePaymentProviderProofBundle({
    cwd,
    env: options.env,
    now,
    outFile: paths.paymentProviderBundle,
    planOutFile: paths.paymentProviderPlan,
    readinessOutFile: paths.paymentProviderReadiness,
    templateOutFile: paths.paymentProviderTemplate,
  });
  const marketplace = await writeMarketplaceProductionProofBundle({
    cwd,
    env: options.env,
    now,
    outFile: paths.marketplaceBundle,
    planOutFile: paths.marketplacePlan,
    readinessOutFile: paths.marketplaceReadiness,
    templateOutFile: paths.marketplaceTemplate,
  });
  const custody = await writeCustodyProductionProofBundle({
    cwd,
    env: options.env,
    now,
    outFile: paths.custodyBundle,
    planOutFile: paths.custodyPlan,
    readinessOutFile: paths.custodyReadiness,
    templateOutFile: paths.custodyTemplate,
  });

  const productStatus = await writeProductStatusArtifact({
    cwd,
    env: options.env,
    gasStationRuntimeReport: options.gasStationRuntimeReport,
    gasStationRuntimeRunner: options.gasStationRuntimeRunner,
    now,
    outFile: paths.productStatus,
  });
  const launchReadiness = await writeLaunchReadinessArtifact({
    cwd,
    productStatus,
    now,
    outFile: paths.launchReadiness,
  });
  const operatorGates = await writeOperatorLiveGateArtifact({
    cwd,
    env: options.env,
    productStatus,
    gasStationRuntimeReport: options.gasStationRuntimeReport,
    gasStationRuntimeRunner: options.gasStationRuntimeRunner,
    now,
    outFile: paths.operatorGates,
  });
  const roadmapCompletion = await writeRoadmapCompletionArtifact({
    cwd,
    productStatus,
    launchReadiness,
    operatorLiveGates: operatorGates,
    now,
    outFile: paths.roadmapCompletion,
  });

  const proofBundles = [
    summarizeProofBundle("identity-proof", paths.identityBundle, identity),
    summarizeProofBundle("package-publication", paths.packagePublicationBundle, packagePublication),
    summarizeProofBundle("a2a-public", paths.a2aPublicBundle, a2aPublic),
    summarizeProofBundle("payment-provider", paths.paymentProviderBundle, paymentProvider),
    summarizeProofBundle("marketplace-production", paths.marketplaceBundle, marketplace),
    summarizeProofBundle("custody-production", paths.custodyBundle, custody),
  ];
  const statusArtifacts = [
    summarizeStatusArtifact("product-status", paths.productStatus, productStatus),
    summarizeStatusArtifact("launch-readiness", paths.launchReadiness, launchReadiness),
    summarizeStatusArtifact("operator-live-gates", paths.operatorGates, operatorGates),
    summarizeStatusArtifact("roadmap-completion", paths.roadmapCompletion, roadmapCompletion),
  ];
  const blockerCodes = firstUnique([
    ...roadmapCompletion.blockerCodes,
    ...proofBundles.flatMap((bundle) => bundle.blockerCodes),
  ]);

  const bundle: RoadmapExecutionProofBundle = {
    schemaVersion: 1,
    kind: "agentrail.roadmap-execution-proof-bundle",
    generatedAt: now.toISOString(),
    status: roadmapCompletion.roadmapComplete ? "ready-for-approval" : "blocked",
    roadmapComplete: roadmapCompletion.roadmapComplete,
    localProofOk: roadmapCompletion.localProofOk,
    productComplete: roadmapCompletion.productComplete,
    launchReady: roadmapCompletion.launchReady,
    operatorGatesClear: roadmapCompletion.operatorGatesClear,
    artifactDir,
    statusArtifacts,
    proofBundles,
    blockerCodes,
    readyApprovalGateIds: operatorGates.readyApprovalGateIds,
    approvalRequiredGateIds: operatorGates.approvalRequiredGateIds,
    liveServiceGateIds: operatorGates.liveServiceGateIds,
    nextCommands: roadmapCompletion.nextCommands,
    steps: buildSteps(paths),
    boundaries: BOUNDARIES,
  };

  await writeJsonFile(cwd, outFile, bundle);
  return bundle;
}

function artifactPaths(artifactDir: string): Record<string, string> {
  return {
    identityBundle: join(artifactDir, "identity-proof-bundle.json"),
    iotaNamesTemplate: join(artifactDir, "iota-names-live-report-template.json"),
    iotaIdentityTemplate: join(artifactDir, "iota-identity-live-report-template.json"),
    vcValidationTemplate: join(artifactDir, "vc-validation-live-report-template.json"),
    liveProofPlan: join(artifactDir, "live-proof-plan.json"),
    liveProofStatus: join(artifactDir, "live-proof-status.json"),
    packagePublicationBundle: join(artifactDir, "package-publication-proof-bundle.json"),
    packagePublicationPlan: join(artifactDir, "package-publication-proof-plan.json"),
    packagePublicationReadiness: join(artifactDir, "package-publication-readiness.json"),
    packagePublicationTemplate: join(artifactDir, "package-publication-report-template.json"),
    a2aPublicBundle: join(artifactDir, "a2a-public-proof-bundle.json"),
    a2aPublicPlan: join(artifactDir, "a2a-public-proof-plan.json"),
    a2aPublicReadiness: join(artifactDir, "a2a-public-readiness.json"),
    a2aDiscoveryTemplate: join(artifactDir, "a2a-public-discovery-report-template.json"),
    a2aPushTemplate: join(artifactDir, "a2a-public-push-delivery-report-template.json"),
    a2aConformanceTemplate: join(artifactDir, "a2a-external-conformance-report-template.json"),
    paymentProviderBundle: join(artifactDir, "payment-provider-proof-bundle.json"),
    paymentProviderPlan: join(artifactDir, "payment-provider-proof-plan.json"),
    paymentProviderReadiness: join(artifactDir, "payment-provider-readiness.json"),
    paymentProviderTemplate: join(artifactDir, "payment-provider-live-report-template.json"),
    marketplaceBundle: join(artifactDir, "marketplace-production-proof-bundle.json"),
    marketplacePlan: join(artifactDir, "marketplace-production-proof-plan.json"),
    marketplaceReadiness: join(artifactDir, "marketplace-readiness.json"),
    marketplaceTemplate: join(artifactDir, "marketplace-production-report-template.json"),
    custodyBundle: join(artifactDir, "custody-production-proof-bundle.json"),
    custodyPlan: join(artifactDir, "custody-production-proof-plan.json"),
    custodyReadiness: join(artifactDir, "custody-readiness.json"),
    custodyTemplate: join(artifactDir, "custody-production-report-template.json"),
    productStatus: join(artifactDir, "product-status.json"),
    launchReadiness: join(artifactDir, "launch-readiness.json"),
    operatorGates: join(artifactDir, "operator-live-gates.json"),
    roadmapCompletion: join(artifactDir, "roadmap-completion.json"),
  };
}

function summarizeProofBundle(
  id: string,
  path: string,
  bundle:
    | IdentityProofBundle
    | PackagePublicationProofBundle
    | A2APublicProofBundle
    | PaymentProviderProofBundle
    | MarketplaceProductionProofBundle
    | CustodyProductionProofBundle,
): RoadmapExecutionProofBundleArtifactRef {
  return {
    id,
    kind: bundle.kind,
    path,
    status: bundle.status,
    blockerCodes: bundle.blockerCodes,
    readyCodes: "readyCodes" in bundle ? bundle.readyCodes : bundle.readyApprovalCodes,
  };
}

function summarizeStatusArtifact(
  id: string,
  path: string,
  artifact:
    | ProductStatusArtifact
    | LaunchReadinessArtifact
    | OperatorLiveGateArtifact
    | RoadmapCompletionArtifact,
): RoadmapExecutionProofBundleArtifactRef {
  return {
    id,
    kind: artifact.kind,
    path,
    blockerCodes: "blockerCodes" in artifact ? artifact.blockerCodes : [],
    readyCodes: readyCodesForStatusArtifact(artifact),
  };
}

function readyCodesForStatusArtifact(
  artifact:
    | ProductStatusArtifact
    | LaunchReadinessArtifact
    | OperatorLiveGateArtifact
    | RoadmapCompletionArtifact,
): readonly string[] {
  if (artifact.kind === "agentrail.product-status-report") return artifact.readyLiveCheckIds;
  if (artifact.kind === "agentrail.operator-live-gate-report") return artifact.readyApprovalGateIds;
  if (artifact.kind === "agentrail.launch-readiness-report") return artifact.provenLocalAreaIds;
  return [];
}

function buildSteps(paths: Record<string, string>): readonly RoadmapExecutionProofBundleStep[] {
  return [
    {
      id: "write-identity-proof-bundle",
      command: `npm run live:write-identity-proof-bundle -- --out ${paths.identityBundle}`,
      contactsLiveService: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-package-publication-proof-bundle",
      command: `npm run package:write-publication-proof-bundle -- --out ${paths.packagePublicationBundle}`,
      contactsLiveService: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-a2a-public-proof-bundle",
      command: `npm run a2a:write-public-proof-bundle -- --out ${paths.a2aPublicBundle}`,
      contactsLiveService: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-payment-provider-proof-bundle",
      command: `npm run payment:write-provider-proof-bundle -- --out ${paths.paymentProviderBundle}`,
      contactsLiveService: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-marketplace-production-proof-bundle",
      command: `npm run marketplace:write-production-proof-bundle -- --out ${paths.marketplaceBundle}`,
      contactsLiveService: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-custody-production-proof-bundle",
      command: `npm run custody:write-production-proof-bundle -- --out ${paths.custodyBundle}`,
      contactsLiveService: false,
      requiresOperatorApproval: false,
    },
    {
      id: "write-roadmap-completion-audit",
      command: `npm run proof:roadmap-completion -- --out ${paths.roadmapCompletion}`,
      contactsLiveService: false,
      requiresOperatorApproval: false,
      dependsOn: [
        "write-identity-proof-bundle",
        "write-package-publication-proof-bundle",
        "write-a2a-public-proof-bundle",
        "write-payment-provider-proof-bundle",
        "write-marketplace-production-proof-bundle",
        "write-custody-production-proof-bundle",
      ],
    },
    {
      id: "run-operator-approved-remaining-proof",
      command: "complete the approval-required nextCommands from this bundle and rerun npm run proof:roadmap-completion",
      contactsLiveService: true,
      requiresOperatorApproval: true,
      dependsOn: ["write-roadmap-completion-audit"],
    },
  ];
}

function firstUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

async function writeJsonFile(cwd: string, path: string, value: unknown): Promise<void> {
  const outFile = isAbsolute(path) ? path : resolve(cwd, path);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(outFile, 0o600);
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: { help: boolean; outFile?: string; artifactDir: string } = {
    help: false,
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

  const bundle = await writeRoadmapExecutionProofBundle({
    outFile: options.outFile,
    artifactDir: options.artifactDir,
  });
  console.log(JSON.stringify(bundle, null, 2));
  console.log("wroteBundle=true");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
