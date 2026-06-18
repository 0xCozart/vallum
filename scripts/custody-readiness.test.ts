import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildCustodyReadinessArtifact,
  checkCustodyReadiness,
  formatCustodyReadinessArtifact,
  formatCustodyReadinessReport,
  writeCustodyReadinessArtifact,
} from "./check-custody-readiness.js";

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

test("custody readiness reports local signer-reference proof and missing production report without secrets", async () => {
  const report = await checkCustodyReadiness({
    cwd: repoRoot,
    env: {},
    now: new Date("2026-06-11T12:00:00.000Z"),
  });
  const formatted = formatCustodyReadinessReport(report);
  const artifact = buildCustodyReadinessArtifact(report, new Date("2026-06-11T12:00:00.000Z"));
  const artifactJson = formatCustodyReadinessArtifact(artifact);

  assert.equal(report.localProofOk, true);
  assert.equal(report.productionReady, false);
  assert.equal(artifact.kind, "vallum.custody-readiness-report");
  assert.equal(artifact.localProofOk, true);
  assert.equal(artifact.productionReady, false);
  assert.ok(artifact.provenLocalCheckIds.includes("local-signer-reference-proof"));
  assert.ok(artifact.blockedCheckIds.includes("production-custody-report"));
  assert.ok(artifact.blockerCodes.includes("CUSTODY_PRODUCTION_REPORT_MISSING"));
  assert.equal(
    report.checks.find((check) => check.id === "local-signer-reference-proof")?.code,
    "CUSTODY_LOCAL_SIGNER_REFERENCE_PROOF_CONFIGURED",
  );
  assert.equal(
    report.checks.find((check) => check.id === "production-custody-report")?.code,
    "CUSTODY_PRODUCTION_REPORT_MISSING",
  );
  assert.match(formatted, /operator:write-report-template -- --kind custody-production/);
  assert.match(formatted, /packages\/accounts\/src\/accounts\.test\.ts/);
  assert.doesNotMatch(formatted, /seed phrase|private key|raw keypair|credential|bearer token/i);
  assert.doesNotMatch(
    artifactJson,
    /custody-report\.json|unsafe\.json|fixture-redacted-key-material|seed phrase value|raw keypair value|Bearer abc|0x[0-9a-fA-F]{64}/i,
  );
});

