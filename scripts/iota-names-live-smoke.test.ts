import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  formatIotaNamesLiveSmokeResult,
  runIotaNamesLiveSmoke,
} from "./smoke-iota-names-live.js";
import {
  buildIotaNamesLiveReport,
  loadIotaNamesLiveReport,
  validateIotaNamesLiveReport,
} from "./iota-names-live-report.js";
import type { IotaNamesGraphQLRequest } from "../packages/registry/src/index.js";

test("IOTA Names live smoke reports exact missing configuration without secrets", async () => {
  const result = await runIotaNamesLiveSmoke({ env: {} });
  const formatted = formatIotaNamesLiveSmokeResult(result);

  assert.equal(result.ok, false);
  assert.equal(result.kind, "blocked");
  assert.deepEqual(result.missing, [
    "IOTA_NAMES_GRAPHQL_URL",
    "IOTA_NAMES_NAME",
    "IOTA_NAMES_EXPECTED_ADDRESS",
  ]);
  assert.match(formatted, /IOTA_NAMES_GRAPHQL_URL/);
  assert.doesNotMatch(formatted, /private|mnemonic|bearer|token|secret|iotaprivkey/i);
});

test("IOTA Names live smoke resolves a configured name through the registry adapter", async () => {
  const requests: unknown[] = [];
  const result = await runIotaNamesLiveSmoke({
    env: {
      IOTA_NAMES_GRAPHQL_URL: "https://graphql.testnet.example/iota",
      IOTA_NAMES_NAME: "researcher.demo.iota",
      IOTA_NAMES_EXPECTED_ADDRESS: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
    graphQL: {
      async query<TData>(request: IotaNamesGraphQLRequest) {
        requests.push(request);
        return {
          data: {
            resolveIotaNamesAddress: {
              address: "0x1111111111111111111111111111111111111111111111111111111111111111",
            },
          } as TData,
        };
      },
    },
  });

  assert.deepEqual(result, {
    ok: true,
    name: "researcher.demo.iota",
    address: "0x1111111111111111111111111111111111111111111111111111111111111111",
    source: "iota-names-graphql",
  });
  assert.equal(requests.length, 1);
  assert.match(JSON.stringify(requests[0]), /resolveIotaNamesAddress/);
});

test("IOTA Names live smoke blocks non-loopback HTTP endpoints", async () => {
  const result = await runIotaNamesLiveSmoke({
    env: {
      IOTA_NAMES_GRAPHQL_URL: "http://graphql.testnet.example/iota",
      IOTA_NAMES_NAME: "researcher.demo.iota",
      IOTA_NAMES_EXPECTED_ADDRESS: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.kind, "blocked");
  assert.equal(result.code, "IOTA_NAMES_GRAPHQL_URL_UNSAFE");
  assert.doesNotMatch(formatIotaNamesLiveSmokeResult(result), /graphql\.testnet\.example/);
});

test("IOTA Names live smoke fails closed when the resolved address does not match expected", async () => {
  const result = await runIotaNamesLiveSmoke({
    env: {
      IOTA_NAMES_GRAPHQL_URL: "https://graphql.testnet.example/iota",
      IOTA_NAMES_NAME: "researcher.demo.iota",
      IOTA_NAMES_EXPECTED_ADDRESS: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
    graphQL: {
      async query<TData>() {
        return {
          data: {
            resolveIotaNamesAddress: {
              address: "0x2222222222222222222222222222222222222222222222222222222222222222",
            },
          } as TData,
        };
      },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.kind, "failed");
  assert.equal(result.code, "IOTA_NAMES_ADDRESS_MISMATCH");
  assert.match(formatIotaNamesLiveSmokeResult(result), /resolved address did not match/i);
});

test("IOTA Names live smoke report stores only sanitized proof metadata", async () => {
  const fullAddress = "0x1111111111111111111111111111111111111111111111111111111111111111";
  const result = await runIotaNamesLiveSmoke({
    env: {
      IOTA_NAMES_GRAPHQL_URL: "https://graphql.testnet.example/iota",
      IOTA_NAMES_NAME: "researcher.demo.iota",
      IOTA_NAMES_EXPECTED_ADDRESS: fullAddress,
    },
    graphQL: {
      async query<TData>() {
        return {
          data: {
            resolveIotaNamesAddress: {
              address: fullAddress,
            },
          } as TData,
        };
      },
    },
  });
  const report = buildIotaNamesLiveReport({
    result,
    observedAt: new Date(),
    env: {
      IOTA_NAMES_GRAPHQL_URL: "https://graphql.testnet.example/iota",
      IOTA_NAMES_NAME: "researcher.demo.iota",
      IOTA_NAMES_EXPECTED_ADDRESS: fullAddress,
    },
  });
  const serialized = JSON.stringify(report);

  assert.equal(report.result, "passed");
  assert.equal(report.code, "IOTA_NAMES_LIVE_SMOKE_PASSED");
  assert.equal(validateIotaNamesLiveReport(report).ok, true);
  assert.doesNotMatch(serialized, /graphql\.testnet\.example|researcher\.demo\.iota/);
  assert.doesNotMatch(serialized, new RegExp(fullAddress));
  assert.match(report.resolvedAddressRedacted ?? "", /^0x11111111\.\.\.11111111$/);
});

test("IOTA Names live smoke report rejects unsafe full-address fields", async () => {
  const unsafe = {
    schemaVersion: 1,
    kind: "vallum.iota-names-live-smoke-report",
    observedAt: new Date().toISOString(),
    result: "passed",
    code: "IOTA_NAMES_LIVE_SMOKE_PASSED",
    message: "Unsafe report.",
    contactsLiveService: true,
    endpointConfigured: true,
    nameConfigured: true,
    expectedAddressConfigured: true,
    addressMatched: true,
    address: "0x1111111111111111111111111111111111111111111111111111111111111111",
  };
  const cwd = await mkdtemp(join(tmpdir(), "vallum-iota-names-report-"));
  try {
    const path = join(cwd, "names-report.json");
    await writeFile(path, JSON.stringify(unsafe));
    await assert.rejects(() => loadIotaNamesLiveReport(path));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
