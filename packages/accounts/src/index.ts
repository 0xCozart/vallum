import { createHash, randomBytes, randomUUID } from "node:crypto";

export type WalletAccountStatus = "active" | "disabled" | "revoked" | "compromised";
export type CustodyProductionEnvironment = "local" | "testnet" | "production";
export type CustodyProductionMode = "local-in-memory" | "external-signer" | "kms";
export type CustodyProductionReviewStatus = "pending" | "passed" | "blocked";
export type CustodyProductionReviewResult = "pending-operator-proof" | "passed" | "blocked";
export type CustodyProductionReviewCheckId =
  | "signer-reference-contract-review"
  | "no-agent-secret-exposure-review"
  | "kms-external-signer-review"
  | "cryptographic-module-validation-review"
  | "operator-access-review"
  | "key-lifecycle-review"
  | "recovery-export-review"
  | "backup-restore-review"
  | "rotation-revocation-review"
  | "audit-logging-review"
  | "legal-security-review"
  | "incident-response-review"
  | "redaction-review";

export interface SignerRef {
  readonly value: string;
  readonly walletId: string;
  readonly ownerId: string;
  readonly agentId: string;
  readonly scopes: readonly string[];
  readonly createdAt: string;
}

export interface WalletAccount {
  readonly walletId: string;
  readonly address: string;
  readonly signerRef: SignerRef;
  readonly status: WalletAccountStatus;
  readonly allowedScopes: readonly string[];
  readonly ownerId: string;
  readonly agentId: string;
  readonly createdAt: string;
  readonly profileId?: string;
}

export interface WalletCreationContext {
  readonly ownerId: string;
  readonly agentId: string;
  readonly requestedScopes?: readonly string[];
  readonly profileId?: string;
}

export interface SignerAdapter {
  readonly id: string;
  authorizeSigning(request: SigningAuthorizationRequest): Promise<SigningAuthorizationResult>;
}

export interface RecoveryPolicy {
  readonly exportEnabled: false;
  readonly reason: "unsupported" | "operator_required";
}

export interface SigningAuthorizationRequest {
  readonly signerRef: string;
  readonly walletId?: string;
  readonly ownerId?: string;
  readonly agentId?: string;
  readonly scope?: string;
}

export type SigningAuthorizationResult =
  | {
      readonly authorized: true;
      readonly walletId: string;
      readonly signerRef: SignerRef;
    }
  | {
      readonly authorized: false;
      readonly reasonCode:
        | "OWNER_CONTEXT_REQUIRED"
        | "AGENT_CONTEXT_REQUIRED"
        | "WALLET_NOT_FOUND"
        | "SIGNER_REF_NOT_FOUND"
        | "SIGNER_REF_MISMATCH"
        | "SCOPE_NOT_ALLOWED"
        | "WALLET_NOT_ACTIVE";
      readonly message: string;
    };

export interface RecoveryExportRequest {
  readonly walletId: string;
  readonly actorId: string;
  readonly reason: string;
}

export interface RecoveryExportDenied {
  readonly allowed: false;
  readonly reasonCode: "RECOVERY_EXPORT_UNSUPPORTED";
  readonly message: string;
  readonly audit: {
    readonly walletId: string;
    readonly actorId: string;
    readonly reason: string;
    readonly requestedAt: string;
    readonly destinationType: "none";
  };
}

export interface WalletAccountStore extends SignerAdapter {
  createWallet(context: WalletCreationContext): Promise<WalletAccount>;
  getWallet(walletId: string): Promise<WalletAccount | undefined>;
  setWalletStatus(walletId: string, status: WalletAccountStatus): Promise<WalletAccount | undefined>;
  requestRecoveryExport(request: RecoveryExportRequest): Promise<RecoveryExportDenied>;
}

export interface InMemoryWalletAccountStoreOptions {
  readonly now?: () => Date;
  readonly idBytes?: () => Uint8Array;
  readonly maxWalletsPerOwnerAgent?: number;
}

export interface CustodyProductionReviewCheckInput {
  readonly id: CustodyProductionReviewCheckId;
  readonly status: CustodyProductionReviewStatus;
  readonly observedAt?: Date | string;
  readonly note?: string;
}

export interface CreateCustodyProductionReviewSnapshotInput {
  readonly environment: CustodyProductionEnvironment;
  readonly custodyMode: CustodyProductionMode;
  readonly checks?: readonly CustodyProductionReviewCheckInput[];
  readonly generatedAt?: Date;
}

