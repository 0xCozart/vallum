import { createHash, randomBytes, randomUUID } from "node:crypto";

export type WalletAccountStatus = "active" | "disabled" | "revoked" | "compromised";

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

const EMPTY_SCOPES: readonly string[] = Object.freeze([]);

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

function deny(
  reasonCode: Exclude<SigningAuthorizationResult, { authorized: true }>["reasonCode"],
  message: string,
): SigningAuthorizationResult {
  return { authorized: false, reasonCode, message };
}

function redactString(value: string): string {
  return value
    .replace(/\bsigner_ref_[A-Za-z0-9_:-]+\b/g, "signer_ref_[REDACTED]")
    .replace(/\b(?:seed|mnemonic|private[_-]?key|raw[_-]?keypair|bearer|api[_-]?key)\b[^\s,;]*/gi, "[REDACTED]");
}

function shouldRedactKey(key: string): boolean {
  return /^(value|seed|mnemonic|privateKey|private_key|rawKeypair|raw_keypair|apiKey|api_key|bearerToken|bearer_token)$/i.test(key);
}
