import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { PassThrough } from "node:stream";
import { test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { validManifestFixture } from "@sacredlabs/agentrail-manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy } from "@sacredlabs/agentrail-policy-gateway";
import {
  createAgentRailMcpProtocolServer,
  startAgentRailMcpStdioServer,
  toMcpToolResult,
} from "./stdio.js";

const now = new Date("2026-06-10T12:00:00.000Z");

interface ErrorStructuredContent {
  readonly error?: {
    readonly code?: string;
  };
}

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

test("MCP protocol server lists existing AgentRail tool descriptors", async () => {
  await withMcpClient({
    gatewayBaseUrl: "http://127.0.0.1:1",
    apiKey: "test-key",
  }, async (client) => {
    const listed = await client.listTools();
    const toolNames = listed.tools.map((tool) => tool.name);

    assert.deepEqual(toolNames, [
      "iota.request_sponsored_transaction",
      "iota.open_escrow",
    ]);
    assert.equal(listed.tools[0]?.inputSchema.type, "object");
    assert.deepEqual(listed.tools[0]?.inputSchema.required, ["manifest"]);
  });
});

test("MCP protocol tool call preserves approval structured content", async () => {
  const gateway = createAgentMockGatewayServer({
    policy: agentActionPolicy,
    now: () => now,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_stdio_1" }),
    },
  });

  try {
    await withMcpClient({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
    }, async (client) => {
      const result = await client.callTool({
        name: "iota.request_sponsored_transaction",
        arguments: { manifest: validManifestFixture() },
      });

      assert.equal(result.isError, false);
      assert.deepEqual(result.structuredContent, {
        approved: true,
        decision: { allowed: true },
        mockSponsorshipId: "mock_sponsorship_stdio_1",
      });
    });
  } finally {
    await close(gateway);
  }
});

test("MCP protocol tool call preserves denial structured content", async () => {
  const gateway = createAgentMockGatewayServer({
    policy: agentActionPolicy,
    now: () => now,
  });

  try {
    await withMcpClient({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
    }, async (client) => {
      const result = await client.callTool({
        name: "iota.open_escrow",
        arguments: {
          manifest: {
            ...validManifestFixture(),
            spend: { maxGasBudget: 50_000_001 },
          },
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
    });
  } finally {
    await close(gateway);
  }
});

test("MCP protocol unknown tool and invalid manifest fail before gateway calls", async () => {
  let fetchCalls = 0;

  await withMcpClient({
    gatewayBaseUrl: "https://gateway.example.test",
    apiKey: "test-key",
  }, async (client) => {
    const unknownTool = await client.callTool({ name: "iota.unknown", arguments: {} });
    const invalidManifest = await client.callTool({
      name: "iota.request_sponsored_transaction",
      arguments: {},
    });

    assert.equal(unknownTool.isError, true);
    assert.equal((unknownTool.structuredContent as ErrorStructuredContent | undefined)?.error?.code, "UNKNOWN_TOOL");
    assert.equal(invalidManifest.isError, true);
    assert.equal((invalidManifest.structuredContent as ErrorStructuredContent | undefined)?.error?.code, "INVALID_TOOL_INPUT");
    assert.equal(fetchCalls, 0);
  }, {
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("fetch should not run for invalid MCP tool calls");
    },
  });
});

test("MCP result mapper preserves content, structured content, and error flag", () => {
  const mapped = toMcpToolResult({
    isError: true,
    content: [{ type: "text", text: "denied" }],
    structuredContent: { error: { code: "DENIED" } },
  });

  assert.deepEqual(mapped, {
    isError: true,
    content: [{ type: "text", text: "denied" }],
    structuredContent: { error: { code: "DENIED" } },
  });
});

test("MCP stdio session close is idempotent for signal races", async () => {
  const session = await startAgentRailMcpStdioServer({
    gatewayBaseUrl: "http://127.0.0.1:1",
    apiKey: "test-key",
    serverName: "agentrail-test",
    serverVersion: "0.0.0-test",
    logLevel: "silent",
  }, {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
  });

  await session.close();
  await session.close();
  await session.closed;
});

async function withMcpClient(
  config: {
    readonly gatewayBaseUrl: string;
    readonly apiKey: string;
  },
  run: (client: Client) => Promise<void>,
  options: {
    readonly fetchImpl?: typeof fetch;
  } = {},
): Promise<void> {
  const server = createAgentRailMcpProtocolServer({
    gatewayBaseUrl: config.gatewayBaseUrl,
    apiKey: config.apiKey,
    serverName: "agentrail-test",
    serverVersion: "0.0.0-test",
    logLevel: "silent",
  }, {
    fetchImpl: options.fetchImpl,
    now: () => now,
  });
  const client = new Client({ name: "agentrail-test-client", version: "0.0.0-test" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}

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
