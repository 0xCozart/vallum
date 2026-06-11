import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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
const publicPackageNames = await loadPublicPackageNames();

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

test("testnet digest proof has offline and opt-in live commands", () => {
  assert.equal(
    packageJson.scripts?.["proof:testnet-digest"],
    "npm run build && tsx scripts/check-testnet-digest-proof.ts",
  );
  assert.equal(
    packageJson.scripts?.["proof:testnet-digest:live"],
    "npm run build && tsx scripts/check-testnet-digest-proof.ts --live",
  );
  assert.match(
    packageJson.scripts?.["verify:local"] ?? "",
    /npm run readiness:testnet:example && npm run proof:testnet-digest && npm run pack:check/,
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /npm run proof:testnet-digest:live/);
});

test("A2A public readiness proof is non-networked and wired into local verification", () => {
  assert.equal(
    packageJson.scripts?.["proof:a2a-public-readiness"],
    "npm run build && tsx scripts/check-a2a-public-readiness.ts",
  );
  assert.match(
    packageJson.scripts?.["verify:local"] ?? "",
    /npm run smoke:package-install && npm run proof:a2a-public-readiness && npm run proof:verification-profiles && npm run proof:product-status/,
  );
});

test("A2A public discovery smoke is opt-in and excluded from local verification", () => {
  assert.equal(
    packageJson.scripts?.["smoke:a2a-public-discovery"],
    "npm run build && tsx scripts/smoke-a2a-public-discovery.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /a2a-public-discovery/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /a2a-public-discovery/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /a2a-public-discovery/);
});

test("verification profiles keep fast iteration separate from the full local gate", () => {
  assert.equal(
    packageJson.scripts?.["proof:verification-profiles"],
    "npm run build && tsx scripts/check-verification-profiles.ts",
  );
  assert.equal(
    packageJson.scripts?.["verify:fast"],
    "npm run build && npm test && npm run docs:check && npm run secrets:scan && npm run proof:product-status && npm run proof:launch-readiness && npm run proof:operator-gates",
  );
  assert.match(
    packageJson.scripts?.["verify:local"] ?? "",
    /npm run proof:a2a-public-readiness && npm run proof:verification-profiles && npm run proof:product-status/,
  );
  assert.equal(packageJson.scripts?.["grant:check"], "npm run verify:local");
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /contracts:test|pack:check|publish:dry-run|execute:testnet-demo/);
});

