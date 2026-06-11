import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type A2APublicDiscoverySmokeResult =
  | {
      readonly ok: true;
      readonly source: "a2a-public-discovery";
      readonly checks: readonly A2APublicDiscoveryCheck[];
    }
  | {
      readonly ok: false;
      readonly kind: "blocked" | "failed";
      readonly code:
        | "A2A_PUBLIC_DISCOVERY_CONFIG_MISSING"
        | "A2A_PUBLIC_DISCOVERY_URL_UNSAFE"
        | "A2A_PUBLIC_AGENT_CARD_FETCH_FAILED"
        | "A2A_PUBLIC_AGENT_CARD_INVALID"
        | "A2A_PUBLIC_AGENT_CARD_SECRET_FIELD"
        | "A2A_PUBLIC_AGENT_CARD_BASE_URL_MISMATCH"
        | "A2A_PUBLIC_AGENT_CARD_AUTH_MISMATCH"
        | "A2A_PUBLIC_JWKS_FETCH_FAILED"
        | "A2A_PUBLIC_JWKS_INVALID"
        | "A2A_PUBLIC_JWKS_PRIVATE_KEY_MATERIAL";
      readonly missing?: readonly string[];
      readonly checks: readonly A2APublicDiscoveryCheck[];
      readonly message: string;
    };

export interface A2APublicDiscoveryCheck {
  readonly id: string;
  readonly status: "passed" | "blocked" | "failed";
  readonly code: string;
  readonly message: string;
}

export interface A2APublicDiscoveryEvidenceReport {
  readonly schemaVersion: 1;
  readonly kind: "a2a-public-discovery";
  readonly result: "passed";
  readonly observedAt: string;
  readonly publicAgentCardUrl: string;
  readonly publicBaseUrl: string;
  readonly publicJwksUrl: string;
  readonly taskAuthDecision: "bearer" | "oauth2" | "mtls";
  readonly checks: readonly string[];
}

export interface RunA2APublicDiscoverySmokeOptions {
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly fetch?: typeof fetch;
  readonly now?: Date;
  readonly reportPath?: string;
  readonly timeoutMs?: number;
}

const REQUIRED_ENV = [
  "A2A_PUBLIC_AGENT_CARD_URL",
  "A2A_PUBLIC_BASE_URL",
  "A2A_PUBLIC_JWKS_URL",
  "A2A_PUBLIC_TASK_AUTH_DECISION",
] as const;

type A2APublicTaskAuthDecision = A2APublicDiscoveryEvidenceReport["taskAuthDecision"];

const ALLOWED_AUTH_DECISIONS = new Set(["bearer", "oauth2", "mtls"]);
const MAX_RESPONSE_BYTES = 64 * 1024;
const PRIVATE_JWK_FIELDS = new Set(["d", "p", "q", "dp", "dq", "qi", "oth"]);

export async function runA2APublicDiscoverySmoke(
  options: RunA2APublicDiscoverySmokeOptions = {},
): Promise<A2APublicDiscoverySmokeResult> {
  const env = options.env ?? process.env;
  const missing = REQUIRED_ENV.filter((key) => !readEnv(env, key));
  if (missing.length > 0) {
    return blocked("A2A_PUBLIC_DISCOVERY_CONFIG_MISSING", "A2A public discovery smoke requires public Agent Card, base URL, JWKS URL, and task auth decision configuration.", missing);
  }

  const agentCardUrl = readEnv(env, "A2A_PUBLIC_AGENT_CARD_URL");
  const publicBaseUrl = readEnv(env, "A2A_PUBLIC_BASE_URL");
  const jwksUrl = readEnv(env, "A2A_PUBLIC_JWKS_URL");
  const taskAuthDecisionValue = readEnv(env, "A2A_PUBLIC_TASK_AUTH_DECISION");
  if (!agentCardUrl || !publicBaseUrl || !jwksUrl || !taskAuthDecisionValue) {
    throw new Error("A2A public discovery missing-config invariant failed.");
  }

  const taskAuthDecision = normalizeTaskAuthDecision(taskAuthDecisionValue);
  if (
    !isPublicHttpsUrl(agentCardUrl)
    || !isPublicHttpsUrl(publicBaseUrl)
    || !isPublicHttpsUrl(jwksUrl)
    || !agentCardUrl.endsWith("/.well-known/agent-card.json")
    || !taskAuthDecision
  ) {
    return blocked("A2A_PUBLIC_DISCOVERY_URL_UNSAFE", "A2A public discovery configuration must use public HTTPS URLs and a supported auth decision.");
  }

  const fetchImpl = withTimeout(options.fetch ?? fetch, options.timeoutMs ?? 10_000);
  const agentCardResult = await fetchJson(fetchImpl, agentCardUrl);
  if (!agentCardResult.ok) {
    return failed("A2A_PUBLIC_AGENT_CARD_FETCH_FAILED", "A2A public Agent Card fetch failed.");
  }

  const agentCardValidation = validateAgentCard(agentCardResult.value, {
    agentCardUrl,
    publicBaseUrl,
    taskAuthDecision,
  });
  if (!agentCardValidation.ok) return agentCardValidation.result;

  const jwksResult = await fetchJson(fetchImpl, jwksUrl);
  if (!jwksResult.ok) {
    return failed("A2A_PUBLIC_JWKS_FETCH_FAILED", "A2A public JWKS fetch failed.");
  }

  const jwksValidation = validateJwks(jwksResult.value);
  if (!jwksValidation.ok) return jwksValidation.result;

  const checks = [
    passed("public-config", "A2A_PUBLIC_DISCOVERY_CONFIG_SAFE", "A2A public discovery configuration is safe to probe."),
    passed("public-agent-card", "A2A_PUBLIC_AGENT_CARD_VALID", "A2A public Agent Card matched configured discovery inputs."),
    passed("public-jwks", "A2A_PUBLIC_JWKS_VALID", "A2A public JWKS exposed public key material only."),
  ];
  const result: A2APublicDiscoverySmokeResult = {
    ok: true,
    source: "a2a-public-discovery",
    checks,
  };
  if (options.reportPath) {
    await writeDiscoveryReport(options.reportPath, {
      schemaVersion: 1,
      kind: "a2a-public-discovery",
      result: "passed",
      observedAt: (options.now ?? new Date()).toISOString(),
      publicAgentCardUrl: agentCardUrl,
      publicBaseUrl,
      publicJwksUrl: jwksUrl,
      taskAuthDecision,
      checks: checks.map((check) => check.id),
    });
  }
  return result;
}

