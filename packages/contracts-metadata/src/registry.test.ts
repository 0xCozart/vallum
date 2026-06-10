import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createContractTemplateRegistry,
  evaluateContractTemplateAction,
  escrowContractTemplateV1,
} from "./index.js";

const registry = createContractTemplateRegistry([
  escrowContractTemplateV1,
]);

test("approved template and version metadata is accepted", () => {
  const decision = evaluateContractTemplateAction(registry, {
    templateId: "escrow_v1",
    templateVersion: "1.0.0",
    packageId: "0x2222222222222222222222222222222222222222222222222222222222222222",
    module: "escrow",
    functionName: "open_escrow",
  });

  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.template.templateId, "escrow_v1");
    assert.equal(decision.template.version, "1.0.0");
  }
});

test("unknown package for an approved template is denied", () => {
  const decision = evaluateContractTemplateAction(registry, {
    templateId: "escrow_v1",
    templateVersion: "1.0.0",
    packageId: "0x9999999999999999999999999999999999999999999999999999999999999999",
    module: "escrow",
    functionName: "open_escrow",
  });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.reasonCode, "CONTRACT_PACKAGE_NOT_REGISTERED");
  }
});

test("mismatched template version is denied", () => {
  const decision = evaluateContractTemplateAction(registry, {
    templateId: "escrow_v1",
    templateVersion: "2.0.0",
    packageId: "0x2222222222222222222222222222222222222222222222222222222222222222",
    module: "escrow",
    functionName: "open_escrow",
  });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.reasonCode, "CONTRACT_TEMPLATE_VERSION_MISMATCH");
  }
});

test("missing module for an approved template is denied", () => {
  const decision = evaluateContractTemplateAction(registry, {
    templateId: "escrow_v1",
    templateVersion: "1.0.0",
    packageId: "0x2222222222222222222222222222222222222222222222222222222222222222",
    functionName: "open_escrow",
  });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.reasonCode, "CONTRACT_MODULE_NOT_REGISTERED");
  }
});
