import { access, readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type A2APublicReadinessStatus =
  | "proven-local"
  | "blocked-local"
  | "blocked-config"
  | "ready-approval"
  | "unsupported"
  | "blocked-conformance";

export interface A2APublicReadinessCheck {
  readonly id: string;
  readonly status: A2APublicReadinessStatus;
  readonly code: string;
  readonly message: string;
  readonly evidence?: string;
  readonly next: string;
}

export interface A2APublicReadinessReport {
  readonly publicReady: boolean;
  readonly localProofOk: boolean;
  readonly checks: readonly A2APublicReadinessCheck[];
}

export interface A2APublicReadinessOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly scripts?: Record<string, string | undefined>;
  readonly now?: Date;
}

const REQUIRED_LOCAL_COMMANDS = [
  "npm run smoke:a2a-well-known",
  "npm run smoke:a2a-signed-card",
  "npm run smoke:a2a-task-message",
  "npm run smoke:a2a-http",
  "npm run smoke:a2a-local-server",
] as const;

const REQUIRED_SOURCE_PATHS = [
  "packages/registry/src/a2aCard.ts",
  "packages/registry/src/a2aWellKnown.ts",
  "packages/registry/src/a2aJwks.ts",
  "packages/registry/src/a2aDiscoveryBundle.ts",
  "packages/standards/src/a2a.ts",
  "packages/standards/src/a2aHttp.ts",
  "packages/standards/src/a2aNodeServer.ts",
  "packages/standards/src/a2aPush.ts",
  "scripts/check-a2a-static-discovery-bundle.ts",
  "scripts/smoke-a2a-static-discovery-local.ts",
  "scripts/write-a2a-static-discovery-bundle.ts",
  "scripts/write-a2a-static-hosting-review.ts",
  "scripts/smoke-a2a-local-server.ts",
] as const;

const ALLOWED_TASK_AUTH_DECISIONS = new Set(["bearer", "oauth2", "mtls"]);

export async function checkA2APublicReadiness(
  options: A2APublicReadinessOptions = {},
): Promise<A2APublicReadinessReport> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const scripts = options.scripts ?? await loadPackageScripts(cwd);
  const now = options.now ?? new Date();
  const checks = [
    await checkLocalA2AProof(cwd, scripts),
    localPublicJwksHostingSupport(),
    localStaticDiscoveryBundleSupport(),
    localStaticDiscoveryArtifactWriterSupport(),
    localStaticDiscoveryArtifactValidatorSupport(),
    localStaticDiscoveryLocalHostSupport(),
    localStaticHostingReviewSupport(),
    localPublicProofPlanSupport(),
    checkPublicUrl(
      "public-agent-card-url",
      env.A2A_PUBLIC_AGENT_CARD_URL,
      "A2A_PUBLIC_AGENT_CARD_URL",
      (url) => url.pathname === "/.well-known/agent-card.json",
      "A2A public Agent Card URL must be HTTPS, non-loopback, and use /.well-known/agent-card.json.",
    ),
    checkPublicUrl(
      "public-base-url",
      env.A2A_PUBLIC_BASE_URL,
      "A2A_PUBLIC_BASE_URL",
      () => true,
      "A2A public base URL must be HTTPS and non-loopback.",
    ),
    checkPublicUrl(
      "production-jwks-url",
      env.A2A_PUBLIC_JWKS_URL,
      "A2A_PUBLIC_JWKS_URL",
      () => true,
      "A2A production JWKS URL must be HTTPS and non-loopback.",
    ),
    checkTaskAuthDecision(env.A2A_PUBLIC_TASK_AUTH_DECISION),
    await checkPublicDiscoveryReport(cwd, env.A2A_PUBLIC_DISCOVERY_REPORT, {
      expectedPublicAgentCardUrl: env.A2A_PUBLIC_AGENT_CARD_URL,
      expectedPublicBaseUrl: env.A2A_PUBLIC_BASE_URL,
      expectedPublicJwksUrl: env.A2A_PUBLIC_JWKS_URL,
      expectedTaskAuthDecision: env.A2A_PUBLIC_TASK_AUTH_DECISION,
      now,
    }),
    localExtendedAgentCardSupport(),
    localStreamingSupport(),
    localPushConfigurationSupport(),
    localPushDeliverySupport(),
    localPushHttpTransportSupport(),
    localPushCallbackUrlHardeningSupport(),
    localPushCallbackHostAllowlistSupport(),
    localPushRetryObservabilitySupport(),
    localPushDurableAttemptEvidenceSupport(),
    localPushDeliveryQueueSupport(),
    localPushDeliveryWorkerSupport(),
    await checkPublicPushDeliveryReport(cwd, env.A2A_PUBLIC_PUSH_DELIVERY_REPORT, {
      expectedPublicBaseUrl: env.A2A_PUBLIC_BASE_URL,
      now,
    }),
    await checkConformanceReport(cwd, env.A2A_EXTERNAL_CONFORMANCE_REPORT, {
      expectedPublicAgentCardUrl: env.A2A_PUBLIC_AGENT_CARD_URL,
      expectedPublicBaseUrl: env.A2A_PUBLIC_BASE_URL,
      now,
    }),
  ];

  return {
    publicReady: checks.every((check) => check.status === "proven-local" || check.status === "ready-approval"),
    localProofOk: checks.find((check) => check.id === "local-a2a-proof")?.status === "proven-local",
    checks,
  };
}

