import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import { loadGatewayConfigFromEnv } from "./config.js";

export interface ReadinessCheck {
  id: string;
  status: "pass" | "fail";
  message: string;
}

export interface ReadinessReport {
  ok: boolean;
  mode: "testnet" | "example";
  checks: ReadinessCheck[];
  failures: ReadinessCheck[];
}

export interface CheckReadinessOptions {
  env: NodeJS.ProcessEnv;
  cwd?: string;
  expectPlaceholders?: boolean;
}

const SECRET_KEYS = new Set([
  "GAS_STATION_KEYPAIR",
  "GAS_STATION_AUTH",
  "JWT_SECRET",
  "GASKIT_DEMO_APP_KEY",
  "GAS_STATION_BEARER_TOKEN",
  "GASKIT_OPERATOR_USAGE_TOKEN",
]);

const REQUIRED_KEYS = [
  "IOTA_RPC_URL",
  "GAS_STATION_KEYPAIR",
  "GAS_STATION_AUTH",
  "JWT_SECRET",
  "DATABASE_URL",
  "GASKIT_GATEWAY_HOST",
  "GASKIT_GATEWAY_PORT",
  "GASKIT_POLICY_PATH",
  "GASKIT_DEMO_APP_KEY",
  "GAS_STATION_URL",
  "GAS_STATION_BEARER_TOKEN",
] as const;

function stripInlineComment(value: string): string {
  let quote: "'" | '"' | undefined;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === "'" || char === '"') && (index === 0 || value[index - 1] !== "\\")) {
      quote = quote === char ? undefined : quote ?? char;
      continue;
    }
    if (char === "#" && !quote && /\s/.test(value[index - 1] ?? "")) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value.trimEnd();
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseDotEnv(source: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const assignment = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const separator = assignment.indexOf("=");
    if (separator <= 0) continue;
    const key = assignment.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    const value = unquote(stripInlineComment(assignment.slice(separator + 1)));
    env[key] = value;
  }
  return env;
}

export async function loadEnvFile(path: string, cwd = process.cwd()): Promise<Record<string, string>> {
  const resolved = isAbsolute(path) ? path : resolve(cwd, path);
  return parseDotEnv(await readFile(resolved, "utf8"));
}

function isPlaceholderValue(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return (
    normalized.includes("replace") ||
    normalized.includes("replac...") ||
    normalized.includes("placeholder") ||
    normalized.includes("your_") ||
    normalized.includes("your-") ||
    normalized.includes("0xyour") ||
    normalized === "local-dev-demo-key" ||
    normalized.includes("local-secret")
  );
}

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function addCheck(checks: ReadinessCheck[], id: string, status: ReadinessCheck["status"], message: string): void {
  checks.push({ id, status, message });
}

function validateRequired(checks: ReadinessCheck[], env: NodeJS.ProcessEnv): void {
  for (const key of REQUIRED_KEYS) {
    addCheck(
      checks,
      `${key}.required`,
      hasValue(env[key]) ? "pass" : "fail",
      hasValue(env[key]) ? `${key} is set.` : `${key} is required.`,
    );
  }
}

function validateSecretPlaceholders(checks: ReadinessCheck[], env: NodeJS.ProcessEnv, expectPlaceholders: boolean): void {
  for (const key of Array.from(SECRET_KEYS)) {
    const value = env[key];
    if (!hasValue(value)) continue;
    const placeholder = isPlaceholderValue(value);
    if (expectPlaceholders) {
      addCheck(
        checks,
        `${key}.placeholder`,
        placeholder ? "pass" : "fail",
        placeholder ? `${key} is documented as a placeholder.` : `${key} should be a placeholder in example readiness mode.`,
      );
      continue;
    }
    addCheck(
      checks,
      `${key}.value`,
      placeholder ? "fail" : "pass",
      placeholder ? `${key} still contains a placeholder or local-only demo value.` : `${key} is non-placeholder.`,
    );
  }

  if (!expectPlaceholders && hasValue(env.JWT_SECRET)) {
    addCheck(
      checks,
      "JWT_SECRET.length",
      env.JWT_SECRET.length >= 32 ? "pass" : "fail",
      env.JWT_SECRET.length >= 32 ? "JWT_SECRET length is acceptable." : "JWT_SECRET must be at least 32 characters.",
    );
  }
}

function validateUrl(checks: ReadinessCheck[], id: string, value: string | undefined, options: { requireHttps?: boolean; requireTestnet?: boolean } = {}): void {
  if (!hasValue(value)) return;
  try {
    const parsed = new URL(value);
    if (options.requireHttps && parsed.protocol !== "https:") {
      addCheck(checks, `${id}.url`, "fail", `${id} must use https for testnet readiness.`);
      return;
    }
    if (options.requireTestnet && !`${parsed.hostname}${parsed.pathname}`.toLowerCase().includes("testnet")) {
      addCheck(checks, `${id}.url`, "fail", `${id} must point at a testnet endpoint for this preflight.`);
      return;
    }
    addCheck(checks, `${id}.url`, "pass", `${id} is a valid URL.`);
  } catch {
    addCheck(checks, `${id}.url`, "fail", `${id} must be a valid URL.`);
  }
}