test("root local verification includes deterministic secret scan after package checks", () => {
  const localVerify = packageJson.scripts?.["verify:local"] ?? "";

  assert.match(
    localVerify,
    /npm run readiness:testnet:example && npm run proof:testnet-digest && npm run pack:check && npm run smoke:package-install && npm run proof:a2a-public-readiness && npm run proof:verification-profiles && npm run proof:product-status && npm run proof:launch-readiness && npm run proof:operator-gates && npm run docs:check && npm run secrets:scan/,
  );
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

test("marketplace package is built and included in package dry-runs", () => {
  assert.match(packageJson.scripts?.["build"] ?? "", /npm run build -w @iota-gaskit\/marketplace/);
  assert.match(packageJson.scripts?.["pack:check"] ?? "", /-w @iota-gaskit\/marketplace/);
});

test("root build and package dry-run cover every public package workspace", () => {
  const build = packageJson.scripts?.["build"] ?? "";
  const packCheck = packageJson.scripts?.["pack:check"] ?? "";

  for (const packageName of publicPackageNames) {
    assert.match(build, new RegExp(`npm run build -w ${escapeRegExp(packageName)}`), `${packageName} must be built by root build`);
    assert.match(packCheck, new RegExp(`-w ${escapeRegExp(packageName)}(\\s|$)`), `${packageName} must be included in pack:check`);
  }
});

test("package publish dry-run is opt-in and not part of local verification", () => {
  assert.equal(packageJson.scripts?.["publish:dry-run"], "npm run build && tsx scripts/package-publish-dry-run.ts");
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /npm run publish:dry-run/);
});

test("package install smoke is wired after package dry-runs in local verification", () => {
  assert.equal(packageJson.scripts?.["smoke:package-install"], "npm run build && tsx scripts/smoke-package-install.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run pack:check && npm run smoke:package-install/);
});

test("agent escrow smoke is wired into local verification", () => {
  assert.equal(packageJson.scripts?.["smoke:agent-escrow"], "npm run build && tsx scripts/smoke-agent-escrow.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:agent-escrow/);
});

test("paid MCP tool smoke is wired into local verification", () => {
  assert.equal(packageJson.scripts?.["smoke:paid-mcp-tool"], "npm run build && tsx scripts/smoke-paid-mcp-tool.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:paid-mcp-tool/);
});

test("data license smoke is wired into local verification", () => {
  assert.equal(packageJson.scripts?.["smoke:data-license"], "npm run build && tsx scripts/smoke-data-license.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:data-license/);
});

test("service bounty smoke is wired into local verification", () => {
  assert.equal(packageJson.scripts?.["smoke:service-bounty"], "npm run build && tsx scripts/smoke-service-bounty.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:service-bounty/);
});

test("reputation receipt smoke is wired into local verification", () => {
  assert.equal(packageJson.scripts?.["smoke:reputation-receipt"], "npm run build && tsx scripts/smoke-reputation-receipt.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:reputation-receipt/);
});

test("subscription smoke is wired into local verification", () => {
  assert.equal(packageJson.scripts?.["smoke:subscription"], "npm run build && tsx scripts/smoke-subscription.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:subscription/);
});

test("A2A well-known smoke is wired into local verification", () => {
  assert.equal(packageJson.scripts?.["smoke:a2a-well-known"], "npm run build && tsx scripts/smoke-a2a-well-known.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:a2a-well-known/);
});

test("A2A signed Agent Card smoke is wired into local verification", () => {
  assert.equal(packageJson.scripts?.["smoke:a2a-signed-card"], "npm run build && tsx scripts/smoke-a2a-signed-card.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:a2a-signed-card/);
});

test("A2A task/message smoke is wired into local verification", () => {
  assert.equal(packageJson.scripts?.["smoke:a2a-task-message"], "npm run build && tsx scripts/smoke-a2a-task-message.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:a2a-task-message/);
});

test("A2A HTTP smoke is wired into local verification", () => {
  assert.equal(packageJson.scripts?.["smoke:a2a-http"], "npm run build && tsx scripts/smoke-a2a-http.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:a2a-http/);
});

test("A2A local server smoke is wired into local verification", () => {
  assert.equal(
    packageJson.scripts?.["smoke:a2a-local-server"],
    "npm run build && tsx scripts/smoke-a2a-local-server.ts",
  );
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:a2a-local-server/);
});

test("marketplace read-model smoke is wired into local verification", () => {
  assert.equal(
    packageJson.scripts?.["smoke:marketplace-read-model"],
    "npm run build && tsx scripts/smoke-marketplace-read-model.ts",
  );
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:marketplace-read-model/);
});

test("IOTA Names live smoke is opt-in and not part of local verification", () => {
  assert.equal(
    packageJson.scripts?.["smoke:iota-names-live"],
    "npm run build && tsx scripts/smoke-iota-names-live.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:iota-names-live/);
});

test("IOTA Identity live smoke is opt-in and not part of local verification", () => {
  assert.equal(
    packageJson.scripts?.["smoke:iota-identity-live"],
    "npm run build && tsx scripts/smoke-iota-identity-live.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /npm run smoke:iota-identity-live/);
});

test("live proof status is non-networked and not part of local verification", () => {
  assert.equal(
    packageJson.scripts?.["proof:live-status"],
    "npm run build && tsx scripts/check-live-proof-status.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /npm run proof:live-status/);
});

test("product status is non-networked and wired into local verification", () => {
  assert.equal(
    packageJson.scripts?.["proof:product-status"],
    "npm run build && tsx scripts/check-product-status.ts",
  );
  assert.match(
    packageJson.scripts?.["verify:local"] ?? "",
    /npm run smoke:package-install && npm run proof:a2a-public-readiness && npm run proof:verification-profiles && npm run proof:product-status && npm run proof:launch-readiness && npm run proof:operator-gates && npm run docs:check/,
  );
});

test("launch readiness is non-networked and wired into local verification", () => {
  assert.equal(
    packageJson.scripts?.["proof:launch-readiness"],
    "npm run build && tsx scripts/check-launch-readiness.ts",
  );
  assert.match(
    packageJson.scripts?.["verify:local"] ?? "",
    /npm run proof:product-status && npm run proof:launch-readiness && npm run proof:operator-gates && npm run docs:check/,
  );
});

test("operator live gates are non-networked and wired into local verification", () => {
  assert.equal(
    packageJson.scripts?.["proof:operator-gates"],
    "npm run build && tsx scripts/check-operator-live-gates.ts",
  );
  assert.match(
    packageJson.scripts?.["verify:local"] ?? "",
    /npm run proof:launch-readiness && npm run proof:operator-gates && npm run docs:check/,
  );
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

async function loadPublicPackageNames(): Promise<string[]> {
  const packagesDir = resolve(repoRoot, "packages");
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const names: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const packageJsonPath = join(packagesDir, entry.name, "package.json");
    const workspacePackageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      name: string;
      private?: boolean;
    };
    if (!workspacePackageJson.private) names.push(workspacePackageJson.name);
  }
  return names.sort();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
