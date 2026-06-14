import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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
  "recovery-export-review",
  "rotation-revocation-review",
  "audit-logging-review",
  "legal-security-review",
  "incident-response-review",
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
  assert.equal(artifact.kind, "agentic-gaskit.custody-readiness-report");
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
  assert.match(formatted, /packages\/accounts\/src\/accounts\.test\.ts/);
  assert.doesNotMatch(formatted, /seed phrase|private key|raw keypair|credential|bearer token/i);
  assert.doesNotMatch(
    artifactJson,
    /custody-report\.json|unsafe\.json|fixture-redacted-key-material|seed phrase value|raw keypair value|Bearer abc|0x[0-9a-fA-F]{64}/i,
  );
});

test("custody readiness artifact writer uses restrictive local file permissions", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-custody-artifact-"));
  try {
    const outFile = "tmp/gaskit/custody-readiness.json";
    const artifact = await writeCustodyReadinessArtifact({
      cwd: repoRoot,
      env: {},
      now: new Date("2026-06-11T12:00:00.000Z"),
      outFile: join(cwd, outFile),
    });
    const written = JSON.parse(await readFile(join(cwd, outFile), "utf8")) as typeof artifact;
    const mode = (await stat(join(cwd, outFile))).mode & 0o777;

    assert.equal(artifact.kind, "agentic-gaskit.custody-readiness-report");
    assert.equal(written.kind, "agentic-gaskit.custody-readiness-report");
    assert.equal(written.productionReady, false);
    assert.equal(written.blockerCodes.includes("CUSTODY_PRODUCTION_REPORT_MISSING"), true);
    assert.equal(mode, 0o600);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("custody readiness accepts a recent redacted production report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-custody-readiness-"));
  try {
    const reportPath = join(cwd, "custody-report.json");
    await writeFile(reportPath, JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.custody-production-proof",
      result: "passed",
      observedAt: "2026-06-11T11:00:00.000Z",
      custodyMode: "external-signer",
      checks: requiredChecks,
    }));

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

test("custody readiness rejects unsafe report fields and stale reports", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-custody-readiness-"));
  try {
    const unsafePath = join(cwd, "unsafe.json");
    await writeFile(unsafePath, JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.custody-production-proof",
      result: "passed",
      observedAt: "2026-06-11T11:00:00.000Z",
      custodyMode: "kms",
      checks: requiredChecks,
      privateKeyMaterial: "fixture-redacted-key-material",
    }));
    const stalePath = join(cwd, "stale.json");
    await writeFile(stalePath, JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.custody-production-proof",
      result: "passed",
      observedAt: "2026-04-01T00:00:00.000Z",
      custodyMode: "kms",
      checks: requiredChecks,
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

    assert.equal(
      unsafe.checks.find((check) => check.id === "production-custody-report")?.code,
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

test("custody readiness blocks incomplete local script wiring", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-custody-readiness-"));
  try {
    const report = await checkCustodyReadiness({
      cwd,
      env: {},
      scripts: {
        build: "npm run build -w @iota-gaskit/accounts",
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
