import { mkdir, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFile } from "../apps/policy-gateway-service/src/readiness.js";

export type A2AExternalConformanceSmokeResult =
  | {
      readonly ok: true;
      readonly source: "a2a-external-conformance";
      readonly checks: readonly A2AExternalConformanceCheck[];
    }
  | {
      readonly ok: false;
      readonly kind: "blocked" | "failed";
      readonly code:
        | "A2A_EXTERNAL_CONFORMANCE_CONFIG_MISSING"
        | "A2A_EXTERNAL_CONFORMANCE_URL_UNSAFE"
        | "A2A_EXTERNAL_CONFORMANCE_AUTH_UNSUPPORTED"
        | "A2A_EXTERNAL_CONFORMANCE_AGENT_CARD_FETCH_FAILED"
        | "A2A_EXTERNAL_CONFORMANCE_AGENT_CARD_INVALID"
        | "A2A_EXTERNAL_CONFORMANCE_AGENT_CARD_BASE_URL_MISMATCH"
        | "A2A_EXTERNAL_CONFORMANCE_SEND_FAILED"
        | "A2A_EXTERNAL_CONFORMANCE_SEND_RESPONSE_INVALID";
      readonly missing?: readonly string[];
      readonly checks: readonly A2AExternalConformanceCheck[];
      readonly message: string;
      readonly httpStatus?: number;
    };

export interface A2AExternalConformanceCheck {
  readonly id: string;
  readonly status: "passed" | "blocked" | "failed";
  readonly code: string;
  readonly message: string;
}

export interface A2AExternalConformanceEvidenceReport {
  readonly schemaVersion: 1;
  readonly kind: "a2a-external-conformance";
  readonly result: "passed";
  readonly observedAt: string;
  readonly publicAgentCardUrl: string;
  readonly publicBaseUrl: string;
  readonly checks: readonly string[];
  readonly runner: "vallum-public-task-route-smoke";
}

export interface RunA2AExternalConformanceSmokeOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly fetch?: typeof fetch;
  readonly now?: Date;
  readonly reportPath?: string;
  readonly timeoutMs?: number;
}

const REQUIRED_ENV = [
  "A2A_PUBLIC_AGENT_CARD_URL",
  "A2A_PUBLIC_BASE_URL",
  "A2A_PUBLIC_TASK_AUTH_DECISION",
] as const;

const BEARER_TOKEN_ENV = "A2A_PUBLIC_TASK_BEARER_TOKEN";
const MAX_RESPONSE_BYTES = 64 * 1024;
const LOCAL_ENV_FILE = ".env";