export function formatA2APublicReadinessReport(report: A2APublicReadinessReport): string {
  const lines = [
    `Agentic GasKit A2A public readiness ${report.publicReady ? "ready-for-approval" : "blocked"}`,
    `localProofOk=${report.localProofOk}`,
    `publicReady=${report.publicReady}`,
  ];

  for (const check of report.checks) {
    lines.push(`${check.status}: ${check.id}: code=${check.code}`);
    lines.push(`message=${check.message}`);
    if (check.evidence) lines.push(`evidence=${check.evidence}`);
    lines.push(`next=${check.next}`);
  }

  return lines.join("\n");
}

async function loadPackageScripts(cwd: string): Promise<Record<string, string | undefined>> {
  try {
    const packageJson = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    return packageJson.scripts ?? {};
  } catch {
    return {};
  }
}

async function checkLocalA2AProof(
  cwd: string,
  scripts: Record<string, string | undefined>,
): Promise<A2APublicReadinessCheck> {
  const verifyLocal = scripts["verify:local"] ?? "";
  const missingCommands = REQUIRED_LOCAL_COMMANDS.filter((command) => !verifyLocal.includes(command));
  const missingPaths: string[] = [];
  for (const path of REQUIRED_SOURCE_PATHS) {
    try {
      await access(resolve(cwd, path));
    } catch {
      missingPaths.push(path);
    }
  }

  if (missingCommands.length > 0 || missingPaths.length > 0) {
    return {
      id: "local-a2a-proof",
      status: "blocked-local",
      code: "A2A_LOCAL_PROOF_INCOMPLETE",
      message: "Local A2A proof commands or source evidence are missing.",
      evidence: [
        missingCommands.length > 0 ? `missingCommands=${missingCommands.join(",")}` : undefined,
        missingPaths.length > 0 ? `missingPaths=${missingPaths.join(",")}` : undefined,
      ].filter(Boolean).join(";"),
      next: "Restore local A2A smoke wiring and source evidence before evaluating public readiness.",
    };
  }

  return {
    id: "local-a2a-proof",
    status: "proven-local",
    code: "A2A_LOCAL_PROOF_CONFIGURED",
    message: "Local A2A well-known, signed-card, task/message, HTTP, and loopback server proof is wired.",
    evidence: REQUIRED_LOCAL_COMMANDS.join("; "),
    next: "Keep this as local proof only until public hosting and conformance evidence exists.",
  };
}

function checkPublicUrl(
  id: string,
  value: string | undefined,
  variableName: string,
  validatePath: (url: URL) => boolean,
  message: string,
): A2APublicReadinessCheck {
  if (!value || value.trim() === "") {
    return {
      id,
      status: "blocked-config",
      code: `${variableName}_MISSING`,
      message,
      evidence: `missing=${variableName}`,
      next: `Set ${variableName} outside committed files before running an operator-approved public A2A proof slice.`,
    };
  }

  const parsed = parsePublicHttpsUrl(value);
  if (!parsed || !validatePath(parsed)) {
    return {
      id,
      status: "blocked-config",
      code: `${variableName}_UNSAFE`,
      message,
      evidence: "configured-value-rejected",
      next: `Replace ${variableName} with a public HTTPS value outside committed files.`,
    };
  }

  return {
    id,
    status: "ready-approval",
    code: `${variableName}_CONFIG_PRESENT`,
    message,
    evidence: "configuration-present-redacted",
    next: "Run only in a dedicated operator-approved public A2A proof slice.",
  };
}

