import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { validManifestFixture } from "@iota-gaskit/manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy } from "@iota-gaskit/policy-gateway";
import {
  createGasKitClient,
  GasKitAuthError,
  GasKitError,
  GasKitPolicyError,
  IotaAgent,
  requestSponsoredAction,
} from "./index.js";

const agentActionPolicy: AgentActionPolicy = {
  knownAgents: ["agent:quote-bot"],
  maxGasBudget: 50_000_000,
  allowedContracts: [{
    packageId: "0x2222222222222222222222222222222222222222222222222222222222222222",
    module: "escrow",
    functionName: "open_escrow",
  }],
  allowedCounterparties: ["provider:quote-service"],
  requireSimulation: true,
};

const agentGatewayNow = new Date("2026-06-10T12:00:00.000Z");

test("requestSponsoredAction submits a manifest to the mock gateway and returns approval", async () => {
  const server = createAgentMockGatewayServer({
    policy: agentActionPolicy,
    now: () => agentGatewayNow,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_sdk_1" }),
    },
  });

  try {
    const client = createGasKitClient({
      baseUrl: await listen(server),
      apiKey: "test-key",
    });

    const result = await client.requestSponsoredAction({
      manifest: validManifestFixture(),
    });

    assert.deepEqual(result, {
      approved: true,
      decision: { allowed: true },
      mockSponsorshipId: "mock_sponsorship_sdk_1",
    });
  } finally {
    await close(server);
  }
});

test("requestSponsoredAction returns gateway denial as typed data", async () => {
  const server = createAgentMockGatewayServer({
    policy: agentActionPolicy,
    now: () => agentGatewayNow,
  });

  try {
    const client = createGasKitClient({
      baseUrl: await listen(server),
      apiKey: "test-key",
    });

    const result = await client.requestSponsoredAction({
      manifest: {
        ...validManifestFixture(),
        spend: { maxGasBudget: 50_000_001 },
      },
    });

    assert.deepEqual(result, {
      approved: false,
      decision: {
        allowed: false,
        reasonCode: "GAS_BUDGET_TOO_HIGH",
        message: "Manifest gas budget exceeds policy.",
      },
    });
  } finally {
    await close(server);
  }
});

