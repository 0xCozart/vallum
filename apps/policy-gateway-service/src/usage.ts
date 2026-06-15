import type { GatewayEvent, GatewayEventOutcome, GatewayOperation } from "./server.js";

const UNKNOWN_GROUP = "unknown";
const LITERAL_UNKNOWN_GROUP = "literal:unknown";
const DEFAULT_MAX_RECENT_EVENTS = 100;
const OPERATIONS: GatewayOperation[] = ["reserve", "execute"];
const OUTCOMES: GatewayEventOutcome[] = ["allowed", "rejected", "upstream_failed"];

export interface GatewayUsageReadModelOptions {
  maxRecentEvents?: number;
}

export interface GatewayUsageGroupSnapshot {
  events: number;
  gasBudgetReserved: number;
  byOperation: Record<GatewayOperation, number>;
  byOutcome: Record<GatewayEventOutcome, number>;
  byReasonCode: Record<string, number>;
}

export interface GatewayUsageTotalsSnapshot extends GatewayUsageGroupSnapshot {}

export type GatewayUsageEvent = GatewayEvent;

export interface GatewayUsageSnapshot {
  totals: GatewayUsageTotalsSnapshot;
  byAppId: Record<string, GatewayUsageGroupSnapshot>;
  byWalletAddress: Record<string, GatewayUsageGroupSnapshot>;
  recentEvents: GatewayUsageEvent[];
}

export interface GatewayUsageReadModel {
  record(event: GatewayEvent): void;
  snapshot(): GatewayUsageSnapshot;
}

function zeroOperationCounts(): Record<GatewayOperation, number> {
  return { reserve: 0, execute: 0 };
}

function zeroOutcomeCounts(): Record<GatewayEventOutcome, number> {
  return { allowed: 0, rejected: 0, upstream_failed: 0 };
}

function createGroup(): GatewayUsageGroupSnapshot {
  return {
    events: 0,
    gasBudgetReserved: 0,
    byOperation: zeroOperationCounts(),
    byOutcome: zeroOutcomeCounts(),
    byReasonCode: Object.create(null) as Record<string, number>,
  };
}

function normalizeMaxRecentEvents(value: number | undefined): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : DEFAULT_MAX_RECENT_EVENTS;
}

function cloneGroup(group: GatewayUsageGroupSnapshot): GatewayUsageGroupSnapshot {
  return {
    events: group.events,
    gasBudgetReserved: group.gasBudgetReserved,
    byOperation: { ...group.byOperation },
    byOutcome: { ...group.byOutcome },
    byReasonCode: sortRecord(group.byReasonCode),
  };
}

function sortRecord(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function snapshotGroups(groups: Map<string, GatewayUsageGroupSnapshot>): Record<string, GatewayUsageGroupSnapshot> {
  return Object.fromEntries(
    Array.from(groups.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, group]) => [key, cloneGroup(group)]),
  );
}

function incrementReason(group: GatewayUsageGroupSnapshot, reasonCode: string | undefined): void {
  const safeReasonCode = reasonCode ?? UNKNOWN_GROUP;
  group.byReasonCode[safeReasonCode] = (group.byReasonCode[safeReasonCode] ?? 0) + 1;
}

function gasBudgetReserved(event: GatewayEvent): number {
  return event.operation === "reserve" && event.outcome === "allowed" && typeof event.gasBudget === "number" && Number.isFinite(event.gasBudget)
    ? event.gasBudget
    : 0;
}

function incrementGroup(group: GatewayUsageGroupSnapshot, event: GatewayEvent): void {
  group.events += 1;
  if (OPERATIONS.includes(event.operation)) {
    group.byOperation[event.operation] += 1;
  }
  if (OUTCOMES.includes(event.outcome)) {
    group.byOutcome[event.outcome] += 1;
  }
  group.gasBudgetReserved += gasBudgetReserved(event);
  incrementReason(group, event.reasonCode);
}

function groupKey(key: string | undefined): string {
  if (key === undefined) {
    return UNKNOWN_GROUP;
  }
  return key === UNKNOWN_GROUP ? LITERAL_UNKNOWN_GROUP : key;
}

function groupFor(groups: Map<string, GatewayUsageGroupSnapshot>, key: string | undefined): GatewayUsageGroupSnapshot {
  const safeKey = groupKey(key);
  const existing = groups.get(safeKey);
  if (existing) {
    return existing;
  }
  const created = createGroup();
  groups.set(safeKey, created);
  return created;
}

export function copyAllowedEventFields(event: GatewayEvent): GatewayUsageEvent {
  return {
    id: event.id,
    timestamp: event.timestamp,
    operation: event.operation,
    outcome: event.outcome,
    httpStatus: event.httpStatus,
    ...(event.appId === undefined ? {} : { appId: event.appId }),
    ...(event.walletAddress === undefined ? {} : { walletAddress: event.walletAddress }),
    ...(event.packageId === undefined ? {} : { packageId: event.packageId }),
    ...(event.functionName === undefined ? {} : { functionName: event.functionName }),
    ...(event.gasBudget === undefined ? {} : { gasBudget: event.gasBudget }),
    ...(event.agentRailTransactionId === undefined ? {} : { agentRailTransactionId: event.agentRailTransactionId }),
    ...(event.upstreamReservationId === undefined ? {} : { upstreamReservationId: event.upstreamReservationId }),
    ...(event.reasonCode === undefined ? {} : { reasonCode: event.reasonCode }),
    ...(event.upstreamStatus === undefined ? {} : { upstreamStatus: event.upstreamStatus }),
  };
}

export function createGatewayUsageReadModel(options: GatewayUsageReadModelOptions = {}): GatewayUsageReadModel {
  const maxRecentEvents = normalizeMaxRecentEvents(options.maxRecentEvents);
  const totals = createGroup();
  const byAppId = new Map<string, GatewayUsageGroupSnapshot>();
  const byWalletAddress = new Map<string, GatewayUsageGroupSnapshot>();
  const recentEvents: GatewayUsageEvent[] = [];

  return {
    record(rawEvent: GatewayEvent): void {
      const event = copyAllowedEventFields(rawEvent);

      incrementGroup(totals, event);
      incrementGroup(groupFor(byAppId, event.appId), event);
      incrementGroup(groupFor(byWalletAddress, event.walletAddress), event);

      recentEvents.push(event);
      while (recentEvents.length > maxRecentEvents) {
        recentEvents.shift();
      }
    },

    snapshot(): GatewayUsageSnapshot {
      return {
        totals: cloneGroup(totals),
        byAppId: snapshotGroups(byAppId),
        byWalletAddress: snapshotGroups(byWalletAddress),
        recentEvents: recentEvents.map(copyAllowedEventFields),
      };
    },
  };
}
