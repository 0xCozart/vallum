import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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
  "moderation-abuse-review",
  "session-auth-review",
  "receipt-access-review",
  "payment-settlement-review",
  "dispute-workflow-review",
  "operations-incident-review",
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
    await writeFile(reportPath, JSON.stringify({
      schemaVersion: 1,
      kind: "vallum.marketplace-production-proof",
      result: "passed",
      observedAt: "2026-06-11T11:00:00.000Z",
      environment: "testnet",
      checks: requiredChecks,
    }));

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
    await writeFile(stalePath, JSON.stringify({
      schemaVersion: 1,
      kind: "vallum.marketplace-production-proof",
      result: "passed",
      observedAt: "2026-04-01T00:00:00.000Z",
      environment: "testnet",
      checks: requiredChecks,
    }));
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