function checkTaskAuthDecision(value: string | undefined): A2APublicReadinessCheck {
  if (!value || value.trim() === "") {
    return {
      id: "task-auth-decision",
      status: "blocked-config",
      code: "A2A_PUBLIC_TASK_AUTH_DECISION_MISSING",
      message: "A2A public task routes need an explicit production auth decision.",
      evidence: "missing=A2A_PUBLIC_TASK_AUTH_DECISION",
      next: "Set A2A_PUBLIC_TASK_AUTH_DECISION to bearer, oauth2, or mtls outside committed files after choosing the production auth model.",
    };
  }

  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_TASK_AUTH_DECISIONS.has(normalized)) {
    return {
      id: "task-auth-decision",
      status: "blocked-config",
      code: "A2A_PUBLIC_TASK_AUTH_DECISION_UNSUPPORTED",
      message: "A2A public task routes need a supported production auth decision.",
      evidence: "configured-value-rejected",
      next: "Choose bearer, oauth2, or mtls before any public task route proof.",
    };
  }

  return {
    id: "task-auth-decision",
    status: "ready-approval",
    code: "A2A_PUBLIC_TASK_AUTH_DECISION_PRESENT",
    message: "A2A public task route auth decision is configured for a future approved proof slice.",
    evidence: "configuration-present-redacted",
    next: "Run only in a dedicated operator-approved public A2A proof slice.",
  };
}

function localStreamingSupport(): A2APublicReadinessCheck {
  return {
    id: "streaming",
    status: "proven-local",
    code: "A2A_STREAMING_LOCAL_PROOF_CONFIGURED",
    message: "A2A streaming is locally supported by the loopback Node server through SSE task events.",
    evidence: "npm run smoke:a2a-local-server",
    next: "Keep this as local loopback streaming proof only until public hosting and external conformance evidence exists.",
  };
}

function localExtendedAgentCardSupport(): A2APublicReadinessCheck {
  return {
    id: "extended-agent-card",
    status: "proven-local",
    code: "A2A_EXTENDED_AGENT_CARD_LOCAL_PROOF_CONFIGURED",
    message: "A2A authenticated extended Agent Card access is locally supported by the HTTP boundary.",
    evidence: "npm run smoke:a2a-http",
    next: "Keep this as local authenticated-card proof only until public hosting, production auth, and external conformance evidence exist.",
  };
}

function localPublicJwksHostingSupport(): A2APublicReadinessCheck {
  return {
    id: "local-public-jwks-hosting",
    status: "proven-local",
    code: "A2A_PUBLIC_JWKS_LOCAL_PROOF_CONFIGURED",
    message: "A2A public JWKS responses can be served locally with explicitly configured public key material only.",
    evidence: "node --import tsx --test packages/registry/src/a2aJwks.test.ts packages/standards/src/a2aNodeServer.test.ts",
    next: "Keep this as local JWKS hosting support only until an operator-approved public HTTPS JWKS URL, endpoint ownership, key rotation policy, and structured public discovery evidence exist.",
  };
}

function localStaticDiscoveryBundleSupport(): A2APublicReadinessCheck {
  return {
    id: "local-static-discovery-bundle",
    status: "proven-local",
    code: "A2A_STATIC_DISCOVERY_BUNDLE_LOCAL_PROOF_CONFIGURED",
    message: "A2A static discovery bundles can package signed Agent Card and public JWKS JSON artifacts for canonical well-known paths using public key material only.",
    evidence: "node --import tsx --test packages/registry/src/a2aDiscoveryBundle.test.ts packages/registry/src/a2aJwks.test.ts",
    next: "Keep this as local deployable-artifact support only until an operator-approved public host serves the bundle and structured public discovery evidence is accepted.",
  };
}

