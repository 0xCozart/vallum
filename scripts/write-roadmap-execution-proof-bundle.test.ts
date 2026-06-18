import assert from "node:assert/strict";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import {
  resolveRoadmapExecutionEnv,
  writeRoadmapExecutionProofBundle,
} from "./write-roadmap-execution-proof-bundle.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

test("roadmap execution env hydrates local .env and preserves explicit overrides", async () => {
  const cwd = `tmp/vallum/roadmap-env-test-${process.pid}-${Date.now()}`;
  try {
    await mkdir(cwd, { recursive: true });
    await writeFile(
      join(cwd, ".env"),
      [
        "PACKAGE_PUBLICATION_REPORT=tmp/vallum/package-publication-proof-report.json",
        "A2A_EXTERNAL_CONFORMANCE_REPORT=tmp/vallum/a2a-external-conformance-report.json",
        "DEVICE_ACCESS_SAFETY_REPORT=tmp/vallum/device-access-safety-report.json",
      ].join("\n"),
      { mode: 0o600 },
    );

    const env = await resolveRoadmapExecutionEnv(cwd, {
      DEVICE_ACCESS_SAFETY_REPORT: "",
      PAYMENT_PROVIDER_LIVE_REPORT: "tmp/vallum/payment-provider-live-report.json",
    });

    assert.equal(env.PACKAGE_PUBLICATION_REPORT, "tmp/vallum/package-publication-proof-report.json");
    assert.equal(env.A2A_EXTERNAL_CONFORMANCE_REPORT, "tmp/vallum/a2a-external-conformance-report.json");
    assert.equal(env.PAYMENT_PROVIDER_LIVE_REPORT, "tmp/vallum/payment-provider-live-report.json");
    assert.equal(env.DEVICE_ACCESS_SAFETY_REPORT, "");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("roadmap execution proof bundle writes all remaining proof artifacts without running live proofs", async () => {
  const artifactDir = `tmp/vallum/roadmap-execution-test-${process.pid}-${Date.now()}`;
  const outFile = `${artifactDir}/roadmap-execution-proof-bundle.json`;
  try {
    const bundle = await writeRoadmapExecutionProofBundle({
      cwd: process.cwd(),
      env: {
        DEVICE_ACCESS_SAFETY_REPORT: "",
      },
      now: NOW,
      artifactDir,
      outFile,
    });
    const raw = await readFile(outFile, "utf8");

    assert.equal(bundle.kind, "vallum.roadmap-execution-proof-bundle");
    assert.equal(bundle.status, "blocked");
    assert.equal(bundle.roadmapComplete, false);
    assert.equal(bundle.localProofOk, true);
    assert.equal(bundle.artifactDir, artifactDir);
    assert.deepEqual(bundle.proofBundles.map((artifact) => artifact.id), [
      "identity-proof",
      "package-publication",
      "a2a-public",
      "payment-provider",
      "marketplace-production",
      "custody-production",
      "device-access-safety",
    ]);
    assert.deepEqual(bundle.statusArtifacts.map((artifact) => artifact.id), [
      "product-status",
      "launch-readiness",
      "operator-live-gates",
      "roadmap-completion",
    ]);
    assert.ok(bundle.blockerCodes.includes("DEVICE_ACCESS_SAFETY_REPORT_MISSING"));
    assert.ok(bundle.nextCommands.some((command) => command.includes("device-access:write-safety-proof-bundle")));
    assert.equal(bundle.steps.some((step) => step.id === "write-device-access-safety-proof-bundle"), true);
    assert.equal(bundle.steps.find((step) => step.id === "write-roadmap-completion-audit")?.contactsLiveService, false);
    assert.equal(bundle.steps.find((step) => step.id === "run-operator-approved-remaining-proof")?.requiresOperatorApproval, true);

    await assertMode(outFile, 0o600);
    for (const artifact of [...bundle.statusArtifacts, ...bundle.proofBundles]) {
      await assertMode(artifact.path, 0o600);
    }

    assert.doesNotMatch(
      raw,
      /fake-testnet-sponsor-key|fake-gas-station-auth|fake-upstream-bearer|iotaprivkey|rawTransactionBytes|userSignature=|local-secret|\.env=/i,
    );
  } finally {
    await rm(artifactDir, { recursive: true, force: true });
  }
});

async function assertMode(path: string, expected: number): Promise<void> {
  const mode = (await stat(path)).mode & 0o777;
  assert.equal(mode, expected);
}
