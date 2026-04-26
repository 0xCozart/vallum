import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { loadGatewayConfigFromEnv } from "./config.js";

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
  const dir = await mkdtemp(join(tmpdir(), "gaskit-policy-"));
  const path = join(dir, "policy.yaml");
  await writeFile(path, source);
  return path;
}

test("policy config requires an explicit demo app key by default", async () => {
  const policyPath = await writePolicy(validPolicy);

  await assert.rejects(
    () => loadGatewayConfigFromEnv({ GASKIT_POLICY_PATH: policyPath }),
    /GASKIT_DEMO_APP_KEY/,
  );
});

test("policy config can opt into the documented insecure local demo key", async () => {
  const policyPath = await writePolicy(validPolicy);

  const config = await loadGatewayConfigFromEnv({
    GASKIT_POLICY_PATH: policyPath,
    GASKIT_ALLOW_INSECURE_DEMO_KEY: "true",
  });

  assert.equal(config.apps["demo-dapp"]?.apiKey, "local-dev-demo-key");
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
    () => loadGatewayConfigFromEnv({ GASKIT_POLICY_PATH: policyPath, GASKIT_DEMO_APP_KEY: "demo-key" }),
    /allowed_packages/,
  );
});

test("policy config rejects unknown app status values", async () => {
  const policyPath = await writePolicy(validPolicy.replace("status: active", "status: typo"));

  await assert.rejects(
    () => loadGatewayConfigFromEnv({ GASKIT_POLICY_PATH: policyPath, GASKIT_DEMO_APP_KEY: "demo-key" }),
    /status/,
  );
});
