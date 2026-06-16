import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { validManifestFixture } from "@vallum/manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy } from "@vallum/policy-gateway";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fakeApiKey = "local-mcp-stdio-secret-key";
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

const gateway = createAgentMockGatewayServer({
  policy: agentActionPolicy,
  now: () => now,
  mockGasStation: {
    reserve: async () => ({ sponsorshipId: "mock_sponsorship_mcp_stdio_smoke_1" }),
  },
});

try {
  const gatewayBaseUrl = await listen(gateway);
  const cli = await readFile(resolve(repoRoot, "packages/mcp-server/dist/cli.js"), "utf8");
  assert.match(cli, /^#!\/usr\/bin\/env node/, "built MCP CLI must preserve the executable shebang");

  const client = new Client({ name: "vallum-stdio-smoke", version: "0.0.0-local" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["packages/mcp-server/dist/cli.js"],
    cwd: repoRoot,
    env: {
      VALLUM_GATEWAY_URL: gatewayBaseUrl,
      VALLUM_API_KEY: fakeApiKey,
      VALLUM_MCP_LOG_LEVEL: "error",
    },
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });

  try {
    await client.connect(transport);

    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name), [
      "iota.request_sponsored_transaction",
      "iota.open_escrow",
    ]);

    const approved = await client.callTool({
      name: "iota.request_sponsored_transaction",
      arguments: { manifest: freshManifestFixture() },
    });
    assert.equal(approved.isError, false);
    assert.deepEqual(approved.structuredContent, {
      approved: true,
      decision: { allowed: true },
      mockSponsorshipId: "mock_sponsorship_mcp_stdio_smoke_1",
    });

    const denied = await client.callTool({
      name: "iota.open_escrow",
      arguments: {
        manifest: {
          ...freshManifestFixture(),
          spend: { maxGasBudget: 50_000_001 },
        },
      },
    });
    assert.equal(denied.isError, true);
    assert.equal((denied.structuredContent as ErrorStructuredContent | undefined)?.error?.code, "GAS_BUDGET_TOO_HIGH");

    const invalid = await client.callTool({
      name: "iota.request_sponsored_transaction",
      arguments: {},
    });
    assert.equal(invalid.isError, true);
    assert.equal((invalid.structuredContent as ErrorStructuredContent | undefined)?.error?.code, "INVALID_TOOL_INPUT");
  } finally {
    await client.close();
  }

  assert.doesNotMatch(stderr, new RegExp(fakeApiKey));
  assert.doesNotMatch(stderr, /signerRef|transactionBytes|userSignature|raw upstream|private key|mnemonic/i);
  console.log("MCP stdio smoke passed with loopback mock gateway.");
} finally {
  await close(gateway);
}

async function listen(server: ReturnType<typeof createAgentMockGatewayServer>): Promise<string> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function freshManifestFixture(): ReturnType<typeof validManifestFixture> {
  return {
    ...validManifestFixture(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  let timeout: NodeJS.Timeout | undefined;
  const closePromise = new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  const timeoutPromise = new Promise<void>((_, reject) => {
    timeout = setTimeout(() => {
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
      reject(new Error("Timed out closing MCP stdio mock gateway."));
    }, 2_000);
  });
  try {
    await Promise.race([closePromise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
