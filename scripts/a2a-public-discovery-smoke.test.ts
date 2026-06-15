import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  formatA2APublicDiscoverySmokeResult,
  runA2APublicDiscoverySmoke,
} from "./smoke-a2a-public-discovery.js";

const VALID_ENV = {
  A2A_PUBLIC_AGENT_CARD_URL: "https://agents.example/.well-known/agent-card.json",
  A2A_PUBLIC_BASE_URL: "https://agents.example/a2a",
  A2A_PUBLIC_JWKS_URL: "https://agents.example/.well-known/jwks.json",
  A2A_PUBLIC_TASK_AUTH_DECISION: "bearer",
};

test("A2A public discovery smoke blocks missing config without network calls", async () => {
  let calls = 0;
  const result = await runA2APublicDiscoverySmoke({
    env: {},
    fetch: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });
  const formatted = formatA2APublicDiscoverySmokeResult(result);

  assert.equal(result.ok, false);
  assert.equal(result.kind, "blocked");
  assert.equal(result.code, "A2A_PUBLIC_DISCOVERY_CONFIG_MISSING");
  assert.equal(calls, 0);
  assert.match(formatted, /A2A_PUBLIC_AGENT_CARD_URL/);
  assert.doesNotMatch(formatted, /agents\.example|bearer/i);
});

test("A2A public discovery smoke rejects unsafe public config without printing values", async () => {
  let calls = 0;
  const result = await runA2APublicDiscoverySmoke({
    env: {
      A2A_PUBLIC_AGENT_CARD_URL: "http://localhost/.well-known/agent-card.json",
      A2A_PUBLIC_BASE_URL: "https://127.0.0.1/a2a",
      A2A_PUBLIC_JWKS_URL: "https://keys.localhost/jwks.json",
      A2A_PUBLIC_TASK_AUTH_DECISION: "query-token-secret",
    },
    fetch: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });
  const formatted = formatA2APublicDiscoverySmokeResult(result);

  assert.equal(result.ok, false);
  assert.equal(result.kind, "blocked");
  assert.equal(result.code, "A2A_PUBLIC_DISCOVERY_URL_UNSAFE");
  assert.equal(calls, 0);
  assert.doesNotMatch(formatted, /localhost|127\.0\.0\.1|keys\.localhost|query-token-secret/i);
});

test("A2A public discovery smoke validates public Agent Card and JWKS through injected fetch", async () => {
  const requested: string[] = [];
  const cwd = await mkdtemp(join(tmpdir(), "agentrail-a2a-discovery-"));
  try {
    const reportPath = join(cwd, "a2a-public-discovery-report.json");
    const result = await runA2APublicDiscoverySmoke({
      env: VALID_ENV,
      now: new Date("2026-06-11T12:00:00.000Z"),
      reportPath,
      fetch: async (input) => {
        requested.push(String(input));
        if (String(input).endsWith("/.well-known/agent-card.json")) return jsonResponse(validAgentCard());
        if (String(input).endsWith("/.well-known/jwks.json")) return jsonResponse(validJwks());
        return jsonResponse({ error: "not found" }, 404);
      },
    });
    const formatted = formatA2APublicDiscoverySmokeResult(result);
    const report = JSON.parse(await readFile(reportPath, "utf8")) as Record<string, unknown>;

    assert.equal(result.ok, true);
    assert.deepEqual(requested, [
      "https://agents.example/.well-known/agent-card.json",
      "https://agents.example/.well-known/jwks.json",
    ]);
    assert.deepEqual(report, {
      schemaVersion: 1,
      kind: "a2a-public-discovery",
      result: "passed",
      observedAt: "2026-06-11T12:00:00.000Z",
      publicAgentCardUrl: "https://agents.example/.well-known/agent-card.json",
      publicBaseUrl: "https://agents.example/a2a",
      publicJwksUrl: "https://agents.example/.well-known/jwks.json",
      taskAuthDecision: "bearer",
      checks: ["public-config", "public-agent-card", "public-jwks"],
    });
    assert.match(formatted, /A2A public discovery smoke passed/);
    assert.doesNotMatch(formatted, /agents\.example|bearer|researcher\.demo|a2a-public-discovery-report/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("A2A public discovery smoke fails closed on Agent Card endpoint mismatch", async () => {
  const result = await runA2APublicDiscoverySmoke({
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
      return jsonResponse(validJwks());
    },
  });
  const formatted = formatA2APublicDiscoverySmokeResult(result);

  assert.equal(result.ok, false);
  assert.equal(result.kind, "failed");
  assert.equal(result.code, "A2A_PUBLIC_AGENT_CARD_BASE_URL_MISMATCH");
  assert.doesNotMatch(formatted, /agents\.example|other\.example/);
});

test("A2A public discovery smoke fails closed on auth mismatch and secret-like public fields", async () => {
  const authMismatch = await runA2APublicDiscoverySmoke({
    env: { ...VALID_ENV, A2A_PUBLIC_TASK_AUTH_DECISION: "oauth2" },
    fetch: async (input) => String(input).endsWith("/jwks.json") ? jsonResponse(validJwks()) : jsonResponse(validAgentCard()),
  });
  assert.equal(authMismatch.ok, false);
  assert.equal(authMismatch.code, "A2A_PUBLIC_AGENT_CARD_AUTH_MISMATCH");

  const secretField = await runA2APublicDiscoverySmoke({
    env: VALID_ENV,
    fetch: async (input) => String(input).endsWith("/jwks.json")
      ? jsonResponse(validJwks())
      : jsonResponse({ ...validAgentCard(), privateToken: "fixture-redacted-value" }),
  });
  const formatted = formatA2APublicDiscoverySmokeResult(secretField);

  assert.equal(secretField.ok, false);
  assert.equal(secretField.code, "A2A_PUBLIC_AGENT_CARD_SECRET_FIELD");
  assert.doesNotMatch(formatted, /fixture-redacted-value|privateToken/);
});

test("A2A public discovery smoke fails closed on private JWKS material", async () => {
  const result = await runA2APublicDiscoverySmoke({
    env: VALID_ENV,
    fetch: async (input) => {
      if (String(input).endsWith("/.well-known/agent-card.json")) return jsonResponse(validAgentCard());
      return jsonResponse({
        keys: [{
          kid: "a2a-signing-key",
          kty: "OKP",
          crv: "Ed25519",
          x: "public",
          d: "private",
        }],
      });
    },
  });
  const formatted = formatA2APublicDiscoverySmokeResult(result);

  assert.equal(result.ok, false);
  assert.equal(result.kind, "failed");
  assert.equal(result.code, "A2A_PUBLIC_JWKS_PRIVATE_KEY_MATERIAL");
  assert.doesNotMatch(formatted, /a2a-signing-key|agents\.example|Ed25519|x=|d=/i);
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
      agentrailBearer: {
        httpAuthSecurityScheme: {
          scheme: "Bearer",
          bearerFormat: "JWT",
        },
      },
    },
    securityRequirements: [{ schemes: { agentrailBearer: [] } }],
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

function validJwks() {
  return {
    keys: [{
      kid: "a2a-signing-key",
      kty: "OKP",
      crv: "Ed25519",
      x: "public",
    }],
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}
