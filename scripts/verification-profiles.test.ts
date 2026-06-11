import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkVerificationProfiles, formatVerificationProfileReport } from "./check-verification-profiles.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};

test("current package scripts expose fast verification without weakening the full gate", async () => {
  const report = await checkVerificationProfiles({ scripts: packageJson.scripts });

  assert.equal(report.profilesOk, true);
  assert.equal(report.fastProfileOk, true);
  assert.equal(report.fullGatePreserved, true);
  assert.deepEqual(report.checks.map((check) => check.code), [
    "VERIFY_FAST_PROFILE_CONFIGURED",
    "VERIFY_LOCAL_FULL_GATE_PRESERVED",
    "GRANT_CHECK_FULL_GATE_PRESERVED",
  ]);
});

test("fast verification remains bounded and excludes heavy or live proof commands", async () => {
  const scripts = {
    ...packageJson.scripts,
    "verify:fast": "npm run build && npm test && npm run contracts:test && npm run docs:check && npm run secrets:scan && npm run proof:product-status && npm run proof:launch-readiness && npm run proof:operator-gates",
  };
  const report = await checkVerificationProfiles({ scripts });
  const formatted = formatVerificationProfileReport(report);

  assert.equal(report.profilesOk, false);
  assert.match(formatted, /VERIFY_FAST_PROFILE_INVALID/);
  assert.match(formatted, /forbidden=contracts:test/);
});

test("full verification must include profile audit and all release evidence commands", async () => {
  const scripts = {
    ...packageJson.scripts,
    "verify:local": packageJson.scripts?.["verify:local"]?.replace(" && npm run proof:verification-profiles", ""),
  };
  const report = await checkVerificationProfiles({ scripts });
  const formatted = formatVerificationProfileReport(report);

  assert.equal(report.fullGatePreserved, false);
  assert.match(formatted, /VERIFY_LOCAL_FULL_GATE_INVALID/);
  assert.match(formatted, /missing=npm run proof:verification-profiles/);
});

test("grant and reviewer verification cannot point at the fast profile", async () => {
  const scripts = {
    ...packageJson.scripts,
    "grant:check": "npm run verify:fast",
  };
  const report = await checkVerificationProfiles({ scripts });
  const formatted = formatVerificationProfileReport(report);

  assert.equal(report.fullGatePreserved, false);
  assert.match(formatted, /GRANT_CHECK_NOT_FULL_GATE/);
  assert.match(formatted, /grant:check=npm run verify:fast/);
});
