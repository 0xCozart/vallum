import { mkdir, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  A2APushNotificationError,
  LocalA2APushNotificationAttemptStore,
  LocalA2APushNotificationStore,
  createA2APushHttpTransport,
  createA2APushNotificationConfig,
  deliverA2APushNotifications,
  type A2ATask,
} from "@vallum/standards";

export type A2APublicPushDeliverySmokeResult =
  | {
      readonly ok: true;
      readonly source: "a2a-public-push-delivery";
      readonly checks: readonly A2APublicPushDeliveryCheck[];
      readonly attempts: number;
      readonly deliveredStatus: number;
    }
  | {
      readonly ok: false;
      readonly kind: "blocked" | "failed";
      readonly code:
        | "A2A_PUBLIC_PUSH_CONFIG_MISSING"
        | "A2A_PUBLIC_PUSH_CONFIG_UNSAFE"
        | "A2A_PUBLIC_PUSH_DELIVERY_FAILED";
      readonly missing?: readonly string[];
      readonly checks: readonly A2APublicPushDeliveryCheck[];
      readonly message: string;
    };

export interface A2APublicPushDeliveryCheck {
  readonly id: string;
  readonly status: "passed" | "blocked" | "failed";
  readonly code: string;
  readonly message: string;
}

export interface A2APublicPushDeliveryEvidenceReport {
  readonly schemaVersion: 1;
  readonly kind: "a2a-public-push-delivery";
  readonly result: "passed";
  readonly observedAt: string;
  readonly publicBaseUrl: string;
  readonly deliveryStatus: number;
  readonly attempts: number;
  readonly checks: readonly string[];
}

export interface RunA2APublicPushDeliverySmokeOptions {
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly fetch?: typeof fetch;
  readonly now?: Date;
  readonly reportPath?: string;
  readonly timeoutMs?: number;
}

const REQUIRED_ENV = [
  "A2A_PUBLIC_BASE_URL",
  "A2A_PUBLIC_PUSH_CALLBACK_URL",
] as const;

const TASK_ID = "vallum-public-push-proof-task";

export async function runA2APublicPushDeliverySmoke(
  options: RunA2APublicPushDeliverySmokeOptions = {},
): Promise<A2APublicPushDeliverySmokeResult> {
  const env = options.env ?? process.env;
  const missing = REQUIRED_ENV.filter((key) => !readEnv(env, key));
  if (missing.length > 0) {
    return blocked(
      "A2A_PUBLIC_PUSH_CONFIG_MISSING",
      "A2A public push delivery smoke requires a public base URL and public HTTPS callback URL.",
      missing,
    );
  }

  const publicBaseUrl = readEnv(env, "A2A_PUBLIC_BASE_URL");
  const callbackUrl = readEnv(env, "A2A_PUBLIC_PUSH_CALLBACK_URL");
  if (!publicBaseUrl || !callbackUrl) {
    throw new Error("A2A public push missing-config invariant failed.");
  }

  const base = parsePublicHttpsUrl(publicBaseUrl);
  const callback = parsePublicHttpsUrl(callbackUrl);
  if (!base || !callback || callback.search || callback.hash || callback.username || callback.password) {
    return blocked(
      "A2A_PUBLIC_PUSH_CONFIG_UNSAFE",
      "A2A public push delivery configuration must use public HTTPS URLs without callback credentials, query strings, or fragments.",
    );
  }

  try {
    const now = options.now ?? new Date();
    const store = new LocalA2APushNotificationStore();
    const attemptStore = new LocalA2APushNotificationAttemptStore();
    createA2APushNotificationConfig({
      store,
      taskId: TASK_ID,
      now,
      allowedCallbackHosts: [callback.hostname],
      value: {
        id: "public-push-proof",
        url: callback.toString(),
      },
    });

    const result = await deliverA2APushNotifications({
      store,
      task: taskFixture(now),
      attemptStore,
      transport: createA2APushHttpTransport({
        allowedCallbackHosts: [callback.hostname],
        fetch: options.fetch ?? fetch,
        timeoutMs: options.timeoutMs ?? 10_000,
      }),
      maxAttempts: 1,
      now: () => now,
    });
    const attempts = result.attempts.length > 0 ? result.attempts : attemptStore.list();
    const delivered = attempts.find((attempt) => attempt.status === "delivered" && isSuccessStatus(attempt.httpStatus));
    if (!delivered) {
      return failed("A2A_PUBLIC_PUSH_DELIVERY_FAILED", "A2A public push delivery callback did not return a successful HTTP status.");
    }
    const deliveredStatus = delivered.httpStatus;
    if (!isSuccessStatus(deliveredStatus)) {
      return failed("A2A_PUBLIC_PUSH_DELIVERY_FAILED", "A2A public push delivery callback did not return a successful HTTP status.");
    }

    const checks = [
      passed("public-config", "A2A_PUBLIC_PUSH_CONFIG_SAFE", "A2A public push delivery configuration is safe to probe."),
      passed("callback-delivery", "A2A_PUBLIC_PUSH_CALLBACK_DELIVERED", "A2A public push delivery callback returned a successful HTTP status."),
      passed("redaction-review", "A2A_PUBLIC_PUSH_REPORT_REDACTED", "A2A public push delivery report excludes callback URL, task prompt, headers, and response bodies."),
    ];
    const smokeResult: A2APublicPushDeliverySmokeResult = {
      ok: true,
      source: "a2a-public-push-delivery",
      checks,
      attempts: attempts.length,
      deliveredStatus,
    };
    if (options.reportPath) {
      await writePushDeliveryReport(options.reportPath, {
        schemaVersion: 1,
        kind: "a2a-public-push-delivery",
        result: "passed",
        observedAt: now.toISOString(),
        publicBaseUrl: base.toString(),
        deliveryStatus: deliveredStatus,
        attempts: attempts.length,
        checks: checks.map((check) => check.id),
      });
    }
    return smokeResult;
  } catch (error) {
    if (error instanceof A2APushNotificationError) {
      return blocked("A2A_PUBLIC_PUSH_CONFIG_UNSAFE", "A2A public push delivery configuration was rejected by callback URL hardening.");
    }
    return failed("A2A_PUBLIC_PUSH_DELIVERY_FAILED", "A2A public push delivery callback failed.");
  }
}