function validatePort(checks: ReadinessCheck[], value: string | undefined): void {
  if (!hasValue(value)) return;
  const port = Number(value);
  addCheck(
    checks,
    "GASKIT_GATEWAY_PORT.range",
    Number.isInteger(port) && port > 0 && port <= 65_535 ? "pass" : "fail",
    Number.isInteger(port) && port > 0 && port <= 65_535
      ? "GASKIT_GATEWAY_PORT is a valid TCP port."
      : "GASKIT_GATEWAY_PORT must be an integer from 1 to 65535.",
  );
}

function isLoopbackHost(value: string): boolean {
  return value === "127.0.0.1" || value === "localhost" || value === "::1";
}

function validateGatewayHost(checks: ReadinessCheck[], value: string | undefined): void {
  if (!hasValue(value)) return;
  addCheck(
    checks,
    "GASKIT_GATEWAY_HOST.loopback",
    isLoopbackHost(value) ? "pass" : "fail",
    isLoopbackHost(value)
      ? "GASKIT_GATEWAY_HOST is loopback-only for the first testnet demo boundary."
      : "GASKIT_GATEWAY_HOST must stay loopback-only before deployment hardening is complete.",
  );
}

async function validatePolicy(
  checks: ReadinessCheck[],
  env: NodeJS.ProcessEnv,
  expectPlaceholders: boolean,
  cwd?: string,
): Promise<void> {
  if (!hasValue(env.GASKIT_POLICY_PATH) || !hasValue(env.GASKIT_DEMO_APP_KEY)) return;
  try {
    const config = await loadGatewayConfigFromEnv(cwd ? { ...env, INIT_CWD: cwd } : env);
    const policies = Object.values(config.apps).map((app) => app.policy);
    const hasPackageAllowlist = policies.every((policy) => Array.isArray(policy.allowedPackages) && policy.allowedPackages.length > 0);
    addCheck(
      checks,
      "policy.load",
      "pass",
      "GASKIT_POLICY_PATH loads through the gateway config parser.",
    );
    addCheck(
      checks,
      "policy.packageAllowlist.present",
      hasPackageAllowlist ? "pass" : "fail",
      hasPackageAllowlist ? "Policy has package allowlists." : "Policy must define package allowlists.",
    );
    const hasPlaceholderPackage = policies.some((policy) => policy.allowedPackages.some((pkg) => isPlaceholderValue(pkg)));
    addCheck(
      checks,
      "policy.packageAllowlist.placeholders",
      expectPlaceholders || !hasPlaceholderPackage ? "pass" : "fail",
      expectPlaceholders
        ? hasPlaceholderPackage
          ? "Example policy contains an intentional package placeholder."
          : "Example policy uses a concrete package allowlist."
        : hasPlaceholderPackage
          ? "Policy package allowlist still contains a placeholder package id."
          : "Policy package allowlist does not contain placeholders.",
    );
  } catch (error) {
    addCheck(checks, "policy.load", "fail", error instanceof Error ? error.message : "Policy config could not be loaded.");
  }
}

export async function checkTestnetReadiness(options: CheckReadinessOptions): Promise<ReadinessReport> {
  const checks: ReadinessCheck[] = [];
  const env = options.env;
  const expectPlaceholders = options.expectPlaceholders === true;

  validateRequired(checks, env);
  validateSecretPlaceholders(checks, env, expectPlaceholders);
  validateUrl(checks, "IOTA_RPC_URL", env.IOTA_RPC_URL, { requireHttps: true, requireTestnet: true });
  validateUrl(checks, "GAS_STATION_URL", env.GAS_STATION_URL);
  validateGatewayHost(checks, env.GASKIT_GATEWAY_HOST);
  validatePort(checks, env.GASKIT_GATEWAY_PORT);
  await validatePolicy(checks, env, expectPlaceholders, options.cwd);

  const failures = checks.filter((check) => check.status === "fail");
  return {
    ok: failures.length === 0,
    mode: expectPlaceholders ? "example" : "testnet",
    checks,
    failures,
  };
}

function secretKeyForCheckId(id: string): string | undefined {
  return Array.from(SECRET_KEYS).find((key) => id === key || id.startsWith(`${key}.`));
}

export function formatReadinessReport(report: ReadinessReport): string {
  const lines = [`IOTA GasKit ${report.mode} readiness ${report.ok ? "passed" : "failed"}`];
  for (const check of report.checks) {
    const prefix = check.status === "pass" ? "ok" : "fail";
    const sensitiveSuffix = secretKeyForCheckId(check.id) ? " [value hidden]" : "";
    lines.push(`${prefix}: ${check.id}: ${check.message}${sensitiveSuffix}`);
  }
  return lines.join("\n");
}
