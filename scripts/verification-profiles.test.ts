import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildVerificationProfileArtifact,
  checkVerificationProfiles,
  formatVerificationProfileArtifact,
  formatVerificationProfileReport,
  writeVerificationProfileArtifact,
} from "./check-verification-profiles.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};

test("current package scripts expose fast verification without weakening the full gate", async () => {
  const report = await checkVerificationProfiles({ scripts: packageJson.scripts });
  const artifact = buildVerificationProfileArtifact(report, new Date("2026-06-14T12:00:00.000Z"));
  const json = formatVerificationProfileArtifact(artifact);

  assert.equal(report.profilesOk, true);
  assert.equal(report.fastProfileOk, true);
  assert.equal(report.fullGatePreserved, true);
  assert.equal(artifact.kind, "vallum.verification-profile-report");
  assert.equal(artifact.blockerCodes.length, 0);
  assert.deepEqual(artifact.provenLocalCheckIds, [
    "verify-fast-profile",
    "verify-local-full-gate",
    "grant-check-full-gate",
  ]);
  assert.doesNotMatch(json, /private-key|mnemonic-value|local-secret|bearer-token-value/i);
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
  assert.deepEqual(buildVerificationProfileArtifact(report).blockerCodes, ["VERIFY_FAST_PROFILE_INVALID"]);
  assert.match(formatted, /VERIFY_FAST_PROFILE_INVALID/);
  assert.match(formatted, /forbidden=contracts:test/);
});

test("verification profile artifact writer uses restrictive local file permissions", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-verification-profiles-"));
  try {
    const outFile = "tmp/vallum/verification-profiles.json";
    const artifact = await writeVerificationProfileArtifact({
      cwd,
      scripts: packageJson.scripts,
      now: new Date("2026-06-14T12:00:00.000Z"),
      outFile,
    });
    const written = await readFile(join(cwd, outFile), "utf8");
    const mode = (await stat(join(cwd, outFile))).mode & 0o777;

    assert.equal(artifact.kind, "vallum.verification-profile-report");
    assert.equal(JSON.parse(written).kind, "vallum.verification-profile-report");
    assert.equal(mode, 0o600);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
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
