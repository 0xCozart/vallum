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
const apexProfile = JSON.parse(await readFile(resolve(repoRoot, "apex.workflow.json"), "utf8")) as {
  authority?: { executionTruth?: string[] };
};

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

test("root local verification includes deterministic secret scan after package checks", () => {
  const localVerify = packageJson.scripts?.["verify:local"] ?? "";

  assert.match(localVerify, /npm run pack:check && npm run docs:check && npm run secrets:scan/);
  assert.equal(packageJson.scripts?.["grant:check"], "npm run verify:local");
  assert.equal(packageJson.scripts?.["secrets:scan"], "tsx scripts/scan-secrets.ts");
});

test("docs site check is wired into local verification", () => {
  assert.equal(packageJson.scripts?.["docs:check"], "npm run check -w @iota-gaskit/docs-site");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run docs:check/);
});

test("registry, contract metadata, and standards packages are built and included in package dry-runs", () => {
  assert.match(packageJson.scripts?.["build"] ?? "", /npm run build -w @iota-gaskit\/registry/);
  assert.match(packageJson.scripts?.["pack:check"] ?? "", /-w @iota-gaskit\/registry/);
  assert.match(packageJson.scripts?.["build"] ?? "", /npm run build -w @iota-gaskit\/contracts-metadata/);
  assert.match(packageJson.scripts?.["pack:check"] ?? "", /-w @iota-gaskit\/contracts-metadata/);
  assert.match(packageJson.scripts?.["build"] ?? "", /npm run build -w @iota-gaskit\/standards/);
  assert.match(packageJson.scripts?.["pack:check"] ?? "", /-w @iota-gaskit\/standards/);
});

test("agent escrow smoke is wired into local verification", () => {
  assert.equal(packageJson.scripts?.["smoke:agent-escrow"], "npm run build && tsx scripts/smoke-agent-escrow.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:agent-escrow/);
});

test("paid MCP tool smoke is wired into local verification", () => {
  assert.equal(packageJson.scripts?.["smoke:paid-mcp-tool"], "npm run build && tsx scripts/smoke-paid-mcp-tool.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:paid-mcp-tool/);
});

test("Move contract tests are wired into local verification", () => {
  assert.equal(packageJson.scripts?.["contracts:test"], "tsx scripts/run-move-tests.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run contracts:test/);
});

test("root docs scripts build the static hosted documentation site", () => {
  assert.equal(packageJson.scripts?.["docs:build"], "npm run build -w @iota-gaskit/docs-site");
  assert.equal(packageJson.scripts?.["docs:check"], "npm run check -w @iota-gaskit/docs-site");
  assert.equal(packageJson.scripts?.["docs:serve"], "npm run serve -w @iota-gaskit/docs-site --");
});

test("workflow execution truth does not reference deleted milestone docs", () => {
  assert.ok(apexProfile.authority?.executionTruth?.includes("docs/milestone-0-proof.md"));
  assert.ok(apexProfile.authority?.executionTruth?.includes("docs/reviewer-walkthrough.md"));
  assert.ok(!apexProfile.authority?.executionTruth?.includes("docs/grant-milestones.md"));
});

test("secret scan covers tracked, staged, and untracked text without broad source-test skips", () => {
  assert.match(secretScanScript, /--cached/);
  assert.match(secretScanScript, /--others/);
  assert.match(secretScanScript, /existsSync/);
  assert.doesNotMatch(secretScanScript, /endsWith\("\.test\.ts"\)\) return false/);
  assert.doesNotMatch(secretScanScript, /startsWith\("scripts\/smoke-"\)\) return false/);
});

test("secret scan iterates all matches so fixture values cannot mask later secrets", () => {
  assert.match(secretScanScript, /while \(\(match = pattern\.exec\(content\)\) !== null\)/);
  assert.match(secretScanScript, /pattern\.lastIndex = 0/);
});

test("CI workflow runs local verification with read-only repository token permissions", () => {
  assert.match(ciWorkflow, /permissions:\s+contents: read/s);
  assert.match(ciWorkflow, /npm run verify:local/);
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
