import assert from "node:assert/strict";
import { readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { writeRoadmapExecutionProofBundle } from "./write-roadmap-execution-proof-bundle.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

test("roadmap execution proof bundle writes all remaining proof artifacts without running live proofs", async () => {
  const artifactDir = `tmp/agentrail/roadmap-execution-test-${process.pid}-${Date.now()}`;
  const outFile = `${artifactDir}/roadmap-execution-proof-bundle.json`;
  try {
    const bundle = await writeRoadmapExecutionProofBundle({
      cwd: process.cwd(),
      now: NOW,
      artifactDir,
      outFile,
    });
    const raw = await readFile(outFile, "utf8");

    assert.equal(bundle.kind, "agentrail.roadmap-execution-proof-bundle");
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
    ]);
    assert.deepEqual(bundle.statusArtifacts.map((artifact) => artifact.id), [
      "product-status",
      "launch-readiness",
      "operator-live-gates",
      "roadmap-completion",
    ]);
    assert.ok(bundle.blockerCodes.includes("IOTA_NAMES_LIVE_CONFIG_MISSING"));
    assert.ok(bundle.blockerCodes.includes("NPM_PUBLICATION_UNRUN"));
    assert.ok(bundle.nextCommands.some((command) => command.includes("live:write-identity-proof-bundle")));
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