function localStaticDiscoveryArtifactWriterSupport(): A2APublicReadinessCheck {
  return {
    id: "local-static-discovery-artifact-writer",
    status: "proven-local",
    code: "A2A_STATIC_DISCOVERY_ARTIFACT_WRITER_LOCAL_PROOF_CONFIGURED",
    message: "A2A static discovery bundles can be written as local deployable well-known JSON artifacts plus a sanitized header manifest.",
    evidence: "npm run a2a:write-static-discovery-bundle -- --agent-card <signed-card.json> --jwks <jwks.json> --public-base-url <url> --public-jwks-url <url> --out-dir <dir>",
    next: "Keep this as local artifact generation only until the files are hosted on an operator-approved public HTTPS endpoint and structured public discovery evidence is accepted.",
  };
}

function localStaticDiscoveryArtifactValidatorSupport(): A2APublicReadinessCheck {
  return {
    id: "local-static-discovery-artifact-validator",
    status: "proven-local",
    code: "A2A_STATIC_DISCOVERY_ARTIFACT_VALIDATOR_LOCAL_PROOF_CONFIGURED",
    message: "A2A static discovery artifact directories can be validated locally before public hosting review without fetching public URLs.",
    evidence: "npm run a2a:check-static-discovery-bundle -- --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url>",
    next: "Keep this as local pre-hosting validation only until the files are served by an operator-approved public HTTPS endpoint and structured public discovery evidence is accepted.",
  };
}

function localStaticDiscoveryLocalHostSupport(): A2APublicReadinessCheck {
  return {
    id: "local-static-discovery-host-smoke",
    status: "proven-local",
    code: "A2A_STATIC_DISCOVERY_LOCAL_HOST_SMOKE_CONFIGURED",
    message: "A2A static discovery artifacts can be served and fetched over loopback with manifest-declared headers after local artifact validation.",
    evidence: "npm run smoke:a2a-static-discovery-local -- --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url>",
    next: "Keep this as local host-semantics proof only until an operator-approved public HTTPS endpoint serves the artifacts and structured public discovery evidence is accepted.",
  };
}

function localStaticHostingReviewSupport(): A2APublicReadinessCheck {
  return {
    id: "local-static-hosting-review",
    status: "proven-local",
    code: "A2A_STATIC_HOSTING_REVIEW_LOCAL_PROOF_CONFIGURED",
    message: "A2A static discovery artifacts can produce a redacted local hosting-review packet with canonical paths, required headers, command order, and public-proof boundaries.",
    evidence: "npm run a2a:write-static-hosting-review -- --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url> --out <review.json>",
    next: "Keep this as local review evidence only until an operator-approved public HTTPS endpoint serves the artifacts and structured public discovery evidence is accepted.",
  };
}

function localPublicProofPlanSupport(): A2APublicReadinessCheck {
  return {
    id: "local-public-proof-plan",
    status: "proven-local",
    code: "A2A_PUBLIC_PROOF_PLAN_LOCAL_PROOF_CONFIGURED",
    message: "A2A public proof planning can produce a redacted local operator checklist from current readiness gates without contacting public endpoints.",
    evidence: "npm run a2a:write-public-proof-plan",
    next: "Keep this as local planning evidence only; public discovery, public push delivery, and external conformance still require operator-approved proof runs and structured reports.",
  };
}

function localPushConfigurationSupport(): A2APublicReadinessCheck {
  return {
    id: "push-notification-configs",
    status: "proven-local",
    code: "A2A_PUSH_CONFIG_LOCAL_PROOF_CONFIGURED",
    message: "A2A push notification configuration CRUD is locally supported without webhook credential storage.",
    evidence: "npm run smoke:a2a-http",
    next: "Keep this as local configuration proof only until public webhook delivery, production auth, and external conformance evidence exist.",
  };
}

function localPushDeliverySupport(): A2APublicReadinessCheck {
  return {
    id: "local-push-delivery",
    status: "proven-local",
    code: "A2A_PUSH_DELIVERY_LOCAL_PROOF_CONFIGURED",
    message: "A2A push notification delivery envelopes are locally supported through an injected transport without default outbound webhook calls.",
    evidence: "npm run smoke:a2a-http",
    next: "Keep this as injected local proof only until public webhook delivery controls and infrastructure evidence exist.",
  };
}

function localPushHttpTransportSupport(): A2APublicReadinessCheck {
  return {
    id: "local-push-http-transport",
    status: "proven-local",
    code: "A2A_PUSH_HTTP_TRANSPORT_LOCAL_PROOF_CONFIGURED",
    message: "A2A push notification HTTP transport is locally supported as an explicitly injected helper with safe URL checks, timeout handling, manual redirect handling, and status-only results.",
    evidence: "node --import tsx --test packages/standards/src/a2aPush.test.ts",
    next: "Keep this as local mocked transport proof only until public webhook infrastructure, delivery observability, and external conformance evidence exist.",
  };
}

