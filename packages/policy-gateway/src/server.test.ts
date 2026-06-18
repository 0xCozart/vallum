import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import type { AddressInfo } from "node:net";

import { validManifestFixture } from "@vallum/manifest";
import {
  createAgentMockGatewayServer,
  type AgentGatewayEvent,
  type AgentActionPolicy,
} from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");

const basePolicy: AgentActionPolicy = {
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

test("agent mock gateway starts locally and returns an approved mock sponsorship", async () => {
  const events: AgentGatewayEvent[] = [];
  const server = createAgentMockGatewayServer({
    policy: basePolicy,
    now: () => now,
    eventSink: (event) => {
      events.push(event);
    },
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_test_1" }),
    },
  });

  try {
    const baseUrl = await listen(server);
    const response = await fetch(`${baseUrl}/v1/agent/sponsorships`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest: validManifestFixture() }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      approved: true,
      decision: { allowed: true },
      mockSponsorshipId: "mock_sponsorship_test_1",
    });
    assert.equal(events.length, 1);
    assert.equal(events[0]?.outcome, "approved");
  } finally {
    await close(server);
  }
});

test("agent mock gateway returns a denied reason code without reserving sponsorship", async () => {
  let reserveCalls = 0;
  const server = createAgentMockGatewayServer({
    policy: basePolicy,
    now: () => now,
    mockGasStation: {
      reserve: async () => {
        reserveCalls += 1;
        return { sponsorshipId: "mock_sponsorship_should_not_exist" };
      },
    },
  });

  try {
    const baseUrl = await listen(server);
    const response = await fetch(`${baseUrl}/v1/agent/sponsorships`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manifest: {
          ...validManifestFixture(),
          spend: { maxGasBudget: 50_000_001 },
        },
      }),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      approved: false,
      decision: {
        allowed: false,
        reasonCode: "GAS_BUDGET_TOO_HIGH",
        message: "Manifest gas budget exceeds policy.",
      },
    });
    assert.equal(reserveCalls, 0);
  } finally {
    await close(server);
  }
});

test("agent mock gateway redacts prompt-like and secret request fields in events", async () => {
  const events: AgentGatewayEvent[] = [];
  const server = createAgentMockGatewayServer({
    policy: basePolicy,
    now: () => now,
    eventSink: (event) => {
      events.push(event);
    },
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_test_2" }),
    },
  });

  try {
    const baseUrl = await listen(server);
    const manifest = {
      ...validManifestFixture(),
      intent: "This full natural language instruction should not be stored.",
      wallet: {
        walletId: "wallet_demo_1",
        signerRef: "signer_ref_should_not_be_logged",
      },
      metadata: {
        prompt: "secret prompt text",
        ["api" + "Key"]: "credential_sentinel_should_not_be_logged",
        purpose: "test-fixture",
      },
    };

    const response = await fetch(`${baseUrl}/v1/agent/sponsorships`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest }),
    });

    assert.equal(response.status, 200);
    const serializedEvents = JSON.stringify(events);
    assert.equal(serializedEvents.includes("full natural language instruction"), false);
    assert.equal(serializedEvents.includes("signer_ref_should_not_be_logged"), false);
    assert.equal(serializedEvents.includes("secret prompt text"), false);
    assert.equal(serializedEvents.includes("credential_sentinel_should_not_be_logged"), false);
    assert.equal(events[0]?.manifest.intentLength, manifest.intent.length);
    assert.equal(events[0]?.manifest.hasMetadata, true);
  } finally {
    await close(server);
  }
});

test("agent mock gateway event sink failures do not affect request handling", async () => {
  const server = createAgentMockGatewayServer({
    policy: basePolicy,
    now: () => now,
    eventSink: () => {
      throw new Error("event sink unavailable");
    },
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_test_3" }),
    },
  });

  try {
    const baseUrl = await listen(server);
    const response = await fetch(`${baseUrl}/v1/agent/sponsorships`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest: validManifestFixture() }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      approved: true,
      decision: { allowed: true },
      mockSponsorshipId: "mock_sponsorship_test_3",
    });
  } finally {
    await close(server);
  }
});

test("agent mock gateway refuses non-loopback listen hosts by default", () => {
  const server = createAgentMockGatewayServer({
    policy: basePolicy,
    now: () => now,
  });

  assert.throws(() => server.listen(0), /must bind to 127\.0\.0\.1/);
  assert.throws(() => server.listen(0, "0.0.0.0"), /must bind to 127\.0\.0\.1/);
});

test("agent mock gateway can explicitly opt into unsafe non-loopback hosts", async () => {
  const server = createAgentMockGatewayServer({
    policy: basePolicy,
    now: () => now,
    allowUnsafeNonLoopback: true,
  });

  try {
    server.listen(0, "0.0.0.0");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    assert.equal(typeof address.port, "number");
  } finally {
    await close(server);
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