export interface CustodyProductionReviewSnapshot {
  readonly schemaVersion: 1;
  readonly kind: "vallum.custody-production-review-snapshot";
  readonly result: CustodyProductionReviewResult;
  readonly environment: CustodyProductionEnvironment;
  readonly custodyMode: CustodyProductionMode;
  readonly generatedAt: string;
  readonly requiredCheckIds: readonly CustodyProductionReviewCheckId[];
  readonly passedCheckIds: readonly CustodyProductionReviewCheckId[];
  readonly pendingCheckIds: readonly CustodyProductionReviewCheckId[];
  readonly blockedCheckIds: readonly CustodyProductionReviewCheckId[];
  readonly blockerCodes: readonly string[];
  readonly checks: readonly CustodyProductionReviewCheck[];
  readonly boundaries: readonly string[];
}

export interface CustodyProductionReviewCheck {
  readonly id: CustodyProductionReviewCheckId;
  readonly status: CustodyProductionReviewStatus;
  readonly observedAt?: string;
  readonly note?: string;
}

const EMPTY_SCOPES: readonly string[] = Object.freeze([]);
const CUSTODY_PRODUCTION_REVIEW_CHECKS = [
  "signer-reference-contract-review",
  "no-agent-secret-exposure-review",
  "kms-external-signer-review",
  "cryptographic-module-validation-review",
  "operator-access-review",
  "key-lifecycle-review",
  "recovery-export-review",
  "backup-restore-review",
  "rotation-revocation-review",
  "audit-logging-review",
  "legal-security-review",
  "incident-response-review",
  "redaction-review",
] as const satisfies readonly CustodyProductionReviewCheckId[];

const CUSTODY_PRODUCTION_REVIEW_BOUNDARIES = [
  "This snapshot is status-only and does not prove production custody readiness by itself.",
  "Missing checks stay pending until an operator-approved custody review supplies passing evidence.",
  "Do not include key material, signer material, credentials, authorization headers, payloads, raw signing proofs, exported keys, recovery artifacts, account data, or local secret paths.",
] as const;

export function createInMemoryWalletAccountStore(
  options: InMemoryWalletAccountStoreOptions = {},
): WalletAccountStore {
  const accounts = new Map<string, WalletAccount>();
  const now = options.now ?? (() => new Date());
  const idBytes = options.idBytes ?? (() => randomBytes(32));
  const maxWalletsPerOwnerAgent = options.maxWalletsPerOwnerAgent ?? Number.POSITIVE_INFINITY;

  function createOpaqueId(prefix: string): string {
    return `${prefix}_${randomUUID().replaceAll("-", "")}`;
  }

  function createAddress(): string {
    const digest = createHash("sha256").update(idBytes()).digest("hex");
    return `0x${digest}`;
  }

  return {
    id: "in-memory-wallet-account-store",

    async createWallet(context) {
      const ownerId = normalizeRequiredContext("ownerId", context.ownerId);
      const agentId = normalizeRequiredContext("agentId", context.agentId);
      const existingForContext = [...accounts.values()].filter(
        (account) => account.ownerId === ownerId && account.agentId === agentId,
      ).length;
      if (existingForContext >= maxWalletsPerOwnerAgent) {
        throw new Error("wallet creation limit exceeded for owner and agent context.");
      }

      const walletId = createOpaqueId("wallet");
      const createdAt = now().toISOString();
      const allowedScopes = [...new Set(context.requestedScopes ?? EMPTY_SCOPES)];
      const signerRef: SignerRef = Object.freeze({
        value: createOpaqueId("signer_ref"),
        walletId,
        ownerId,
        agentId,
        scopes: Object.freeze([...allowedScopes]),
        createdAt,
      });

      const account: WalletAccount = Object.freeze({
        walletId,
        address: createAddress(),
        signerRef,
        status: "active",
        allowedScopes: Object.freeze([...allowedScopes]),
        ownerId,
        agentId,
        createdAt,
        ...(context.profileId ? { profileId: context.profileId } : {}),
      });

      accounts.set(walletId, account);
      return account;
    },

    async getWallet(walletId) {
      return accounts.get(walletId);
    },

    async setWalletStatus(walletId, status) {
      const account = accounts.get(walletId);
      if (!account) return undefined;
      const updated: WalletAccount = Object.freeze({ ...account, status });
      accounts.set(walletId, updated);
      return updated;
    },

    async authorizeSigning(request) {
      if (!request.ownerId) {
        return deny("OWNER_CONTEXT_REQUIRED", "Owner context is required before using a signer reference.");
      }
      if (!request.agentId) {
        return deny("AGENT_CONTEXT_REQUIRED", "Agent context is required before using a signer reference.");
      }

      const account = findAccountBySignerRef(accounts, request.signerRef);
      if (!account) return deny("SIGNER_REF_NOT_FOUND", "Signer reference was not found.");
      if (request.walletId && request.walletId !== account.walletId) {
        return deny("SIGNER_REF_MISMATCH", "Signer reference does not belong to the requested wallet.");
      }
      if (request.ownerId !== account.ownerId || request.agentId !== account.agentId) {
        return deny("SIGNER_REF_MISMATCH", "Signer reference context does not match the wallet account.");
      }
      if (account.status !== "active") {
        return deny("WALLET_NOT_ACTIVE", "Wallet account is not active.");
      }
      if (request.scope && !account.allowedScopes.includes(request.scope)) {
        return deny("SCOPE_NOT_ALLOWED", "Requested signing scope is not allowed for this wallet.");
      }

      return {
        authorized: true,
        walletId: account.walletId,
        signerRef: account.signerRef,
      };
    },

    async requestRecoveryExport(request) {
      return {
        allowed: false,
        reasonCode: "RECOVERY_EXPORT_UNSUPPORTED",
        message: "Recovery export is unsupported for autonomous agent runtime flows.",
        audit: {
          walletId: request.walletId,
          actorId: request.actorId,
          reason: request.reason,
          requestedAt: now().toISOString(),
          destinationType: "none",
        },
      };
    },
  };
}

