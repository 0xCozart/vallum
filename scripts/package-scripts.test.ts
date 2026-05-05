import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const tsconfig = JSON.parse(await readFile(resolve(repoRoot, "tsconfig.json"), "utf8")) as {
  include?: string[];
};
const secretScanScript = await readFile(resolve(repoRoot, "scripts/scan-secrets.ts"), "utf8");
const ciWorkflow = await readFile(resolve(repoRoot, ".github/workflows/ci.yml"), "utf8");

test("local smoke script builds workspace packages before running gateway smoke", () => {
  const smokeLocal = packageJson.scripts?.["smoke:local"];

  assert.equal(
    smokeLocal,
    "npm run build && tsx scripts/smoke-local-gateway.ts",
    "npm run smoke:local must not depend on pre-existing ignored dist artifacts",
  );
});

test("gas station diagnosis script builds before probing live upstream", () => {
  const diagnose = packageJson.scripts?.["diagnose:gas-station"];

  assert.equal(
    diagnose,
    "npm run build && tsx scripts/diagnose-gas-station-upstream.ts",
    "npm run diagnose:gas-station must not depend on pre-existing ignored dist artifacts",
  );
});

test("testnet demo execute script builds before submitting a live transaction", () => {
  const executeDemo = packageJson.scripts?.["execute:testnet-demo"];

  assert.equal(
    executeDemo,
    "npm run build && tsx scripts/execute-testnet-sponsored-demo.ts",
    "npm run execute:testnet-demo must not depend on pre-existing ignored dist artifacts",
  );
});

test("root grant check includes deterministic secret scan after package checks", () => {
  const grantCheck = packageJson.scripts?.["grant:check"] ?? "";

  assert.match(grantCheck, /npm run pack:check && npm run secrets:scan/);
  assert.equal(packageJson.scripts?.["secrets:scan"], "tsx scripts/scan-secrets.ts");
});

test("secret scan covers tracked, staged, and untracked text without broad source-test skips", () => {
  assert.match(secretScanScript, /--cached/);
  assert.match(secretScanScript, /--others/);
  assert.doesNotMatch(secretScanScript, /endsWith\("\.test\.ts"\)\) return false/);
  assert.doesNotMatch(secretScanScript, /startsWith\("scripts\/smoke-"\)\) return false/);
});

test("secret scan iterates all matches so fixture values cannot mask later secrets", () => {
  assert.match(secretScanScript, /while \(\(match = pattern\.exec\(content\)\) !== null\)/);
  assert.match(secretScanScript, /pattern\.lastIndex = 0/);
});

test("CI workflow runs grant check with read-only repository token permissions", () => {
  assert.match(ciWorkflow, /permissions:\s+contents: read/s);
  assert.match(ciWorkflow, /npm run grant:check/);
});

test("root npm test includes script, example, package, and app regression tests", () => {
  const npmTest = packageJson.scripts?.["test"] ?? "";

  assert.match(npmTest, /scripts\/\*\.test\.ts/);
  assert.match(npmTest, /examples\/\*\*\/\*\.test\.ts/);
  assert.match(npmTest, /packages\/\*\/src\/\*\.test\.ts/);
  assert.match(npmTest, /apps\/\*\/src\/\*\.test\.ts/);
});

test("root typecheck includes package, app, script, and example source", () => {
  assert.ok(tsconfig.include?.includes("packages/**/*.ts"));
  assert.ok(tsconfig.include?.includes("apps/**/*.ts"));
  assert.ok(tsconfig.include?.includes("scripts/**/*.ts"));
  assert.ok(tsconfig.include?.includes("examples/**/*.ts"));
});
