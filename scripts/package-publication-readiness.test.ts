import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildPackagePublicationReadinessArtifact,
  checkPackagePublicationReadiness,
  formatPackagePublicationReadinessArtifact,
  formatPackagePublicationReadinessReport,
  writePackagePublicationReadinessArtifact,
} from "./check-package-publication-readiness.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("package publication readiness reports local proof and missing registry report without secrets", async () => {
  const report = await checkPackagePublicationReadiness({
    cwd: repoRoot,
    env: {},
    now: new Date("2026-06-11T12:00:00.000Z"),
  });
  const formatted = formatPackagePublicationReadinessReport(report);
  const artifact = buildPackagePublicationReadinessArtifact(report, new Date("2026-06-11T12:00:00.000Z"));
  const artifactJson = formatPackagePublicationReadinessArtifact(artifact);

  assert.equal(report.localProofOk, true);
  assert.equal(report.liveReady, false);
  assert.equal(artifact.kind, "agentic-gaskit.package-publication-readiness-report");
  assert.equal(artifact.localProofOk, true);
  assert.equal(artifact.liveReady, false);
  assert.ok(artifact.packageNames.includes("@iota-gaskit/sdk"));
  assert.ok(artifact.provenLocalCheckIds.includes("local-package-publication-proof"));
  assert.ok(artifact.blockedCheckIds.includes("npm-registry-publication-report"));
  assert.ok(artifact.blockerCodes.includes("PACKAGE_PUBLICATION_REPORT_MISSING"));
  assert.ok(report.packageNames.includes("@iota-gaskit/sdk"));
  assert.equal(
    report.checks.find((check) => check.id === "local-package-publication-proof")?.code,
    "PACKAGE_PUBLICATION_LOCAL_PROOF_CONFIGURED",
  );
  assert.equal(
    report.checks.find((check) => check.id === "npm-registry-publication-report")?.code,
    "PACKAGE_PUBLICATION_REPORT_MISSING",
  );
  assert.match(formatted, /npm run publish:dry-run/);
  assert.doesNotMatch(formatted, /npm_token|otp|password|credential|secret/i);
  assert.doesNotMatch(artifactJson, /npm_token|fixture-redacted-but-still-forbidden|publication-report\.json|0x[0-9a-fA-F]{64}/);
});

test("package publication readiness artifact writer uses restrictive local file permissions", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-package-publication-"));
  try {
    const outFile = "tmp/gaskit/package-publication-readiness.json";
    const artifact = await writePackagePublicationReadinessArtifact({
      cwd: repoRoot,
      env: {},
      now: new Date("2026-06-11T12:00:00.000Z"),
      outFile: join(cwd, outFile),
    });
    const written = JSON.parse(await readFile(join(cwd, outFile), "utf8")) as typeof artifact;
    const mode = (await stat(join(cwd, outFile))).mode & 0o777;

    assert.equal(artifact.kind, "agentic-gaskit.package-publication-readiness-report");
    assert.equal(written.kind, "agentic-gaskit.package-publication-readiness-report");
    assert.equal(written.liveReady, false);
    assert.equal(written.blockerCodes.includes("PACKAGE_PUBLICATION_REPORT_MISSING"), true);
    assert.equal(mode, 0o600);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("package publication readiness accepts a recent redacted registry report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-package-publication-"));
  try {
    const baseline = await checkPackagePublicationReadiness({
      cwd: repoRoot,
      env: {},
      now: new Date("2026-06-11T12:00:00.000Z"),
    });
    const reportPath = join(cwd, "publication-report.json");
    await writeFile(reportPath, JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.package-publication-proof",
      result: "passed",
      observedAt: "2026-06-11T11:00:00.000Z",
      registry: "npm",
      packageNames: baseline.packageNames,
      checks: [
        "npm-pack-dry-run",
        "local-tarball-install",
        "npm-publish-dry-run",
        "registry-install",
        "provenance-review",
        "rollback-review",
      ],
    }));

    const report = await checkPackagePublicationReadiness({
      cwd: repoRoot,
      env: { PACKAGE_PUBLICATION_REPORT: reportPath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });
    const formatted = formatPackagePublicationReadinessReport(report);

    assert.equal(report.localProofOk, true);
    assert.equal(report.liveReady, true);
    assert.equal(
      report.checks.find((check) => check.id === "npm-registry-publication-report")?.code,
      "PACKAGE_PUBLICATION_REPORT_VALID",
    );
    assert.doesNotMatch(formatted, /publication-report\.json|registry-install|provenance-review/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("package publication readiness rejects unsafe report fields and stale reports", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-package-publication-"));
  try {
    const baseline = await checkPackagePublicationReadiness({ cwd: repoRoot, env: {} });
    const unsafePath = join(cwd, "unsafe.json");
    await writeFile(unsafePath, JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.package-publication-proof",
      result: "passed",
      observedAt: "2026-06-11T11:00:00.000Z",
      registry: "npm",
      packageNames: baseline.packageNames,
      checks: [
        "npm-pack-dry-run",
        "local-tarball-install",
        "npm-publish-dry-run",
        "registry-install",
        "provenance-review",
        "rollback-review",
      ],
      npmToken: "fixture-redacted-but-still-forbidden",
    }));
    const stalePath = join(cwd, "stale.json");
    await writeFile(stalePath, JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.package-publication-proof",
      result: "passed",
      observedAt: "2026-04-01T00:00:00.000Z",
      registry: "npm",
      packageNames: baseline.packageNames,
      checks: [
        "npm-pack-dry-run",
        "local-tarball-install",
        "npm-publish-dry-run",
        "registry-install",
        "provenance-review",
        "rollback-review",
      ],
    }));

    const unsafe = await checkPackagePublicationReadiness({
      cwd: repoRoot,
      env: { PACKAGE_PUBLICATION_REPORT: unsafePath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });
    const stale = await checkPackagePublicationReadiness({
      cwd: repoRoot,
      env: { PACKAGE_PUBLICATION_REPORT: stalePath },
      now: new Date("2026-06-11T12:00:00.000Z"),
    });

    assert.equal(
      unsafe.checks.find((check) => check.id === "npm-registry-publication-report")?.code,
      "PACKAGE_PUBLICATION_REPORT_UNSAFE_FIELDS",
    );
    assert.equal(
      stale.checks.find((check) => check.id === "npm-registry-publication-report")?.code,
      "PACKAGE_PUBLICATION_REPORT_STALE",
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("package publication readiness blocks incomplete local script wiring", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-package-publication-"));
  try {
    const report = await checkPackagePublicationReadiness({
      cwd,
      env: {},
      scripts: {
        "pack:check": "npm pack --dry-run",
        "smoke:package-install": "tsx scripts/smoke-package-install.ts",
        "publish:dry-run": "tsx scripts/package-publish-dry-run.ts",
        "verify:local": "npm run publish:dry-run",
      },
    });
    const local = report.checks.find((check) => check.id === "local-package-publication-proof");

    assert.equal(report.localProofOk, false);
    assert.equal(local?.code, "PACKAGE_PUBLICATION_LOCAL_PROOF_INCOMPLETE");
    assert.match(local?.evidence ?? "", /publishable packages/);
    assert.match(local?.evidence ?? "", /publish:dry-run must stay opt-in/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