export function createCustodyProductionReviewSnapshot(
  input: CreateCustodyProductionReviewSnapshotInput,
): CustodyProductionReviewSnapshot {
  const supplied = new Map<CustodyProductionReviewCheckId, CustodyProductionReviewCheckInput>();
  for (const check of input.checks ?? []) {
    supplied.set(check.id, check);
  }

  const checks = CUSTODY_PRODUCTION_REVIEW_CHECKS.map((id) => {
    const check = supplied.get(id);
    return {
      id,
      status: check?.status ?? "pending",
      ...(check?.observedAt ? { observedAt: isoString(check.observedAt) } : {}),
      ...(check?.note ? { note: redactString(check.note) } : {}),
    } satisfies CustodyProductionReviewCheck;
  });
  const passedCheckIds = checks.filter((check) => check.status === "passed").map((check) => check.id);
  const pendingCheckIds = checks.filter((check) => check.status === "pending").map((check) => check.id);
  const blockedCheckIds = checks.filter((check) => check.status === "blocked").map((check) => check.id);

  return {
    schemaVersion: 1,
    kind: "vallum.custody-production-review-snapshot",
    result: custodyReviewResult({ pendingCheckIds, blockedCheckIds }),
    environment: input.environment,
    custodyMode: input.custodyMode,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    requiredCheckIds: CUSTODY_PRODUCTION_REVIEW_CHECKS,
    passedCheckIds,
    pendingCheckIds,
    blockedCheckIds,
    blockerCodes: [
      ...pendingCheckIds.map((id) => `CUSTODY_${constantCase(id)}_PENDING`),
      ...blockedCheckIds.map((id) => `CUSTODY_${constantCase(id)}_BLOCKED`),
    ],
    checks,
    boundaries: CUSTODY_PRODUCTION_REVIEW_BOUNDARIES,
  };
}

export function redactAccountValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactAccountValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, shouldRedactKey(key) ? "[REDACTED]" : redactAccountValue(item)]),
    );
  }
  return value;
}

function normalizeRequiredContext(name: "ownerId" | "agentId", value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name} is required for wallet creation.`);
  return normalized;
}

function findAccountBySignerRef(
  accounts: ReadonlyMap<string, WalletAccount>,
  signerRef: string,
): WalletAccount | undefined {
  for (const account of accounts.values()) {
    if (account.signerRef.value === signerRef) return account;
  }
  return undefined;
}

function custodyReviewResult(input: {
  readonly pendingCheckIds: readonly CustodyProductionReviewCheckId[];
  readonly blockedCheckIds: readonly CustodyProductionReviewCheckId[];
}): CustodyProductionReviewResult {
  if (input.blockedCheckIds.length > 0) return "blocked";
  if (input.pendingCheckIds.length > 0) return "pending-operator-proof";
  return "passed";
}

function isoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function constantCase(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toUpperCase();
}

function deny(
  reasonCode: Exclude<SigningAuthorizationResult, { authorized: true }>["reasonCode"],
  message: string,
): SigningAuthorizationResult {
  return { authorized: false, reasonCode, message };
}

function redactString(value: string): string {
  return value
    .replace(/\bsigner_ref_[A-Za-z0-9_:-]+\b/g, "signer_ref_[REDACTED]")
    .replace(/\b(?:seed|mnemonic|private[_-]?key|raw[_-]?keypair|key[_-]?material|exported[_-]?key|bearer|api[_-]?key|credential|authorization|signature|payload)\b[^\s,;]*/gi, "[REDACTED]");
}

function shouldRedactKey(key: string): boolean {
  return /^(value|seed|mnemonic|privateKey|private_key|rawKeypair|raw_keypair|apiKey|api_key|bearerToken|bearer_token)$/i.test(key);
}
