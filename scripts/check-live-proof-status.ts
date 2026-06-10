import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkTestnetReadiness,
  loadEnvFile,
  type ReadinessCheck,
} from "../apps/policy-gateway-service/src/readiness.js";

export type LiveProofStatus = "ready" | "blocked";

export interface LiveProofCheck {
  readonly id: string;
  readonly status: LiveProofStatus;
  readonly code: string;
  readonly message: string;
  readonly missing?: readonly string[];
  readonly next?: string;
}

export interface LiveProofStatusReport {
  readonly ok: boolean;
  readonly checks: readonly LiveProofCheck[];
}

export interface CheckLiveProofStatusOptions {
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly envFile?: string;
  readonly cwd?: string;
}

const IOTA_NAMES_REQUIRED_ENV = [
  "IOTA_NAMES_GRAPHQL_URL",
  "IOTA_NAMES_NAME",
  "IOTA_NAMES_EXPECTED_ADDRESS",
] as const;

const VC_TRUST_POLICY_REQUIRED_ENV = [
  "IOTA_IDENTITY_TRUSTED_ISSUER_DIDS",
  "IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS",
  "IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES",
  "IOTA_IDENTITY_ACCEPTED_STATUS_TYPES",
  "IOTA_IDENTITY_CACHE_TTL_MS",
] as const;

const VC_TRUST_POLICY_STATUS_TYPES = new Set([
  "RevocationBitmap2022",
  "StatusList2021",
  "StatusList2021Entry",
]);
const LIVE_TESTNET_ENV_FILE = ".env";

export async function checkLiveProofStatus(
  options: CheckLiveProofStatusOptions = {},
): Promise<LiveProofStatusReport> {
  const env = options.env ?? process.env;
  const envFile = options.envFile ?? LIVE_TESTNET_ENV_FILE;
  const cwd = options.cwd ?? process.cwd();
  const fileEnv = await loadOptionalEnvFile(envFile, cwd);
  const checks: LiveProofCheck[] = [
    await checkTestnetReadinessStatus(envFile, cwd),
    checkIotaNamesStatus(mergeEnv(fileEnv, env)),
    {
      id: "iota-identity-live",
      status: "blocked",
      code: "IOTA_IDENTITY_LIVE_PROOF_UNIMPLEMENTED",
      message: "No live IOTA Identity DID or credential validation command is implemented yet.",
      next: "Implement a live Identity proof slice with trusted resolver, issuer, verification method, revocation, and cache policy configuration.",
    },
    checkVcTrustPolicyStatus(mergeEnv(fileEnv, env)),
  ];

  return {
    ok: checks.every((check) => check.status === "ready"),
    checks,
  };
}

export function formatLiveProofStatusReport(report: LiveProofStatusReport): string {
  const lines = [`Agentic GasKit live proof status ${report.ok ? "ready" : "blocked"}`];
  for (const check of report.checks) {
    lines.push(`${check.status}: ${check.id}: code=${check.code}`);
    lines.push(`message=${check.message}`);
    if (check.missing && check.missing.length > 0) {
      lines.push(`missing=${check.missing.join(",")}`);
    }
    if (check.next) {
      lines.push(`next=${check.next}`);
    }
  }
  return lines.join("\n");
}

async function checkTestnetReadinessStatus(envFile: string, cwd: string): Promise<LiveProofCheck> {
  const envFilePath = resolve(cwd, envFile);
  try {
    await access(envFilePath);
  } catch {
    return {
      id: "testnet-readiness",
      status: "blocked",
      code: "TESTNET_ENV_FILE_MISSING",
      missing: [envFile],
      message: "No local testnet .env file is present for readiness validation.",
      next: "Copy .env.example to .env, replace placeholders outside the repo, then run npm run readiness:testnet.",
    };
  }

  try {
    const env = await loadEnvFile(envFilePath);
    const readiness = await checkTestnetReadiness({ env, cwd });
    if (readiness.ok) {
      return {
        id: "testnet-readiness",
        status: "ready",
        code: "TESTNET_READINESS_CONFIG_PRESENT",
        message: "Local testnet readiness configuration passes non-network validation.",
        next: "With explicit operator intent, run the relevant testnet smoke command.",
      };
    }

    return {
      id: "testnet-readiness",
      status: "blocked",
      code: "TESTNET_READINESS_FAILED",
      missing: readiness.failures.map((failure: ReadinessCheck) => failure.id),
      message: "Local testnet readiness configuration failed non-network validation.",
      next: "Fix the listed readiness check ids, then rerun npm run readiness:testnet.",
    };
  } catch {
    return {
      id: "testnet-readiness",
      status: "blocked",
      code: "TESTNET_READINESS_UNREADABLE",
      message: "Local testnet readiness configuration could not be loaded safely.",
      next: "Validate .env syntax and referenced local policy paths without printing secret values.",
    };
  }
}

