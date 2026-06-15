import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { writePackagePublicationProofBundle } from "./write-package-publication-proof-bundle.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

test("package publication proof bundle writes template, plan, and blocked summary without registry secrets", async () => {
  const cwd = await writePackageEvidence();
  try {
    const bundle = await writePackagePublicationProofBundle({
      cwd,
      now: NOW,
      scripts: completeScripts(),
      env: {
        PACKAGE_PUBLICATION_REPORT: "missing-publication-report.json",
      },
    });
    const bundleRaw = await readFile(join(cwd, "tmp/gaskit/package-publication-proof-bundle.json"), "utf8");
    const planRaw = await readFile(join(cwd, "tmp/gaskit/package-publication-proof-plan.json"), "utf8");
    const readinessRaw = await readFile(join(cwd, "tmp/gaskit/package-publication-readiness.json"), "utf8");
    const templateRaw = await readFile(join(cwd, "tmp/gaskit/package-publication-report-template.json"), "utf8");

    assert.equal(bundle.kind, "agentic-gaskit.package-publication-proof-bundle");
    assert.equal(bundle.status, "blocked");
    assert.equal(bundle.localProofOk, true);
    assert.equal(bundle.liveReady, false);
    assert.deepEqual(bundle.packageNames, ["@iota-gaskit/sdk"]);
    assert.deepEqual(bundle.templateArtifacts, [
      {
        id: "package-publication",
        path: "tmp/gaskit/package-publication-report-template.json",
        acceptedReportEnv: "PACKAGE_PUBLICATION_REPORT",
      },
    ]);
    assert.equal(bundle.planArtifact, "tmp/gaskit/package-publication-proof-plan.json");
    assert.equal(bundle.readinessArtifact, "tmp/gaskit/package-publication-readiness.json");
    assert.ok(bundle.blockerCodes.includes("PACKAGE_PUBLICATION_REPORT_NOT_FOUND"));
    assert.ok(bundle.readyApprovalCodes.length === 0);
    assert.ok(bundle.requiredOperatorInputs.includes("PACKAGE_PUBLICATION_REPORT"));
    assert.ok(bundle.requiredStructuredReportFields.includes("packageNames"));
    assert.ok(bundle.requiredStructuredReportCheckIds.includes("registry-install"));
    assert.ok(bundle.requiredEvidenceArtifacts.includes("sanitized npm publication structured report"));
    assert.equal(bundle.steps.find((step) => step.id === "run-approved-npm-publication-proof")?.contactsNpmRegistry, true);
    assert.equal(bundle.steps.find((step) => step.id === "write-publication-template")?.contactsNpmRegistry, false);

    await assertMode(join(cwd, "tmp/gaskit/package-publication-proof-bundle.json"), 0o600);
    await assertMode(join(cwd, "tmp/gaskit/package-publication-proof-plan.json"), 0o600);
    await assertMode(join(cwd, "tmp/gaskit/package-publication-readiness.json"), 0o600);
    await assertMode(join(cwd, "tmp/gaskit/package-publication-report-template.json"), 0o600);

    const allOutput = `${JSON.stringify(bundle)}\n${bundleRaw}\n${planRaw}\n${readinessRaw}\n${templateRaw}`;
    assert.doesNotMatch(allOutput, /missing-publication-report|npm-token-value|one-time-password|registry-response-body|_authToken/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("package publication proof bundle is ready for approval when structured report passes", async () => {
  const cwd = await writePackageEvidence();
  try {
    await writeJsonReport(join(cwd, "package-publication-report.json"), {
      schemaVersion: 1,
      kind: "agentic-gaskit.package-publication-proof",
      result: "passed",
      observedAt: NOW.toISOString(),
      registry: "npm",
      packageNames: ["@iota-gaskit/sdk"],
      checks: [
        "npm-pack-dry-run",
        "local-tarball-install",
        "npm-publish-dry-run",
        "registry-install",
        "provenance-review",
        "rollback-review",
      ],
    });

    const bundle = await writePackagePublicationProofBundle({
      cwd,
      now: NOW,
      scripts: completeScripts(),
      env: {
        PACKAGE_PUBLICATION_REPORT: "package-publication-report.json",
      },
    });
    const bundleRaw = await readFile(join(cwd, "tmp/gaskit/package-publication-proof-bundle.json"), "utf8");

    assert.equal(bundle.status, "ready-for-approval");
    assert.equal(bundle.liveReady, true);
    assert.deepEqual(bundle.blockerCodes, []);
    assert.ok(bundle.readyApprovalCodes.includes("PACKAGE_PUBLICATION_REPORT_VALID"));
    assert.equal(bundle.checks.find((check) => check.id === "npm-registry-publication-report")?.status, "ready-approval");
    assert.doesNotMatch(bundleRaw, /package-publication-report\.json|npm-token-value|one-time-password|registry-response-body|_authToken/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

async function writePackageEvidence(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-package-proof-bundle-"));
  for (const path of [
    "docs/agentic-gaskit/package-release-strategy.md",
    "scripts/package-publish-dry-run.ts",
    "scripts/smoke-package-install.ts",
    "scripts/smoke-package-paid-mcp-consumer.ts",
    "scripts/package-publish.test.ts",
    "scripts/package-publish-dry-run.test.ts",
    "scripts/package-install-smoke.test.ts",
    "scripts/package-scripts.test.ts",
  ]) {
    await mkdir(dirname(join(cwd, path)), { recursive: true });
    await writeFile(join(cwd, path), "export {};\n");
  }
  await mkdir(join(cwd, "packages/sdk"), { recursive: true });
  await writeFile(join(cwd, "packages/sdk/package.json"), `${JSON.stringify({
    name: "@iota-gaskit/sdk",
    version: "0.0.0-prerelease",
  }, null, 2)}\n`);
  return cwd;
}

function completeScripts(): Record<string, string | undefined> {
  return {
    "pack:check": "npm run build && npm pack --dry-run -w @iota-gaskit/sdk",
    "smoke:package-install": "npm run build && tsx scripts/smoke-package-install.ts",
    "smoke:package-paid-mcp-consumer": "npm run build && tsx scripts/smoke-package-paid-mcp-consumer.ts",
    "publish:dry-run": "npm run build && tsx scripts/package-publish-dry-run.ts",
    "verify:fast": "npm test",
    "verify:local": "npm test",
    "grant:check": "npm test",
  };
}

async function writeJsonReport(path: string, report: Record<string, unknown>): Promise<void> {
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
}

async function assertMode(path: string, expected: number): Promise<void> {
  const mode = (await stat(path)).mode & 0o777;
  assert.equal(mode, expected);
}
