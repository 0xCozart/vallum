import assert from "node:assert/strict";
import { readFile, rm, stat } from "node:fs/promises";
import test from "node:test";

import { writeBlockerResolutionPlan } from "./write-blocker-resolution-plan.js";

const NOW = new Date("2026-06-17T12:00:00.000Z");

test("blocker resolution plan composes remaining proof bundles without exposing configured values", async () => {
  const artifactDir = `tmp/vallum/blocker-resolution-test-${process.pid}-${Date.now()}`;
  const outFile = `${artifactDir}/blocker-resolution-plan.json`;
  try {
    const plan = await writeBlockerResolutionPlan({
      cwd: process.cwd(),
      env: {
        A2A_PUBLIC_AGENT_CARD_URL: "https://agent.example/.well-known/agent-card.json",
        DEVICE_ACCESS_SAFETY_REPORT: "",
      },
      now: NOW,
      artifactDir,
      outFile,
    });
    const raw = await readFile(outFile, "utf8");

    assert.equal(plan.kind, "vallum.blocker-resolution-plan");
    assert.equal(plan.generatedAt, NOW.toISOString());
    assert.equal(plan.status, "blocked");
    assert.equal(plan.roadmapComplete, false);
    assert.equal(plan.localProofOk, true);
    assert.equal(plan.roadmapBundlePath, `${artifactDir}/roadmap-execution-proof-bundle.json`);
    assert.ok(plan.blockerCodes.length > 0);
    assert.ok(plan.nextCommands.includes("npm run proof:product-status"));
    assert.ok(plan.nextCommands.includes("npm run proof:launch-readiness"));

    const a2a = group(plan.blockerGroups, "a2a-public");
    assert.ok(a2a.requiredOperatorInputs.includes("A2A_PUBLIC_AGENT_CARD_URL"));
    assert.ok(a2a.acceptedReportEnvs.includes("A2A_PUBLIC_DISCOVERY_REPORT"));
    assert.ok(a2a.acceptedReportEnvs.includes("A2A_EXTERNAL_CONFORMANCE_REPORT"));
    assert.ok(a2a.conditionalOperatorInputs.some((input) => input.input === "A2A_PUBLIC_TASK_BEARER_TOKEN"));
    assert.ok(a2a.approvalRequiredCommands.some((command) => command.includes("smoke:a2a-public-discovery")));
    assert.ok(a2a.nonNetworkedCommands.some((command) => command.includes("a2a:write-public-proof-plan")));

    const payment = group(plan.blockerGroups, "payment-provider");
    assert.ok(payment.requiredOperatorInputs.includes("PAYMENT_PROVIDER_LIVE_REPORT"));
    assert.ok(payment.requiredEvidenceArtifacts.includes("x402 facilitator verify result"));
    assert.ok(payment.conditionalOperatorInputs.some((input) => input.input === "PAYMENT_PROVIDER_AUTH_BEARER_TOKEN"));
    assert.ok(payment.approvalRequiredCommands.some((command) => command.includes("smoke:payment-provider-live")));

    const marketplace = group(plan.blockerGroups, "marketplace-production");
    assert.ok(marketplace.requiredStructuredReportFields.includes("providerReview"));

    const custody = group(plan.blockerGroups, "custody-production");
    assert.ok(custody.requiredStructuredReportFields.includes("signerReferenceReview"));

    const deviceAccess = group(plan.blockerGroups, "device-access-safety");
    assert.ok(deviceAccess.requiredStructuredReportFields.includes("hazardReview"));

    await assertMode(outFile, 0o600);
    await assertMode(plan.roadmapBundlePath, 0o600);
    assert.doesNotMatch(
      raw,
      /agent\.example|rawTransactionBytes|userSignature=|local-secret|\.env=/i,
    );
  } finally {
    await rm(artifactDir, { recursive: true, force: true });
  }
});

function group(groups: readonly { readonly id: string }[], id: string) {
  const found = groups.find((candidate) => candidate.id === id);
  assert.ok(found, `expected blocker group ${id}`);
  return found as typeof found & {
    readonly acceptedReportEnvs: readonly string[];
    readonly requiredOperatorInputs: readonly string[];
    readonly conditionalOperatorInputs: readonly { readonly input: string }[];
    readonly requiredStructuredReportFields: readonly string[];
    readonly requiredEvidenceArtifacts: readonly string[];
    readonly nonNetworkedCommands: readonly string[];
    readonly approvalRequiredCommands: readonly string[];
  };
}

async function assertMode(path: string, expected: number): Promise<void> {
  const mode = (await stat(path)).mode & 0o777;
  assert.equal(mode, expected);
}