export async function runA2AExternalConformanceSmoke(
  options: RunA2AExternalConformanceSmokeOptions = {},
): Promise<A2AExternalConformanceSmokeResult> {
  const cwd = options.cwd ?? process.cwd();
  const env = await resolveA2AExternalConformanceEnv(cwd, options.env);
  const missing = REQUIRED_ENV.filter((key) => !readEnv(env, key));
  if (missing.length > 0) {
    return blocked(
      "A2A_EXTERNAL_CONFORMANCE_CONFIG_MISSING",
      "A2A external conformance smoke requires public Agent Card, public base URL, and task auth decision configuration.",
      missing,
    );
  }

  const agentCardUrl = readEnv(env, "A2A_PUBLIC_AGENT_CARD_URL");
  const publicBaseUrl = readEnv(env, "A2A_PUBLIC_BASE_URL");
  const taskAuthDecision = readEnv(env, "A2A_PUBLIC_TASK_AUTH_DECISION")?.toLowerCase();
  if (!agentCardUrl || !publicBaseUrl || !taskAuthDecision) {
    throw new Error("A2A external conformance missing-config invariant failed.");
  }

  if (
    !isSafePublicHttpsUrl(agentCardUrl)
    || !isSafePublicHttpsUrl(publicBaseUrl)
    || !agentCardUrl.endsWith("/.well-known/agent-card.json")
  ) {
    return blocked(
      "A2A_EXTERNAL_CONFORMANCE_URL_UNSAFE",
      "A2A external conformance smoke requires public HTTPS URLs and the canonical Agent Card path.",
    );
  }

  if (taskAuthDecision !== "bearer") {
    return blocked(
      "A2A_EXTERNAL_CONFORMANCE_AUTH_UNSUPPORTED",
      "A2A external conformance smoke currently automates bearer task auth only; OAuth2 and mTLS require an operator-owned report.",
    );
  }

  const bearerToken = readEnv(env, BEARER_TOKEN_ENV);
  if (!bearerToken) {
    return blocked(
      "A2A_EXTERNAL_CONFORMANCE_CONFIG_MISSING",
      "A2A external conformance smoke requires a local bearer token for the public task route.",
      [BEARER_TOKEN_ENV],
    );
  }

  const fetchImpl = withTimeout(options.fetch ?? fetch, options.timeoutMs ?? 10_000);
  const agentCardResult = await fetchJson(fetchImpl, agentCardUrl, {
    method: "GET",
    headers: { accept: "application/json" },
  });
  if (!agentCardResult.ok) {
    return failed("A2A_EXTERNAL_CONFORMANCE_AGENT_CARD_FETCH_FAILED", "A2A public Agent Card fetch failed.");
  }

  const agentCardValidation = validateAgentCard(agentCardResult.value, publicBaseUrl);
  if (!agentCardValidation.ok) return agentCardValidation.result;

  const sendResult = await fetchJson(fetchImpl, messageSendUrl(publicBaseUrl), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify({
      message: {
        messageId: `vallum-public-conformance-${(options.now ?? new Date()).getTime()}`,
        role: "ROLE_USER",
        parts: [{ text: "Vallum external conformance probe." }],
      },
    }),
  });
  if (!sendResult.ok) {
    return failed(
      "A2A_EXTERNAL_CONFORMANCE_SEND_FAILED",
      "A2A public message send failed.",
      sendResult.status,
    );
  }
  if (!isValidSendMessageResponse(sendResult.value)) {
    return failed(
      "A2A_EXTERNAL_CONFORMANCE_SEND_RESPONSE_INVALID",
      "A2A public message send returned an invalid response shape.",
    );
  }

  const checks = [
    passed("agent-card", "A2A_EXTERNAL_AGENT_CARD_VALID", "A2A public Agent Card was reachable and matched the configured public base URL."),
    passed("message-send", "A2A_EXTERNAL_MESSAGE_SEND_VALID", "A2A public message:send accepted bearer-authenticated JSON and returned a task or message."),
    passed("redaction-review", "A2A_EXTERNAL_CONFORMANCE_REPORT_REDACTED", "A2A external conformance report excludes credentials, raw payloads, response bodies, and local paths."),
  ];
  const result: A2AExternalConformanceSmokeResult = {
    ok: true,
    source: "a2a-external-conformance",
    checks,
  };
  if (options.reportPath) {
    await writeConformanceReport(cwd, options.reportPath, {
      schemaVersion: 1,
      kind: "a2a-external-conformance",
      result: "passed",
      observedAt: (options.now ?? new Date()).toISOString(),
      publicAgentCardUrl: agentCardUrl,
      publicBaseUrl,
      checks: checks.map((check) => check.id),
      runner: "vallum-public-task-route-smoke",
    });
  }
  return result;
}

export async function resolveA2AExternalConformanceEnv(
  cwd: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> | undefined,
): Promise<Record<string, string | undefined>> {
  const fileEnv = await loadOptionalLocalEnv(cwd);
  return {
    ...fileEnv,
    ...(env ?? process.env),
  };
}

async function loadOptionalLocalEnv(cwd: string): Promise<Record<string, string>> {
  try {
    return await loadEnvFile(LOCAL_ENV_FILE, cwd);
  } catch {
    return {};
  }
}

export function formatA2AExternalConformanceSmokeResult(result: A2AExternalConformanceSmokeResult): string {
  const lines = [
    `A2A external conformance smoke ${result.ok ? "passed" : result.kind}`,
    `ok=${result.ok}`,
  ];
  if (result.ok) {
    lines.push(`source=${result.source}`);
  } else {
    lines.push(`code=${result.code}`);
    if (result.missing) lines.push(`missing=${result.missing.join(",")}`);
    if (result.httpStatus !== undefined) lines.push(`httpStatus=${result.httpStatus}`);
    lines.push(`message=${result.message}`);
  }
  for (const check of result.checks) {
    lines.push(`${check.status}: ${check.id}: code=${check.code}`);
    lines.push(`message=${check.message}`);
  }
  return lines.join("\n");
}

function validateAgentCard(
  value: unknown,
  publicBaseUrl: string,
): { readonly ok: true } | { readonly ok: false; readonly result: A2AExternalConformanceSmokeResult } {
  if (!isRecord(value)) {
    return invalidAgentCard("A2A public Agent Card response was not a JSON object.");
  }
  if (containsSecretLikePublicField(value)) {
    return invalidAgentCard("A2A public Agent Card contained secret-like fields.");
  }
  const interfaces = Array.isArray(value.supportedInterfaces) ? value.supportedInterfaces : [];
  const matchingInterface = interfaces.find((entry) =>
    isRecord(entry)
    && entry.url === publicBaseUrl
    && entry.protocolBinding === "HTTP+JSON"
    && typeof entry.protocolVersion === "string"
  );
  if (!matchingInterface) {
    return {
      ok: false,
      result: failed(
        "A2A_EXTERNAL_CONFORMANCE_AGENT_CARD_BASE_URL_MISMATCH",
        "A2A public Agent Card did not advertise the configured public base URL with HTTP+JSON.",
      ),
    };
  }
  if (typeof value.name !== "string" || value.name.trim() === "") {
    return invalidAgentCard("A2A public Agent Card was missing a name.");
  }
  if (!isRecord(value.capabilities)) {
    return invalidAgentCard("A2A public Agent Card was missing capabilities.");
  }
  return { ok: true };
}