function localPushCallbackUrlHardeningSupport(): A2APublicReadinessCheck {
  return {
    id: "local-push-callback-url-hardening",
    status: "proven-local",
    code: "A2A_PUSH_CALLBACK_URL_HARDENING_LOCAL_PROOF_CONFIGURED",
    message: "A2A push notification callback URLs are locally rejected when they include credentials, query strings, fragments, loopback hosts, or non-public network hosts.",
    evidence: "node --import tsx --test packages/standards/src/a2aPush.test.ts",
    next: "Keep this as local callback admission proof only until public webhook allowlisting, authentication, worker, queue, observability, and external conformance evidence exist.",
  };
}

function localPushCallbackHostAllowlistSupport(): A2APublicReadinessCheck {
  return {
    id: "local-push-callback-host-allowlist",
    status: "proven-local",
    code: "A2A_PUSH_CALLBACK_HOST_ALLOWLIST_LOCAL_PROOF_CONFIGURED",
    message: "A2A push notification callback hosts can be constrained by an exact local allowlist before config storage or injected HTTP transport delivery.",
    evidence: "node --import tsx --test packages/standards/src/a2aPush.test.ts",
    next: "Keep this as local host-admission proof only until public webhook allowlisting, authentication, worker, queue, observability, and external conformance evidence exist.",
  };
}

function localPushRetryObservabilitySupport(): A2APublicReadinessCheck {
  return {
    id: "local-push-retry-observability",
    status: "proven-local",
    code: "A2A_PUSH_RETRY_OBSERVABILITY_LOCAL_PROOF_CONFIGURED",
    message: "A2A push notification retry and delivery-attempt observability are locally supported for explicitly injected transports with status-only attempt records.",
    evidence: "node --import tsx --test packages/standards/src/a2aPush.test.ts",
    next: "Keep this as local retry/attempt proof only until public webhook workers, persistent queues, production observability, and external conformance evidence exist.",
  };
}

function localPushDurableAttemptEvidenceSupport(): A2APublicReadinessCheck {
  return {
    id: "local-push-durable-attempt-evidence",
    status: "proven-local",
    code: "A2A_PUSH_DURABLE_ATTEMPT_EVIDENCE_LOCAL_PROOF_CONFIGURED",
    message: "A2A push notification delivery attempts can be persisted locally as sanitized JSONL status evidence without request bodies, response bodies, webhook credentials, or raw transport errors.",
    evidence: "node --import tsx --test packages/standards/src/a2aPush.test.ts",
    next: "Keep this as local durable evidence only until public webhook workers, delivery queues, production observability, authentication, and external conformance evidence exist.",
  };
}

function localPushDeliveryQueueSupport(): A2APublicReadinessCheck {
  return {
    id: "local-push-delivery-queue",
    status: "proven-local",
    code: "A2A_PUSH_DELIVERY_QUEUE_LOCAL_PROOF_CONFIGURED",
    message: "A2A push notification delivery requests can be queued locally as sanitized file-backed jobs with public headers and redacted task payloads.",
    evidence: "node --import tsx --test packages/standards/src/a2aPush.test.ts",
    next: "Keep this as local queue proof only until public webhook workers, production authentication, endpoint ownership, production observability, and external conformance evidence exist.",
  };
}

function localPushDeliveryWorkerSupport(): A2APublicReadinessCheck {
  return {
    id: "local-push-delivery-worker",
    status: "proven-local",
    code: "A2A_PUSH_DELIVERY_WORKER_LOCAL_PROOF_CONFIGURED",
    message: "A2A push notification delivery workers can process one local queued job through an explicitly injected transport, record status-only attempts, and complete or fail the local queue entry.",
    evidence: "node --import tsx --test packages/standards/src/a2aPush.test.ts",
    next: "Keep this as local worker proof only until public webhook operation, production authentication, endpoint ownership, production observability, and external conformance evidence exist.",
  };
}

