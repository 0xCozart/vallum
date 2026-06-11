import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  checkA2APublicReadiness,
  formatA2APublicReadinessReport,
} from "./check-a2a-public-readiness.js";

const NOW = new Date("2026-06-11T12:00:00.000Z");

test("A2A public readiness reports local proof while public gates remain blocked", async () => {
  const cwd = await writeA2AEvidence();
  try {
    const report = await checkA2APublicReadiness({ cwd, env: {}, scripts: completeScripts(), now: NOW });
    const formatted = formatA2APublicReadinessReport(report);

    assert.equal(report.localProofOk, true);
    assert.equal(report.publicReady, false);
    assert.equal(findCheck(report, "local-a2a-proof").status, "proven-local");
    assert.equal(findCheck(report, "public-agent-card-url").code, "A2A_PUBLIC_AGENT_CARD_URL_MISSING");
    assert.equal(findCheck(report, "extended-agent-card").status, "proven-local");
    assert.equal(findCheck(report, "extended-agent-card").code, "A2A_EXTENDED_AGENT_CARD_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "streaming").status, "proven-local");
    assert.equal(findCheck(report, "streaming").code, "A2A_STREAMING_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "push-notification-configs").status, "proven-local");
    assert.equal(findCheck(report, "push-notification-configs").code, "A2A_PUSH_CONFIG_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "local-push-delivery").status, "proven-local");
    assert.equal(findCheck(report, "local-push-delivery").code, "A2A_PUSH_DELIVERY_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "local-push-http-transport").status, "proven-local");
    assert.equal(findCheck(report, "local-push-http-transport").code, "A2A_PUSH_HTTP_TRANSPORT_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "local-push-retry-observability").status, "proven-local");
    assert.equal(findCheck(report, "local-push-retry-observability").code, "A2A_PUSH_RETRY_OBSERVABILITY_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "public-push-delivery").status, "blocked-conformance");
    assert.equal(findCheck(report, "public-push-delivery").code, "A2A_PUBLIC_PUSH_DELIVERY_REPORT_MISSING");
    assert.equal(findCheck(report, "external-conformance").code, "A2A_EXTERNAL_CONFORMANCE_REPORT_MISSING");
    assert.match(formatted, /Agentic GasKit A2A public readiness blocked/);
    assert.doesNotMatch(formatted, /secret|token|private/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public readiness fails local proof when commands or source evidence are missing", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-a2a-readiness-"));
  try {
    const report = await checkA2APublicReadiness({
      cwd,
      env: {},
      scripts: { "verify:local": "npm test && npm run smoke:a2a-well-known" },
      now: NOW,
    });
    const local = findCheck(report, "local-a2a-proof");

    assert.equal(report.localProofOk, false);
    assert.equal(local.status, "blocked-local");
    assert.equal(local.code, "A2A_LOCAL_PROOF_INCOMPLETE");
    assert.match(local.evidence ?? "", /npm run smoke:a2a-signed-card/);
    assert.match(local.evidence ?? "", /packages\/standards\/src\/a2aHttp\.ts/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public readiness rejects unsafe public URLs without printing them", async () => {
  const cwd = await writeA2AEvidence();
  try {
    const report = await checkA2APublicReadiness({
      cwd,
      scripts: completeScripts(),
      env: {
        A2A_PUBLIC_AGENT_CARD_URL: "http://localhost/.well-known/agent-card.json",
        A2A_PUBLIC_BASE_URL: "https://127.0.0.1/a2a",
        A2A_PUBLIC_JWKS_URL: "https://keys.localhost/jwks.json",
        A2A_PUBLIC_TASK_AUTH_DECISION: "query-token-secret",
        A2A_PUBLIC_PUSH_DELIVERY_REPORT: "missing-push-secret-report.txt",
        A2A_EXTERNAL_CONFORMANCE_REPORT: "missing-secret-report.txt",
      },
      now: NOW,
    });
    const formatted = formatA2APublicReadinessReport(report);

    assert.equal(findCheck(report, "public-agent-card-url").code, "A2A_PUBLIC_AGENT_CARD_URL_UNSAFE");
    assert.equal(findCheck(report, "public-base-url").code, "A2A_PUBLIC_BASE_URL_UNSAFE");
    assert.equal(findCheck(report, "production-jwks-url").code, "A2A_PUBLIC_JWKS_URL_UNSAFE");
    assert.equal(findCheck(report, "task-auth-decision").code, "A2A_PUBLIC_TASK_AUTH_DECISION_UNSUPPORTED");
    assert.equal(findCheck(report, "public-push-delivery").code, "A2A_PUBLIC_PUSH_DELIVERY_REPORT_NOT_FOUND");
    assert.equal(findCheck(report, "external-conformance").code, "A2A_EXTERNAL_CONFORMANCE_REPORT_NOT_FOUND");
    assert.doesNotMatch(
      formatted,
      /localhost|127\.0\.0\.1|keys\.localhost|query-token-secret|missing-push-secret-report|missing-secret-report/,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public readiness accepts redacted public config and existing conformance report", async () => {
  const cwd = await writeA2AEvidence();
  try {
    await writeJsonReport(join(cwd, "a2a-conformance-report.json"), {
      schemaVersion: 1,
      kind: "a2a-external-conformance",
      result: "passed",
      observedAt: NOW.toISOString(),
      publicAgentCardUrl: "https://agents.example/.well-known/agent-card.json",
      publicBaseUrl: "https://agents.example/a2a",
      checks: ["agent-card", "task-route"],
    });
    const report = await checkA2APublicReadiness({
      cwd,
      scripts: completeScripts(),
      env: {
        A2A_PUBLIC_AGENT_CARD_URL: "https://agents.example/.well-known/agent-card.json",
        A2A_PUBLIC_BASE_URL: "https://agents.example/a2a",
        A2A_PUBLIC_JWKS_URL: "https://agents.example/.well-known/jwks.json",
        A2A_PUBLIC_TASK_AUTH_DECISION: "oauth2",
        A2A_EXTERNAL_CONFORMANCE_REPORT: "a2a-conformance-report.json",
      },
      now: NOW,
    });
    const formatted = formatA2APublicReadinessReport(report);

    assert.equal(report.localProofOk, true);
    assert.equal(report.publicReady, false, "public push webhook delivery proof is still missing");
    assert.equal(findCheck(report, "public-agent-card-url").status, "ready-approval");
    assert.equal(findCheck(report, "public-base-url").status, "ready-approval");
    assert.equal(findCheck(report, "production-jwks-url").status, "ready-approval");
    assert.equal(findCheck(report, "task-auth-decision").status, "ready-approval");
    assert.equal(findCheck(report, "external-conformance").status, "ready-approval");
    assert.equal(findCheck(report, "external-conformance").code, "A2A_EXTERNAL_CONFORMANCE_REPORT_VALID");
    assert.equal(findCheck(report, "extended-agent-card").status, "proven-local");
    assert.equal(findCheck(report, "streaming").status, "proven-local");
    assert.equal(findCheck(report, "push-notification-configs").status, "proven-local");
    assert.equal(findCheck(report, "local-push-delivery").status, "proven-local");
    assert.equal(findCheck(report, "local-push-http-transport").status, "proven-local");
    assert.equal(findCheck(report, "local-push-retry-observability").status, "proven-local");
    assert.equal(findCheck(report, "public-push-delivery").status, "blocked-conformance");
    assert.equal(findCheck(report, "public-push-delivery").code, "A2A_PUBLIC_PUSH_DELIVERY_REPORT_MISSING");
    assert.doesNotMatch(formatted, /agents\.example|a2a-conformance-report|oauth2/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public readiness accepts redacted public push delivery evidence after approved proof", async () => {
  const cwd = await writeA2AEvidence();
  try {
    await writeJsonReport(join(cwd, "a2a-conformance-report.json"), {
      schemaVersion: 1,
      kind: "a2a-external-conformance",
      result: "passed",
      observedAt: NOW.toISOString(),
      publicAgentCardUrl: "https://agents.example/.well-known/agent-card.json",
      publicBaseUrl: "https://agents.example/a2a",
      checks: ["agent-card", "task-route"],
    });
    await writeJsonReport(join(cwd, "a2a-public-push-report.json"), {
      schemaVersion: 1,
      kind: "a2a-public-push-delivery",
      result: "passed",
      observedAt: NOW.toISOString(),
      publicBaseUrl: "https://agents.example/a2a",
      callbackStatus: 202,
      attempts: 1,
    });
    const report = await checkA2APublicReadiness({
      cwd,
      scripts: completeScripts(),
      env: {
        A2A_PUBLIC_AGENT_CARD_URL: "https://agents.example/.well-known/agent-card.json",
        A2A_PUBLIC_BASE_URL: "https://agents.example/a2a",
        A2A_PUBLIC_JWKS_URL: "https://agents.example/.well-known/jwks.json",
        A2A_PUBLIC_TASK_AUTH_DECISION: "oauth2",
        A2A_PUBLIC_PUSH_DELIVERY_REPORT: "a2a-public-push-report.json",
        A2A_EXTERNAL_CONFORMANCE_REPORT: "a2a-conformance-report.json",
      },
      now: NOW,
    });
    const formatted = formatA2APublicReadinessReport(report);

    assert.equal(report.localProofOk, true);
    assert.equal(report.publicReady, true);
    assert.match(formatted, /Agentic GasKit A2A public readiness ready-for-approval/);
    assert.equal(findCheck(report, "public-push-delivery").status, "ready-approval");
    assert.equal(findCheck(report, "public-push-delivery").code, "A2A_PUBLIC_PUSH_DELIVERY_REPORT_VALID");
    assert.equal(findCheck(report, "external-conformance").status, "ready-approval");
    assert.doesNotMatch(formatted, /agents\.example|a2a-public-push-report|a2a-conformance-report|oauth2/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public readiness rejects malformed or endpoint-mismatched structured reports", async () => {
  const cwd = await writeA2AEvidence();
  try {
    await writeFile(join(cwd, "a2a-conformance-report.json"), "passed external client checks\n");
    await writeJsonReport(join(cwd, "a2a-public-push-report.json"), {
      schemaVersion: 1,
      kind: "a2a-public-push-delivery",
      result: "passed",
      observedAt: NOW.toISOString(),
      publicBaseUrl: "https://other.example/a2a",
    });
    const report = await checkA2APublicReadiness({
      cwd,
      scripts: completeScripts(),
      env: {
        A2A_PUBLIC_AGENT_CARD_URL: "https://agents.example/.well-known/agent-card.json",
        A2A_PUBLIC_BASE_URL: "https://agents.example/a2a",
        A2A_PUBLIC_JWKS_URL: "https://agents.example/.well-known/jwks.json",
        A2A_PUBLIC_TASK_AUTH_DECISION: "oauth2",
        A2A_PUBLIC_PUSH_DELIVERY_REPORT: "a2a-public-push-report.json",
        A2A_EXTERNAL_CONFORMANCE_REPORT: "a2a-conformance-report.json",
      },
      now: NOW,
    });
    const formatted = formatA2APublicReadinessReport(report);

    assert.equal(report.publicReady, false);
    assert.equal(
      findCheck(report, "public-push-delivery").code,
      "A2A_PUBLIC_PUSH_DELIVERY_REPORT_PUBLIC_BASE_URL_MISMATCH",
    );
    assert.equal(findCheck(report, "external-conformance").code, "A2A_EXTERNAL_CONFORMANCE_REPORT_INVALID_JSON");
    assert.doesNotMatch(formatted, /agents\.example|other\.example|a2a-public-push-report|a2a-conformance-report/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public readiness rejects stale structured reports", async () => {
  const cwd = await writeA2AEvidence();
  try {
    await writeJsonReport(join(cwd, "a2a-conformance-report.json"), {
      schemaVersion: 1,
      kind: "a2a-external-conformance",
      result: "passed",
      observedAt: "2026-04-01T12:00:00.000Z",
      publicAgentCardUrl: "https://agents.example/.well-known/agent-card.json",
      publicBaseUrl: "https://agents.example/a2a",
    });
    const report = await checkA2APublicReadiness({
      cwd,
      scripts: completeScripts(),
      env: {
        A2A_PUBLIC_AGENT_CARD_URL: "https://agents.example/.well-known/agent-card.json",
        A2A_PUBLIC_BASE_URL: "https://agents.example/a2a",
        A2A_PUBLIC_JWKS_URL: "https://agents.example/.well-known/jwks.json",
        A2A_PUBLIC_TASK_AUTH_DECISION: "oauth2",
        A2A_EXTERNAL_CONFORMANCE_REPORT: "a2a-conformance-report.json",
      },
      now: NOW,
    });
    const formatted = formatA2APublicReadinessReport(report);

    assert.equal(report.publicReady, false);
    assert.equal(
      findCheck(report, "external-conformance").code,
      "A2A_EXTERNAL_CONFORMANCE_REPORT_STALE_OR_INVALID_TIME",
    );
    assert.doesNotMatch(formatted, /agents\.example|a2a-conformance-report/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

function findCheck(
  report: Awaited<ReturnType<typeof checkA2APublicReadiness>>,
  id: string,
) {
  const check = report.checks.find((candidate) => candidate.id === id);
  assert.ok(check, `expected ${id} check`);
  return check;
}

async function writeA2AEvidence(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-a2a-readiness-"));
  for (const path of [
    "packages/registry/src/a2aCard.ts",
    "packages/registry/src/a2aWellKnown.ts",
    "packages/standards/src/a2a.ts",
    "packages/standards/src/a2aHttp.ts",
    "packages/standards/src/a2aNodeServer.ts",
    "packages/standards/src/a2aPush.ts",
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
