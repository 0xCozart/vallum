import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  checkMarketplaceReadiness,
  formatMarketplaceReadinessReport,
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

  assert.equal(report.localProofOk, true);
  assert.equal(report.productionReady, false);
  assert.equal(
    report.checks.find((check) => check.id === "local-marketplace-read-model-proof")?.code,
    "MARKETPLACE_LOCAL_PROOF_CONFIGURED",
  );
  assert.equal(
    report.checks.find((check) => check.id === "production-marketplace-report")?.code,
    "MARKETPLACE_PRODUCTION_REPORT_MISSING",
  );
  assert.match(formatted, /npm run smoke:marketplace-read-model/);
  assert.doesNotMatch(formatted, /private prompt|Bearer abc|session-id|payment-secret|credential/i);
});

test("marketplace readiness accepts a recent redacted production report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-marketplace-readiness-"));
  try {
    const reportPath = join(cwd, "marketplace-report.json");
    await writeFile(reportPath, JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.marketplace-production-proof",
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
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-marketplace-readiness-"));
  try {
    const unsafePath = join(cwd, "unsafe.json");
    await writeFile(unsafePath, JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.marketplace-production-proof",
      result: "passed",
      observedAt: "2026-06-11T11:00:00.000Z",
      environment: "testnet",
      checks: requiredChecks,
      sessionId: "fixture-session-id",
    }));
    const stalePath = join(cwd, "stale.json");
    await writeFile(stalePath, JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.marketplace-production-proof",
      result: "passed",
      observedAt: "2026-04-01T00:00:00.000Z",
      environment: "testnet",
      checks: requiredChecks,
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

    assert.equal(
      unsafe.checks.find((check) => check.id === "production-marketplace-report")?.code,
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
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-marketplace-readiness-"));
  try {
    const report = await checkMarketplaceReadiness({
      cwd,
      env: {},
      scripts: {
        build: "npm run build -w @iota-gaskit/marketplace",
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