async function checkPublicDiscoveryReport(
  cwd: string,
  value: string | undefined,
  options: {
    readonly expectedPublicAgentCardUrl: string | undefined;
    readonly expectedPublicBaseUrl: string | undefined;
    readonly expectedPublicJwksUrl: string | undefined;
    readonly expectedTaskAuthDecision: string | undefined;
    readonly now: Date;
  },
): Promise<A2APublicReadinessCheck> {
  if (!value || value.trim() === "") {
    return {
      id: "public-discovery",
      status: "blocked-conformance",
      code: "A2A_PUBLIC_DISCOVERY_REPORT_MISSING",
      message: "A2A public discovery and JWKS evidence has not been supplied.",
      evidence: "missing=A2A_PUBLIC_DISCOVERY_REPORT",
      next: "Run npm run smoke:a2a-public-discovery -- --report <local-report-path> only after operator approval and provide the report path outside committed docs.",
    };
  }

  const reportPath = isAbsolute(value) ? value : resolve(cwd, value);
  const report = await readStructuredEvidenceReport(reportPath, {
    kind: "a2a-public-discovery",
    id: "public-discovery",
    missingCode: "A2A_PUBLIC_DISCOVERY_REPORT_NOT_FOUND",
    invalidCodePrefix: "A2A_PUBLIC_DISCOVERY_REPORT",
    notFoundMessage: "A2A public discovery evidence path was configured but not found.",
    invalidMessage: "A2A public discovery evidence is not a valid passing structured report.",
    expectedPublicAgentCardUrl: options.expectedPublicAgentCardUrl,
    expectedPublicBaseUrl: options.expectedPublicBaseUrl,
    expectedPublicJwksUrl: options.expectedPublicJwksUrl,
    expectedTaskAuthDecision: options.expectedTaskAuthDecision,
    now: options.now,
  });
  if (!report.ok) {
    return {
      id: "public-discovery",
      status: "blocked-conformance",
      code: report.code,
      message: report.message,
      evidence: report.evidence,
      next: report.next,
    };
  }

  return {
    id: "public-discovery",
    status: "ready-approval",
    code: "A2A_PUBLIC_DISCOVERY_REPORT_VALID",
    message: "A2A public discovery and JWKS evidence is a passing structured report for a future approved review.",
    evidence: "local-structured-report-valid-redacted",
    next: "Review the report manually before accepting public discovery or JWKS claims.",
  };
}

async function checkPublicPushDeliveryReport(
  cwd: string,
  value: string | undefined,
  options: {
    readonly expectedPublicBaseUrl: string | undefined;
    readonly now: Date;
  },
): Promise<A2APublicReadinessCheck> {
  if (!value || value.trim() === "") {
    return {
      id: "public-push-delivery",
      status: "blocked-conformance",
      code: "A2A_PUBLIC_PUSH_DELIVERY_REPORT_MISSING",
      message: "A2A public push webhook delivery evidence has not been supplied.",
      evidence: "missing=A2A_PUBLIC_PUSH_DELIVERY_REPORT",
      next: "Provide a local structured public push delivery report path outside committed docs only after an operator-approved public webhook delivery proof run.",
    };
  }

  const reportPath = isAbsolute(value) ? value : resolve(cwd, value);
  const report = await readStructuredEvidenceReport(reportPath, {
    kind: "a2a-public-push-delivery",
    id: "public-push-delivery",
    missingCode: "A2A_PUBLIC_PUSH_DELIVERY_REPORT_NOT_FOUND",
    invalidCodePrefix: "A2A_PUBLIC_PUSH_DELIVERY_REPORT",
    notFoundMessage: "A2A public push webhook delivery evidence path was configured but not found.",
    invalidMessage: "A2A public push webhook delivery evidence is not a valid passing structured report.",
    expectedPublicBaseUrl: options.expectedPublicBaseUrl,
    now: options.now,
  });
  if (!report.ok) {
    return {
      id: "public-push-delivery",
      status: "blocked-conformance",
      code: report.code,
      message: report.message,
      evidence: report.evidence,
      next: report.next,
    };
  }

  return {
    id: "public-push-delivery",
    status: "ready-approval",
    code: "A2A_PUBLIC_PUSH_DELIVERY_REPORT_VALID",
    message: "A2A public push webhook delivery evidence is a passing structured report for a future approved review.",
    evidence: "local-structured-report-valid-redacted",
    next: "Review the report manually before accepting public push delivery claims.",
  };
}