export function formatA2APublicDiscoverySmokeResult(result: A2APublicDiscoverySmokeResult): string {
  const lines = [
    `A2A public discovery smoke ${result.ok ? "passed" : result.kind}`,
    `ok=${result.ok}`,
  ];
  if (!result.ok) {
    lines.push(`code=${result.code}`);
    if (result.missing) lines.push(`missing=${result.missing.join(",")}`);
    lines.push(`message=${result.message}`);
  } else {
    lines.push(`source=${result.source}`);
  }
  for (const check of result.checks) {
    lines.push(`${check.status}: ${check.id}: code=${check.code}`);
    lines.push(`message=${check.message}`);
  }
  return lines.join("\n");
}

function validateAgentCard(
  value: unknown,
  expected: {
    readonly agentCardUrl: string;
    readonly publicBaseUrl: string;
    readonly taskAuthDecision: string;
  },
): { readonly ok: true } | { readonly ok: false; readonly result: A2APublicDiscoverySmokeResult } {
  if (!isRecord(value)) {
    return invalidAgentCard("A2A public Agent Card response was not a JSON object.");
  }

  if (containsSecretLikePublicField(value)) {
    return {
      ok: false,
      result: failed("A2A_PUBLIC_AGENT_CARD_SECRET_FIELD", "A2A public Agent Card contained secret-like fields."),
    };
  }

  const interfaces = Array.isArray(value.supportedInterfaces) ? value.supportedInterfaces : [];
  const matchingInterface = interfaces.find((entry) =>
    isRecord(entry)
    && entry.url === expected.publicBaseUrl
    && entry.protocolBinding === "HTTP+JSON"
    && typeof entry.protocolVersion === "string"
  );
  if (!matchingInterface) {
    return {
      ok: false,
      result: failed("A2A_PUBLIC_AGENT_CARD_BASE_URL_MISMATCH", "A2A public Agent Card did not advertise the configured public base URL with HTTP+JSON."),
    };
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    return invalidAgentCard("A2A public Agent Card was missing a name.");
  }
  if (typeof value.version !== "string" || value.version.trim() === "") {
    return invalidAgentCard("A2A public Agent Card was missing a version.");
  }
  if (!isRecord(value.capabilities)) {
    return invalidAgentCard("A2A public Agent Card was missing capabilities.");
  }
  if (!Array.isArray(value.skills)) {
    return invalidAgentCard("A2A public Agent Card was missing skills.");
  }

  if (!agentCardAuthMatches(value, expected.taskAuthDecision)) {
    return {
      ok: false,
      result: failed("A2A_PUBLIC_AGENT_CARD_AUTH_MISMATCH", "A2A public Agent Card auth schemes did not match the configured task auth decision."),
    };
  }

  return { ok: true };
}

function validateJwks(
  value: unknown,
): { readonly ok: true } | { readonly ok: false; readonly result: A2APublicDiscoverySmokeResult } {
  if (!isRecord(value) || !Array.isArray(value.keys) || value.keys.length === 0) {
    return {
      ok: false,
      result: failed("A2A_PUBLIC_JWKS_INVALID", "A2A public JWKS response was malformed or empty."),
    };
  }

  for (const key of value.keys) {
    if (!isRecord(key) || typeof key.kid !== "string" || key.kid.trim() === "" || typeof key.kty !== "string") {
      return {
        ok: false,
        result: failed("A2A_PUBLIC_JWKS_INVALID", "A2A public JWKS key was missing public key metadata."),
      };
    }
    for (const field of PRIVATE_JWK_FIELDS) {
      if (field in key) {
        return {
          ok: false,
          result: failed("A2A_PUBLIC_JWKS_PRIVATE_KEY_MATERIAL", "A2A public JWKS contained private key material."),
        };
      }
    }
  }

  return { ok: true };
}

