import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  buildA2APublicReadinessArtifact,
  checkA2APublicReadiness,
  formatA2APublicReadinessArtifact,
  formatA2APublicReadinessReport,
  writeA2APublicReadinessArtifact,
} from "./check-a2a-public-readiness.js";

const NOW = new Date("2026-06-11T12:00:00.000Z");

test("A2A public readiness reports local proof while public gates remain blocked", async () => {
  const cwd = await writeA2AEvidence();
  try {
    const report = await checkA2APublicReadiness({ cwd, env: {}, scripts: completeScripts(), now: NOW });
    const formatted = formatA2APublicReadinessReport(report);
    const artifact = buildA2APublicReadinessArtifact(report, NOW);
    const artifactJson = formatA2APublicReadinessArtifact(artifact);

    assert.equal(report.localProofOk, true);
    assert.equal(report.publicReady, false);
    assert.equal(artifact.kind, "vallum.a2a-public-readiness-report");
    assert.equal(artifact.localProofOk, true);
    assert.equal(artifact.publicReady, false);
    assert.ok(artifact.provenLocalCheckIds.includes("local-a2a-proof"));
    assert.ok(artifact.blockedCheckIds.includes("public-agent-card-url"));
    assert.ok(artifact.blockerCodes.includes("A2A_PUBLIC_DISCOVERY_REPORT_MISSING"));
    assert.doesNotMatch(
      artifactJson,
      /agents\.example|a2a-conformance-report|query-token-secret|missing-secret-report|0x[0-9a-fA-F]{64}/,
    );
    assert.equal(findCheck(report, "local-a2a-proof").status, "proven-local");
    assert.equal(findCheck(report, "local-public-jwks-hosting").status, "proven-local");
    assert.equal(findCheck(report, "local-public-jwks-hosting").code, "A2A_PUBLIC_JWKS_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "local-static-discovery-bundle").status, "proven-local");
    assert.equal(findCheck(report, "local-static-discovery-bundle").code, "A2A_STATIC_DISCOVERY_BUNDLE_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "local-static-discovery-artifact-writer").status, "proven-local");
    assert.equal(findCheck(report, "local-static-discovery-artifact-writer").code, "A2A_STATIC_DISCOVERY_ARTIFACT_WRITER_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "local-static-discovery-artifact-validator").status, "proven-local");
    assert.equal(findCheck(report, "local-static-discovery-artifact-validator").code, "A2A_STATIC_DISCOVERY_ARTIFACT_VALIDATOR_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "local-static-discovery-host-smoke").status, "proven-local");
    assert.equal(findCheck(report, "local-static-discovery-host-smoke").code, "A2A_STATIC_DISCOVERY_LOCAL_HOST_SMOKE_CONFIGURED");
    assert.equal(findCheck(report, "local-static-hosting-review").status, "proven-local");
    assert.equal(findCheck(report, "local-static-hosting-review").code, "A2A_STATIC_HOSTING_REVIEW_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "local-public-proof-plan").status, "proven-local");
    assert.equal(findCheck(report, "local-public-proof-plan").code, "A2A_PUBLIC_PROOF_PLAN_LOCAL_PROOF_CONFIGURED");
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
    assert.equal(findCheck(report, "local-push-callback-url-hardening").status, "proven-local");
    assert.equal(findCheck(report, "local-push-callback-url-hardening").code, "A2A_PUSH_CALLBACK_URL_HARDENING_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "local-push-callback-host-allowlist").status, "proven-local");
    assert.equal(findCheck(report, "local-push-callback-host-allowlist").code, "A2A_PUSH_CALLBACK_HOST_ALLOWLIST_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "local-push-retry-observability").status, "proven-local");
    assert.equal(findCheck(report, "local-push-retry-observability").code, "A2A_PUSH_RETRY_OBSERVABILITY_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "local-push-durable-attempt-evidence").status, "proven-local");
    assert.equal(findCheck(report, "local-push-durable-attempt-evidence").code, "A2A_PUSH_DURABLE_ATTEMPT_EVIDENCE_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "local-push-delivery-queue").status, "proven-local");
    assert.equal(findCheck(report, "local-push-delivery-queue").code, "A2A_PUSH_DELIVERY_QUEUE_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "local-push-delivery-worker").status, "proven-local");
    assert.equal(findCheck(report, "local-push-delivery-worker").code, "A2A_PUSH_DELIVERY_WORKER_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "public-discovery").status, "blocked-conformance");
    assert.equal(findCheck(report, "public-discovery").code, "A2A_PUBLIC_DISCOVERY_REPORT_MISSING");
    assert.equal(findCheck(report, "public-push-delivery").status, "blocked-conformance");
    assert.equal(findCheck(report, "public-push-delivery").code, "A2A_PUBLIC_PUSH_DELIVERY_REPORT_MISSING");
    assert.equal(findCheck(report, "external-conformance").code, "A2A_EXTERNAL_CONFORMANCE_REPORT_MISSING");
    assert.match(formatted, /operator:write-report-template -- --kind a2a-public-discovery/);
    assert.match(formatted, /operator:write-report-template -- --kind a2a-public-push-delivery/);
    assert.match(formatted, /operator:write-report-template -- --kind a2a-external-conformance/);
    assert.match(formatted, /Vallum A2A public readiness blocked/);
    assert.doesNotMatch(formatted, /secret|token|private/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public readiness artifact writer uses restrictive local file permissions", async () => {
  const cwd = await writeA2AEvidence();
  try {
    const outFile = "tmp/vallum/a2a-public-readiness.json";
    const artifact = await writeA2APublicReadinessArtifact({
      cwd,
      env: {},
      scripts: completeScripts(),
      now: NOW,
      outFile,
    });
    const written = JSON.parse(await readFile(join(cwd, outFile), "utf8")) as typeof artifact;
    const mode = (await stat(join(cwd, outFile))).mode & 0o777;

    assert.equal(artifact.kind, "vallum.a2a-public-readiness-report");
    assert.equal(written.kind, "vallum.a2a-public-readiness-report");
    assert.equal(written.publicReady, false);
    assert.equal(written.blockerCodes.includes("A2A_PUBLIC_AGENT_CARD_URL_MISSING"), true);
    assert.equal(mode, 0o600);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public readiness fails local proof when commands or source evidence are missing", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-a2a-readiness-"));
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
        A2A_PUBLIC_DISCOVERY_REPORT: "missing-discovery-secret-report.txt",
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
    assert.equal(findCheck(report, "public-discovery").code, "A2A_PUBLIC_DISCOVERY_REPORT_NOT_FOUND");
    assert.equal(findCheck(report, "public-push-delivery").code, "A2A_PUBLIC_PUSH_DELIVERY_REPORT_NOT_FOUND");
    assert.equal(findCheck(report, "external-conformance").code, "A2A_EXTERNAL_CONFORMANCE_REPORT_NOT_FOUND");
    assert.doesNotMatch(
      formatted,
      /localhost|127\.0\.0\.1|keys\.localhost|query-token-secret|missing-discovery-secret-report|missing-push-secret-report|missing-secret-report/,
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
    assert.equal(findCheck(report, "public-discovery").status, "blocked-conformance");
    assert.equal(findCheck(report, "public-discovery").code, "A2A_PUBLIC_DISCOVERY_REPORT_MISSING");
    assert.equal(findCheck(report, "external-conformance").status, "ready-approval");
    assert.equal(findCheck(report, "external-conformance").code, "A2A_EXTERNAL_CONFORMANCE_REPORT_VALID");
    assert.equal(findCheck(report, "extended-agent-card").status, "proven-local");
    assert.equal(findCheck(report, "streaming").status, "proven-local");
    assert.equal(findCheck(report, "push-notification-configs").status, "proven-local");
    assert.equal(findCheck(report, "local-push-delivery").status, "proven-local");
    assert.equal(findCheck(report, "local-push-http-transport").status, "proven-local");
    assert.equal(findCheck(report, "local-push-callback-url-hardening").status, "proven-local");
    assert.equal(findCheck(report, "local-push-callback-host-allowlist").status, "proven-local");
    assert.equal(findCheck(report, "local-push-retry-observability").status, "proven-local");
    assert.equal(findCheck(report, "local-push-durable-attempt-evidence").status, "proven-local");
    assert.equal(findCheck(report, "local-push-delivery-queue").status, "proven-local");
    assert.equal(findCheck(report, "local-push-delivery-worker").status, "proven-local");
    assert.equal(findCheck(report, "local-public-jwks-hosting").status, "proven-local");
    assert.equal(findCheck(report, "local-static-discovery-bundle").status, "proven-local");
    assert.equal(findCheck(report, "local-static-discovery-artifact-writer").status, "proven-local");
    assert.equal(findCheck(report, "local-static-discovery-artifact-validator").status, "proven-local");
    assert.equal(findCheck(report, "local-static-discovery-host-smoke").status, "proven-local");
    assert.equal(findCheck(report, "local-static-hosting-review").status, "proven-local");
    assert.equal(findCheck(report, "local-public-proof-plan").status, "proven-local");
    assert.equal(findCheck(report, "public-push-delivery").status, "blocked-conformance");
    assert.equal(findCheck(report, "public-push-delivery").code, "A2A_PUBLIC_PUSH_DELIVERY_REPORT_MISSING");
    assert.doesNotMatch(formatted, /agents\.example|a2a-conformance-report|oauth2/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public readiness accepts official A2A TCK compatibility evidence", async () => {
  const cwd = await writeA2AEvidence();
  try {
    await writeJsonReport(join(cwd, "a2a-tck-conformance-report.json"), {
      schemaVersion: 1,
      kind: "a2a-external-conformance",
      result: "passed",
      observedAt: NOW.toISOString(),
      publicAgentCardUrl: "https://agents.example/.well-known/agent-card.json",
      publicBaseUrl: "https://agents.example/a2a",
      checks: ["agent-card", "official-a2a-tck", "http-json-must"],
      runner: "a2a-tck",
      tckCompatibility: officialTckCompatibilityReport(),
    });
    const report = await checkA2APublicReadiness({
      cwd,
      scripts: completeScripts(),
      env: {
        A2A_PUBLIC_AGENT_CARD_URL: "https://agents.example/.well-known/agent-card.json",
        A2A_PUBLIC_BASE_URL: "https://agents.example/a2a",
        A2A_PUBLIC_JWKS_URL: "https://agents.example/.well-known/jwks.json",
        A2A_PUBLIC_TASK_AUTH_DECISION: "bearer",
        A2A_EXTERNAL_CONFORMANCE_REPORT: "a2a-tck-conformance-report.json",
      },
      now: NOW,
    });
    const formatted = formatA2APublicReadinessReport(report);

    assert.equal(findCheck(report, "external-conformance").status, "ready-approval");
    assert.equal(findCheck(report, "external-conformance").code, "A2A_EXTERNAL_CONFORMANCE_REPORT_VALID");
    assert.equal(report.publicReady, false, "public discovery and push delivery proof are still missing");
    assert.doesNotMatch(formatted, /agents\.example|a2a-tck-conformance-report|bearer/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public readiness rejects official A2A TCK evidence with remaining MUST failures", async () => {
  const cwd = await writeA2AEvidence();
  try {
    const baseTck = officialTckCompatibilityReport();
    const baseTckSummary = baseTck.summary as Record<string, unknown>;
    const baseTckRequirements = baseTck.per_requirement as Record<string, unknown>;
    await writeJsonReport(join(cwd, "a2a-tck-conformance-report.json"), {
      schemaVersion: 1,
      kind: "a2a-external-conformance",
      result: "passed",
      observedAt: NOW.toISOString(),
      publicAgentCardUrl: "https://agents.example/.well-known/agent-card.json",
      publicBaseUrl: "https://agents.example/a2a",
      checks: ["agent-card", "official-a2a-tck", "http-json-must"],
      runner: "a2a-tck",
      tckCompatibility: {
        ...baseTck,
        summary: {
          ...baseTckSummary,
          must_compatibility: "99.0%",
        },
        per_transport: {
          "HTTP+JSON": {
            total: 88,
            passed: 73,
            failed: 1,
            skipped: 14,
          },
        },
        per_requirement: {
          ...baseTckRequirements,
          "CORE-SEND-003": {
            level: "MUST",
            status: "FAIL",
            transports: { "HTTP+JSON": "FAIL" },
            errors: ["redacted failure"],
            test_ids: ["test_content_type_not_supported_error_32005"],
          },
        },
      },
    });
    const report = await checkA2APublicReadiness({
      cwd,
      scripts: completeScripts(),
      env: {
        A2A_PUBLIC_AGENT_CARD_URL: "https://agents.example/.well-known/agent-card.json",
        A2A_PUBLIC_BASE_URL: "https://agents.example/a2a",
        A2A_PUBLIC_JWKS_URL: "https://agents.example/.well-known/jwks.json",
        A2A_PUBLIC_TASK_AUTH_DECISION: "bearer",
        A2A_EXTERNAL_CONFORMANCE_REPORT: "a2a-tck-conformance-report.json",
      },
      now: NOW,
    });
    const formatted = formatA2APublicReadinessReport(report);

    assert.equal(report.publicReady, false);
    assert.equal(
      findCheck(report, "external-conformance").code,
      "A2A_EXTERNAL_CONFORMANCE_REPORT_TCK_MUST_COMPATIBILITY_INCOMPLETE",
    );
    assert.doesNotMatch(formatted, /agents\.example|a2a-tck-conformance-report|redacted failure|bearer/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public readiness accepts redacted public push delivery evidence after approved proof", async () => {
  const cwd = await writeA2AEvidence();
  try {
    await writeJsonReport(join(cwd, "a2a-public-discovery-report.json"), publicDiscoveryReport());
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
        A2A_PUBLIC_DISCOVERY_REPORT: "a2a-public-discovery-report.json",
        A2A_PUBLIC_PUSH_DELIVERY_REPORT: "a2a-public-push-report.json",
        A2A_EXTERNAL_CONFORMANCE_REPORT: "a2a-conformance-report.json",
      },
      now: NOW,
    });
    const formatted = formatA2APublicReadinessReport(report);

    assert.equal(report.localProofOk, true);
    assert.equal(report.publicReady, true);
    assert.match(formatted, /Vallum A2A public readiness ready-for-approval/);
    assert.equal(findCheck(report, "public-discovery").status, "ready-approval");
    assert.equal(findCheck(report, "public-discovery").code, "A2A_PUBLIC_DISCOVERY_REPORT_VALID");
    assert.equal(findCheck(report, "public-push-delivery").status, "ready-approval");
    assert.equal(findCheck(report, "public-push-delivery").code, "A2A_PUBLIC_PUSH_DELIVERY_REPORT_VALID");
    assert.equal(findCheck(report, "external-conformance").status, "ready-approval");
    assert.doesNotMatch(formatted, /agents\.example|a2a-public-discovery-report|a2a-public-push-report|a2a-conformance-report|oauth2/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public readiness hydrates public proof evidence from local env", async () => {
  const cwd = await writeA2AEvidence();
  try {
    await writeJsonReport(join(cwd, "a2a-public-discovery-report.json"), publicDiscoveryReport());
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
      callbackStatus: 204,
      attempts: 1,
    });
    await writeFile(join(cwd, ".env"), [
      "A2A_PUBLIC_AGENT_CARD_URL=https://agents.example/.well-known/agent-card.json",
      "A2A_PUBLIC_BASE_URL=https://agents.example/a2a",
      "A2A_PUBLIC_JWKS_URL=https://agents.example/.well-known/jwks.json",
      "A2A_PUBLIC_TASK_AUTH_DECISION=oauth2",
      "A2A_PUBLIC_TASK_BEARER_TOKEN=super-secret-token",
      "A2A_PUBLIC_DISCOVERY_REPORT=a2a-public-discovery-report.json",
      "A2A_PUBLIC_PUSH_DELIVERY_REPORT=a2a-public-push-report.json",
      "A2A_EXTERNAL_CONFORMANCE_REPORT=a2a-conformance-report.json",
      "",
    ].join("\n"));

    const report = await checkA2APublicReadiness({ cwd, scripts: completeScripts(), now: NOW });
    const formatted = formatA2APublicReadinessReport(report);

    assert.equal(report.localProofOk, true);
    assert.equal(report.publicReady, true);
    assert.equal(findCheck(report, "public-discovery").code, "A2A_PUBLIC_DISCOVERY_REPORT_VALID");
    assert.equal(findCheck(report, "public-push-delivery").code, "A2A_PUBLIC_PUSH_DELIVERY_REPORT_VALID");
    assert.equal(findCheck(report, "external-conformance").code, "A2A_EXTERNAL_CONFORMANCE_REPORT_VALID");
    assert.doesNotMatch(
      formatted,
      /agents\.example|a2a-public-discovery-report|a2a-public-push-report|a2a-conformance-report|oauth2|super-secret-token/i,
    );
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
    await writeJsonReport(join(cwd, "a2a-public-discovery-report.json"), {
      ...publicDiscoveryReport(),
      publicJwksUrl: "https://other.example/.well-known/jwks.json",
    });
    const report = await checkA2APublicReadiness({
      cwd,
      scripts: completeScripts(),
      env: {
        A2A_PUBLIC_AGENT_CARD_URL: "https://agents.example/.well-known/agent-card.json",
        A2A_PUBLIC_BASE_URL: "https://agents.example/a2a",
        A2A_PUBLIC_JWKS_URL: "https://agents.example/.well-known/jwks.json",
        A2A_PUBLIC_TASK_AUTH_DECISION: "oauth2",
        A2A_PUBLIC_DISCOVERY_REPORT: "a2a-public-discovery-report.json",
        A2A_PUBLIC_PUSH_DELIVERY_REPORT: "a2a-public-push-report.json",
        A2A_EXTERNAL_CONFORMANCE_REPORT: "a2a-conformance-report.json",
      },
      now: NOW,
    });
    const formatted = formatA2APublicReadinessReport(report);

    assert.equal(report.publicReady, false);
    assert.equal(
      findCheck(report, "public-discovery").code,
      "A2A_PUBLIC_DISCOVERY_REPORT_PUBLIC_JWKS_URL_MISMATCH",
    );
    assert.equal(
      findCheck(report, "public-push-delivery").code,
      "A2A_PUBLIC_PUSH_DELIVERY_REPORT_PUBLIC_BASE_URL_MISMATCH",
    );
    assert.equal(findCheck(report, "external-conformance").code, "A2A_EXTERNAL_CONFORMANCE_REPORT_INVALID_JSON");
    assert.doesNotMatch(formatted, /agents\.example|other\.example|a2a-public-discovery-report|a2a-public-push-report|a2a-conformance-report/);
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
  const cwd = await mkdtemp(join(tmpdir(), "vallum-a2a-readiness-"));
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

function officialTckCompatibilityReport(): Record<string, unknown> {
  return {
    summary: {
      timestamp: NOW.toISOString(),
      sut_url: "https://agents.example/a2a",
      spec_version: "1.0.0",
      overall_compatibility: "100.0%",
      must_compatibility: "100.0%",
      should_compatibility: "100.0%",
      may_compatibility: "100.0%",
    },
    per_requirement: {
      "CORE-SEND-001": {
        level: "MUST",
        status: "PASS",
        transports: { "HTTP+JSON": "PASS" },
        errors: [],
        test_ids: ["test_send_message_returns_task_or_message"],
      },
      "CORE-SEND-003": {
        level: "MUST",
        status: "PASS",
        transports: { "HTTP+JSON": "PASS" },
        errors: [],
        test_ids: ["test_content_type_not_supported_error_32005"],
      },
    },
    per_transport: {
      "HTTP+JSON": {
        total: 88,
        passed: 74,
        failed: 0,
        skipped: 14,
      },
    },
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