async function checkConformanceReport(
  cwd: string,
  value: string | undefined,
  options: {
    readonly expectedPublicAgentCardUrl: string | undefined;
    readonly expectedPublicBaseUrl: string | undefined;
    readonly now: Date;
  },
): Promise<A2APublicReadinessCheck> {
  if (!value || value.trim() === "") {
    return {
      id: "external-conformance",
      status: "blocked-conformance",
      code: "A2A_EXTERNAL_CONFORMANCE_REPORT_MISSING",
      message: "External A2A conformance evidence has not been supplied.",
      evidence: "missing=A2A_EXTERNAL_CONFORMANCE_REPORT",
      next: "Provide a local structured conformance report path outside committed docs only after an operator-approved public A2A proof run.",
    };
  }

  const reportPath = isAbsolute(value) ? value : resolve(cwd, value);
  const report = await readStructuredEvidenceReport(reportPath, {
    kind: "a2a-external-conformance",
    id: "external-conformance",
    missingCode: "A2A_EXTERNAL_CONFORMANCE_REPORT_NOT_FOUND",
    invalidCodePrefix: "A2A_EXTERNAL_CONFORMANCE_REPORT",
    notFoundMessage: "External A2A conformance evidence path was configured but not found.",
    invalidMessage: "External A2A conformance evidence is not a valid passing structured report.",
    expectedPublicAgentCardUrl: options.expectedPublicAgentCardUrl,
    expectedPublicBaseUrl: options.expectedPublicBaseUrl,
    now: options.now,
  });
  if (!report.ok) {
    return {
      id: "external-conformance",
      status: "blocked-conformance",
      code: report.code,
      message: report.message,
      evidence: report.evidence,
      next: report.next,
    };
  }

  return {
    id: "external-conformance",
    status: "ready-approval",
    code: "A2A_EXTERNAL_CONFORMANCE_REPORT_VALID",
    message: "External A2A conformance evidence is a passing structured report for a future approved review.",
    evidence: "local-structured-report-valid-redacted",
    next: "Review the report manually before accepting public A2A interoperability claims.",
  };
}

interface StructuredEvidenceValidationOptions {
  readonly kind: "a2a-public-discovery" | "a2a-public-push-delivery" | "a2a-external-conformance";
  readonly id: string;
  readonly missingCode: string;
  readonly invalidCodePrefix: string;
  readonly notFoundMessage: string;
  readonly invalidMessage: string;
  readonly expectedPublicAgentCardUrl?: string;
  readonly expectedPublicBaseUrl?: string;
  readonly expectedPublicJwksUrl?: string;
  readonly expectedTaskAuthDecision?: string;
  readonly now: Date;
}

type StructuredEvidenceValidationResult = {
  readonly ok: true;
} | {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
  readonly evidence: string;
  readonly next: string;
};

