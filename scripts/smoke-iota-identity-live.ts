import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateAgentProfile,
  verifyAgentProfileIdentity,
  type AgentProfile,
  type IotaIdentityCredentialEvidence,
  type IotaIdentityCredentialValidationResult,
  type IotaIdentityVcTrustPolicy,
} from "../packages/registry/src/index.js";
import {
  buildIotaIdentityLiveReport,
  formatIotaIdentityLiveReport,
} from "./iota-identity-live-report.js";

export type IotaIdentityLiveSmokeResult =
  | {
      readonly ok: true;
      readonly profileName: string;
      readonly credentialRefsChecked: number;
      readonly source: "iota-identity-proof-endpoint";
    }
  | {
      readonly ok: false;
      readonly kind: "blocked";
      readonly code:
        | "IOTA_IDENTITY_LIVE_CONFIG_MISSING"
        | "IOTA_IDENTITY_PROOF_ENDPOINT_UNSAFE"
        | "IOTA_IDENTITY_PROFILE_UNREADABLE"
        | "IOTA_IDENTITY_PROFILE_INVALID"
        | "VC_TRUST_POLICY_CONFIG_MISSING"
        | "VC_TRUST_POLICY_CONFIG_INVALID";
      readonly missing?: readonly string[];
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly kind: "failed";
      readonly code: "PROFILE_UNVERIFIABLE" | "PROFILE_REVOKED" | "PROFILE_EXPIRED";
      readonly profileName: string;
      readonly message: string;
    };

export interface RunIotaIdentityLiveSmokeOptions {
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly cwd?: string;
  readonly profile?: unknown;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
}

interface CliOptions {
  readonly help: boolean;
  readonly reportPath?: string;
}

