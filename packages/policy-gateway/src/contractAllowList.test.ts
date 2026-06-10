import assert from "node:assert/strict";
import { test } from "node:test";
import { validManifestFixture } from "@iota-gaskit/manifest";
import { evaluateAgentActionPolicy, type AgentActionPolicy } from "./index.js";

const templatePolicy: AgentActionPolicy = {
  knownAgents: ["agent:quote-bot"],
  maxGasBudget: 50_000_000,
  allowedContracts: [{
    templateId: "escrow_v1",
    templateVersion: "1.0.0",
  }],
  allowedCounterparties: ["provider:quote-service"],
  requireSimulation: true,
};

test("template allow-list accepts approved contract metadata", () => {
  const decision = evaluateAgentActionPolicy(templatePolicy, {
    ...validManifestFixture(),
    action: {
      ...validManifestFixture().action,
      templateId: "escrow_v1",
      templateVersion: "1.0.0",
    },
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.deepEqual(decision, { allowed: true });
});

test("template allow-list denies unknown raw package", () => {
  const decision = evaluateAgentActionPolicy(templatePolicy, {
    ...validManifestFixture(),
    action: {
      ...validManifestFixture().action,
      templateId: "escrow_v1",
      templateVersion: "1.0.0",
      packageId: "0x9999999999999999999999999999999999999999999999999999999999999999",
    },
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assertDenied(decision, "CONTRACT_NOT_ALLOWED");
});

test("template allow-list denies mismatched template version", () => {
  const decision = evaluateAgentActionPolicy(templatePolicy, {
    ...validManifestFixture(),
    action: {
      ...validManifestFixture().action,
      templateId: "escrow_v1",
      templateVersion: "2.0.0",
    },
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assertDenied(decision, "CONTRACT_NOT_ALLOWED");
});

test("template allow-list denies incomplete template metadata", () => {
  const decision = evaluateAgentActionPolicy({
    ...templatePolicy,
    allowedContracts: [{
      templateId: "escrow_v1",
    }],
  }, {
    ...validManifestFixture(),
    action: {
      ...validManifestFixture().action,
      templateId: "escrow_v1",
      templateVersion: "1.0.0",
    },
  }, {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assertDenied(decision, "CONTRACT_NOT_ALLOWED");
});

test("template allow-list can coexist with raw package allow-list entries", () => {
  const decision = evaluateAgentActionPolicy({
    ...templatePolicy,
    allowedContracts: [
      {
        templateId: "escrow_v1",
        templateVersion: "2.0.0",
      },
      {
        packageId: "0x2222222222222222222222222222222222222222222222222222222222222222",
        module: "escrow",
        functionName: "open_escrow",
      },
    ],
  }, validManifestFixture(), {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.deepEqual(decision, { allowed: true });
});

test("raw package/function allow-list remains compatible", () => {
  const decision = evaluateAgentActionPolicy({
    ...templatePolicy,
    allowedContracts: [{
      packageId: "0x2222222222222222222222222222222222222222222222222222222222222222",
      module: "escrow",
      functionName: "open_escrow",
    }],
  }, validManifestFixture(), {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  assert.deepEqual(decision, { allowed: true });
});

function assertDenied(
  decision: ReturnType<typeof evaluateAgentActionPolicy>,
  reasonCode: Exclude<ReturnType<typeof evaluateAgentActionPolicy>, { allowed: true }>["reasonCode"],
): void {
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reasonCode, reasonCode);
}