async function readStructuredEvidenceReport(
  reportPath: string,
  options: StructuredEvidenceValidationOptions,
): Promise<StructuredEvidenceValidationResult> {
  let raw: string;
  try {
    await access(reportPath);
    raw = await readFile(reportPath, "utf8");
  } catch {
    return structuredEvidenceFailure(
      options.missingCode,
      options.notFoundMessage,
      "configured-report-missing",
      "Provide an existing local structured report after an operator-approved proof run.",
    );
  }

  if (raw.length > 64 * 1024) {
    return structuredEvidenceFailure(
      `${options.invalidCodePrefix}_TOO_LARGE`,
      options.invalidMessage,
      "configured-report-too-large",
      "Provide a concise local structured report without raw payloads or credential material.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return structuredEvidenceFailure(
      `${options.invalidCodePrefix}_INVALID_JSON`,
      options.invalidMessage,
      "configured-report-invalid-json",
      "Provide a JSON structured evidence report generated after an operator-approved proof run.",
    );
  }

  if (!isRecord(parsed)) {
    return structuredEvidenceFailure(
      `${options.invalidCodePrefix}_INVALID_SHAPE`,
      options.invalidMessage,
      "configured-report-invalid-shape",
      "Provide a JSON object structured evidence report.",
    );
  }

  if (parsed.schemaVersion !== 1) {
    return structuredEvidenceFailure(
      `${options.invalidCodePrefix}_UNSUPPORTED_SCHEMA`,
      options.invalidMessage,
      "configured-report-unsupported-schema",
      "Provide a structured evidence report with schemaVersion=1.",
    );
  }

  if (parsed.kind !== options.kind) {
    return structuredEvidenceFailure(
      `${options.invalidCodePrefix}_KIND_MISMATCH`,
      options.invalidMessage,
      "configured-report-kind-mismatch",
      `Provide a ${options.kind} structured evidence report.`,
    );
  }

  if (parsed.result !== "passed") {
    return structuredEvidenceFailure(
      `${options.invalidCodePrefix}_NOT_PASSED`,
      options.invalidMessage,
      "configured-report-not-passed",
      "Provide only passing evidence from an operator-approved proof run.",
    );
  }

  if (typeof parsed.observedAt !== "string" || !isRecentTimestamp(parsed.observedAt, options.now)) {
    return structuredEvidenceFailure(
      `${options.invalidCodePrefix}_STALE_OR_INVALID_TIME`,
      options.invalidMessage,
      "configured-report-stale-or-invalid-time",
      "Provide a structured evidence report with an observedAt timestamp from the last 30 days.",
    );
  }

  if (options.expectedPublicBaseUrl && isPublicUrl(options.expectedPublicBaseUrl)) {
    if (parsed.publicBaseUrl !== options.expectedPublicBaseUrl) {
      return structuredEvidenceFailure(
        `${options.invalidCodePrefix}_PUBLIC_BASE_URL_MISMATCH`,
        options.invalidMessage,
        "configured-report-public-base-url-mismatch",
        "Provide evidence for the same configured public base URL.",
      );
    }
  }

  if (options.expectedPublicAgentCardUrl && isPublicUrl(options.expectedPublicAgentCardUrl)) {
    if (parsed.publicAgentCardUrl !== options.expectedPublicAgentCardUrl) {
      return structuredEvidenceFailure(
        `${options.invalidCodePrefix}_PUBLIC_AGENT_CARD_URL_MISMATCH`,
        options.invalidMessage,
        "configured-report-public-agent-card-url-mismatch",
        "Provide evidence for the same configured public Agent Card URL.",
      );
    }
  }

  if (options.expectedPublicJwksUrl && isPublicUrl(options.expectedPublicJwksUrl)) {
    if (parsed.publicJwksUrl !== options.expectedPublicJwksUrl) {
      return structuredEvidenceFailure(
        `${options.invalidCodePrefix}_PUBLIC_JWKS_URL_MISMATCH`,
        options.invalidMessage,
        "configured-report-public-jwks-url-mismatch",
        "Provide evidence for the same configured public JWKS URL.",
      );
    }
  }

  const expectedTaskAuthDecision = normalizeTaskAuthDecision(options.expectedTaskAuthDecision);
  if (expectedTaskAuthDecision && parsed.taskAuthDecision !== expectedTaskAuthDecision) {
    return structuredEvidenceFailure(
      `${options.invalidCodePrefix}_TASK_AUTH_DECISION_MISMATCH`,
      options.invalidMessage,
      "configured-report-task-auth-decision-mismatch",
      "Provide evidence for the same configured public task auth decision.",
    );
  }

  return { ok: true };
}

function structuredEvidenceFailure(
  code: string,
  message: string,
  evidence: string,
  next: string,
): StructuredEvidenceValidationResult {
  return {
    ok: false,
    code,
    message,
    evidence,
    next,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecentTimestamp(value: string, now: Date): boolean {
  const observedAt = new Date(value);
  const observedMs = observedAt.getTime();
  if (!Number.isFinite(observedMs)) return false;
  const nowMs = now.getTime();
  if (observedMs > nowMs + 60_000) return false;
  return nowMs - observedMs <= 30 * 24 * 60 * 60 * 1000;
}

function isPublicUrl(value: string): boolean {
  return parsePublicHttpsUrl(value) !== undefined;
}

function normalizeTaskAuthDecision(value: string | undefined): "bearer" | "oauth2" | "mtls" | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || !ALLOWED_TASK_AUTH_DECISIONS.has(normalized)) return undefined;
  return normalized as "bearer" | "oauth2" | "mtls";
}

function parsePublicHttpsUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return undefined;
    if (isLoopbackHostname(url.hostname)) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "::1"
    || normalized === "[::1]"
    || normalized.endsWith(".localhost");
}

async function main(): Promise<number> {
  const report = await checkA2APublicReadiness();
  console.log(formatA2APublicReadinessReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