const IDENTITY_REQUIRED_ENV = [
  "IOTA_IDENTITY_PROOF_ENDPOINT",
  "IOTA_IDENTITY_PROFILE_PATH",
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

export async function runIotaIdentityLiveSmoke(
  options: RunIotaIdentityLiveSmokeOptions = {},
): Promise<IotaIdentityLiveSmokeResult> {
  const env = options.env ?? process.env;
  const requiredEnv = [
    "IOTA_IDENTITY_PROOF_ENDPOINT",
    ...(options.profile ? [] : ["IOTA_IDENTITY_PROFILE_PATH"]),
    ...VC_TRUST_POLICY_REQUIRED_ENV,
  ];
  const missing = requiredEnv.filter((key) => !readEnv(env, key));
  if (missing.length > 0) {
    const identityMissing = missing.filter((key) => IDENTITY_REQUIRED_ENV.includes(key as typeof IDENTITY_REQUIRED_ENV[number]));
    return {
      ok: false,
      kind: "blocked",
      code: identityMissing.length > 0 ? "IOTA_IDENTITY_LIVE_CONFIG_MISSING" : "VC_TRUST_POLICY_CONFIG_MISSING",
      missing,
      message: identityMissing.length > 0
        ? "IOTA Identity live smoke requires an operator-provided proof endpoint and Agent Profile path."
        : "IOTA Identity live smoke requires operator-provided VC trust-policy configuration.",
    };
  }

  const endpoint = readEnv(env, "IOTA_IDENTITY_PROOF_ENDPOINT");
  if (!endpoint || !isSafeProofEndpoint(endpoint)) {
    return {
      ok: false,
      kind: "blocked",
      code: "IOTA_IDENTITY_PROOF_ENDPOINT_UNSAFE",
      message: "IOTA Identity proof endpoint must be HTTPS or loopback HTTP.",
    };
  }

  const trustPolicy = parseTrustPolicyEnv(env);
  if (!trustPolicy.ok) return trustPolicy.result;

  const loadedProfile = options.profile
    ? { ok: true as const, profile: options.profile }
    : await loadProfileFromPath(env, options.cwd ?? process.cwd());
  if (!loadedProfile.ok) return loadedProfile.result;

  const validation = validateAgentProfile(loadedProfile.profile, { now: options.now?.() });
  if (!validation.ok) {
    return {
      ok: false,
      kind: "blocked",
      code: "IOTA_IDENTITY_PROFILE_INVALID",
      message: "IOTA Identity live smoke profile failed local Agent Profile validation.",
    };
  }

  const proofClient = createHttpIotaIdentityProofClient(endpoint, options.fetch ?? fetch);
  const identity = await verifyAgentProfileIdentity(validation.profile, {
    didResolver: proofClient,
    credentialValidator: proofClient,
    trustPolicy: trustPolicy.policy,
    cacheTtlMs: trustPolicy.policy.maxCredentialAgeMs,
    now: options.now,
  });

  if (!identity.ok) {
    return {
      ok: false,
      kind: "failed",
      code: identity.error.code,
      profileName: validation.profile.name,
      message: identity.error.message,
    };
  }

  return {
    ok: true,
    profileName: validation.profile.name,
    credentialRefsChecked: identity.credentialRefsChecked.length,
    source: "iota-identity-proof-endpoint",
  };
}

export function formatIotaIdentityLiveSmokeResult(result: IotaIdentityLiveSmokeResult): string {
  if (result.ok) {
    return [
      "IOTA Identity live smoke passed",
      `profile=${result.profileName}`,
      `credentialRefsChecked=${result.credentialRefsChecked}`,
      `source=${result.source}`,
    ].join("\n");
  }

  if (result.kind === "blocked") {
    return [
      "IOTA Identity live smoke blocked",
      `code=${result.code}`,
      ...(result.missing ? [`missing=${result.missing.join(",")}`] : []),
      `message=${result.message}`,
    ].join("\n");
  }

  return [
    "IOTA Identity live smoke failed",
    `code=${result.code}`,
    `profile=${result.profileName}`,
    `message=${result.message}`,
  ].join("\n");
}

function createHttpIotaIdentityProofClient(endpoint: string, fetchImpl: typeof fetch) {
  const postProof = async (request: IotaIdentityProofRequest): Promise<unknown> => {
    const response = await withTimeout(fetchImpl)(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error("IOTA Identity proof endpoint returned an error.");
    return response.json();
  };

  return {
    async resolveDid(did: string): Promise<unknown> {
      const response = await postProof({ operation: "resolveDid", did });
      if (!isRecord(response)) throw new Error("IOTA Identity DID response is malformed.");
      if (isRecord(response.didDocument)) return response.didDocument;
      if (response.ok === true && isRecord(response.document)) return response.document;
      throw new Error("IOTA Identity DID response is missing DID Document.");
    },
    async validateCredentialRef(
      credentialRef: string,
      context: { readonly profile: AgentProfile },
    ): Promise<IotaIdentityCredentialValidationResult> {
      const response = await postProof({
        operation: "validateCredentialRef",
        credentialRef,
        profile: {
          name: context.profile.name,
          agentDid: context.profile.agentDid,
          ownerDid: context.profile.ownerDid,
        },
      });
      return parseCredentialValidationResponse(response);
    },
  };
}

type IotaIdentityProofRequest =
  | {
      readonly operation: "resolveDid";
      readonly did: string;
    }
  | {
      readonly operation: "validateCredentialRef";
      readonly credentialRef: string;
      readonly profile: {
        readonly name: string;
        readonly agentDid: string;
        readonly ownerDid: string;
      };
    };

function parseCredentialValidationResponse(response: unknown): IotaIdentityCredentialValidationResult {
  if (!isRecord(response)) {
    return credentialFailed("CREDENTIAL_UNVERIFIABLE", "IOTA Identity credential proof response is malformed.");
  }
  if (response.ok === false) {
    const code = isCredentialFailureCode(response.code) ? response.code : "CREDENTIAL_UNVERIFIABLE";
    return credentialFailed(code, "IOTA Identity credential proof endpoint rejected credential evidence.");
  }
  if (response.ok === true && isCredentialEvidence(response.evidence)) {
    return { ok: true, evidence: response.evidence };
  }
  if (isCredentialEvidence(response.evidence)) {
    return { ok: true, evidence: response.evidence };
  }
  return credentialFailed("CREDENTIAL_UNVERIFIABLE", "IOTA Identity credential proof response is missing evidence.");
}

function parseTrustPolicyEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): { readonly ok: true; readonly policy: IotaIdentityVcTrustPolicy } | { readonly ok: false; readonly result: IotaIdentityLiveSmokeResult } {
  const trustedIssuerDids = readListEnv(env, "IOTA_IDENTITY_TRUSTED_ISSUER_DIDS");
  const allowedVerificationMethods = readListEnv(env, "IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS");
  const requiredCredentialTypes = readListEnv(env, "IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES");
  const acceptedCredentialStatusTypes = readListEnv(env, "IOTA_IDENTITY_ACCEPTED_STATUS_TYPES");
  const cacheTtlMs = Number(readEnv(env, "IOTA_IDENTITY_CACHE_TTL_MS"));
  if (
    !trustedIssuerDids.every((did) => did.startsWith("did:iota:"))
    || !allowedVerificationMethods.every((method) => method.startsWith("did:iota:") || method.startsWith("#"))
    || requiredCredentialTypes.length === 0
    || acceptedCredentialStatusTypes.length === 0
    || !acceptedCredentialStatusTypes.every((statusType) => VC_TRUST_POLICY_STATUS_TYPES.has(statusType))
    || !Number.isSafeInteger(cacheTtlMs)
    || cacheTtlMs <= 0
  ) {
    return {
      ok: false,
      result: {
        ok: false,
        kind: "blocked",
        code: "VC_TRUST_POLICY_CONFIG_INVALID",
        message: "IOTA Identity live smoke trust-policy configuration is invalid.",
      },
    };
  }

  return {
    ok: true,
    policy: {
      trustedIssuerDids,
      allowedVerificationMethods,
      requiredCredentialTypes,
      acceptedCredentialStatusTypes,
      requireCredentialStatus: true,
      maxCredentialAgeMs: cacheTtlMs,
    },
  };
}

async function loadProfileFromPath(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  cwd: string,
): Promise<{ readonly ok: true; readonly profile: unknown } | { readonly ok: false; readonly result: IotaIdentityLiveSmokeResult }> {
  const profilePath = readEnv(env, "IOTA_IDENTITY_PROFILE_PATH");
  if (!profilePath) {
    return {
      ok: false,
      result: {
        ok: false,
        kind: "blocked",
        code: "IOTA_IDENTITY_LIVE_CONFIG_MISSING",
        missing: ["IOTA_IDENTITY_PROFILE_PATH"],
        message: "IOTA Identity live smoke requires an Agent Profile path.",
      },
    };
  }

  try {
    const rawProfile = await readFile(resolve(cwd, profilePath), "utf8");
    return { ok: true, profile: JSON.parse(rawProfile) };
  } catch {
    return {
      ok: false,
      result: {
        ok: false,
        kind: "blocked",
        code: "IOTA_IDENTITY_PROFILE_UNREADABLE",
        message: "IOTA Identity live smoke could not safely load the configured Agent Profile.",
      },
    };
  }
}

function readEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function readListEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>, key: string): readonly string[] {
  return (readEnv(env, key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isSafeProofEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    return ["127.0.0.1", "::1", "localhost"].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isCredentialEvidence(value: unknown): value is IotaIdentityCredentialEvidence {
  if (!isRecord(value)) return false;
  if (typeof value.issuerDid !== "string" || typeof value.verificationMethod !== "string") return false;
  if (value.credentialTypes !== undefined && !isStringArray(value.credentialTypes)) return false;
  if (value.issuedAt !== undefined && typeof value.issuedAt !== "string") return false;
  if (value.expiresAt !== undefined && typeof value.expiresAt !== "string") return false;
  if (value.credentialStatus !== undefined) {
    if (!isRecord(value.credentialStatus) || typeof value.credentialStatus.type !== "string") return false;
    if (value.credentialStatus.id !== undefined && typeof value.credentialStatus.id !== "string") return false;
    if (value.credentialStatus.revoked !== undefined && typeof value.credentialStatus.revoked !== "boolean") return false;
  }
  return true;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isCredentialFailureCode(
  value: unknown,
): value is Exclude<IotaIdentityCredentialValidationResult, { ok: true }>["code"] {
  return value === "CREDENTIAL_REVOKED" || value === "CREDENTIAL_EXPIRED" || value === "CREDENTIAL_UNVERIFIABLE";
}

function credentialFailed(
  code: Exclude<IotaIdentityCredentialValidationResult, { ok: true }>["code"],
  message: string,
): IotaIdentityCredentialValidationResult {
  return { ok: false, code, message };
}

function withTimeout(fetchImpl: typeof fetch): typeof fetch {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: { help: boolean; reportPath?: string } = { help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--report") {
      const value = argv[index + 1];
      if (!value) throw new Error("--report requires a path.");
      options.reportPath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function writeReport(path: string, result: IotaIdentityLiveSmokeResult): Promise<void> {
  const reportPath = isAbsolute(path) ? path : resolve(process.cwd(), path);
  const report = buildIotaIdentityLiveReport({
    result,
    env: process.env,
  });
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, formatIotaIdentityLiveReport(report), { mode: 0o600 });
  console.log(`report=${path}`);
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
    console.log("usage: npm exec tsx -- scripts/smoke-iota-identity-live.ts [--report <ignored-json-path>]");
    return 0;
  }

  const result = await runIotaIdentityLiveSmoke();
  const formatted = formatIotaIdentityLiveSmokeResult(result);
  if (options.reportPath) {
    await writeReport(options.reportPath, result);
  }
  if (result.ok) {
    console.log(formatted);
    return 0;
  }
  console.error(formatted);
  return result.kind === "blocked" ? 2 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
