import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { GatewayEvent } from "./server.js";
import { createFileGatewayUsageEventStore } from "./usage-store.js";

function event(overrides: Partial<GatewayEvent> = {}): GatewayEvent {
  return {
    id: overrides.id ?? "event-1",
    timestamp: overrides.timestamp ?? "2026-04-24T20:42:32.000Z",
    operation: overrides.operation ?? "reserve",
    outcome: overrides.outcome ?? "allowed",
    httpStatus: overrides.httpStatus ?? 200,
    ...overrides,
  };
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "gaskit-usage-store-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("file usage event store appends sanitized events and replays a usage snapshot", async () => {
  await withTempDir(async (dir) => {
    const filePath = join(dir, "nested", "usage-events.jsonl");
    const store = createFileGatewayUsageEventStore({ filePath });

    await store.append(
      {
        ...event({
          id: "reserve-allowed",
          operation: "reserve",
          outcome: "allowed",
          appId: "demo-dapp",
          walletAddress: "0xUSER",
          packageId: `0xPACKAGE\u0000${"x".repeat(300)}`,
          gasBudget: 7,
        }),
        apiKey: "local-dev-demo-key",
        bearerToken: "local-smoke-token",
        raw: { upstream: "raw-body" },
      } as GatewayEvent & Record<string, unknown>,
    );
    await store.append(event({ id: "reserve-rejected", outcome: "rejected", httpStatus: 400, reasonCode: "PACKAGE_NOT_ALLOWED" }));

    const rawFile = await readFile(filePath, "utf8");
    assert.equal(rawFile.endsWith("\n"), true);
    assert.equal(rawFile.includes("reserve-allowed"), true);
    assert.equal(rawFile.includes("local-dev-demo-key"), false);
    assert.equal(rawFile.includes("local-smoke-token"), false);
    assert.equal(rawFile.includes("raw-body"), false);
    assert.equal(rawFile.includes("\\u0000"), false);
    const [storedAllowedEvent] = rawFile
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as GatewayEvent);
    assert.equal(storedAllowedEvent.packageId?.includes("\u0000"), false);
    assert.equal(storedAllowedEvent.packageId?.length, 256);

    const snapshot = await store.loadReadModel({ maxRecentEvents: 10 });
    assert.equal(snapshot.totals.events, 2);
    assert.equal(snapshot.totals.gasBudgetReserved, 7);
    assert.deepEqual(snapshot.totals.byReasonCode, { PACKAGE_NOT_ALLOWED: 1, unknown: 1 });
    assert.equal(snapshot.byAppId["demo-dapp"]?.events, 1);
    assert.equal(snapshot.byAppId.unknown?.events, 1);
  });
});

test("file usage event store replays blank-line tolerant JSONL without exposing raw corrupt lines", async () => {
  await withTempDir(async (dir) => {
    const filePath = join(dir, "usage-events.jsonl");
    const store = createFileGatewayUsageEventStore({ filePath });
    await writeFile(filePath, `${JSON.stringify(event({ id: "ok" }))}\n\nnot-json-with-secret-local-dev-demo-key\n`, "utf8");

    let replayed = 0;
    await assert.rejects(
      () => {
        return store.replay(() => {
          replayed += 1;
        });
      },
      (error) => error instanceof Error && /Invalid usage event store JSON at line 3\./.test(error.message) && !error.message.includes("local-dev-demo-key"),
    );
    assert.equal(replayed, 0);
  });
});

test("file usage event store validates stored event shape before replaying", async () => {
  await withTempDir(async (dir) => {
    const filePath = join(dir, "usage-events.jsonl");
    const store = createFileGatewayUsageEventStore({ filePath });
    await writeFile(filePath, `${JSON.stringify({ ...event({ id: "bad" }), operation: "simulate" })}\n`, "utf8");

    let replayed = 0;
    await assert.rejects(
      () => store.replay(() => {
        replayed += 1;
      }),
      /Invalid usage event store event at line 1\./,
    );
    assert.equal(replayed, 0);

    await writeFile(filePath, `${JSON.stringify({ ...event({ id: "bad-optional" }), appId: 123 })}\n`, "utf8");
    await assert.rejects(
      () => store.replay(() => {
        replayed += 1;
      }),
      /Invalid usage event store event at line 1\./,
    );
    assert.equal(replayed, 0);
  });
});

test("file usage event store treats missing files as empty stores", async () => {
  await withTempDir(async (dir) => {
    const store = createFileGatewayUsageEventStore({ filePath: join(dir, "missing", "usage-events.jsonl") });

    let replayed = 0;
    const count = await store.replay(() => {
      replayed += 1;
    });
    const snapshot = await store.loadReadModel();

    assert.equal(count, 0);
    assert.equal(replayed, 0);
    assert.equal(snapshot.totals.events, 0);
    assert.deepEqual(snapshot.recentEvents, []);
  });
});