test("requestSponsoredAction posts only to the gateway sponsorship route", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const manifest = validManifestFixture();

  const result = await requestSponsoredAction({
    baseUrl: "https://api.example.test///",
    apiKey: "test-key",
    manifest,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({
        approved: true,
        decision: { allowed: true },
        mockSponsorshipId: "mock_sponsorship_sdk_2",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  assert.deepEqual(result, {
    approved: true,
    decision: { allowed: true },
    mockSponsorshipId: "mock_sponsorship_sdk_2",
  });
  assert.equal(calls[0].url, "https://api.example.test/v1/agent/sponsorships");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer test-key");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { manifest });
});

test("IotaAgent exposes requestSponsoredAction through the gateway", async () => {
  const server = createAgentMockGatewayServer({
    policy: agentActionPolicy,
    now: () => agentGatewayNow,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_agent_1" }),
    },
  });

  try {
    const agent = new IotaAgent({
      gatewayBaseUrl: await listen(server),
      apiKey: "test-key",
    });

    const result = await agent.requestSponsoredAction({
      manifest: validManifestFixture(),
    });

    assert.deepEqual(result, {
      approved: true,
      decision: { allowed: true },
      mockSponsorshipId: "mock_sponsorship_agent_1",
    });
  } finally {
    await close(server);
  }
});

test("reserveGas constructs the expected request", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = createGasKitClient({
    baseUrl: "https://api.example.test///",
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({
        result: {
          reservation_id: "reservation-1",
          sponsor_address: "0xsponsor",
          gas_coins: [{ objectId: "0xcoin" }],
        },
        gasKitTransactionId: "tx-1",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  const response = await client.reserveGas({
    gasBudget: 50_000_000,
    reserveDurationSecs: 120,
    walletAddress: "0xwallet",
    packageId: "0xpackage",
    functionName: "mint_badge",
  });

  assert.equal(response.reservationId, "reservation-1");
  assert.equal(response.gasKitTransactionId, "tx-1");
  assert.equal(calls[0].url, "https://api.example.test/v1/reserve_gas");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer test-key");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    gas_budget: 50_000_000,
    reserve_duration_secs: 120,
    wallet_address: "0xwallet",
    package_id: "0xpackage",
    function_name: "mint_badge",
  });
});

test("reserveGas still accepts legacy transaction id responses for compatibility", async () => {
  const client = createGasKitClient({
    baseUrl: "https://api.example.test",
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify({
      result: { reservation_id: "reservation-1" },
      _saas_tx_id: "legacy-tx-1",
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  });

  const response = await client.reserveGas({ gasBudget: 1 });

  assert.equal(response.gasKitTransactionId, "legacy-tx-1");
});

test("reserveGas rejects malformed success responses", async () => {
  const client = createGasKitClient({
    baseUrl: "https://api.example.test",
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify({ result: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  });

  await assert.rejects(
    () => client.reserveGas({ gasBudget: 100 }),
    (error) => error instanceof GasKitError && error.message.includes("result.reservation_id"),
  );
});

test("simulatePolicy constructs a local policy preflight request", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = createGasKitClient({
    baseUrl: "https://api.example.test///",
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ allowed: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  const response = await client.simulatePolicy({
    gasBudget: 50_000_000,
    walletAddress: "0xwallet",
    packageId: "0xpackage",
    functionName: "mint_badge",
  });

  assert.deepEqual(response, { allowed: true });
  assert.equal(calls[0].url, "https://api.example.test/v1/policy/simulate");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer test-key");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    gas_budget: 50_000_000,
    wallet_address: "0xwallet",
    package_id: "0xpackage",
    function_name: "mint_badge",
  });
});

test("simulatePolicy returns policy rejections as decision data", async () => {
  const client = createGasKitClient({
    baseUrl: "https://api.example.test",
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify({
      allowed: false,
      reasonCode: "PACKAGE_NOT_ALLOWED",
      message: "The requested package is not allowlisted.",
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  });

  const response = await client.simulatePolicy({ gasBudget: 1, packageId: "0xNOT_ALLOWED", functionName: "mint_badge" });

  assert.deepEqual(response, {
    allowed: false,
    reasonCode: "PACKAGE_NOT_ALLOWED",
    message: "The requested package is not allowlisted.",
  });
});

test("simulatePolicy keeps auth failures as transport errors", async () => {
  const client = createGasKitClient({
    baseUrl: "https://api.example.test",
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
  });

  await assert.rejects(
    () => client.simulatePolicy({ gasBudget: 1 }),
    (error) => error instanceof GasKitAuthError && error.status === 401,
  );
});

test("simulatePolicy rejects malformed decision responses", async () => {
  const client = createGasKitClient({
    baseUrl: "https://api.example.test",
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } }),
  });

  await assert.rejects(
    () => client.simulatePolicy({ gasBudget: 1 }),
    (error) => error instanceof GasKitError && error.message.includes("policy simulation decision"),
  );
});

test("executeSponsoredTransaction returns transaction digest", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = createGasKitClient({
    baseUrl: "https://api.example.test",
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({
        effects: { transactionDigest: "digest-1" },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  const response = await client.executeSponsoredTransaction({
    reservationId: "reservation-1",
    gasKitTransactionId: "tx-1",
    transactionBytes: "base64-tx",
    userSignature: "base64-sig",
  });

  assert.equal(response.digest, "digest-1");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    reservation_id: "reservation-1",
    gasKitTransactionId: "tx-1",
    tx_bytes: "base64-tx",
    user_sig: "base64-sig",
  });
});

test("auth rejection throws GasKitAuthError", async () => {
  const client = createGasKitClient({
    baseUrl: "https://api.example.test",
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
  });

  await assert.rejects(
    () => client.reserveGas({ gasBudget: 100 }),
    (error) => error instanceof GasKitAuthError && error.status === 401,
  );
});

test("policy rejection throws GasKitPolicyError", async () => {
  const client = createGasKitClient({
    baseUrl: "https://api.example.test",
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify({
      error: "Package not allowed",
      reasonCode: "PACKAGE_NOT_ALLOWED",
    }), { status: 429, headers: { "Content-Type": "application/json" } }),
  });

  await assert.rejects(
    () => client.reserveGas({ gasBudget: 100 }),
    (error) => error instanceof GasKitPolicyError && error.reasonCode === "PACKAGE_NOT_ALLOWED",
  );
});

async function listen(server: ReturnType<typeof createAgentMockGatewayServer>): Promise<string> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: ReturnType<typeof createAgentMockGatewayServer>): Promise<void> {
  server.close();
  await once(server, "close");
}
