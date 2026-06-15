import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envExample = await readFile(resolve(repoRoot, ".env.example"), "utf8");

const requiredExampleKeys = [
  "AGENTRAIL_SPONSOR_FUNDING_REPORT",
  "AGENTRAIL_SPONSOR_FAUCET_REPORT",
  "AGENTRAIL_TESTNET_UPSTREAM_REPORT",
  "AGENTRAIL_TESTNET_DIGEST_REPORT",
  "IOTA_NAMES_GRAPHQL_URL",
  "IOTA_NAMES_NAME",
  "IOTA_NAMES_EXPECTED_ADDRESS",
  "IOTA_NAMES_LIVE_REPORT",
  "IOTA_IDENTITY_PROOF_ENDPOINT",
  "IOTA_IDENTITY_PROFILE_PATH",
  "IOTA_IDENTITY_LIVE_REPORT",
  "IOTA_IDENTITY_TRUSTED_ISSUER_DIDS",
  "IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS",
  "IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES",
  "IOTA_IDENTITY_ACCEPTED_STATUS_TYPES",
  "IOTA_IDENTITY_CACHE_TTL_MS",
  "PACKAGE_PUBLICATION_REPORT",
  "A2A_PUBLIC_DISCOVERY_REPORT",
  "A2A_PUBLIC_PUSH_DELIVERY_REPORT",
  "A2A_EXTERNAL_CONFORMANCE_REPORT",
  "PAYMENT_PROVIDER_LIVE_REPORT",
  "MARKETPLACE_PRODUCTION_REPORT",
  "CUSTODY_PRODUCTION_REPORT",
] as const;

test(".env.example documents live proof and production report inputs as comments", () => {
  for (const key of requiredExampleKeys) {
    assert.match(envExample, new RegExp(`^# ${key}=`, "m"), `${key} must be documented as a commented example`);
    assert.doesNotMatch(envExample, new RegExp(`^${key}=`, "m"), `${key} must not be enabled in .env.example`);
  }
});

test(".env.example keeps live proof report pointers in ignored local artifact paths", () => {
  const reportLines = envExample
    .split(/\r?\n/)
    .filter((line) => /^# [A-Z0-9_]+_REPORT=/.test(line));

  assert.ok(reportLines.length >= 10, "expected report pointers for live and production gates");
  for (const line of reportLines) {
    assert.match(line, /^# [A-Z0-9_]+_REPORT=tmp\/agentrail\/[a-z0-9-]+\.json$/);
  }
});
