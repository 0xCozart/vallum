import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkTestnetReadiness, formatReadinessReport, parseDotEnv } from "./readiness.js";

const validPolicy = `apps:
  demo-dapp:
    api_key_name: demo-dapp-key
    status: active
    daily_budget_iota: 1
    daily_request_limit: 10
    max_requests_per_wallet_per_day: 2
    max_gas_budget_per_tx: 5000000
    allowed_packages:
      - "0x1234567890abcdef"
    allowed_functions:
      - "mint_badge"
    denied_wallets: []
`;

const placeholderPolicy = validPolicy.replace("0x1234567890abcdef", "0xYOUR_DEMO_PACKAGE_ID");

async function writePolicy(source: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agentrail-readiness-policy-"));
  const path = join(dir, "policy.yaml");
  await writeFile(path, source);
  return path;
}

async function validEnv(overrides: Record<string, string | undefined> = {}): Promise<NodeJS.ProcessEnv> {
  const policyPath = await writePolicy(validPolicy);
  return {
    IOTA_RPC_URL: "https://api.testnet.iota.cafe",
    GAS_STATION_KEYPAIR: "fake-testnet-sponsor-key-with-enough-entropy-for-preflight",
    GAS_STATION_AUTH: "fake-gas-station-auth-value-with-enough-entropy",
    JWT_SECRET: "jwt-secret-with-at-least-thirty-two-characters",
    DATABASE_URL: "file:./data/agentrail.sqlite3",
    AGENTRAIL_GATEWAY_HOST: "127.0.0.1",
    AGENTRAIL_GATEWAY_PORT: "8787",
    AGENTRAIL_POLICY_PATH: policyPath,
    AGENTRAIL_DEMO_APP_KEY: "demo-app-key-with-enough-entropy",
    GAS_STATION_URL: "http://127.0.0.1:9527",
    GAS_STATION_BEARER_TOKEN: "fake-upstream-bearer-value-with-enough-entropy",
    ...overrides,
  };
}

test("parseDotEnv handles comments, quoted values, and inline comments without shelling out", () => {
  const parsed = parseDotEnv(`# comment
IOTA_RPC_URL="https://api.testnet.iota.cafe"
JWT_SECRET='secret#kept'
DATABASE_URL=file:./data/agentrail.sqlite3 # local db
`);

  assert.equal(parsed.IOTA_RPC_URL, "https://api.testnet.iota.cafe");
  assert.equal(parsed.JWT_SECRET, "secret#kept");
  assert.equal(parsed.DATABASE_URL, "file:./data/agentrail.sqlite3");
});

test("testnet readiness passes with explicit non-placeholder local testnet values", async () => {
  const report = await checkTestnetReadiness({ env: await validEnv() });

  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
  assert.ok(report.checks.some((check) => check.id === "policy.packageAllowlist.present" && check.status === "pass"));
});

test("testnet readiness fails closed on placeholders, missing secrets, and placeholder package allowlists", async () => {
  const policyPath = await writePolicy(placeholderPolicy);
  const report = await checkTestnetReadiness({
    env: await validEnv({
      AGENTRAIL_POLICY_PATH: policyPath,
      GAS_STATION_KEYPAIR: "replace-with-local-testnet-sponsor-key",
      GAS_STATION_AUTH: undefined,
      JWT_SECRET: "replac...cret",
      AGENTRAIL_DEMO_APP_KEY: "local-dev-demo-key",
    }),
  });

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.id === "GAS_STATION_KEYPAIR.value"));
  assert.ok(report.failures.some((failure) => failure.id === "GAS_STATION_AUTH.required"));
  assert.ok(report.failures.some((failure) => failure.id === "JWT_SECRET.value"));
  assert.ok(report.failures.some((failure) => failure.id === "AGENTRAIL_DEMO_APP_KEY.value"));
  assert.ok(report.failures.some((failure) => failure.id === "policy.packageAllowlist.placeholders"));
});

test("testnet readiness validates URLs and loopback host boundaries", async () => {
  const report = await checkTestnetReadiness({
    env: await validEnv({
      IOTA_RPC_URL: "http://api.testnet.iota.cafe",
      GAS_STATION_URL: "not-a-url",
      AGENTRAIL_GATEWAY_HOST: "0.0.0.0",
      AGENTRAIL_GATEWAY_PORT: "99999",
    }),
  });

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.id === "IOTA_RPC_URL.url"));
  assert.ok(report.failures.some((failure) => failure.id === "GAS_STATION_URL.url"));
  assert.ok(report.failures.some((failure) => failure.id === "AGENTRAIL_GATEWAY_HOST.loopback"));
  assert.ok(report.failures.some((failure) => failure.id === "AGENTRAIL_GATEWAY_PORT.range"));
});

test("example readiness mode requires documented placeholders but still checks required keys", async () => {
  const policyPath = await writePolicy(placeholderPolicy);
  const report = await checkTestnetReadiness({
    env: {
      IOTA_RPC_URL: "https://api.testnet.iota.cafe",
      GAS_STATION_KEYPAIR: "replace-with-local-testnet-sponsor-key",
      GAS_STATION_AUTH: "replac...oken",
      JWT_SECRET: "replac...cret",
      DATABASE_URL: "file:./data/agentrail.sqlite3",
      AGENTRAIL_GATEWAY_HOST: "127.0.0.1",
      AGENTRAIL_GATEWAY_PORT: "8787",
      AGENTRAIL_POLICY_PATH: policyPath,
      AGENTRAIL_DEMO_APP_KEY: "local-dev-demo-key",
      GAS_STATION_URL: "http://127.0.0.1:9527",
      GAS_STATION_BEARER_TOKEN: "replac...oken",
    },
    expectPlaceholders: true,
  });

  assert.equal(report.ok, true);
  assert.ok(report.checks.some((check) => check.id === "policy.packageAllowlist.present" && check.status === "pass"));
});

test("readiness resolves relative policy paths from the provided cwd", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agentrail-readiness-cwd-"));
  await writeFile(join(dir, "policy.yaml"), validPolicy);
  const report = await checkTestnetReadiness({
    env: await validEnv({ AGENTRAIL_POLICY_PATH: "policy.yaml" }),
    cwd: dir,
  });

  assert.equal(report.ok, true);
  assert.ok(report.checks.some((check) => check.id === "policy.load" && check.status === "pass"));
});

test("readiness treats optional operator usage token as a secret when configured", async () => {
  const report = await checkTestnetReadiness({
    env: await validEnv({
      AGENTRAIL_USAGE_EVENT_STORE_PATH: "tmp/usage.jsonl",
      AGENTRAIL_OPERATOR_USAGE_TOKEN: "replace-with-local-operator-token",
    }),
  });

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.id === "AGENTRAIL_OPERATOR_USAGE_TOKEN.value"));
  const formatted = formatReadinessReport(report);
  assert.ok(!formatted.includes("replace-with-local-operator-token"));
  assert.ok(formatted.includes("AGENTRAIL_OPERATOR_USAGE_TOKEN"));
});

test("readiness report formatting never prints secret values", async () => {
  const secret = "redacted-sentinel-value-that-must-not-print";
  const report = await checkTestnetReadiness({ env: await validEnv({ GAS_STATION_AUTH: secret }) });
  const formatted = formatReadinessReport(report);

  assert.ok(!formatted.includes(secret));
  assert.ok(formatted.includes("GAS_STATION_AUTH"));
});
