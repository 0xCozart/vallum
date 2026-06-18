import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildMarketplaceReadinessArtifact,
  checkMarketplaceReadiness,
  formatMarketplaceReadinessArtifact,
  formatMarketplaceReadinessReport,
  writeMarketplaceReadinessArtifact,
} from "./check-marketplace-readiness.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredChecks = [
  "provider-onboarding-review",
  "provider-verification-review",
  "provider-capability-review",
  "moderation-abuse-review",
  "session-auth-review",
  "receipt-access-review",
  "payment-settlement-review",
  "settlement-reconciliation-review",
  "dispute-workflow-review",
  "operations-incident-review",
  "incident-response-review",
  "redaction-review",
] as const;

test("marketplace readiness reports local proof and missing production report without secrets", async () => {
  const report = await checkMarketplaceReadiness({
    cwd: repoRoot,
    env: {},
    now: new Date("2026-06-11T12:00:00.000Z"),
  });
  const formatted = formatMarketplaceReadinessReport(report);
  const artifact = buildMarketplaceReadinessArtifact(report, new Date("2026-06-11T12:00:00.000Z"));
  const artifactJson = formatMarketplaceReadinessArtifact(artifact);

  assert.equal(report.localProofOk, true);
  assert.equal(report.productionReady, false);
  assert.equal(artifact.kind, "vallum.marketplace-readiness-report");
  assert.equal(artifact.localProofOk, true);
  assert.equal(artifact.productionReady, false);
  assert.ok(artifact.provenLocalCheckIds.includes("local-marketplace-read-model-proof"));
  assert.ok(artifact.blockedCheckIds.includes("production-marketplace-report"));
  assert.ok(artifact.blockerCodes.includes("MARKETPLACE_PRODUCTION_REPORT_MISSING"));
  assert.equal(
    report.checks.find((check) => check.id === "local-marketplace-read-model-proof")?.code,
    "MARKETPLACE_LOCAL_PROOF_CONFIGURED",
  );
  assert.equal(
    report.checks.find((check) => check.id === "production-marketplace-report")?.code,
    "MARKETPLACE_PRODUCTION_REPORT_MISSING",
  );
  assert.match(formatted, /operator:write-report-template -- --kind marketplace-production/);
  assert.match(formatted, /npm run smoke:marketplace-read-model/);
  assert.doesNotMatch(formatted, /private prompt|Bearer abc|session-id|payment-secret|credential/i);
  assert.doesNotMatch(
    artifactJson,
    /marketplace-report\.json|unsafe\.json|fixture-session-id|Bearer abc|payment-secret-value|private-prompt-value|0x[0-9a-fA-F]{64}/i,
  );
});

