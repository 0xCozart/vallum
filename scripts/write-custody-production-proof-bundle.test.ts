import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { writeCustodyProductionProofBundle } from "./write-custody-production-proof-bundle.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

test("custody production proof bundle writes template, plan, and blocked summary without custody secrets", async () => {
  const cwd = await writeCustodyEvidence();
  try {
    const bundle = await writeCustodyProductionProofBundle({
      cwd,
      now: NOW,
      scripts: completeScripts(),
      env: {
        CUSTODY_PRODUCTION_REPORT: "missing-custody-report.json",
      },
    });
    const bundleRaw = await readFile(join(cwd, "tmp/gaskit/custody-production-proof-bundle.json"), "utf8");
    const planRaw = await readFile(join(cwd, "tmp/gaskit/custody-production-proof-plan.json"), "utf8");
    const readinessRaw = await readFile(join(cwd, "tmp/gaskit/custody-readiness.json"), "utf8");
    const templateRaw = await readFile(join(cwd, "tmp/gaskit/custody-production-report-template.json"), "utf8");

    assert.equal(bundle.kind, "agentic-gaskit.custody-production-proof-bundle");
    assert.equal(bundle.status, "blocked");
    assert.equal(bundle.localProofOk, true);
    assert.equal(bundle.productionReady, false);
    assert.deepEqual(bundle.templateArtifacts, [
      {
        id: "custody-production",
        path: "tmp/gaskit/custody-production-report-template.json",
        acceptedReportEnv: "CUSTODY_PRODUCTION_REPORT",
      },
    ]);
    assert.equal(bundle.planArtifact, "tmp/gaskit/custody-production-proof-plan.json");
    assert.equal(bundle.readinessArtifact, "tmp/gaskit/custody-readiness.json");
    assert.ok(bundle.blockerCodes.includes("CUSTODY_PRODUCTION_REPORT_NOT_FOUND"));
    assert.equal(bundle.readyApprovalCodes.length, 0);
    assert.ok(bundle.requiredOperatorInputs.includes("CUSTODY_PRODUCTION_REPORT"));
    assert.ok(bundle.requiredStructuredReportFields.includes("custodyMode"));
    assert.ok(bundle.requiredStructuredReportCheckIds.includes("kms-external-signer-review"));
    assert.ok(bundle.requiredEvidenceArtifacts.includes("sanitized custody production structured report"));
    assert.equal(bundle.steps.find((step) => step.id === "run-approved-production-custody-review")?.contactsCustodySystem, true);
    assert.equal(bundle.steps.find((step) => step.id === "write-custody-template")?.contactsCustodySystem, false);

    await assertMode(join(cwd, "tmp/gaskit/custody-production-proof-bundle.json"), 0o600);
    await assertMode(join(cwd, "tmp/gaskit/custody-production-proof-plan.json"), 0o600);
    await assertMode(join(cwd, "tmp/gaskit/custody-readiness.json"), 0o600);
    await assertMode(join(cwd, "tmp/gaskit/custody-production-report-template.json"), 0o600);

    const allOutput = `${JSON.stringify(bundle)}\n${bundleRaw}\n${planRaw}\n${readinessRaw}\n${templateRaw}`;
    assert.doesNotMatch(
      allOutput,
      /missing-custody-report|seed phrase value|mnemonic-value|private-key-value|raw keypair value|Bearer abc|signature-value|exported-key-value|0x[0-9a-fA-F]{64}/i,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("custody production proof bundle is ready for approval when structured report passes", async () => {
  const cwd = await writeCustodyEvidence();
  try {
    await writeJsonReport(join(cwd, "custody-production-report.json"), validProductionReport());

    const bundle = await writeCustodyProductionProofBundle({
      cwd,
      now: NOW,
      scripts: completeScripts(),
      env: {
        CUSTODY_PRODUCTION_REPORT: "custody-production-report.json",
      },
    });
    const bundleRaw = await readFile(join(cwd, "tmp/gaskit/custody-production-proof-bundle.json"), "utf8");

    assert.equal(bundle.status, "ready-for-approval");
    assert.equal(bundle.productionReady, true);
    assert.deepEqual(bundle.blockerCodes, []);
    assert.ok(bundle.readyApprovalCodes.includes("CUSTODY_PRODUCTION_REPORT_VALID"));
    assert.equal(bundle.checks.find((check) => check.id === "production-custody-report")?.status, "ready-approval");
    assert.doesNotMatch(
      bundleRaw,
      /custody-production-report\.json|seed phrase value|mnemonic-value|private-key-value|raw keypair value|Bearer abc|signature-value|exported-key-value/i,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

async function writeCustodyEvidence(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-custody-proof-bundle-"));
  for (const path of [
    "packages/accounts/src/index.ts",
    "packages/accounts/src/accounts.test.ts",
    "packages/accounts/README.md",
    "docs/agentic-gaskit/account-wallet-safety.md",
    "docs/agentic-gaskit/verification-hardening.md",
  ]) {
    await writeFileWithParents(join(cwd, path), "export {};\n");
  }
  return cwd;
}

function completeScripts(): Record<string, string | undefined> {
  return {
    build: "npm run build -w @iota-gaskit/accounts",
    "verify:local": "npm test",
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
    kind: "agentic-gaskit.custody-production-proof",
    result: "passed",
    observedAt: NOW.toISOString(),
    custodyMode: "kms",
    checks: [
      "signer-reference-contract-review",
      "no-agent-secret-exposure-review",
      "kms-external-signer-review",
      "recovery-export-review",
      "rotation-revocation-review",
      "audit-logging-review",
      "legal-security-review",
      "incident-response-review",
    ],
  };
}
