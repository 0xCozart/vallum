import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  writeDeviceAccessSafetyProofBundle,
} from "./write-device-access-safety-proof-bundle.js";

test("device access safety proof bundle writes template plan and readiness artifacts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vallum-device-access-bundle-"));
  const out = join(dir, "bundle.json");
  const planOut = join(dir, "plan.json");
  const readinessOut = join(dir, "readiness.json");
  const templateOut = join(dir, "template.json");

  const bundle = await writeDeviceAccessSafetyProofBundle({
    env: {},
    now: new Date("2026-06-17T00:00:00.000Z"),
    outFile: out,
    planOutFile: planOut,
    readinessOutFile: readinessOut,
    templateOutFile: templateOut,
  });

  assert.equal(bundle.kind, "vallum.device-access-safety-proof-bundle");
  assert.equal(bundle.status, "blocked");
  assert.ok(bundle.blockerCodes.includes("DEVICE_ACCESS_SAFETY_REPORT_MISSING"));
  assert.deepEqual(bundle.requiredOperatorInputs, ["DEVICE_ACCESS_SAFETY_REPORT"]);
  assert.ok(bundle.requiredStructuredReportFields.includes("hazardReview"));
  assert.ok(bundle.requiredStructuredReportFields.includes("proofPathReview"));
  assert.ok(bundle.requiredEvidenceArtifacts.includes("status-only revocation and emergency-stop review section"));
  assert.ok(bundle.steps.every((step) => !step.contactsPhysicalDevice));
  assert.ok(bundle.steps.some((step) => step.id === "run-approved-physical-device-safety-review" && step.requiresOwnerApproval));

  const template = JSON.parse(await readFile(templateOut, "utf8")) as {
    kind?: string;
    deviceAccessMode?: string;
    result?: string;
    hazardReview?: Record<string, unknown>;
    proofPathReview?: Record<string, unknown>;
  };
  const written = JSON.parse(await readFile(out, "utf8")) as { kind?: string };

  assert.equal(written.kind, "vallum.device-access-safety-proof-bundle");
  assert.equal(template.kind, "vallum.device-access-safety-proof");
  assert.equal(template.deviceAccessMode, "physical-approved");
  assert.equal(template.result, "pending-operator-proof");
  assert.equal(template.hazardReview?.hazardAnalysis, "pending");
  assert.equal(template.proofPathReview?.noRealWorldMotion, "pending");
});
