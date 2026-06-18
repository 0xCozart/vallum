import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { checkA2APublicReadiness } from "./check-a2a-public-readiness.js";
import {
  formatWrapA2ATckConformanceResult,
  resolveA2ATckConformanceEnv,
  wrapA2ATckConformance,
} from "./wrap-a2a-tck-conformance.js";

const NOW = new Date("2026-06-17T12:00:00.000Z");

test("A2A TCK wrapper env hydrates local .env and preserves explicit overrides", async () => {
  const cwd = await writeA2AEvidence();
  try {
    await writeFile(join(cwd, ".env"), [
      "A2A_TCK_COMPATIBILITY_REPORT=reports/compatibility.json",
      "A2A_EXTERNAL_CONFORMANCE_REPORT=tmp/vallum/a2a-external-conformance-report.json",
      "A2A_PUBLIC_AGENT_CARD_URL=https://agents.example/.well-known/agent-card.json",
      "A2A_PUBLIC_BASE_URL=https://agents.example/a2a",
    ].join("\n"));

    const env = await resolveA2ATckConformanceEnv(cwd, {
      A2A_EXTERNAL_CONFORMANCE_REPORT: "tmp/vallum/override-conformance-report.json",
    });

    assert.equal(env.A2A_TCK_COMPATIBILITY_REPORT, "reports/compatibility.json");
    assert.equal(env.A2A_PUBLIC_AGENT_CARD_URL, "https://agents.example/.well-known/agent-card.json");
    assert.equal(env.A2A_PUBLIC_BASE_URL, "https://agents.example/a2a");
    assert.equal(env.A2A_EXTERNAL_CONFORMANCE_REPORT, "tmp/vallum/override-conformance-report.json");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A TCK wrapper writes accepted redacted external conformance report", async () => {
  const cwd = await writeA2AEvidence();
  try {
    await writeJson(join(cwd, "reports/compatibility.json"), officialTckCompatibilityReport());
    const result = await wrapA2ATckConformance({
      cwd,
      now: NOW,
      compatibilityFile: "reports/compatibility.json",
      outFile: "tmp/vallum/a2a-external-conformance-report.json",
      publicAgentCardUrl: "https://agents.example/.well-known/agent-card.json",
      publicBaseUrl: "https://agents.example/a2a",
    });
    const formatted = formatWrapA2ATckConformanceResult(result);

    assert.equal(result.ok, true);
    assert.doesNotMatch(formatted, /agents\.example|compatibility\.json|a2a-external-conformance-report|raw response|Authorization/i);

    const reportPath = join(cwd, "tmp/vallum/a2a-external-conformance-report.json");
    const raw = await readFile(reportPath, "utf8");
    const written = JSON.parse(raw) as {
      kind?: string;
      checks?: string[];
      tckCompatibility?: {
        per_requirement?: Record<string, { errors?: unknown; status?: string; transports?: Record<string, unknown> }>;
      };
    };

    assert.equal(written.kind, "a2a-external-conformance");
    assert.deepEqual(written.checks, ["agent-card", "official-a2a-tck", "http-json-must", "redaction-review"]);
    assert.equal(written.tckCompatibility?.per_requirement?.["CORE-SEND-001"]?.status, "PASS");
    assert.equal(written.tckCompatibility?.per_requirement?.["CORE-SEND-003"]?.transports?.["HTTP+JSON"], "PASS");
    assert.equal(written.tckCompatibility?.per_requirement?.["CORE-SEND-003"]?.errors, undefined);
    assert.doesNotMatch(raw, /raw response body|Authorization|Bearer|privatePrompt|unrelated-should-failure/);
    assert.equal((await stat(reportPath)).mode & 0o777, 0o600);

    const readiness = await checkA2APublicReadiness({
      cwd,
      now: NOW,
      scripts: completeScripts(),
      env: {
        A2A_PUBLIC_AGENT_CARD_URL: "https://agents.example/.well-known/agent-card.json",
        A2A_PUBLIC_BASE_URL: "https://agents.example/a2a",
        A2A_PUBLIC_JWKS_URL: "https://agents.example/.well-known/jwks.json",
        A2A_PUBLIC_TASK_AUTH_DECISION: "bearer",
        A2A_EXTERNAL_CONFORMANCE_REPORT: "tmp/vallum/a2a-external-conformance-report.json",
      },
    });
    const external = readiness.checks.find((check) => check.id === "external-conformance");
    assert.equal(external?.status, "ready-approval");
    assert.equal(external?.code, "A2A_EXTERNAL_CONFORMANCE_REPORT_VALID");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A TCK wrapper blocks missing config and unsafe public URLs", async () => {
  const cwd = await writeA2AEvidence();
  try {
    const missing = await wrapA2ATckConformance({ cwd, env: {} });
    assert.equal(missing.ok, false);
    assert.equal(missing.code, "A2A_TCK_WRAPPER_CONFIG_MISSING");
    assert.deepEqual(missing.missing, [
      "A2A_TCK_COMPATIBILITY_REPORT",
      "A2A_EXTERNAL_CONFORMANCE_REPORT",
      "A2A_PUBLIC_AGENT_CARD_URL",
      "A2A_PUBLIC_BASE_URL",
    ]);

    await writeJson(join(cwd, "reports/compatibility.json"), officialTckCompatibilityReport());
    const unsafe = await wrapA2ATckConformance({
      cwd,
      compatibilityFile: "reports/compatibility.json",
      outFile: "tmp/vallum/a2a-external-conformance-report.json",
      publicAgentCardUrl: "http://localhost/.well-known/agent-card.json",
      publicBaseUrl: "https://127.0.0.1/a2a",
    });
    const formatted = formatWrapA2ATckConformanceResult(unsafe);

    assert.equal(unsafe.ok, false);
    assert.equal(unsafe.code, "A2A_TCK_WRAPPER_URL_UNSAFE");
    assert.doesNotMatch(formatted, /localhost|127\.0\.0\.1|compatibility\.json|a2a-external-conformance-report/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A TCK wrapper rejects incomplete MUST and HTTP+JSON evidence", async () => {
  const cwd = await writeA2AEvidence();
  try {
    const incomplete = officialTckCompatibilityReport();
    await writeJson(join(cwd, "reports/compatibility.json"), {
      ...incomplete,
      summary: {
        ...(incomplete.summary as Record<string, unknown>),
        must_compatibility: "99.0%",
      },
    });

    const mustFailed = await wrapA2ATckConformance({
      cwd,
      compatibilityFile: "reports/compatibility.json",
      outFile: "tmp/vallum/a2a-external-conformance-report.json",
      publicAgentCardUrl: "https://agents.example/.well-known/agent-card.json",
      publicBaseUrl: "https://agents.example/a2a",
    });

    assert.equal(mustFailed.ok, false);
    assert.equal(mustFailed.code, "A2A_TCK_WRAPPER_TCK_MUST_COMPATIBILITY_INCOMPLETE");

    await writeJson(join(cwd, "reports/compatibility.json"), {
      ...officialTckCompatibilityReport(),
      per_transport: {
        "HTTP+JSON": { total: 88, passed: 73, failed: 1, skipped: 14 },
      },
    });
    const transportFailed = await wrapA2ATckConformance({
      cwd,
      compatibilityFile: "reports/compatibility.json",
      outFile: "tmp/vallum/a2a-external-conformance-report.json",
      publicAgentCardUrl: "https://agents.example/.well-known/agent-card.json",
      publicBaseUrl: "https://agents.example/a2a",
    });

    assert.equal(transportFailed.ok, false);
    assert.equal(transportFailed.code, "A2A_TCK_WRAPPER_TCK_HTTP_JSON_FAILURES_PRESENT");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

async function writeA2AEvidence(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-a2a-tck-wrapper-"));
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
  await mkdir(join(cwd, "reports"), { recursive: true });
  return cwd;
}

async function writeJson(path: string, value: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function officialTckCompatibilityReport(): Record<string, unknown> {
  return {
    summary: {
      timestamp: NOW.toISOString(),
      sut_url: "https://agents.example/a2a",
      spec_version: "1.0.0",
      overall_compatibility: "100.0%",
      must_compatibility: "100.0%",
      should_compatibility: "97.0%",
      may_compatibility: "80.0%",
    },
    per_requirement: {
      "CORE-SEND-001": {
        level: "MUST",
        status: "PASS",
        transports: { "HTTP+JSON": "PASS" },
        errors: ["raw response body with Authorization header should not be copied"],
        test_ids: ["test_send_message_returns_task_or_message"],
      },
      "CORE-SEND-003": {
        level: "MUST",
        status: "PASS",
        transports: { "HTTP+JSON": "PASS" },
        errors: ["privatePrompt should not be copied"],
        test_ids: ["test_content_type_not_supported_error_32005"],
      },
      "QUALITY-SHOULD-001": {
        level: "SHOULD",
        status: "FAIL",
        transports: { "HTTP+JSON": "FAIL" },
        errors: ["unrelated-should-failure"],
        test_ids: ["test_unrelated_should"],
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
