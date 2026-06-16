import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { validManifestFixture } from "@sacredlabs/agentrail-manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy } from "@sacredlabs/agentrail-policy-gateway";
import { openEscrow } from "./openEscrow.js";

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

test("openEscrow submits manifest through gateway and returns sponsored receipt", async () => {
  const gateway = createAgentMockGatewayServer({
    policy: agentActionPolicy,
    now: () => now,
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_open_escrow_1" }),
    },
  });

  try {
    const result = await openEscrow({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      manifest: validManifestFixture(),
      receiptId: "receipt_open_escrow_1",
      providerId: "provider:quote-service",
      verifierId: "verifier:alice",
      amount: { amount: "10.00", asset: "USD" },
      now: () => now,
    });

    assert.equal(result.sponsoredAction.approved, true);
    assert.equal(result.receipt.status, "sponsored");
    assert.equal(result.receipt.escrow.status, "open");
    assert.equal(result.receipt.sponsorshipId, "mock_sponsorship_open_escrow_1");
    assert.deepEqual(result.receipt.events.map((event) => event.type), [
      "escrow_created",
      "approved",
      "sponsored",
    ]);
  } finally {
    await close(gateway);
  }
});

test("openEscrow returns denied receipt when gateway rejects manifest", async () => {
  const gateway = createAgentMockGatewayServer({
    policy: agentActionPolicy,
    now: () => now,
  });

  try {
    const result = await openEscrow({
      gatewayBaseUrl: await listen(gateway),
      apiKey: "test-key",
      manifest: {
        ...validManifestFixture(),
        spend: { maxGasBudget: 50_000_001 },
      },
      receiptId: "receipt_open_escrow_denied_1",
      providerId: "provider:quote-service",
      verifierId: "verifier:alice",
      amount: { amount: "10.00", asset: "USD" },
      now: () => now,
    });

    assert.equal(result.sponsoredAction.approved, false);
    assert.equal(result.receipt.status, "denied");
    assert.equal(result.receipt.escrow.status, "open");
    assert.equal(result.receipt.events.at(-1)?.type, "denied");
  } finally {
    await close(gateway);
  }
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
