import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  formatA2APublicProofPlan,
  writeA2APublicProofPlan,
} from "./write-a2a-public-proof-plan.js";

const NOW = new Date("2026-06-11T12:00:00.000Z");

test("A2A public proof plan reports current blockers without configured values", async () => {
  const cwd = await writeA2AEvidence();
  try {
    const plan = await writeA2APublicProofPlan({
      cwd,
      now: NOW,
      scripts: completeScripts(),
      env: {
        A2A_PUBLIC_AGENT_CARD_URL: "https://agents.example/.well-known/agent-card.json",
        A2A_PUBLIC_BASE_URL: "https://agents.example/a2a",
        A2A_PUBLIC_JWKS_URL: "https://agents.example/.well-known/jwks.json",
        A2A_PUBLIC_TASK_AUTH_DECISION: "oauth2",
        A2A_PUBLIC_DISCOVERY_REPORT: "missing-discovery-report.json",
        A2A_PUBLIC_PUSH_DELIVERY_REPORT: "missing-push-report.json",
        A2A_EXTERNAL_CONFORMANCE_REPORT: "missing-conformance-report.json",
      },
    });
    const formatted = formatA2APublicProofPlan(plan);

    assert.equal(plan.schemaVersion, 1);
    assert.equal(plan.kind, "vallum.a2a-public-proof-plan");
    assert.equal(plan.status, "blocked");
    assert.equal(plan.localProofOk, true);
    assert.equal(plan.publicReady, false);
    assert.ok(plan.blockerCodes.includes("A2A_PUBLIC_DISCOVERY_REPORT_NOT_FOUND"));
    assert.ok(plan.blockerCodes.includes("A2A_PUBLIC_PUSH_DELIVERY_REPORT_NOT_FOUND"));
    assert.ok(plan.blockerCodes.includes("A2A_EXTERNAL_CONFORMANCE_REPORT_NOT_FOUND"));
    assert.ok(plan.readyApprovalCodes.includes("A2A_PUBLIC_TASK_AUTH_DECISION_PRESENT"));
    assert.ok(plan.requiredOperatorInputs.includes("A2A_PUBLIC_DISCOVERY_REPORT"));
    assert.ok(plan.commands.some((command) => command.id === "write-static-hosting-review" && !command.contactsPublicNetwork));
    assert.ok(plan.commands.some((command) => command.id === "smoke-public-discovery" && command.contactsPublicNetwork));
    assert.doesNotMatch(formatted, /agents\.example|oauth2|missing-discovery-report|missing-push-report|missing-conformance-report/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public proof plan can write a redacted local JSON artifact", async () => {
  const cwd = await writeA2AEvidence();
  try {
    const plan = await writeA2APublicProofPlan({
      cwd,
      now: NOW,
      outFile: "tmp/vallum/a2a-public-proof-plan.json",
      scripts: completeScripts(),
      env: {},
    });
    const raw = await readFile(join(cwd, "tmp/vallum/a2a-public-proof-plan.json"), "utf8");
    const written = JSON.parse(raw) as typeof plan;

    assert.equal(written.kind, "vallum.a2a-public-proof-plan");
    assert.equal(written.status, "blocked");
    assert.deepEqual(written.blockerCodes, plan.blockerCodes);
    assert.ok(written.blockerCodes.includes("A2A_PUBLIC_AGENT_CARD_URL_MISSING"));
    assert.doesNotMatch(raw, /agents\.example|missing-discovery-report|missing-push-report|missing-conformance-report/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

async function writeA2AEvidence(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-a2a-proof-plan-"));
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

function completeScripts(): Record<string, string> {
  return {
    "verify:local": [
      "npm run smoke:a2a-well-known",
      "npm run smoke:a2a-signed-card",
      "npm run smoke:a2a-task-message",
      "npm run smoke:a2a-http",
      "npm run smoke:a2a-local-server",
    ].join(" && "),
  };
}