function isValidSendMessageResponse(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (isRecord(value.task) || isRecord(value.message)) return true;
  return typeof value.id === "string" && isRecord(value.status);
}

async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<{ readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly status?: number }> {
  try {
    const response = await fetchImpl(url, { ...init, redirect: "manual" });
    if (!response.ok) return { ok: false, status: response.status };
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) return { ok: false, status: response.status };
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

async function writeConformanceReport(
  cwd: string,
  reportPath: string,
  report: A2AExternalConformanceEvidenceReport,
): Promise<void> {
  const resolved = isAbsolute(reportPath) ? reportPath : resolve(cwd, reportPath);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
}

function messageSendUrl(publicBaseUrl: string): string {
  const url = new URL(publicBaseUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/message:send`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function readEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function isSafePublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || isUnsafePublicHost(url.hostname)) return false;
    if (url.username || url.password || url.search || url.hash) return false;
    return true;
  } catch {
    return false;
  }
}

function isUnsafePublicHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    const [first = 0, second = 0] = normalized.split(".").map((octet) => Number.parseInt(octet, 10));
    return first === 0
      || first === 10
      || first === 127
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 198 && (second === 18 || second === 19))
      || first >= 224;
  }
  if (ipVersion === 6) {
    return normalized === "::"
      || normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || normalized.startsWith("fe80:");
  }
  return false;
}

function passed(id: string, code: string, message: string): A2AExternalConformanceCheck {
  return { id, status: "passed", code, message };
}

function blocked(
  code: Extract<A2AExternalConformanceSmokeResult, { ok: false }>["code"],
  message: string,
  missing?: readonly string[],
): A2AExternalConformanceSmokeResult {
  return {
    ok: false,
    kind: "blocked",
    code,
    ...(missing ? { missing } : {}),
    message,
    checks: [{ id: "public-config", status: "blocked", code, message }],
  };
}

function failed(
  code: Extract<A2AExternalConformanceSmokeResult, { ok: false }>["code"],
  message: string,
  httpStatus?: number,
): A2AExternalConformanceSmokeResult {
  return {
    ok: false,
    kind: "failed",
    code,
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    message,
    checks: [{ id: "external-conformance", status: "failed", code, message }],
  };
}

function invalidAgentCard(message: string): { readonly ok: false; readonly result: A2AExternalConformanceSmokeResult } {
  return {
    ok: false,
    result: failed("A2A_EXTERNAL_CONFORMANCE_AGENT_CARD_INVALID", message),
  };
}

function withTimeout(fetchImpl: typeof fetch, timeoutMs: number): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  };
}

async function main(): Promise<number> {
  const parsedArgs = parseArgs(process.argv.slice(2));
  if (!parsedArgs.ok) {
    console.error(formatA2AExternalConformanceSmokeResult(blocked(
      "A2A_EXTERNAL_CONFORMANCE_CONFIG_MISSING",
      parsedArgs.message,
    )));
    return 2;
  }

  const result = await runA2AExternalConformanceSmoke({
    reportPath: parsedArgs.reportPath,
    timeoutMs: parsedArgs.timeoutMs,
  });
  const formatted = formatA2AExternalConformanceSmokeResult(result);
  if (result.ok) {
    console.log(formatted);
    return 0;
  }
  console.error(formatted);
  return result.kind === "blocked" ? 2 : 1;
}

function parseArgs(args: readonly string[]): (
  | { readonly ok: true; readonly reportPath?: string; readonly timeoutMs?: number }
  | { readonly ok: false; readonly message: string }
) {
  let reportPath: string | undefined;
  let timeoutMs: number | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--report") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        return { ok: false, message: "A2A external conformance --report requires a local output path." };
      }
      reportPath = value;
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        return { ok: false, message: "A2A external conformance --timeout-ms requires a positive integer." };
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return { ok: false, message: "A2A external conformance --timeout-ms requires a positive integer." };
      }
      timeoutMs = parsed;
      index += 1;
      continue;
    }
    return { ok: false, message: "A2A external conformance smoke only accepts --report <path> and --timeout-ms <ms>." };
  }
  return reportPath ? { ok: true, reportPath, timeoutMs } : { ok: true, timeoutMs };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
