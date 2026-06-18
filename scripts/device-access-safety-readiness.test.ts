import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  buildDeviceAccessSafetyReadinessArtifact,
  checkDeviceAccessSafetyReadiness,
  REQUIRED_DEVICE_ACCESS_SAFETY_CHECKS,
} from "./check-device-access-safety-readiness.js";

test("device access safety readiness blocks without an owner report", async () => {
  const report = await checkDeviceAccessSafetyReadiness({
    env: {},
    scripts: {},
  });

  assert.equal(report.localProofOk, true);
  assert.equal(report.safetyReady, false);
  const blocker = report.checks.find((check) => check.id === "physical-device-safety-report");
  assert.equal(blocker?.status, "blocked-config");
  assert.equal(blocker?.code, "DEVICE_ACCESS_SAFETY_REPORT_MISSING");
});

test("device access safety readiness accepts a fresh redacted structured report", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vallum-device-access-safety-"));
  const reportPath = join(dir, "device-access-safety-proof.json");
  await writeFile(reportPath, JSON.stringify(validDeviceAccessSafetyReport("2026-06-17T00:00:00.000Z")));

  const report = await checkDeviceAccessSafetyReadiness({
    env: { DEVICE_ACCESS_SAFETY_REPORT: reportPath },
    now: new Date("2026-06-18T00:00:00.000Z"),
    scripts: {},
  });

  assert.equal(report.localProofOk, true);
  assert.equal(report.safetyReady, true);
  const approval = report.checks.find((check) => check.id === "physical-device-safety-report");
  assert.equal(approval?.status, "ready-approval");
  assert.equal(approval?.code, "DEVICE_ACCESS_SAFETY_REPORT_VALID");
});

test("device access safety readiness rejects unsafe or incomplete reports", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vallum-device-access-safety-"));
  const unsafePath = join(dir, "unsafe.json");
  const incompletePath = join(dir, "incomplete.json");
  const missingSectionPath = join(dir, "missing-section.json");
  const failedSectionPath = join(dir, "failed-section.json");
  await writeFile(unsafePath, JSON.stringify({
    ...validDeviceAccessSafetyReport("2026-06-17T00:00:00.000Z"),
    deviceCredential: "redacted fixture",
  }));
  await writeFile(incompletePath, JSON.stringify({
    ...validDeviceAccessSafetyReport("2026-06-17T00:00:00.000Z"),
    checks: ["device-class-hazard-analysis"],
  }));
  const { hazardReview: _hazardReview, ...missingSection } = validDeviceAccessSafetyReport("2026-06-17T00:00:00.000Z");
  await writeFile(missingSectionPath, JSON.stringify(missingSection));
  await writeFile(failedSectionPath, JSON.stringify({
    ...validDeviceAccessSafetyReport("2026-06-17T00:00:00.000Z"),
    revocationReview: {
      revocation: "passed",
      emergencyStop: "blocked",
      failClosed: "passed",
    },
  }));

  const unsafe = await checkDeviceAccessSafetyReadiness({
    env: { DEVICE_ACCESS_SAFETY_REPORT: unsafePath },
    now: new Date("2026-06-18T00:00:00.000Z"),
    scripts: {},
  });
  const incomplete = await checkDeviceAccessSafetyReadiness({
    env: { DEVICE_ACCESS_SAFETY_REPORT: incompletePath },
    now: new Date("2026-06-18T00:00:00.000Z"),
    scripts: {},
  });
  const missingSectionReport = await checkDeviceAccessSafetyReadiness({
    env: { DEVICE_ACCESS_SAFETY_REPORT: missingSectionPath },
    now: new Date("2026-06-18T00:00:00.000Z"),
    scripts: {},
  });
  const failedSectionReport = await checkDeviceAccessSafetyReadiness({
    env: { DEVICE_ACCESS_SAFETY_REPORT: failedSectionPath },
    now: new Date("2026-06-18T00:00:00.000Z"),
    scripts: {},
  });

  assert.equal(unsafe.checks.find((check) => check.id === "physical-device-safety-report")?.code, "DEVICE_ACCESS_SAFETY_REPORT_UNSAFE_FIELDS");
  assert.equal(incomplete.checks.find((check) => check.id === "physical-device-safety-report")?.code, "DEVICE_ACCESS_SAFETY_REPORT_CHECKS_INCOMPLETE");
  assert.equal(missingSectionReport.checks.find((check) => check.id === "physical-device-safety-report")?.code, "DEVICE_ACCESS_SAFETY_REPORT_HAZARD_REVIEW_MISSING");
  assert.equal(failedSectionReport.checks.find((check) => check.id === "physical-device-safety-report")?.code, "DEVICE_ACCESS_SAFETY_REPORT_EMERGENCY_STOP_NOT_PASSED");
});

test("device access safety artifact redacts to ids and blocker codes", async () => {
  const report = await checkDeviceAccessSafetyReadiness({ env: {}, scripts: {} });
  const artifact = buildDeviceAccessSafetyReadinessArtifact(report, new Date("2026-06-17T00:00:00.000Z"));

  assert.equal(artifact.kind, "vallum.device-access-safety-readiness-report");
  assert.deepEqual(artifact.provenLocalCheckIds, ["local-device-access-safety-gate"]);
  assert.deepEqual(artifact.blockedCheckIds, ["physical-device-safety-report"]);
  assert.deepEqual(artifact.blockerCodes, ["DEVICE_ACCESS_SAFETY_REPORT_MISSING"]);
});

function validDeviceAccessSafetyReport(observedAt: string) {
  return {
    schemaVersion: 1,
    kind: "vallum.device-access-safety-proof",
    result: "passed",
    observedAt,
    deviceAccessMode: "physical-approved",
    checks: [...REQUIRED_DEVICE_ACCESS_SAFETY_CHECKS],
    hazardReview: {
      deviceClass: "passed",
      hazardAnalysis: "passed",
      safetyBoundary: "passed",
    },
    accountabilityReview: {
      providerIdentity: "passed",
      providerLiability: "passed",
      operatorOwnership: "passed",
    },
    authorizationReview: {
      requesterAuthorization: "passed",
      leastPrivilege: "passed",
      humanApproval: "passed",
    },
    revocationReview: {
      revocation: "passed",
      emergencyStop: "passed",
      failClosed: "passed",
    },
    expiryReview: {
      leaseExpiry: "passed",
      networkFailure: "passed",
      clockSkew: "passed",
    },
    auditPrivacyReview: {
      auditRetention: "passed",
      privacyMinimization: "passed",
      accessLogs: "passed",
    },
    incidentReview: {
      disputeProcess: "passed",
      incidentResponse: "passed",
      escalationPath: "passed",
    },
    credentialReview: {
      storage: "passed",
      rotation: "passed",
      revocation: "passed",
    },
    proofPathReview: {
      simulatedOnly: "passed",
      noRealWorldMotion: "passed",
      testIsolation: "passed",
    },
    legalReview: {
      regulatoryOwner: "passed",
      jurisdiction: "passed",
      terms: "passed",
    },
  };
}
