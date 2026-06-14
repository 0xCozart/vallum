import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  formatPackagePublicationProofPlan,
  writePackagePublicationProofPlan,
} from "./write-package-publication-proof-plan.js";
import { checkPackagePublicationReadiness } from "./check-package-publication-readiness.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("package publication proof plan reports current blockers without registry secrets", async () => {
  const plan = await writePackagePublicationProofPlan({
    cwd: repoRoot,
    env: {},
    now: new Date("2026-06-13T12:00:00.000Z"),
  });
  const formatted = formatPackagePublicationProofPlan(plan);

  assert.equal(plan.kind, "agentic-gaskit.package-publication-proof-plan");
  assert.equal(plan.status, "blocked");
  assert.equal(plan.localProofOk, true);
  assert.equal(plan.liveReady, false);
  assert.ok(plan.packageNames.includes("@iota-gaskit/sdk"));
  assert.ok(plan.blockerCodes.includes("PACKAGE_PUBLICATION_REPORT_MISSING"));
  assert.ok(plan.requiredOperatorInputs.includes("PACKAGE_PUBLICATION_REPORT"));
  assert.ok(plan.requiredStructuredReportFields.includes("packageNames"));
  assert.ok(plan.requiredStructuredReportCheckIds.includes("registry-install"));
  assert.ok(plan.commands.some((command) => command.id === "run-approved-npm-publication-proof" && command.contactsNpmRegistry));
  assert.doesNotMatch(formatted, /npm-token-value|one-time-password|registry-response-body|package-publication-secret/i);
});

test("package publication proof plan can write a redacted local artifact", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-package-plan-"));
  try {
    const outFile = join(cwd, "tmp", "package-publication-proof-plan.json");
    const plan = await writePackagePublicationProofPlan({
      cwd: repoRoot,
      outFile,
      env: {},
      now: new Date("2026-06-13T12:00:00.000Z"),
    });
    const mode = (await stat(outFile)).mode & 0o777;
    const parsed = JSON.parse(await readFile(outFile, "utf8")) as typeof plan;

    assert.equal(mode, 0o600);
    assert.equal(parsed.kind, "agentic-gaskit.package-publication-proof-plan");
    assert.deepEqual(parsed.blockerCodes, plan.blockerCodes);
    assert.deepEqual(parsed.packageNames, plan.packageNames);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("package publication proof plan reports ready approval codes for a valid structured report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-package-plan-"));
  try {
    const baseline = await checkPackagePublicationReadiness({
      cwd: repoRoot,
      env: {},
      now: new Date("2026-06-13T12:00:00.000Z"),
    });
    const reportPath = join(cwd, "publication-report.json");
    await writeFile(reportPath, JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.package-publication-proof",
      result: "passed",
      observedAt: "2026-06-13T11:00:00.000Z",
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

    const plan = await writePackagePublicationProofPlan({
      cwd: repoRoot,
      env: { PACKAGE_PUBLICATION_REPORT: reportPath },
      now: new Date("2026-06-13T12:00:00.000Z"),
    });
    const formatted = formatPackagePublicationProofPlan(plan);

    assert.equal(plan.status, "ready-for-approval");
    assert.equal(plan.liveReady, true);
    assert.ok(plan.readyApprovalCodes.includes("PACKAGE_PUBLICATION_REPORT_VALID"));
    assert.doesNotMatch(formatted, /publication-report\.json/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
