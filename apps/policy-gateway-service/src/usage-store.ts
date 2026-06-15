import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { GatewayEvent, GatewayEventOutcome, GatewayOperation } from "./server.js";
import {
  copyAllowedEventFields,
  createGatewayUsageReadModel,
  type GatewayUsageReadModelOptions,
  type GatewayUsageSnapshot,
} from "./usage.js";

const OPERATIONS = new Set<GatewayOperation>(["reserve", "execute"]);
const OUTCOMES = new Set<GatewayEventOutcome>(["allowed", "rejected", "upstream_failed"]);
const EVENT_STRING_MAX_LENGTH = 256;

export interface FileGatewayUsageEventStoreOptions {
  filePath: string;
}

export interface FileGatewayUsageEventStore {
  append(event: GatewayEvent): Promise<void>;
  replay(record: (event: GatewayEvent) => void): Promise<number>;
  loadReadModel(options?: GatewayUsageReadModelOptions): Promise<GatewayUsageSnapshot>;
}

function hasOwn(record: Record<string, unknown>, key: keyof GatewayEvent): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function sanitizeEventString(value: string): string {
  const withoutControlCharacters = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, "�");
  return withoutControlCharacters.length > EVENT_STRING_MAX_LENGTH ? withoutControlCharacters.slice(0, EVENT_STRING_MAX_LENGTH) : withoutControlCharacters;
}

function optionalString(record: Record<string, unknown>, key: keyof GatewayEvent): string | undefined {
  if (!hasOwn(record, key)) return undefined;
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error("invalid optional string");
  }
  return sanitizeEventString(value);
}

function optionalFiniteNumber(record: Record<string, unknown>, key: keyof GatewayEvent): number | undefined {
  if (!hasOwn(record, key)) return undefined;
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("invalid optional number");
  }
  return value;
}

function requiredString(record: Record<string, unknown>, key: keyof GatewayEvent): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("required string missing");
  }
  return sanitizeEventString(value);
}

function requiredHttpStatus(record: Record<string, unknown>): number {
  const value = record.httpStatus;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 100 || value > 599) {
    throw new Error("invalid httpStatus");
  }
  return value;
}

function requiredOperation(record: Record<string, unknown>): GatewayOperation {
  const value = record.operation;
  if (typeof value !== "string" || !OPERATIONS.has(value as GatewayOperation)) {
    throw new Error("invalid operation");
  }
  return value as GatewayOperation;
}

function requiredOutcome(record: Record<string, unknown>): GatewayEventOutcome {
  const value = record.outcome;
  if (typeof value !== "string" || !OUTCOMES.has(value as GatewayEventOutcome)) {
    throw new Error("invalid outcome");
  }
  return value as GatewayEventOutcome;
}

function parseStoredEvent(value: unknown): GatewayEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("stored event must be an object");
  }
  const record = value as Record<string, unknown>;
  const event: GatewayEvent = {
    id: requiredString(record, "id"),
    timestamp: requiredString(record, "timestamp"),
    operation: requiredOperation(record),
    outcome: requiredOutcome(record),
    httpStatus: requiredHttpStatus(record),
  };

  const appId = optionalString(record, "appId");
  if (appId !== undefined) event.appId = appId;
  const walletAddress = optionalString(record, "walletAddress");
  if (walletAddress !== undefined) event.walletAddress = walletAddress;
  const packageId = optionalString(record, "packageId");
  if (packageId !== undefined) event.packageId = packageId;
  const functionName = optionalString(record, "functionName");
  if (functionName !== undefined) event.functionName = functionName;
  const gasBudget = optionalFiniteNumber(record, "gasBudget");
  if (gasBudget !== undefined) event.gasBudget = gasBudget;
  const agentRailTransactionId = optionalString(record, "agentRailTransactionId");
  if (agentRailTransactionId !== undefined) event.agentRailTransactionId = agentRailTransactionId;
  const upstreamReservationId = optionalString(record, "upstreamReservationId");
  if (upstreamReservationId !== undefined) event.upstreamReservationId = upstreamReservationId;
  const reasonCode = optionalString(record, "reasonCode") as GatewayEvent["reasonCode"] | undefined;
  if (reasonCode !== undefined) event.reasonCode = reasonCode;
  const upstreamStatus = optionalFiniteNumber(record, "upstreamStatus");
  if (upstreamStatus !== undefined) event.upstreamStatus = upstreamStatus;

  return event;
}

function eventForStorage(event: GatewayEvent): GatewayEvent {
  return parseStoredEvent(copyAllowedEventFields(event));
}

function parseJsonLine(line: string, lineNumber: number): unknown {
  try {
    return JSON.parse(line) as unknown;
  } catch {
    throw new Error(`Invalid usage event store JSON at line ${lineNumber}.`);
  }
}

function parseEventLine(line: string, lineNumber: number): GatewayEvent {
  try {
    return parseStoredEvent(parseJsonLine(line, lineNumber));
  } catch (error) {
    if (error instanceof Error && error.message === `Invalid usage event store JSON at line ${lineNumber}.`) {
      throw error;
    }
    throw new Error(`Invalid usage event store event at line ${lineNumber}.`);
  }
}

function parseEventLines(contents: string): GatewayEvent[] {
  const events: GatewayEvent[] = [];
  const lines = contents.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line?.trim()) continue;
    events.push(parseEventLine(line, index + 1));
  }
  return events;
}

export function createFileGatewayUsageEventStore(options: FileGatewayUsageEventStoreOptions): FileGatewayUsageEventStore {
  const filePath = options.filePath;

  return {
    async append(event: GatewayEvent): Promise<void> {
      await mkdir(dirname(filePath), { recursive: true });
      await appendFile(filePath, `${JSON.stringify(eventForStorage(event))}\n`, "utf8");
    },

    async replay(record: (event: GatewayEvent) => void): Promise<number> {
      let contents: string;
      try {
        contents = await readFile(filePath, "utf8");
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          return 0;
        }
        throw error;
      }

      const events = parseEventLines(contents);
      for (const event of events) {
        record(event);
      }
      return events.length;
    },

    async loadReadModel(options?: GatewayUsageReadModelOptions): Promise<GatewayUsageSnapshot> {
      const usage = createGatewayUsageReadModel(options);
      await this.replay((event) => usage.record(event));
      return usage.snapshot();
    },
  };
}
