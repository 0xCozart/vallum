import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { evaluateSponsorshipPolicy } from "@vallum/policy-gateway";
import type { PolicyDecision, SponsorshipPolicy, SponsorshipRequestContext } from "@vallum/shared-types";

export interface GatewayQuotaSnapshot {
  appRequestsToday: number;
  walletRequestsToday: number;
  appGasReservedToday: number;
}

export interface GatewayQuotaReserveInput {
  key: string;
  appId: string;
  walletAddress?: string;
  gasBudget?: number;
  packageId?: string;
  functionName?: string;
  policy: SponsorshipPolicy;
  now?: Date;
}

export type GatewayQuotaReserveResult =
  | {
      reserved: true;
      key: string;
      snapshotBefore: GatewayQuotaSnapshot;
    }
  | {
      reserved: false;
      decision: Exclude<PolicyDecision, { allowed: true }>;
      snapshotBefore: GatewayQuotaSnapshot;
    };

export interface GatewayQuotaStore {
  kind: "memory" | "durable-local" | "production";
  reserve(input: GatewayQuotaReserveInput): Promise<GatewayQuotaReserveResult>;
  rollback(key: string): Promise<void>;
  snapshot(input: Omit<GatewayQuotaReserveInput, "key">): Promise<GatewayQuotaSnapshot>;
}

interface QuotaBucket {
  appRequests: Record<string, number>;
  walletRequests: Record<string, number>;
  appGasReserved: Record<string, number>;
}

interface QuotaReservationEntry {
  day: string;
  appKey: string;
  walletKey: string;
  gasBudget?: number;
  rolledBack?: boolean;
}

interface QuotaState {
  days: Record<string, QuotaBucket>;
  reservations: Record<string, QuotaReservationEntry>;
}

function emptyState(): QuotaState {
  return { days: {}, reservations: {} };
}

function emptyBucket(): QuotaBucket {
  return { appRequests: {}, walletRequests: {}, appGasReserved: {} };
}

function utcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function policyFingerprint(policy: SponsorshipPolicy): string {
  return createHash("sha256").update(JSON.stringify(policy)).digest("hex").slice(0, 16);
}

function appQuotaKey(appId: string, policy: SponsorshipPolicy): string {
  return `${appId}:${policyFingerprint(policy)}`;
}

function walletQuotaKey(appKey: string, walletAddress?: string): string {
  return `${appKey}:${walletAddress ?? "unknown"}`;
}

function getBucket(state: QuotaState, day: string): QuotaBucket {
  state.days[day] ??= emptyBucket();
  return state.days[day];
}

function count(record: Record<string, number>, key: string): number {
  return record[key] ?? 0;
}

function snapshotFromBucket(bucket: QuotaBucket, appKey: string, walletKey: string): GatewayQuotaSnapshot {
  return {
    appRequestsToday: count(bucket.appRequests, appKey),
    walletRequestsToday: count(bucket.walletRequests, walletKey),
    appGasReservedToday: count(bucket.appGasReserved, appKey),
  };
}

function policyNeedsVerifiedWallet(policy: SponsorshipPolicy): boolean {
  return Boolean(policy.deniedWallets?.length) || typeof policy.maxRequestsPerWalletPerDay === "number";
}

function policyNeedsVerifiedGasBudget(policy: SponsorshipPolicy): boolean {
  return typeof policy.dailyBudgetNanos === "number" || typeof policy.maxGasBudgetPerTx === "number";
}

function missingEvidenceDecision(input: GatewayQuotaReserveInput): Exclude<PolicyDecision, { allowed: true }> | undefined {
  if (policyNeedsVerifiedWallet(input.policy) && !input.walletAddress) {
    return { allowed: false, reasonCode: "WALLET_DENIED", message: "Wallet evidence is required by sponsorship policy." };
  }
  if (policyNeedsVerifiedGasBudget(input.policy) && typeof input.gasBudget !== "number") {
    return { allowed: false, reasonCode: "GAS_BUDGET_TOO_HIGH", message: "Gas budget evidence is required by sponsorship policy." };
  }
  return undefined;
}

