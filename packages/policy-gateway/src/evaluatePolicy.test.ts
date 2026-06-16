import assert from "node:assert/strict";
import { test } from "node:test";
import { validManifestFixture } from "@sacredlabs/agentrail-manifest";
import { evaluateAgentActionPolicy, type AgentActionPolicy } from "./index.js";

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
  humanApprovalGasThreshold: 100_000_000,
};

test("known valid agent action is approved", () => {
  const decision = evaluateAgentActionPolicy(basePolicy, validManifestFixture(), {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.deepEqual(decision, {
    allowed: true,
  });
});

test("unknown agent is denied", () => {
  const manifest = {
    ...validManifestFixture(),
    agent: { id: "agent:unknown" },
  };

  const decision = evaluateAgentActionPolicy(basePolicy, manifest, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assertDenied(decision, "UNKNOWN_AGENT");
});

test("revoked agent is denied", () => {
  const decision = evaluateAgentActionPolicy({
    ...basePolicy,
    revokedAgents: ["agent:quote-bot"],
  }, validManifestFixture(), {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assertDenied(decision, "AGENT_REVOKED");
});

test("missing manifest is denied", () => {
  const decision = evaluateAgentActionPolicy(basePolicy, undefined);

  assertDenied(decision, "MISSING_MANIFEST");
});

test("expired manifest is denied", () => {
  const decision = evaluateAgentActionPolicy(basePolicy, {
    ...validManifestFixture(),
    expiresAt: "2026-06-10T11:59:59.999Z",
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assertDenied(decision, "MANIFEST_EXPIRED");
});

test("over-budget action is denied", () => {
  const decision = evaluateAgentActionPolicy(basePolicy, {
    ...validManifestFixture(),
    spend: { maxGasBudget: 50_000_001 },
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assertDenied(decision, "GAS_BUDGET_TOO_HIGH");
});

test("disallowed contract action is denied", () => {
  const decision = evaluateAgentActionPolicy(basePolicy, {
    ...validManifestFixture(),
    action: {
      packageId: "0x9999999999999999999999999999999999999999999999999999999999999999",
      module: "escrow",
      functionName: "open_escrow",
    },
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assertDenied(decision, "CONTRACT_NOT_ALLOWED");
});

test("unauthorized counterparty is denied", () => {
  const decision = evaluateAgentActionPolicy(basePolicy, {
    ...validManifestFixture(),
    counterparty: { id: "provider:unknown" },
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assertDenied(decision, "COUNTERPARTY_NOT_ALLOWED");
});

test("missing simulation is denied when required", () => {
  const decision = evaluateAgentActionPolicy(basePolicy, {
    ...validManifestFixture(),
    simulation: {
      required: true,
      status: "pending",
    },
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assertDenied(decision, "SIMULATION_REQUIRED");
});

test("human approval is required above configured threshold", () => {
  const decision = evaluateAgentActionPolicy({
    ...basePolicy,
    humanApprovalGasThreshold: 10_000,
  }, {
    ...validManifestFixture(),
    humanMandate: { required: false },
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assertDenied(decision, "HUMAN_APPROVAL_REQUIRED");
});

test("unsupported manifest version fails closed", () => {
  const decision = evaluateAgentActionPolicy(basePolicy, {
    ...validManifestFixture(),
    version: "agent-tx-manifest/v999",
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assertDenied(decision, "UNSUPPORTED_MANIFEST_VERSION");
});

function assertDenied(
  decision: ReturnType<typeof evaluateAgentActionPolicy>,
  reasonCode: Exclude<ReturnType<typeof evaluateAgentActionPolicy>, { allowed: true }>["reasonCode"],
): void {
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reasonCode, reasonCode);
}
