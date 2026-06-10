import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { validManifestFixture } from "@iota-gaskit/manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy } from "@iota-gaskit/policy-gateway";
import { createIotaMcpServer } from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");

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

test("iota.request_sponsored_transaction calls the SDK and gateway", async () => {
  const gateway = createAgentMockGatewayServer({
    policy: agentActionPolicy,
    now: () => now,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_mcp_1" }),
    },
  });

  try {
    const server = createIotaMcpServer({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      now: () => now,
    });

    const result = await server.callTool("iota.request_sponsored_transaction", {
      manifest: validManifestFixture(),
    });

    assert.equal(result.isError, false);
    assert.deepEqual(result.structuredContent, {
      approved: true,
      decision: { allowed: true },
      mockSponsorshipId: "mock_sponsorship_mcp_1",
    });
    assert.equal(result.content[0]?.type, "text");
    assert.match(result.content[0]?.text ?? "", /mock_sponsorship_mcp_1/);
  } finally {
    await close(gateway);
  }
});

test("iota.open_escrow calls the SDK and gateway", async () => {
  const gateway = createAgentMockGatewayServer({
    policy: agentActionPolicy,
    now: () => now,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_mcp_escrow_1" }),
    },
  });

  try {
    const server = createIotaMcpServer({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      now: () => now,
    });

    const result = await server.callTool("iota.open_escrow", {
      manifest: validManifestFixture(),
    });

    assert.equal(result.isError, false);
    assert.deepEqual(result.structuredContent, {
      approved: true,
      decision: { allowed: true },
      mockSponsorshipId: "mock_sponsorship_mcp_escrow_1",
    });
  } finally {
    await close(gateway);
  }
});

test("MCP tools return typed errors for invalid input", async () => {
  const server = createIotaMcpServer({
    gatewayBaseUrl: "http://127.0.0.1:1",
    apiKey: "test-key",
    now: () => now,
    fetchImpl: async () => {
      throw new Error("fetch should not run for invalid tool input");
    },
  });

  const result = await server.callTool("iota.request_sponsored_transaction", {});

  assert.equal(result.isError, true);
  assert.deepEqual(result.structuredContent, {
    error: {
      code: "INVALID_TOOL_INPUT",
      message: "Tool input must include a manifest object.",
    },
  });
});

test("MCP tools return gateway denials as structured errors", async () => {
  const gateway = createAgentMockGatewayServer({
    policy: agentActionPolicy,
    now: () => now,
  });

  try {
    const server = createIotaMcpServer({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      now: () => now,
    });

    const result = await server.callTool("iota.request_sponsored_transaction", {
      manifest: {
        ...validManifestFixture(),
        spend: { maxGasBudget: 50_000_001 },
      },
    });

    assert.equal(result.isError, true);
    assert.deepEqual(result.structuredContent, {
      error: {
        code: "GAS_BUDGET_TOO_HIGH",
        message: "Manifest gas budget exceeds policy.",
      },
      decision: {
        allowed: false,
        reasonCode: "GAS_BUDGET_TOO_HIGH",
        message: "Manifest gas budget exceeds policy.",
      },
    });
  } finally {
    await close(gateway);
  }
});

test("MCP tools post only to the SDK gateway sponsorship route", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const manifest = validManifestFixture();
  const server = createIotaMcpServer({
    gatewayBaseUrl: "https://api.example.test///",
    apiKey: "test-key",
    now: () => now,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({
        approved: true,
        decision: { allowed: true },
        mockSponsorshipId: "mock_sponsorship_mcp_route_1",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  const result = await server.callTool("iota.request_sponsored_transaction", { manifest });

  assert.equal(result.isError, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.example.test/v1/agent/sponsorships");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { manifest });
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