function checkIotaNamesStatus(env: Record<string, string | undefined>): LiveProofCheck {
  const missing = IOTA_NAMES_REQUIRED_ENV.filter((key) => !readEnv(env, key));
  if (missing.length > 0) {
    return {
      id: "iota-names-live",
      status: "blocked",
      code: "IOTA_NAMES_LIVE_CONFIG_MISSING",
      missing,
      message: "IOTA Names live proof requires operator-provided endpoint, name, and expected address.",
      next: "Set the missing variables outside committed files, then run npm run smoke:iota-names-live.",
    };
  }

  const endpoint = readEnv(env, "IOTA_NAMES_GRAPHQL_URL");
  if (!endpoint || !isSafeGraphQLEndpoint(endpoint)) {
    return {
      id: "iota-names-live",
      status: "blocked",
      code: "IOTA_NAMES_GRAPHQL_URL_UNSAFE",
      message: "IOTA Names GraphQL endpoint must be HTTPS or loopback HTTP.",
      next: "Use an HTTPS endpoint or loopback local GraphQL endpoint before running npm run smoke:iota-names-live.",
    };
  }

  return {
    id: "iota-names-live",
    status: "ready",
    code: "IOTA_NAMES_LIVE_CONFIG_PRESENT",
    message: "IOTA Names live smoke configuration is present and endpoint scheme is safe.",
    next: "Run npm run smoke:iota-names-live to contact the configured endpoint and prove the name/address binding.",
  };
}

function checkVcTrustPolicyStatus(env: Record<string, string | undefined>): LiveProofCheck {
  const missing = VC_TRUST_POLICY_REQUIRED_ENV.filter((key) => !readEnv(env, key));
  if (missing.length > 0) {
    return {
      id: "vc-validation-live",
      status: "blocked",
      code: "VC_TRUST_POLICY_CONFIG_MISSING",
      missing,
      message: "Local VC trust-policy evaluation exists, but live proof requires operator-provided trusted issuer, verification method, credential type, revocation status, and cache TTL configuration.",
      next: "Set the missing IOTA Identity trust-policy variables outside committed files before accepting live VC proof for policy-gated actions.",
    };
  }

  if (!hasOnlyDidList(env, "IOTA_IDENTITY_TRUSTED_ISSUER_DIDS")) {
    return invalidVcTrustPolicyStatus("Trusted issuer configuration must contain only DID values.");
  }
  if (!hasOnlyVerificationMethodList(env, "IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS")) {
    return invalidVcTrustPolicyStatus("Allowed verification methods must be DID URLs or issuer-local fragments.");
  }
  if (!hasOnlyNonEmptyList(env, "IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES")) {
    return invalidVcTrustPolicyStatus("Required credential types must be a non-empty comma-separated list.");
  }
  const statusTypes = readListEnv(env, "IOTA_IDENTITY_ACCEPTED_STATUS_TYPES");
  if (
    statusTypes.length === 0
    || !statusTypes.every((statusType) => VC_TRUST_POLICY_STATUS_TYPES.has(statusType))
  ) {
    return invalidVcTrustPolicyStatus("Accepted credential status types must be supported revocation mechanisms.");
  }
  const ttlMs = Number(readEnv(env, "IOTA_IDENTITY_CACHE_TTL_MS"));
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    return invalidVcTrustPolicyStatus("Credential cache TTL must be a positive integer in milliseconds.");
  }

  return {
    id: "vc-validation-live",
    status: "ready",
    code: "VC_TRUST_POLICY_CONFIG_PRESENT",
    message: "Live VC trust-policy configuration is present for the local fail-closed evaluator.",
    next: "Use this configuration when implementing and running the live IOTA Identity credential proof command.",
  };
}

function invalidVcTrustPolicyStatus(message: string): LiveProofCheck {
  return {
    id: "vc-validation-live",
    status: "blocked",
    code: "VC_TRUST_POLICY_CONFIG_INVALID",
    message,
    next: "Fix the trust-policy variable shape without committing or printing live credential values.",
  };
}

function mergeEnv(
  fileEnv: Record<string, string | undefined>,
  processEnv: NodeJS.ProcessEnv | Record<string, string | undefined>,
): Record<string, string | undefined> {
  return {
    ...fileEnv,
    ...processEnv,
  };
}

async function loadOptionalEnvFile(envFile: string, cwd: string): Promise<Record<string, string>> {
  const envFilePath = resolve(cwd, envFile);
  try {
    await access(envFilePath);
    return await loadEnvFile(envFilePath);
  } catch {
    return {};
  }
}

function readEnv(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function readListEnv(env: Record<string, string | undefined>, key: string): readonly string[] {
  return (readEnv(env, key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function hasOnlyNonEmptyList(env: Record<string, string | undefined>, key: string): boolean {
  return readListEnv(env, key).length > 0;
}

function hasOnlyDidList(env: Record<string, string | undefined>, key: string): boolean {
  const values = readListEnv(env, key);
  return values.length > 0 && values.every((value) => value.startsWith("did:iota:"));
}

function hasOnlyVerificationMethodList(env: Record<string, string | undefined>, key: string): boolean {
  const values = readListEnv(env, key);
  return values.length > 0 && values.every((value) => value.startsWith("did:iota:") || value.startsWith("#"));
}

function isSafeGraphQLEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    return ["127.0.0.1", "::1", "localhost"].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function main(): Promise<number> {
  const report = await checkLiveProofStatus();
  console.log(formatLiveProofStatusReport(report));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