export function formatA2APublicPushDeliverySmokeResult(result: A2APublicPushDeliverySmokeResult): string {
  const lines = [
    `A2A public push delivery smoke ${result.ok ? "passed" : result.kind}`,
    `ok=${result.ok}`,
  ];
  if (result.ok) {
    lines.push(`source=${result.source}`);
    lines.push(`attempts=${result.attempts}`);
    lines.push(`deliveredStatus=${result.deliveredStatus}`);
  } else {
    lines.push(`code=${result.code}`);
    if (result.missing) lines.push(`missing=${result.missing.join(",")}`);
    lines.push(`message=${result.message}`);
  }
  for (const check of result.checks) {
    lines.push(`${check.status}: ${check.id}: code=${check.code}`);
    lines.push(`message=${check.message}`);
  }
  return lines.join("\n");
}

function taskFixture(now: Date): A2ATask {
  return {
    id: TASK_ID,
    contextId: "vallum-public-push-proof-context",
    status: {
      state: "TASK_STATE_COMPLETED",
      timestamp: now.toISOString(),
    },
    history: [{
      messageId: "vallum-public-push-proof-message",
      role: "ROLE_USER",
      parts: [{ text: "private prompt: Bearer redaction-fixture-token" }],
      metadata: {
        signerRef: "redaction-fixture-signer",
        paymentCredential: "redaction-fixture-payment",
      },
    }],
  };
}

function passed(id: string, code: string, message: string): A2APublicPushDeliveryCheck {
  return { id, status: "passed", code, message };
}

function blocked(
  code: Extract<A2APublicPushDeliverySmokeResult, { ok: false }>["code"],
  message: string,
  missing?: readonly string[],
): A2APublicPushDeliverySmokeResult {
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
  code: Extract<A2APublicPushDeliverySmokeResult, { ok: false }>["code"],
  message: string,
): A2APublicPushDeliverySmokeResult {
  return {
    ok: false,
    kind: "failed",
    code,
    message,
    checks: [{ id: "callback-delivery", status: "failed", code, message }],
  };
}

async function writePushDeliveryReport(
  reportPath: string,
  report: A2APublicPushDeliveryEvidenceReport,
): Promise<void> {
  const resolved = isAbsolute(reportPath) ? reportPath : resolve(process.cwd(), reportPath);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
}

function readEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function parsePublicHttpsUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || isUnsafePublicHost(url.hostname)) return undefined;
    return url;
  } catch {
    return undefined;
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

function isSuccessStatus(status: number | undefined): status is number {
  return typeof status === "number" && status >= 200 && status <= 299;
}

async function main(): Promise<number> {
  const parsedArgs = parseArgs(process.argv.slice(2));
  if (!parsedArgs.ok) {
    console.error(formatA2APublicPushDeliverySmokeResult(blocked(
      "A2A_PUBLIC_PUSH_CONFIG_MISSING",
      parsedArgs.message,
    )));
    return 2;
  }

  const result = await runA2APublicPushDeliverySmoke({
    reportPath: parsedArgs.reportPath,
    timeoutMs: parsedArgs.timeoutMs,
  });
  const formatted = formatA2APublicPushDeliverySmokeResult(result);
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
        return { ok: false, message: "A2A public push delivery --report requires a local output path." };
      }
      reportPath = value;
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        return { ok: false, message: "A2A public push delivery --timeout-ms requires a positive integer." };
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return { ok: false, message: "A2A public push delivery --timeout-ms requires a positive integer." };
      }
      timeoutMs = parsed;
      index += 1;
      continue;
    }
    return { ok: false, message: "A2A public push delivery smoke only accepts --report <path> and --timeout-ms <ms>." };
  }
  return reportPath ? { ok: true, reportPath, timeoutMs } : { ok: true, timeoutMs };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
