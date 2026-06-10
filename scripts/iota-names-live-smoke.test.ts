import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatIotaNamesLiveSmokeResult,
  runIotaNamesLiveSmoke,
} from "./smoke-iota-names-live.js";
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
