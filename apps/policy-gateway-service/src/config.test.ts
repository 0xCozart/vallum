import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { loadGatewayConfigFromEnv } from "./config.js";
import { createGatewayServer } from "./server.js";

const validPolicy = `apps:
  demo-dapp:
    api_key_name: demo-dapp-key
    status: active
    daily_budget_iota: 10
    daily_request_limit: 1000
    max_requests_per_wallet_per_day: 25
    max_gas_budget_per_tx: 50000000
    allowed_packages:
      - "0xDEMO_PACKAGE"
    allowed_functions:
      - "mint_badge"
    denied_wallets: []
`;

async function writePolicy(source: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vallum-policy-"));
  const path = join(dir, "policy.yaml");
  await writeFile(path, source);
  return path;
}

test("policy config requires an explicit demo app key by default", async () => {
  const policyPath = await writePolicy(validPolicy);

  await assert.rejects(
    () => loadGatewayConfigFromEnv({ VALLUM_POLICY_PATH: policyPath }),
    /VALLUM_DEMO_APP_KEY/,
  );
});

test("policy config can opt into the documented insecure local demo key", async () => {
  const policyPath = await writePolicy(validPolicy);

  const config = await loadGatewayConfigFromEnv({
    VALLUM_POLICY_PATH: policyPath,
    VALLUM_ALLOW_INSECURE_DEMO_KEY: "true",
  });

  assert.equal(config.apps["demo-dapp"]?.apiKey, "local-dev-demo-key");
  assert.equal(config.runtimeMode, "local");
  assert.equal(config.transactionIntentVerifier?.authority, "local-test");
});

test("production env config fails closed with the local test transaction verifier", async () => {
  const policyPath = await writePolicy(validPolicy);

  const config = await loadGatewayConfigFromEnv({
    VALLUM_POLICY_PATH: policyPath,
    VALLUM_DEMO_APP_KEY: "demo-key",
    VALLUM_GATEWAY_MODE: "production",
  });

  assert.equal(config.runtimeMode, "production");
  assert.equal(config.transactionIntentVerifier?.authority, "local-test");
  assert.throws(() => createGatewayServer(config), /authoritative transaction intent verifier/);
});

test("policy config rejects blank quota store paths", async () => {
  const policyPath = await writePolicy(validPolicy);

  await assert.rejects(
    () =>
      loadGatewayConfigFromEnv({
        VALLUM_POLICY_PATH: policyPath,
        VALLUM_DEMO_APP_KEY: "demo-key",
        VALLUM_QUOTA_STORE_PATH: "   ",
      }),
    /VALLUM_QUOTA_STORE_PATH/,
  );
});

test("policy config wires a local durable quota store when configured", async () => {
  const policyPath = await writePolicy(validPolicy);
  const quotaDir = await mkdtemp(join(tmpdir(), "vallum-quota-config-"));
  const quotaPath = join(quotaDir, "quota.json");

  const config = await loadGatewayConfigFromEnv({
    VALLUM_POLICY_PATH: policyPath,
    VALLUM_DEMO_APP_KEY: "demo-key",
    VALLUM_QUOTA_STORE_PATH: quotaPath,
  });

  assert.equal(config.quotaStore?.kind, "durable-local");
});

test("policy config rejects missing package allowlists instead of allowing all packages", async () => {
  const policyPath = await writePolicy(`apps:
  demo-dapp:
    api_key_name: demo-dapp-key
    status: active
    daily_budget_iota: 10
    allowed_functions:
      - "mint_badge"
`);

  await assert.rejects(
    () => loadGatewayConfigFromEnv({ VALLUM_POLICY_PATH: policyPath, VALLUM_DEMO_APP_KEY: "demo-key" }),
    /allowed_packages/,
  );
});

test("policy config rejects operator usage token without a usage store path", async () => {
  const policyPath = await writePolicy(validPolicy);

  await assert.rejects(
    () =>
      loadGatewayConfigFromEnv({
        VALLUM_POLICY_PATH: policyPath,
        VALLUM_DEMO_APP_KEY: "demo-key",
        VALLUM_OPERATOR_USAGE_TOKEN: "operator-token",
      }),
    /VALLUM_USAGE_EVENT_STORE_PATH/,
  );
});

test("policy config rejects blank usage store paths when operator usage is enabled", async () => {
  const policyPath = await writePolicy(validPolicy);

  await assert.rejects(
    () =>
      loadGatewayConfigFromEnv({
        VALLUM_POLICY_PATH: policyPath,
        VALLUM_DEMO_APP_KEY: "demo-key",
        VALLUM_USAGE_EVENT_STORE_PATH: "   ",
        VALLUM_OPERATOR_USAGE_TOKEN: "operator-token",
      }),
    /VALLUM_USAGE_EVENT_STORE_PATH/,
  );
});

test("policy config wires local usage event store and authenticated operator usage snapshot", async () => {
  const policyPath = await writePolicy(validPolicy);
  const usageDir = await mkdtemp(join(tmpdir(), "vallum-usage-config-"));
  const usagePath = join(usageDir, "usage-events.jsonl");

  const config = await loadGatewayConfigFromEnv({
    VALLUM_POLICY_PATH: policyPath,
    VALLUM_DEMO_APP_KEY: "demo-key",
    VALLUM_USAGE_EVENT_STORE_PATH: usagePath,
    VALLUM_OPERATOR_USAGE_TOKEN: "operator-token",
    VALLUM_OPERATOR_USAGE_MAX_RECENT_EVENTS: "0",
  });

  assert.equal(typeof config.eventSink, "function");
  assert.equal(config.operatorUsage?.token, "operator-token");
  await config.eventSink?.({
    id: "event-1",
    timestamp: "2026-04-27T00:00:00.000Z",
    operation: "reserve",
    outcome: "allowed",
    httpStatus: 200,
    appId: "demo-dapp",
    gasBudget: 9,
  });
  const snapshot = await config.operatorUsage?.loadSnapshot();

  assert.equal(snapshot?.totals.events, 1);
  assert.equal(snapshot?.totals.gasBudgetReserved, 9);
  assert.deepEqual(snapshot?.recentEvents, []);
});

test("policy config rejects unknown app status values", async () => {
  const policyPath = await writePolicy(validPolicy.replace("status: active", "status: typo"));

  await assert.rejects(
    () => loadGatewayConfigFromEnv({ VALLUM_POLICY_PATH: policyPath, VALLUM_DEMO_APP_KEY: "demo-key" }),
    /status/,
  );
});