function policyContext(input: GatewayQuotaReserveInput, snapshot: GatewayQuotaSnapshot): SponsorshipRequestContext {
  return {
    appId: input.appId,
    authenticated: true,
    walletAddress: input.walletAddress,
    packageId: input.packageId,
    functionName: input.functionName,
    gasBudget: input.gasBudget,
    ...snapshot,
  };
}

function applyReservation(state: QuotaState, input: GatewayQuotaReserveInput): GatewayQuotaReserveResult {
  const day = utcDay(input.now ?? new Date());
  const appKey = appQuotaKey(input.appId, input.policy);
  const walletKey = walletQuotaKey(appKey, input.walletAddress);
  const bucket = getBucket(state, day);
  const snapshotBefore = snapshotFromBucket(bucket, appKey, walletKey);
  const existing = state.reservations[input.key];
  if (existing && !existing.rolledBack) {
    return { reserved: true, key: input.key, snapshotBefore };
  }

  const missingDecision = missingEvidenceDecision(input);
  if (missingDecision) return { reserved: false, decision: missingDecision, snapshotBefore };

  const decision = evaluateSponsorshipPolicy(input.policy, policyContext(input, snapshotBefore));
  if (decision.allowed === false) return { reserved: false, decision, snapshotBefore };

  bucket.appRequests[appKey] = snapshotBefore.appRequestsToday + 1;
  bucket.walletRequests[walletKey] = snapshotBefore.walletRequestsToday + 1;
  if (typeof input.gasBudget === "number") {
    bucket.appGasReserved[appKey] = snapshotBefore.appGasReservedToday + input.gasBudget;
  }
  state.reservations[input.key] = { day, appKey, walletKey, gasBudget: input.gasBudget };
  return { reserved: true, key: input.key, snapshotBefore };
}

function rollbackReservation(state: QuotaState, key: string): void {
  const entry = state.reservations[key];
  if (!entry || entry.rolledBack) return;
  const bucket = getBucket(state, entry.day);
  bucket.appRequests[entry.appKey] = Math.max(0, count(bucket.appRequests, entry.appKey) - 1);
  bucket.walletRequests[entry.walletKey] = Math.max(0, count(bucket.walletRequests, entry.walletKey) - 1);
  if (typeof entry.gasBudget === "number") {
    bucket.appGasReserved[entry.appKey] = Math.max(0, count(bucket.appGasReserved, entry.appKey) - entry.gasBudget);
  }
  entry.rolledBack = true;
}

export function createInMemoryGatewayQuotaStore(): GatewayQuotaStore {
  const state = emptyState();
  return {
    kind: "memory",
    async reserve(input) {
      return applyReservation(state, input);
    },
    async rollback(key) {
      rollbackReservation(state, key);
    },
    async snapshot(input) {
      const day = utcDay(input.now ?? new Date());
      const appKey = appQuotaKey(input.appId, input.policy);
      return snapshotFromBucket(getBucket(state, day), appKey, walletQuotaKey(appKey, input.walletAddress));
    },
  };
}

export function createFileGatewayQuotaStore(options: { filePath: string }): GatewayQuotaStore {
  let pending = Promise.resolve();

  async function load(): Promise<QuotaState> {
    try {
      return JSON.parse(await readFile(options.filePath, "utf8")) as QuotaState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
      throw error;
    }
  }

  async function save(state: QuotaState): Promise<void> {
    await mkdir(dirname(options.filePath), { recursive: true });
    await writeFile(options.filePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  }

  function withLock<T>(work: () => Promise<T>): Promise<T> {
    const result = pending.then(work, work);
    pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    kind: "durable-local",
    reserve(input) {
      return withLock(async () => {
        const state = await load();
        const result = applyReservation(state, input);
        if (result.reserved) await save(state);
        return result;
      });
    },
    rollback(key) {
      return withLock(async () => {
        const state = await load();
        rollbackReservation(state, key);
        await save(state);
      });
    },
    snapshot(input) {
      return withLock(async () => {
        const state = await load();
        const day = utcDay(input.now ?? new Date());
        const appKey = appQuotaKey(input.appId, input.policy);
        return snapshotFromBucket(getBucket(state, day), appKey, walletQuotaKey(appKey, input.walletAddress));
      });
    },
  };
}