test("custody readiness artifact writer uses restrictive local file permissions", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-custody-artifact-"));
  try {
    const outFile = "tmp/vallum/custody-readiness.json";
    const artifact = await writeCustodyReadinessArtifact({
      cwd: repoRoot,
      env: {},
      now: new Date("2026-06-11T12:00:00.000Z"),
      outFile: join(cwd, outFile),
    });
    const written = JSON.parse(await readFile(join(cwd, outFile), "utf8")) as typeof artifact;
    const mode = (await stat(join(cwd, outFile))).mode & 0o777;

    assert.equal(artifact.kind, "vallum.custody-readiness-report");
    assert.equal(written.kind, "vallum.custody-readiness-report");
    assert.equal(written.productionReady, false);
    assert.equal(written.blockerCodes.includes("CUSTODY_PRODUCTION_REPORT_MISSING"), true);
    assert.equal(mode, 0o600);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("custody readiness accepts a recent redacted production report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-custody-readiness-"));
  try {
    const reportPath = join(cwd, "custody-report.json");
    await writeFile(reportPath, JSON.stringify(validProductionReport("2026-06-11T11:00:00.000Z", "external-signer")));

    const report = await checkCustodyReadiness({
      cwd: repoRoot,
      env: { CUSTODY_PRODUCTION_REPORT: reportPath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });
    const formatted = formatCustodyReadinessReport(report);

    assert.equal(report.localProofOk, true);
    assert.equal(report.productionReady, true);
    assert.equal(
      report.checks.find((check) => check.id === "production-custody-report")?.code,
      "CUSTODY_PRODUCTION_REPORT_VALID",
    );
    assert.doesNotMatch(formatted, /custody-report\.json|kms-external-signer-review|recovery-export-review/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("custody readiness hydrates production report path from local env", async () => {
  const cwd = await writeLocalCustodyEvidence();
  try {
    await writeJsonReport(join(cwd, "tmp/custody-production-report.json"), validProductionReport("2026-06-11T11:00:00.000Z", "kms"));
    await writeFile(join(cwd, ".env"), [
      "CUSTODY_PRODUCTION_REPORT=tmp/custody-production-report.json",
      "CUSTODY_PRIVATE_KEY_PATH=/tmp/private-key-value",
      "",
    ].join("\n"));

    const report = await checkCustodyReadiness({
      cwd,
      scripts: completeCustodyScripts(),
      now: new Date("2026-06-11T12:00:00.000Z"),
    });
    const formatted = formatCustodyReadinessReport(report);

    assert.equal(report.localProofOk, true);
    assert.equal(report.productionReady, true);
    assert.equal(
      report.checks.find((check) => check.id === "production-custody-report")?.code,
      "CUSTODY_PRODUCTION_REPORT_VALID",
    );
    assert.doesNotMatch(formatted, /custody-production-report|private-key-value|tmp\//i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("custody readiness rejects reports without status-only review sections", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-custody-readiness-"));
  try {
    const missingPath = join(cwd, "missing-review.json");
    await writeFile(missingPath, JSON.stringify({
      schemaVersion: 1,
      kind: "vallum.custody-production-proof",
      result: "passed",
      observedAt: "2026-06-11T11:00:00.000Z",
      custodyMode: "kms",
      checks: requiredChecks,
    }));
    const failedPath = join(cwd, "failed-review.json");
    await writeFile(failedPath, JSON.stringify({
      ...validProductionReport("2026-06-11T11:00:00.000Z", "kms"),
      lifecycleReview: {
        generation: "passed",
        rotation: "blocked",
        revocation: "passed",
        destruction: "passed",
      },
    }));

    const missing = await checkCustodyReadiness({
      cwd: repoRoot,
      env: { CUSTODY_PRODUCTION_REPORT: missingPath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });
    const failed = await checkCustodyReadiness({
      cwd: repoRoot,
      env: { CUSTODY_PRODUCTION_REPORT: failedPath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });

    assert.equal(
      missing.checks.find((check) => check.id === "production-custody-report")?.code,
      "CUSTODY_PRODUCTION_REPORT_SIGNER_REFERENCE_REVIEW_MISSING",
    );
    assert.equal(
      failed.checks.find((check) => check.id === "production-custody-report")?.code,
      "CUSTODY_PRODUCTION_REPORT_ROTATION_NOT_PASSED",
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("custody readiness rejects unsafe report fields and stale reports", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-custody-readiness-"));
  try {
    const unsafePath = join(cwd, "unsafe.json");
    await writeFile(unsafePath, JSON.stringify({
      schemaVersion: 1,
      kind: "vallum.custody-production-proof",
      result: "passed",
      observedAt: "2026-06-11T11:00:00.000Z",
      custodyMode: "kms",
      checks: requiredChecks,
      privateKeyMaterial: "fixture-redacted-key-material",
    }));
    const stalePath = join(cwd, "stale.json");
    await writeFile(stalePath, JSON.stringify(validProductionReport("2026-04-01T00:00:00.000Z", "kms")));
    const unsafeValuePath = join(cwd, "unsafe-value.json");
    await writeFile(unsafeValuePath, JSON.stringify({
      schemaVersion: 1,
      kind: "vallum.custody-production-proof",
      result: "passed",
      observedAt: "2026-06-11T11:00:00.000Z",
      custodyMode: "kms",
      checks: requiredChecks,
      notes: ["operator review pasted raw keypair value"],
    }));

    const unsafe = await checkCustodyReadiness({
      cwd: repoRoot,
      env: { CUSTODY_PRODUCTION_REPORT: unsafePath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });
    const stale = await checkCustodyReadiness({
      cwd: repoRoot,
      env: { CUSTODY_PRODUCTION_REPORT: stalePath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });
    const unsafeValue = await checkCustodyReadiness({
      cwd: repoRoot,
      env: { CUSTODY_PRODUCTION_REPORT: unsafeValuePath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });

    assert.equal(
      unsafe.checks.find((check) => check.id === "production-custody-report")?.code,
      "CUSTODY_PRODUCTION_REPORT_UNSAFE_FIELDS",
    );
    assert.equal(
      unsafeValue.checks.find((check) => check.id === "production-custody-report")?.code,
      "CUSTODY_PRODUCTION_REPORT_UNSAFE_FIELDS",
    );
    assert.equal(
      stale.checks.find((check) => check.id === "production-custody-report")?.code,
      "CUSTODY_PRODUCTION_REPORT_STALE",
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

function validProductionReport(
  observedAt: string,
  custodyMode: "external-signer" | "kms",
) {
  return {
    schemaVersion: 1,
    kind: "vallum.custody-production-proof",
    result: "passed",
    observedAt,
    custodyMode,
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

async function writeLocalCustodyEvidence(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-custody-readiness-"));
  for (const path of [
    "packages/accounts/src/index.ts",
    "packages/accounts/src/accounts.test.ts",
    "packages/accounts/README.md",
    "docs/vallum/account-wallet-safety.md",
    "docs/vallum/verification-hardening.md",
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

function completeCustodyScripts(): Record<string, string | undefined> {
  return {
    build: "npm run build -w @vallum/accounts",
    "verify:local": "npm test",
  };
}

test("custody readiness blocks incomplete local script wiring", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-custody-readiness-"));
  try {
    const report = await checkCustodyReadiness({
      cwd,
      env: {},
      scripts: {
        build: "npm run build -w @vallum/accounts",
        "verify:local": "npm run proof:custody-readiness",
      },
    });
    const local = report.checks.find((check) => check.id === "local-signer-reference-proof");

    assert.equal(report.localProofOk, false);
    assert.equal(local?.code, "CUSTODY_LOCAL_PROOF_INCOMPLETE");
    assert.match(local?.evidence ?? "", /packages\/accounts\/src\/index\.ts/);
    assert.match(local?.evidence ?? "", /verify:local account tests via npm test/);
    assert.match(local?.evidence ?? "", /custody readiness must stay opt-in/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
