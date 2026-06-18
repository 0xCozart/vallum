import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  writeDeviceAccessSafetyProofPlan,
} from "./write-device-access-safety-proof-plan.js";

test("device access safety proof plan reports missing owner report", async () => {
  const plan = await writeDeviceAccessSafetyProofPlan({
    env: {},
    now: new Date("2026-06-17T00:00:00.000Z"),
  });

  assert.equal(plan.kind, "vallum.device-access-safety-proof-plan");
  assert.equal(plan.status, "blocked");
  assert.ok(plan.blockerCodes.includes("DEVICE_ACCESS_SAFETY_REPORT_MISSING"));
  assert.ok(plan.requiredOperatorInputs.includes("DEVICE_ACCESS_SAFETY_REPORT"));
  assert.ok(plan.requiredStructuredReportFields.includes("hazardReview"));
  assert.ok(plan.requiredStructuredReportFields.includes("proofPathReview"));
  assert.ok(plan.commands.some((command) => command.id === "run-approved-physical-device-safety-review" && command.requiresOwnerApproval));
  assert.ok(plan.commands.every((command) => !command.contactsPhysicalDevice));
});

test("device access safety proof plan writes local artifact", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vallum-device-access-plan-"));
  const out = join(dir, "plan.json");
  await writeDeviceAccessSafetyProofPlan({
    env: {},
    now: new Date("2026-06-17T00:00:00.000Z"),
    outFile: out,
  });

  const written = JSON.parse(await readFile(out, "utf8")) as { kind?: string };
  assert.equal(written.kind, "vallum.device-access-safety-proof-plan");
});
