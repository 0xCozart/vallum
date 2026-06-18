import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  formatCustodyProductionProofPlan,
  writeCustodyProductionProofPlan,
} from "./write-custody-production-proof-plan.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredChecks = [
  "signer-reference-contract-review",
  "no-agent-secret-exposure-review",
  "kms-external-signer-review",
  "cryptographic-module-validation-review",
  "operator-access-review",
  "key-lifecycle-review",
  "recovery-export-review",
  "backup-restore-review",
  "rotation-revocation-review",
  "audit-logging-review",
  "legal-security-review",
  "incident-response-review",
  "redaction-review",
] as const;

test("custody production proof plan reports current blockers without custody secrets", async () => {
  const plan = await writeCustodyProductionProofPlan({
    cwd: repoRoot,
    env: {},
    now: new Date("2026-06-13T12:00:00.000Z"),
  });
  const formatted = formatCustodyProductionProofPlan(plan);

  assert.equal(plan.kind, "vallum.custody-production-proof-plan");
  assert.equal(plan.status, "blocked");
  assert.equal(plan.localProofOk, true);
  assert.equal(plan.productionReady, false);
  assert.ok(plan.blockerCodes.includes("CUSTODY_PRODUCTION_REPORT_MISSING"));
  assert.ok(plan.requiredOperatorInputs.includes("CUSTODY_PRODUCTION_REPORT"));
  assert.ok(plan.requiredStructuredReportFields.includes("custodyMode"));
  assert.ok(plan.requiredStructuredReportFields.includes("signerReferenceReview"));
  assert.ok(plan.requiredStructuredReportFields.includes("lifecycleReview"));
  assert.ok(plan.requiredStructuredReportCheckIds.includes("kms-external-signer-review"));
  assert.ok(plan.requiredStructuredReportCheckIds.includes("cryptographic-module-validation-review"));
  assert.ok(plan.commands.some((command) => command.id === "run-approved-production-custody-review" && command.contactsCustodySystem));
  assert.doesNotMatch(formatted, /seed-phrase-value|private-key-value|raw-keypair-value|signer-material-value|authorization-header-value|exported-key-value/i);
});

test("custody production proof plan can write a redacted local artifact", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-custody-plan-"));
  try {
    const outFile = join(cwd, "tmp", "custody-production-proof-plan.json");
    const plan = await writeCustodyProductionProofPlan({
      cwd: repoRoot,
      outFile,
      env: {},
      now: new Date("2026-06-13T12:00:00.000Z"),
    });
    const mode = (await stat(outFile)).mode & 0o777;
    const parsed = JSON.parse(await readFile(outFile, "utf8")) as typeof plan;

    assert.equal(mode, 0o600);
    assert.equal(parsed.kind, "vallum.custody-production-proof-plan");
    assert.deepEqual(parsed.blockerCodes, plan.blockerCodes);
    assert.deepEqual(parsed.requiredStructuredReportCheckIds, plan.requiredStructuredReportCheckIds);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("custody production proof plan reports ready approval codes for a valid structured report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-custody-plan-"));
  try {
    const reportPath = join(cwd, "custody-report.json");
    await writeFile(reportPath, JSON.stringify(validProductionReport("2026-06-13T11:00:00.000Z")));

    const plan = await writeCustodyProductionProofPlan({
      cwd: repoRoot,
      env: { CUSTODY_PRODUCTION_REPORT: reportPath },
      now: new Date("2026-06-13T12:00:00.000Z"),
    });
    const formatted = formatCustodyProductionProofPlan(plan);

    assert.equal(plan.status, "ready-for-approval");
    assert.equal(plan.productionReady, true);
    assert.ok(plan.readyApprovalCodes.includes("CUSTODY_PRODUCTION_REPORT_VALID"));
    assert.doesNotMatch(formatted, /custody-report\.json/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

function validProductionReport(observedAt: string) {
  return {
    schemaVersion: 1,
    kind: "vallum.custody-production-proof",
    result: "passed",
    observedAt,
    custodyMode: "kms",
    checks: requiredChecks,
    signerReferenceReview: {
      scopedHandles: "passed",
      nonBearer: "passed",
      policyBoundary: "passed",
    },
    custodyControlReview: {
      providerMode: "passed",
      moduleValidation: "passed",
      operatorAccess: "passed",
    },
    lifecycleReview: {
      generation: "passed",
      rotation: "passed",
      revocation: "passed",
      destruction: "passed",
    },
    recoveryReview: {
      backupPlan: "passed",
      restoreDrill: "passed",
      exportControls: "passed",
      zeroization: "passed",
    },
    auditReview: {
      accessLogs: "passed",
      operationLogs: "passed",
      retention: "passed",
    },
    incidentReview: {
      detection: "passed",
      response: "passed",
      recovery: "passed",
    },
    complianceReview: {
      legalSecurity: "passed",
      redaction: "passed",
      segregation: "passed",
    },
  };
}
