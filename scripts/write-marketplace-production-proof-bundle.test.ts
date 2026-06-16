import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { writeMarketplaceProductionProofBundle } from "./write-marketplace-production-proof-bundle.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

test("marketplace production proof bundle writes template, plan, and blocked summary without marketplace secrets", async () => {
  const cwd = await writeMarketplaceEvidence();
  try {
    const bundle = await writeMarketplaceProductionProofBundle({
      cwd,
      now: NOW,
      scripts: completeScripts(),
      env: {
        MARKETPLACE_PRODUCTION_REPORT: "missing-marketplace-report.json",
      },
    });
    const bundleRaw = await readFile(join(cwd, "tmp/vallum/marketplace-production-proof-bundle.json"), "utf8");
    const planRaw = await readFile(join(cwd, "tmp/vallum/marketplace-production-proof-plan.json"), "utf8");
    const readinessRaw = await readFile(join(cwd, "tmp/vallum/marketplace-readiness.json"), "utf8");
    const templateRaw = await readFile(join(cwd, "tmp/vallum/marketplace-production-report-template.json"), "utf8");

    assert.equal(bundle.kind, "vallum.marketplace-production-proof-bundle");
    assert.equal(bundle.status, "blocked");
    assert.equal(bundle.localProofOk, true);
    assert.equal(bundle.productionReady, false);
    assert.deepEqual(bundle.templateArtifacts, [
      {
        id: "marketplace-production",
        path: "tmp/vallum/marketplace-production-report-template.json",
        acceptedReportEnv: "MARKETPLACE_PRODUCTION_REPORT",
      },
    ]);
    assert.equal(bundle.planArtifact, "tmp/vallum/marketplace-production-proof-plan.json");
    assert.equal(bundle.readinessArtifact, "tmp/vallum/marketplace-readiness.json");
    assert.ok(bundle.blockerCodes.includes("MARKETPLACE_PRODUCTION_REPORT_NOT_FOUND"));
    assert.equal(bundle.readyApprovalCodes.length, 0);
    assert.ok(bundle.requiredOperatorInputs.includes("MARKETPLACE_PRODUCTION_REPORT"));
    assert.ok(bundle.requiredStructuredReportFields.includes("environment"));
    assert.ok(bundle.requiredStructuredReportCheckIds.includes("provider-verification-review"));
    assert.ok(bundle.requiredEvidenceArtifacts.includes("sanitized marketplace production structured report"));
    assert.equal(bundle.steps.find((step) => step.id === "run-approved-production-marketplace-review")?.contactsMarketplaceSystem, true);
    assert.equal(bundle.steps.find((step) => step.id === "write-marketplace-template")?.contactsMarketplaceSystem, false);

    await assertMode(join(cwd, "tmp/vallum/marketplace-production-proof-bundle.json"), 0o600);
    await assertMode(join(cwd, "tmp/vallum/marketplace-production-proof-plan.json"), 0o600);
    await assertMode(join(cwd, "tmp/vallum/marketplace-readiness.json"), 0o600);
    await assertMode(join(cwd, "tmp/vallum/marketplace-production-report-template.json"), 0o600);

    const allOutput = `${JSON.stringify(bundle)}\n${bundleRaw}\n${planRaw}\n${readinessRaw}\n${templateRaw}`;
    assert.doesNotMatch(
      allOutput,
      /missing-marketplace-report|provider-secret|session-token|payment-instrument|authorization-header|private-prompt|Bearer abc/i,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("marketplace production proof bundle is ready for approval when structured report passes", async () => {
  const cwd = await writeMarketplaceEvidence();
  try {
    await writeJsonReport(join(cwd, "marketplace-production-report.json"), validProductionReport());

    const bundle = await writeMarketplaceProductionProofBundle({
      cwd,
      now: NOW,
      scripts: completeScripts(),
      env: {
        MARKETPLACE_PRODUCTION_REPORT: "marketplace-production-report.json",
      },
    });
    const bundleRaw = await readFile(join(cwd, "tmp/vallum/marketplace-production-proof-bundle.json"), "utf8");

    assert.equal(bundle.status, "ready-for-approval");
    assert.equal(bundle.productionReady, true);
    assert.deepEqual(bundle.blockerCodes, []);
    assert.ok(bundle.readyApprovalCodes.includes("MARKETPLACE_PRODUCTION_REPORT_VALID"));
    assert.equal(bundle.checks.find((check) => check.id === "production-marketplace-report")?.status, "ready-approval");
    assert.doesNotMatch(
      bundleRaw,
      /marketplace-production-report\.json|provider-secret|session-token|payment-instrument|authorization-header|private-prompt|Bearer abc/i,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

async function writeMarketplaceEvidence(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-marketplace-proof-bundle-"));
  for (const path of [
    "packages/marketplace/src/index.ts",
    "packages/marketplace/src/marketplace.test.ts",
    "packages/marketplace/README.md",
    "scripts/smoke-marketplace-read-model.ts",
    "docs/marketplace-readiness.md",
  ]) {
    await writeFileWithParents(join(cwd, path), "export {};\n");
  }
  return cwd;
}

function completeScripts(): Record<string, string | undefined> {
  return {
    build: "npm run build -w @vallum/marketplace",
    "smoke:marketplace-read-model": "npm run build && tsx scripts/smoke-marketplace-read-model.ts",
    "verify:local": "npm run smoke:marketplace-read-model",
    "verify:fast": "npm test",
    "grant:check": "npm test",
  };
}

async function writeJsonReport(path: string, value: unknown): Promise<void> {
  await writeFileWithParents(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFileWithParents(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function assertMode(path: string, expected: number): Promise<void> {
  const mode = (await stat(path)).mode & 0o777;
  assert.equal(mode, expected);
}

function validProductionReport() {
  return {
    schemaVersion: 1,
    kind: "vallum.marketplace-production-proof",
    result: "passed",
    observedAt: NOW.toISOString(),
    environment: "testnet",
    checks: [
      "provider-onboarding-review",
      "provider-verification-review",
      "moderation-abuse-review",
      "session-auth-review",
      "receipt-access-review",
      "payment-settlement-review",
      "dispute-workflow-review",
      "operations-incident-review",
    ],
  };
}
