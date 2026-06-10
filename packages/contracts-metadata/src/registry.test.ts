import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createContractTemplateRegistry,
  dataLicenseContractTemplateV1,
  evaluateContractTemplateAction,
  escrowContractTemplateV1,
  payPerCallContractTemplateV1,
} from "./index.js";

const registry = createContractTemplateRegistry([
  escrowContractTemplateV1,
  payPerCallContractTemplateV1,
  dataLicenseContractTemplateV1,
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

test("pay-per-call template metadata is accepted", () => {
  const decision = evaluateContractTemplateAction(registry, {
    templateId: "pay_per_call_v1",
    templateVersion: "1.0.0",
    packageId: "0x5555555555555555555555555555555555555555555555555555555555555555",
    module: "pay_per_call",
    functionName: "request_call",
  });

  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.template.templateId, "pay_per_call_v1");
  }
});

test("data-license template metadata is accepted", () => {
  const decision = evaluateContractTemplateAction(registry, {
    templateId: "data_license_v1",
    templateVersion: "1.0.0",
    packageId: "0x6666666666666666666666666666666666666666666666666666666666666666",
    module: "data_license",
    functionName: "request_license",
  });

  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.template.templateId, "data_license_v1");
    assert.deepEqual(decision.template.allowedActions, ["request_license", "grant_access", "revoke_access"]);
  }
});
