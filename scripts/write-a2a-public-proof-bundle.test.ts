import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { writeA2APublicProofBundle } from "./write-a2a-public-proof-bundle.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

test("A2A public proof bundle writes templates, plan, and blocked summary without configured values", async () => {
  const cwd = await writeA2AEvidence();
  try {
    const bundle = await writeA2APublicProofBundle({
      cwd,
      now: NOW,
      scripts: completeScripts(),
      env: configuredA2AEnv({
        A2A_PUBLIC_DISCOVERY_REPORT: "missing-discovery-report.json",
        A2A_PUBLIC_PUSH_DELIVERY_REPORT: "missing-push-report.json",
        A2A_EXTERNAL_CONFORMANCE_REPORT: "missing-conformance-report.json",
      }),
    });
    const bundleRaw = await readFile(join(cwd, "tmp/vallum/a2a-public-proof-bundle.json"), "utf8");
    const planRaw = await readFile(join(cwd, "tmp/vallum/a2a-public-proof-plan.json"), "utf8");
    const readinessRaw = await readFile(join(cwd, "tmp/vallum/a2a-public-readiness.json"), "utf8");

    assert.equal(bundle.kind, "vallum.a2a-public-proof-bundle");
    assert.equal(bundle.status, "blocked");
    assert.equal(bundle.localProofOk, true);
    assert.equal(bundle.publicReady, false);
    assert.deepEqual(bundle.templateArtifacts.map((template) => template.id), [
      "a2a-public-discovery",
      "a2a-public-push-delivery",
      "a2a-external-conformance",
    ]);
    assert.equal(bundle.planArtifact, "tmp/vallum/a2a-public-proof-plan.json");
    assert.equal(bundle.readinessArtifact, "tmp/vallum/a2a-public-readiness.json");
    assert.ok(bundle.blockerCodes.includes("A2A_PUBLIC_DISCOVERY_REPORT_NOT_FOUND"));
    assert.ok(bundle.blockerCodes.includes("A2A_PUBLIC_PUSH_DELIVERY_REPORT_NOT_FOUND"));
    assert.ok(bundle.blockerCodes.includes("A2A_EXTERNAL_CONFORMANCE_REPORT_NOT_FOUND"));
    assert.ok(bundle.readyApprovalCodes.includes("A2A_PUBLIC_AGENT_CARD_URL_CONFIG_PRESENT"));
    assert.ok(bundle.readyApprovalCodes.includes("A2A_PUBLIC_TASK_AUTH_DECISION_PRESENT"));
    assert.ok(bundle.requiredOperatorInputs.includes("A2A_PUBLIC_DISCOVERY_REPORT"));
    assert.ok(bundle.requiredEvidenceArtifacts.includes("sanitized external A2A conformance report"));
    assert.equal(bundle.steps.find((step) => step.id === "run-public-discovery-smoke")?.contactsPublicNetwork, true);
    assert.equal(bundle.steps.find((step) => step.id === "run-public-push-delivery-smoke")?.contactsPublicNetwork, true);
    assert.equal(bundle.steps.find((step) => step.id === "write-public-proof-plan")?.contactsPublicNetwork, false);

    await assertMode(join(cwd, "tmp/vallum/a2a-public-proof-bundle.json"), 0o600);
    await assertMode(join(cwd, "tmp/vallum/a2a-public-proof-plan.json"), 0o600);
    await assertMode(join(cwd, "tmp/vallum/a2a-public-readiness.json"), 0o600);
    await assertMode(join(cwd, "tmp/vallum/a2a-public-discovery-report-template.json"), 0o600);
    await assertMode(join(cwd, "tmp/vallum/a2a-public-push-delivery-report-template.json"), 0o600);
    await assertMode(join(cwd, "tmp/vallum/a2a-external-conformance-report-template.json"), 0o600);

    const allOutput = `${JSON.stringify(bundle)}\n${bundleRaw}\n${planRaw}\n${readinessRaw}`;
    assert.doesNotMatch(allOutput, /agents\.example/);
    assert.doesNotMatch(allOutput, /oauth2/);
    assert.doesNotMatch(allOutput, /missing-discovery-report|missing-push-report|missing-conformance-report/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public proof bundle is ready for approval when public reports pass", async () => {
  const cwd = await writeA2AEvidence();
  try {
    await writeJsonReport(join(cwd, "a2a-public-discovery-report.json"), publicDiscoveryReport());
    await writeJsonReport(join(cwd, "a2a-public-push-report.json"), {
      schemaVersion: 1,
      kind: "a2a-public-push-delivery",
      result: "passed",
      observedAt: NOW.toISOString(),
      publicBaseUrl: "https://agents.example/a2a",
      callbackStatus: 202,
      attempts: 1,
    });
    await writeJsonReport(join(cwd, "a2a-conformance-report.json"), {
      schemaVersion: 1,
      kind: "a2a-external-conformance",
      result: "passed",
      observedAt: NOW.toISOString(),
      publicAgentCardUrl: "https://agents.example/.well-known/agent-card.json",
      publicBaseUrl: "https://agents.example/a2a",
      checks: ["agent-card", "task-route"],
    });

    const bundle = await writeA2APublicProofBundle({
      cwd,
      now: NOW,
      scripts: completeScripts(),
      env: configuredA2AEnv({
        A2A_PUBLIC_DISCOVERY_REPORT: "a2a-public-discovery-report.json",
        A2A_PUBLIC_PUSH_DELIVERY_REPORT: "a2a-public-push-report.json",
        A2A_EXTERNAL_CONFORMANCE_REPORT: "a2a-conformance-report.json",
      }),
    });
    const bundleRaw = await readFile(join(cwd, "tmp/vallum/a2a-public-proof-bundle.json"), "utf8");

    assert.equal(bundle.status, "ready-for-approval");
    assert.equal(bundle.publicReady, true);
    assert.deepEqual(bundle.blockerCodes, []);
    assert.ok(bundle.readyApprovalCodes.includes("A2A_PUBLIC_DISCOVERY_REPORT_VALID"));
    assert.ok(bundle.readyApprovalCodes.includes("A2A_PUBLIC_PUSH_DELIVERY_REPORT_VALID"));
    assert.ok(bundle.readyApprovalCodes.includes("A2A_EXTERNAL_CONFORMANCE_REPORT_VALID"));
    assert.equal(bundle.checks.find((check) => check.id === "public-discovery")?.status, "ready-approval");
    assert.equal(bundle.checks.find((check) => check.id === "public-push-delivery")?.status, "ready-approval");
    assert.equal(bundle.checks.find((check) => check.id === "external-conformance")?.status, "ready-approval");
    assert.doesNotMatch(bundleRaw, /agents\.example|oauth2/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

function configuredA2AEnv(extra: Record<string, string>): Record<string, string> {
  return {
    A2A_PUBLIC_AGENT_CARD_URL: "https://agents.example/.well-known/agent-card.json",
    A2A_PUBLIC_BASE_URL: "https://agents.example/a2a",
    A2A_PUBLIC_JWKS_URL: "https://agents.example/.well-known/jwks.json",
    A2A_PUBLIC_TASK_AUTH_DECISION: "oauth2",
    ...extra,
  };
}

async function writeA2AEvidence(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-a2a-proof-bundle-"));
  for (const path of [
    "packages/registry/src/a2aCard.ts",
    "packages/registry/src/a2aWellKnown.ts",
    "packages/registry/src/a2aJwks.ts",
    "packages/registry/src/a2aDiscoveryBundle.ts",
    "packages/standards/src/a2a.ts",
    "packages/standards/src/a2aHttp.ts",
    "packages/standards/src/a2aNodeServer.ts",
    "packages/standards/src/a2aPush.ts",
    "scripts/check-a2a-static-discovery-bundle.ts",
    "scripts/smoke-a2a-static-discovery-local.ts",
    "scripts/write-a2a-static-discovery-bundle.ts",
    "scripts/write-a2a-static-hosting-review.ts",
    "scripts/smoke-a2a-local-server.ts",
  ]) {
    await mkdir(dirname(join(cwd, path)), { recursive: true });
    await writeFile(join(cwd, path), "export {};\n");
  }
  return cwd;
}

async function writeJsonReport(path: string, report: Record<string, unknown>): Promise<void> {
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
}

function publicDiscoveryReport(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: "a2a-public-discovery",
    result: "passed",
    observedAt: NOW.toISOString(),
    publicAgentCardUrl: "https://agents.example/.well-known/agent-card.json",
    publicBaseUrl: "https://agents.example/a2a",
    publicJwksUrl: "https://agents.example/.well-known/jwks.json",
    taskAuthDecision: "oauth2",
    checks: ["public-config", "public-agent-card", "public-jwks"],
  };
}

function completeScripts(): Record<string, string | undefined> {
  return {
    "verify:local": [
      "npm test",
      "npm run smoke:a2a-well-known",
      "npm run smoke:a2a-signed-card",
      "npm run smoke:a2a-task-message",
      "npm run smoke:a2a-http",
      "npm run smoke:a2a-local-server",
    ].join(" && "),
  };
}

async function assertMode(path: string, expected: number): Promise<void> {
  const mode = (await stat(path)).mode & 0o777;
  assert.equal(mode, expected);
}
