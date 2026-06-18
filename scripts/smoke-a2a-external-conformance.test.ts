import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  formatA2AExternalConformanceSmokeResult,
  resolveA2AExternalConformanceEnv,
  runA2AExternalConformanceSmoke,
} from "./smoke-a2a-external-conformance.js";

const VALID_ENV = {
  A2A_PUBLIC_AGENT_CARD_URL: "https://agents.example/.well-known/agent-card.json",
  A2A_PUBLIC_BASE_URL: "https://agents.example/a2a",
  A2A_PUBLIC_TASK_AUTH_DECISION: "bearer",
  ["A2A_PUBLIC_TASK_BEARER_TOKEN"]: "fixture-public-task-value",
};

test("A2A external conformance env hydrates local .env and preserves explicit overrides", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-a2a-conformance-env-"));
  try {
    await writeFile(join(cwd, ".env"), [
      "A2A_PUBLIC_AGENT_CARD_URL=https://agents.example/.well-known/agent-card.json",
      "A2A_PUBLIC_BASE_URL=https://agents.example/a2a",
      "A2A_PUBLIC_TASK_AUTH_DECISION=bearer",
      "A2A_PUBLIC_TASK_BEARER_TOKEN=fixture-public-task-value",
    ].join("\n"));

    const env = await resolveA2AExternalConformanceEnv(cwd, {
      A2A_PUBLIC_TASK_AUTH_DECISION: "oauth2",
    });

    assert.equal(env.A2A_PUBLIC_AGENT_CARD_URL, "https://agents.example/.well-known/agent-card.json");
    assert.equal(env.A2A_PUBLIC_BASE_URL, "https://agents.example/a2a");
    assert.equal(env.A2A_PUBLIC_TASK_BEARER_TOKEN, "fixture-public-task-value");
    assert.equal(env.A2A_PUBLIC_TASK_AUTH_DECISION, "oauth2");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A external conformance smoke blocks missing config without network calls", async () => {
  let calls = 0;
  const cwd = await mkdtemp(join(tmpdir(), "vallum-a2a-conformance-missing-"));
  try {
    const result = await runA2AExternalConformanceSmoke({
      cwd,
      env: {},
      fetch: async () => {
        calls += 1;
        return jsonResponse({});
      },
    });
    const formatted = formatA2AExternalConformanceSmokeResult(result);

    assert.equal(result.ok, false);
    assert.equal(result.kind, "blocked");
    assert.equal(result.code, "A2A_EXTERNAL_CONFORMANCE_CONFIG_MISSING");
    assert.equal(calls, 0);
    assert.match(formatted, /A2A_PUBLIC_AGENT_CARD_URL/);
    assert.doesNotMatch(formatted, /agents\.example|fixture-public-task-value|bearer/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A external conformance smoke rejects unsafe public config without printing values", async () => {
  let calls = 0;
  const result = await runA2AExternalConformanceSmoke({
    env: {
      A2A_PUBLIC_AGENT_CARD_URL: "http://localhost/.well-known/agent-card.json",
      A2A_PUBLIC_BASE_URL: "https://127.0.0.1/a2a",
      A2A_PUBLIC_TASK_AUTH_DECISION: "bearer",
      ["A2A_PUBLIC_TASK_BEARER_TOKEN"]: "fixture-public-task-value",
    },
    fetch: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });
  const formatted = formatA2AExternalConformanceSmokeResult(result);

  assert.equal(result.ok, false);
  assert.equal(result.kind, "blocked");
  assert.equal(result.code, "A2A_EXTERNAL_CONFORMANCE_URL_UNSAFE");
  assert.equal(calls, 0);
  assert.doesNotMatch(formatted, /localhost|127\.0\.0\.1|fixture-public-task-value/i);
});

test("A2A external conformance smoke rejects credentialed or parameterized public URLs", async () => {
  let calls = 0;
  const result = await runA2AExternalConformanceSmoke({
    env: {
      A2A_PUBLIC_AGENT_CARD_URL: "https://user:pass@agents.example/.well-known/agent-card.json",
      A2A_PUBLIC_BASE_URL: "https://agents.example/a2a?token=value#frag",
      A2A_PUBLIC_TASK_AUTH_DECISION: "bearer",
      ["A2A_PUBLIC_TASK_BEARER_TOKEN"]: "fixture-public-task-value",
    },
    fetch: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });
  const formatted = formatA2AExternalConformanceSmokeResult(result);

  assert.equal(result.ok, false);
  assert.equal(result.kind, "blocked");
  assert.equal(result.code, "A2A_EXTERNAL_CONFORMANCE_URL_UNSAFE");
  assert.equal(calls, 0);
  assert.doesNotMatch(formatted, /agents\.example|user|pass|token=value|frag|fixture-public-task-value/i);
});

test("A2A external conformance smoke blocks unsupported auth and missing bearer token", async () => {
  const oauth = await runA2AExternalConformanceSmoke({
    env: { ...VALID_ENV, A2A_PUBLIC_TASK_AUTH_DECISION: "oauth2" },
    fetch: async () => jsonResponse({}),
  });
  const missingToken = await runA2AExternalConformanceSmoke({
    env: { ...VALID_ENV, A2A_PUBLIC_TASK_BEARER_TOKEN: "" },
    fetch: async () => jsonResponse({}),
  });

  assert.equal(oauth.ok, false);
  assert.equal(oauth.kind, "blocked");
  assert.equal(oauth.code, "A2A_EXTERNAL_CONFORMANCE_AUTH_UNSUPPORTED");
  assert.equal(missingToken.ok, false);
  assert.equal(missingToken.kind, "blocked");
  assert.equal(missingToken.code, "A2A_EXTERNAL_CONFORMANCE_CONFIG_MISSING");
  assert.deepEqual(missingToken.missing, ["A2A_PUBLIC_TASK_BEARER_TOKEN"]);
});

test("A2A external conformance smoke probes public Agent Card and task route through injected fetch", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const cwd = await mkdtemp(join(tmpdir(), "vallum-a2a-conformance-"));
  try {
    const reportPath = join(cwd, "a2a-external-conformance-report.json");
    const result = await runA2AExternalConformanceSmoke({
      env: VALID_ENV,
      now: new Date("2026-06-11T12:00:00.000Z"),
      reportPath,
      fetch: async (input, init) => {
        requests.push({ url: String(input), init });
        if (String(input).endsWith("/.well-known/agent-card.json")) return jsonResponse(validAgentCard());
        if (String(input).endsWith("/a2a/message:send")) return jsonResponse({ task: validTask() });
        return jsonResponse({ error: "not found" }, 404);
      },
    });
    const formatted = formatA2AExternalConformanceSmokeResult(result);
    const report = JSON.parse(await readFile(reportPath, "utf8")) as Record<string, unknown>;

    assert.equal(result.ok, true);
    assert.deepEqual(requests.map((request) => request.url), [
      "https://agents.example/.well-known/agent-card.json",
      "https://agents.example/a2a/message:send",
    ]);
    assert.equal(requests[1]?.init?.method, "POST");
    assert.equal((requests[1]?.init?.headers as Record<string, string>).authorization, "Bearer fixture-public-task-value");
    assert.doesNotMatch(String(requests[1]?.init?.body ?? ""), /fixture-public-task-value|signer_ref|payment-secret/i);
    assert.deepEqual(report, {
      schemaVersion: 1,
      kind: "a2a-external-conformance",
      result: "passed",
      observedAt: "2026-06-11T12:00:00.000Z",
      publicAgentCardUrl: "https://agents.example/.well-known/agent-card.json",
      publicBaseUrl: "https://agents.example/a2a",
      checks: ["agent-card", "message-send", "redaction-review"],
      runner: "vallum-public-task-route-smoke",
    });
    assert.match(formatted, /A2A external conformance smoke passed/);
    assert.doesNotMatch(formatted, /agents\.example|fixture-public-task-value|a2a-external-conformance-report/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A external conformance smoke fails closed on Agent Card and send-response mismatch", async () => {
  const mismatchedCard = await runA2AExternalConformanceSmoke({
    env: VALID_ENV,
    fetch: async (input) => {
      if (String(input).endsWith("/.well-known/agent-card.json")) {
        return jsonResponse({
          ...validAgentCard(),
          supportedInterfaces: [{
            url: "https://other.example/a2a",
            protocolBinding: "HTTP+JSON",
            protocolVersion: "1.0",
          }],
        });
      }
      return jsonResponse({ task: validTask() });
    },
  });
  const badSend = await runA2AExternalConformanceSmoke({
    env: VALID_ENV,
    fetch: async (input) => {
      if (String(input).endsWith("/.well-known/agent-card.json")) return jsonResponse(validAgentCard());
      return jsonResponse({ ok: true });
    },
  });
  const formatted = `${formatA2AExternalConformanceSmokeResult(mismatchedCard)}\n${formatA2AExternalConformanceSmokeResult(badSend)}`;

  assert.equal(mismatchedCard.ok, false);
  assert.equal(mismatchedCard.kind, "failed");
  assert.equal(mismatchedCard.code, "A2A_EXTERNAL_CONFORMANCE_AGENT_CARD_BASE_URL_MISMATCH");
  assert.equal(badSend.ok, false);
  assert.equal(badSend.kind, "failed");
  assert.equal(badSend.code, "A2A_EXTERNAL_CONFORMANCE_SEND_RESPONSE_INVALID");
  assert.doesNotMatch(formatted, /agents\.example|other\.example|fixture-public-task-value/i);
});

test("A2A external conformance smoke fails closed on task-route HTTP failure", async () => {
  const result = await runA2AExternalConformanceSmoke({
    env: VALID_ENV,
    fetch: async (input) => {
      if (String(input).endsWith("/.well-known/agent-card.json")) return jsonResponse(validAgentCard());
      return jsonResponse({ error: "unauthorized" }, 401);
    },
  });
  const formatted = formatA2AExternalConformanceSmokeResult(result);

  assert.equal(result.ok, false);
  assert.equal(result.kind, "failed");
  assert.equal(result.code, "A2A_EXTERNAL_CONFORMANCE_SEND_FAILED");
  assert.equal(result.httpStatus, 401);
  assert.match(formatted, /httpStatus=401/);
  assert.doesNotMatch(formatted, /unauthorized|fixture-public-task-value|agents\.example/i);
});

function validAgentCard() {
  return {
    name: "researcher.demo.iota",
    description: "Research agent.",
    supportedInterfaces: [{
      url: "https://agents.example/a2a",
      protocolBinding: "HTTP+JSON",
      protocolVersion: "1.0",
    }],
    version: "2026.6.11",
    capabilities: {
      streaming: true,
      pushNotifications: true,
      extendedAgentCard: true,
    },
    securitySchemes: {
      vallumBearer: {
        httpAuthSecurityScheme: {
          scheme: "Bearer",
          bearerFormat: "JWT",
        },
      },
    },
    securityRequirements: [{ schemes: { vallumBearer: { list: [] } } }],
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills: [{
      id: "research.summary",
      name: "Research summary",
      description: "Summarize research.",
      tags: ["research"],
    }],
  };
}

function validTask() {
  return {
    id: "task-public-conformance",
    contextId: "context-public-conformance",
    status: {
      state: "TASK_STATE_COMPLETED",
      timestamp: "2026-06-11T12:00:00.000Z",
    },
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}
