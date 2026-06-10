import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createIotaNamesAgentResolver,
  resolveIotaNamesAddress,
  validAgentProfileFixture,
  type IotaNamesGraphQLClient,
  type IotaNamesGraphQLRequest,
  type IotaNamesGraphQLResponse,
} from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");

test("resolveIotaNamesAddress uses the official GraphQL field and returns address", async () => {
  const requests: unknown[] = [];
  const client: IotaNamesGraphQLClient = {
    async query<TData>(request: IotaNamesGraphQLRequest) {
      requests.push(request);
      return {
        data: {
          resolveIotaNamesAddress: {
            address: "0x1111111111111111111111111111111111111111111111111111111111111111",
          },
        },
      } as IotaNamesGraphQLResponse<TData>;
    },
  };

  const result = await resolveIotaNamesAddress("researcher.demo.iota", client);

  assert.deepEqual(result, {
    ok: true,
    name: "researcher.demo.iota",
    address: "0x1111111111111111111111111111111111111111111111111111111111111111",
    source: "iota-names-graphql",
  });
  assert.equal(requests.length, 1);
  assert.match(JSON.stringify(requests[0]), /resolveIotaNamesAddress/);
  assert.match(JSON.stringify(requests[0]), /address/);
});

test("IOTA Names agent resolver resolves a name to a validated bound profile", async () => {
  const profile = validAgentProfileFixture();
  const resolver = createIotaNamesAgentResolver({
    graphQL: graphQLAddress(profile.wallet.address),
    profileSource: {
      async getProfileByAddress(address) {
        assert.equal(address, profile.wallet.address);
        return profile;
      },
    },
    now: () => now,
  });

  const result = await resolver.resolve("researcher.demo.iota");

  assert.deepEqual(result, {
    ok: true,
    profile,
  });
});

test("IOTA Names agent resolver fails closed when the profile address does not match the name target", async () => {
  const profile = validAgentProfileFixture();
  const resolver = createIotaNamesAgentResolver({
    graphQL: graphQLAddress("0x9999999999999999999999999999999999999999999999999999999999999999"),
    profileSource: {
      async getProfileByAddress() {
        return profile;
      },
    },
    now: () => now,
  });

  const result = await resolver.resolve("researcher.demo.iota");

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PROFILE_UNVERIFIABLE");
  assert.match(result.error.message, /does not match/);
});

test("IOTA Names agent resolver maps unresolved names to typed not-found errors", async () => {
  const resolver = createIotaNamesAgentResolver({
    graphQL: {
      async query<TData>() {
        return { data: { resolveIotaNamesAddress: null } } as IotaNamesGraphQLResponse<TData>;
      },
    },
    profileSource: {
      async getProfileByAddress() {
        throw new Error("profile source should not be called");
      },
    },
    now: () => now,
  });

  const result = await resolver.resolve("missing.demo.iota");

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "PROFILE_NOT_FOUND",
      message: "IOTA name did not resolve to an address.",
      name: "missing.demo.iota",
    },
  });
});

test("IOTA Names agent resolver fails closed on GraphQL transport failures", async () => {
  const resolver = createIotaNamesAgentResolver({
    graphQL: {
      async query() {
        throw new Error("network down");
      },
    },
    profileSource: {
      async getProfileByAddress() {
        throw new Error("profile source should not be called");
      },
    },
    now: () => now,
  });

  const result = await resolver.resolve("researcher.demo.iota");

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "PROFILE_UNVERIFIABLE",
      message: "IOTA Names GraphQL request failed.",
      name: "researcher.demo.iota",
    },
  });
});

test("IOTA Names agent resolver fails closed on profile source failures", async () => {
  const profile = validAgentProfileFixture();
  const resolver = createIotaNamesAgentResolver({
    graphQL: graphQLAddress(profile.wallet.address),
    profileSource: {
      async getProfileByAddress() {
        throw new Error("metadata store unavailable");
      },
    },
    now: () => now,
  });

  const result = await resolver.resolve("researcher.demo.iota");

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "PROFILE_UNVERIFIABLE",
      message: "Agent Profile metadata source failed.",
      name: "researcher.demo.iota",
    },
  });
});

function graphQLAddress(address: string): IotaNamesGraphQLClient {
  return {
    async query<TData>() {
      return {
        data: {
          resolveIotaNamesAddress: {
            address,
          },
        },
      } as IotaNamesGraphQLResponse<TData>;
    },
  };
}
