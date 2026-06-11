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
  "packages/standards/src/a2a.ts",
  "packages/standards/src/a2aHttp.ts",
  "packages/standards/src/a2aNodeServer.ts",
  "packages/standards/src/a2aPush.ts",
  "scripts/smoke-a2a-local-server.ts",
] as const;

const ALLOWED_TASK_AUTH_DECISIONS = new Set(["bearer", "oauth2", "mtls"]);

export async function checkA2APublicReadiness(
  options: A2APublicReadinessOptions = {},
): Promise<A2APublicReadinessReport> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const scripts = options.scripts ?? await loadPackageScripts(cwd);
  const checks = [
    await checkLocalA2AProof(cwd, scripts),
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
    localExtendedAgentCardSupport(),
    localStreamingSupport(),
    localPushConfigurationSupport(),
    localPushDeliverySupport(),
    localPushHttpTransportSupport(),
    blockedPublicPushDelivery(),
    await checkConformanceReport(cwd, env.A2A_EXTERNAL_CONFORMANCE_REPORT),
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

function blockedPublicPushDelivery(): A2APublicReadinessCheck {
  return {
    id: "public-push-delivery",
    status: "blocked-conformance",
    code: "A2A_PUBLIC_PUSH_DELIVERY_PROOF_MISSING",
    message: "A2A public push webhook delivery remains blocked until outbound delivery infrastructure, production SSRF controls, production auth, and external conformance evidence exist.",
    evidence: "public-delivery-proof-missing",
    next: "Run only in a dedicated operator-approved public webhook delivery slice.",
  };
}

async function checkConformanceReport(
  cwd: string,
  value: string | undefined,
): Promise<A2APublicReadinessCheck> {
  if (!value || value.trim() === "") {
    return {
      id: "external-conformance",
      status: "blocked-conformance",
      code: "A2A_EXTERNAL_CONFORMANCE_REPORT_MISSING",
      message: "External A2A conformance evidence has not been supplied.",
      evidence: "missing=A2A_EXTERNAL_CONFORMANCE_REPORT",
      next: "Provide a local conformance report path outside committed docs only after an operator-approved public A2A proof run.",
    };
  }

  const reportPath = isAbsolute(value) ? value : resolve(cwd, value);
  try {
    await access(reportPath);
  } catch {
    return {
      id: "external-conformance",
      status: "blocked-conformance",
      code: "A2A_EXTERNAL_CONFORMANCE_REPORT_NOT_FOUND",
      message: "External A2A conformance evidence path was configured but not found.",
      evidence: "configured-report-missing",
      next: "Provide an existing local conformance report after an operator-approved public A2A proof run.",
    };
  }

  return {
    id: "external-conformance",
    status: "ready-approval",
    code: "A2A_EXTERNAL_CONFORMANCE_REPORT_PRESENT",
    message: "External A2A conformance evidence path exists for a future approved review.",
    evidence: "local-report-present-redacted",
    next: "Review the report manually before accepting public A2A interoperability claims.",
  };
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