async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
): Promise<{ readonly ok: true; readonly value: unknown } | { readonly ok: false }> {
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "manual",
    });
    if (!response.ok) return { ok: false };
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) return { ok: false };
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function agentCardAuthMatches(card: Record<string, unknown>, decision: string): boolean {
  const schemes = isRecord(card.securitySchemes) ? Object.values(card.securitySchemes) : [];
  if (decision === "bearer") {
    return schemes.some((scheme) =>
      isRecord(scheme)
      && isRecord(scheme.httpAuthSecurityScheme)
      && typeof scheme.httpAuthSecurityScheme.scheme === "string"
      && scheme.httpAuthSecurityScheme.scheme.toLowerCase() === "bearer"
    );
  }
  if (decision === "oauth2") {
    return schemes.some((scheme) => isRecord(scheme) && (isRecord(scheme.oauth2SecurityScheme) || isRecord(scheme.openIdConnectSecurityScheme)));
  }
  if (decision === "mtls") {
    return schemes.some((scheme) => isRecord(scheme) && isRecord(scheme.mtlsSecurityScheme));
  }
  return false;
}

function containsSecretLikePublicField(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!isRecord(current)) continue;
    for (const [key, nested] of Object.entries(current)) {
      const normalized = key.toLowerCase();
      if (
        normalized.includes("secret")
        || normalized.includes("token")
        || normalized.includes("private")
        || normalized.includes("credential")
        || normalized.includes("signer")
        || normalized.includes("mnemonic")
        || normalized.includes("seed")
      ) {
        return true;
      }
      if (isRecord(nested)) stack.push(nested);
      if (Array.isArray(nested)) stack.push(...nested);
    }
  }
  return false;
}

function invalidAgentCard(message: string): { readonly ok: false; readonly result: A2APublicDiscoverySmokeResult } {
  return {
    ok: false,
    result: failed("A2A_PUBLIC_AGENT_CARD_INVALID", message),
  };
}

function passed(id: string, code: string, message: string): A2APublicDiscoveryCheck {
  return { id, status: "passed", code, message };
}

function blocked(
  code: Extract<A2APublicDiscoverySmokeResult, { ok: false }>["code"],
  message: string,
  missing?: readonly string[],
): A2APublicDiscoverySmokeResult {
  return {
    ok: false,
    kind: "blocked",
    code,
    ...(missing ? { missing } : {}),
    message,
    checks: [blockedCheck("public-config", code, message)],
  };
}

function failed(
  code: Extract<A2APublicDiscoverySmokeResult, { ok: false }>["code"],
  message: string,
): A2APublicDiscoverySmokeResult {
  return {
    ok: false,
    kind: "failed",
    code,
    message,
    checks: [failedCheck("public-discovery", code, message)],
  };
}

function blockedCheck(id: string, code: string, message: string): A2APublicDiscoveryCheck {
  return { id, status: "blocked", code, message };
}

function failedCheck(id: string, code: string, message: string): A2APublicDiscoveryCheck {
  return { id, status: "failed", code, message };
}

function readEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function normalizeTaskAuthDecision(value: string | undefined): A2APublicTaskAuthDecision | undefined {
  const normalized = value?.toLowerCase();
  if (!normalized || !ALLOWED_AUTH_DECISIONS.has(normalized)) return undefined;
  return normalized as A2APublicTaskAuthDecision;
}

async function writeDiscoveryReport(
  reportPath: string,
  report: A2APublicDiscoveryEvidenceReport,
): Promise<void> {
  const resolved = isAbsolute(reportPath) ? reportPath : resolve(process.cwd(), reportPath);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(report, null, 2)}\n`);
}

function isPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return !isLoopbackHostname(url.hostname);
  } catch {
    return false;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function withTimeout(fetchImpl: typeof fetch, timeoutMs: number): typeof fetch {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(input, {
        ...init,
        signal: init.signal ?? controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };
}

async function main(): Promise<number> {
  const parsedArgs = parseArgs(process.argv.slice(2));
  if (!parsedArgs.ok) {
    console.error(formatA2APublicDiscoverySmokeResult(blocked(
      "A2A_PUBLIC_DISCOVERY_CONFIG_MISSING",
      parsedArgs.message,
    )));
    return 2;
  }
  const result = await runA2APublicDiscoverySmoke({ reportPath: parsedArgs.reportPath });
  const formatted = formatA2APublicDiscoverySmokeResult(result);
  if (result.ok) {
    console.log(formatted);
    return 0;
  }
  console.error(formatted);
  return result.kind === "blocked" ? 2 : 1;
}

function parseArgs(args: readonly string[]): { readonly ok: true; readonly reportPath?: string } | { readonly ok: false; readonly message: string } {
  let reportPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--report") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        return { ok: false, message: "A2A public discovery --report requires a local output path." };
      }
      reportPath = value;
      index += 1;
      continue;
    }
    return { ok: false, message: "A2A public discovery smoke only accepts --report <path>." };
  }
  return reportPath ? { ok: true, reportPath } : { ok: true };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