test("marketplace readiness artifact writer uses restrictive local file permissions", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-marketplace-artifact-"));
  try {
    const outFile = "tmp/vallum/marketplace-readiness.json";
    const artifact = await writeMarketplaceReadinessArtifact({
      cwd: repoRoot,
      env: {},
      now: new Date("2026-06-11T12:00:00.000Z"),
      outFile: join(cwd, outFile),
    });
    const written = JSON.parse(await readFile(join(cwd, outFile), "utf8")) as typeof artifact;
    const mode = (await stat(join(cwd, outFile))).mode & 0o777;

    assert.equal(artifact.kind, "vallum.marketplace-readiness-report");
    assert.equal(written.kind, "vallum.marketplace-readiness-report");
    assert.equal(written.productionReady, false);
    assert.equal(written.blockerCodes.includes("MARKETPLACE_PRODUCTION_REPORT_MISSING"), true);
    assert.equal(mode, 0o600);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("marketplace readiness accepts a recent redacted production report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-marketplace-readiness-"));
  try {
    const reportPath = join(cwd, "marketplace-report.json");
    await writeFile(reportPath, JSON.stringify(validProductionReport("2026-06-11T11:00:00.000Z")));

    const report = await checkMarketplaceReadiness({
      cwd: repoRoot,
      env: { MARKETPLACE_PRODUCTION_REPORT: reportPath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });
    const formatted = formatMarketplaceReadinessReport(report);

    assert.equal(report.localProofOk, true);
    assert.equal(report.productionReady, true);
    assert.equal(
      report.checks.find((check) => check.id === "production-marketplace-report")?.code,
      "MARKETPLACE_PRODUCTION_REPORT_VALID",
    );
    assert.doesNotMatch(formatted, /marketplace-report\.json|provider-verification-review|session-auth-review/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("marketplace readiness hydrates production report path from local env", async () => {
  const cwd = await writeLocalMarketplaceEvidence();
  try {
    await writeJsonReport(join(cwd, "tmp/marketplace-production-report.json"), validProductionReport("2026-06-11T11:00:00.000Z"));
    await writeFile(join(cwd, ".env"), [
      "MARKETPLACE_PRODUCTION_REPORT=tmp/marketplace-production-report.json",
      "MARKETPLACE_PRIVATE_PROMPT=private-prompt-value",
      "",
    ].join("\n"));

    const report = await checkMarketplaceReadiness({
      cwd,
      scripts: completeMarketplaceScripts(),
      now: new Date("2026-06-11T12:00:00.000Z"),
    });
    const formatted = formatMarketplaceReadinessReport(report);

    assert.equal(report.localProofOk, true);
    assert.equal(report.productionReady, true);
    assert.equal(
      report.checks.find((check) => check.id === "production-marketplace-report")?.code,
      "MARKETPLACE_PRODUCTION_REPORT_VALID",
    );
    assert.doesNotMatch(formatted, /marketplace-production-report|private-prompt-value|tmp\//i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("marketplace readiness rejects reports without status-only review sections", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-marketplace-readiness-"));
  try {
    const missingPath = join(cwd, "missing-review.json");
    await writeFile(missingPath, JSON.stringify({
      schemaVersion: 1,
      kind: "vallum.marketplace-production-proof",
      result: "passed",
      observedAt: "2026-06-11T11:00:00.000Z",
      environment: "testnet",
      checks: requiredChecks,
    }));
    const failedPath = join(cwd, "failed-review.json");
    await writeFile(failedPath, JSON.stringify({
      ...validProductionReport("2026-06-11T11:00:00.000Z"),
      settlementReview: {
        paymentSettlement: "passed",
        reconciliation: "blocked",
      },
    }));

    const missing = await checkMarketplaceReadiness({
      cwd: repoRoot,
      env: { MARKETPLACE_PRODUCTION_REPORT: missingPath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });
    const failed = await checkMarketplaceReadiness({
      cwd: repoRoot,
      env: { MARKETPLACE_PRODUCTION_REPORT: failedPath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });

    assert.equal(
      missing.checks.find((check) => check.id === "production-marketplace-report")?.code,
      "MARKETPLACE_PRODUCTION_REPORT_PROVIDER_REVIEW_MISSING",
    );
    assert.equal(
      failed.checks.find((check) => check.id === "production-marketplace-report")?.code,
      "MARKETPLACE_PRODUCTION_REPORT_RECONCILIATION_NOT_PASSED",
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("marketplace readiness rejects unsafe report fields and stale reports", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-marketplace-readiness-"));
  try {
    const unsafePath = join(cwd, "unsafe.json");
    await writeFile(unsafePath, JSON.stringify({
      schemaVersion: 1,
      kind: "vallum.marketplace-production-proof",
      result: "passed",
      observedAt: "2026-06-11T11:00:00.000Z",
      environment: "testnet",
      checks: requiredChecks,
      sessionId: "fixture-session-id",
    }));
    const stalePath = join(cwd, "stale.json");
    await writeFile(stalePath, JSON.stringify(validProductionReport("2026-04-01T00:00:00.000Z")));
    const unsafeValuePath = join(cwd, "unsafe-value.json");
    await writeFile(unsafeValuePath, JSON.stringify({
      schemaVersion: 1,
      kind: "vallum.marketplace-production-proof",
      result: "passed",
      observedAt: "2026-06-11T11:00:00.000Z",
      environment: "testnet",
      checks: requiredChecks,
      notes: ["provider review included private prompt fixture value"],
    }));

    const unsafe = await checkMarketplaceReadiness({
      cwd: repoRoot,
      env: { MARKETPLACE_PRODUCTION_REPORT: unsafePath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });
    const stale = await checkMarketplaceReadiness({
      cwd: repoRoot,
      env: { MARKETPLACE_PRODUCTION_REPORT: stalePath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });
    const unsafeValue = await checkMarketplaceReadiness({
      cwd: repoRoot,
      env: { MARKETPLACE_PRODUCTION_REPORT: unsafeValuePath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });

    assert.equal(
      unsafe.checks.find((check) => check.id === "production-marketplace-report")?.code,
      "MARKETPLACE_PRODUCTION_REPORT_UNSAFE_FIELDS",
    );
    assert.equal(
      unsafeValue.checks.find((check) => check.id === "production-marketplace-report")?.code,
      "MARKETPLACE_PRODUCTION_REPORT_UNSAFE_FIELDS",
    );
    assert.equal(
      stale.checks.find((check) => check.id === "production-marketplace-report")?.code,
      "MARKETPLACE_PRODUCTION_REPORT_STALE",
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

function validProductionReport(observedAt: string) {
  return {
    schemaVersion: 1,
    kind: "vallum.marketplace-production-proof",
    result: "passed",
    observedAt,
    environment: "testnet",
    checks: requiredChecks,
    providerReview: {
      onboarding: "passed",
      verification: "passed",
      capabilityReview: "passed",
    },
    moderationReview: {
      abuseControls: "passed",
      escalationPath: "passed",
      redaction: "passed",
    },
    accessReview: {
      apiAccess: "passed",
      receiptAccess: "passed",
      leastPrivilege: "passed",
    },
    settlementReview: {
      paymentSettlement: "passed",
      reconciliation: "passed",
    },
    disputeReview: {
      workflow: "passed",
      evidencePack: "passed",
    },
    operationsReview: {
      incidentRunbook: "passed",
      monitoring: "passed",
      rollback: "passed",
    },
  };
}

async function writeLocalMarketplaceEvidence(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-marketplace-readiness-"));
  for (const path of [
    "packages/marketplace/src/index.ts",
    "packages/marketplace/src/marketplace.test.ts",
    "packages/marketplace/README.md",
    "scripts/smoke-marketplace-read-model.ts",
    "docs/marketplace-readiness.md",
  ]) {
    await writeFileWithParents(join(cwd, path), "placeholder\n");
  }
  return cwd;
}

async function writeJsonReport(path: string, value: unknown): Promise<void> {
  await writeFileWithParents(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFileWithParents(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

function completeMarketplaceScripts(): Record<string, string | undefined> {
  return {
    build: "npm run build -w @vallum/marketplace",
    "smoke:marketplace-read-model": "tsx scripts/smoke-marketplace-read-model.ts",
    "verify:local": "npm run smoke:marketplace-read-model",
  };
}

test("marketplace readiness blocks incomplete local script wiring", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-marketplace-readiness-"));
  try {
    const report = await checkMarketplaceReadiness({
      cwd,
      env: {},
      scripts: {
        build: "npm run build -w @vallum/marketplace",
        "smoke:marketplace-read-model": "tsx scripts/smoke-marketplace-read-model.ts",
        "verify:local": "npm run proof:marketplace-readiness",
      },
    });
    const local = report.checks.find((check) => check.id === "local-marketplace-read-model-proof");

    assert.equal(report.localProofOk, false);
    assert.equal(local?.code, "MARKETPLACE_LOCAL_PROOF_INCOMPLETE");
    assert.match(local?.evidence ?? "", /packages\/marketplace\/src\/index\.ts/);
    assert.match(local?.evidence ?? "", /verify:local marketplace smoke/);
    assert.match(local?.evidence ?? "", /marketplace readiness must stay opt-in/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
