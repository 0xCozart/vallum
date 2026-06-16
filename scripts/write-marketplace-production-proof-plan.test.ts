import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  formatMarketplaceProductionProofPlan,
  writeMarketplaceProductionProofPlan,
} from "./write-marketplace-production-proof-plan.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredChecks = [
  "provider-onboarding-review",
  "provider-verification-review",
  "moderation-abuse-review",
  "session-auth-review",
  "receipt-access-review",
  "payment-settlement-review",
  "dispute-workflow-review",
  "operations-incident-review",
] as const;

test("marketplace production proof plan reports current blockers without marketplace secrets", async () => {
  const plan = await writeMarketplaceProductionProofPlan({
    cwd: repoRoot,
    env: {},
    now: new Date("2026-06-13T12:00:00.000Z"),
  });
  const formatted = formatMarketplaceProductionProofPlan(plan);

  assert.equal(plan.kind, "vallum.marketplace-production-proof-plan");
  assert.equal(plan.status, "blocked");
  assert.equal(plan.localProofOk, true);
  assert.equal(plan.productionReady, false);
  assert.ok(plan.blockerCodes.includes("MARKETPLACE_PRODUCTION_REPORT_MISSING"));
  assert.ok(plan.requiredOperatorInputs.includes("MARKETPLACE_PRODUCTION_REPORT"));
  assert.ok(plan.requiredStructuredReportFields.includes("environment"));
  assert.ok(plan.requiredStructuredReportCheckIds.includes("provider-verification-review"));
  assert.ok(plan.commands.some((command) => command.id === "run-approved-production-marketplace-review" && command.contactsMarketplaceSystem));
  assert.doesNotMatch(formatted, /provider-secret|session-token|payment-instrument|authorization-header|private-prompt/i);
});

test("marketplace production proof plan can write a redacted local artifact", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-marketplace-plan-"));
  try {
    const outFile = join(cwd, "tmp", "marketplace-production-proof-plan.json");
    const plan = await writeMarketplaceProductionProofPlan({
      cwd: repoRoot,
      outFile,
      env: {},
      now: new Date("2026-06-13T12:00:00.000Z"),
    });
    const mode = (await stat(outFile)).mode & 0o777;
    const parsed = JSON.parse(await readFile(outFile, "utf8")) as typeof plan;

    assert.equal(mode, 0o600);
    assert.equal(parsed.kind, "vallum.marketplace-production-proof-plan");
    assert.deepEqual(parsed.blockerCodes, plan.blockerCodes);
    assert.deepEqual(parsed.requiredStructuredReportCheckIds, plan.requiredStructuredReportCheckIds);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("marketplace production proof plan reports ready approval codes for a valid structured report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-marketplace-plan-"));
  try {
    const reportPath = join(cwd, "marketplace-report.json");
    await writeFile(reportPath, JSON.stringify({
      schemaVersion: 1,
      kind: "vallum.marketplace-production-proof",
      result: "passed",
      observedAt: "2026-06-13T11:00:00.000Z",
      environment: "testnet",
      checks: requiredChecks,
    }));

    const plan = await writeMarketplaceProductionProofPlan({
      cwd: repoRoot,
      env: { MARKETPLACE_PRODUCTION_REPORT: reportPath },
      now: new Date("2026-06-13T12:00:00.000Z"),
    });
    const formatted = formatMarketplaceProductionProofPlan(plan);

    assert.equal(plan.status, "ready-for-approval");
    assert.equal(plan.productionReady, true);
    assert.ok(plan.readyApprovalCodes.includes("MARKETPLACE_PRODUCTION_REPORT_VALID"));
    assert.doesNotMatch(formatted, /marketplace-report\.json/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
