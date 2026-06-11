import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const localDockerCompose = await readFile(resolve(repoRoot, "deploy/docker-compose/docker-compose.local.yml"), "utf8");
const tsconfig = JSON.parse(await readFile(resolve(repoRoot, "tsconfig.json"), "utf8")) as {
  include?: string[];
};
const secretScanScript = await readFile(resolve(repoRoot, "scripts/scan-secrets.ts"), "utf8");
const ciWorkflow = await readFile(resolve(repoRoot, ".github/workflows/ci.yml"), "utf8");
const apexProfile = JSON.parse(await readFile(resolve(repoRoot, "apex.workflow.json"), "utf8")) as {
  authority?: { executionTruth?: string[] };
};
const publicPackageNames = await loadPublicPackageNames();
const verifyLocalScript = packageJson.scripts?.["verify:local"] ?? "";

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

test("gas station config renderer builds before writing local signer config", () => {
  const renderConfig = packageJson.scripts?.["gas-station:render-config"];

  assert.equal(
    renderConfig,
    "npm run build && tsx scripts/render-gas-station-config.ts",
    "npm run gas-station:render-config must not depend on pre-existing ignored dist artifacts",
  );
});

test("gas station runtime preflight builds before checking Docker runtime", () => {
  const runtimePreflight = packageJson.scripts?.["gas-station:runtime-preflight"];

  assert.equal(
    runtimePreflight,
    "npm run build && tsx scripts/check-gas-station-runtime-preflight.ts",
    "npm run gas-station:runtime-preflight must not depend on pre-existing ignored dist artifacts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /gas-station:runtime-preflight/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /gas-station:runtime-preflight/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /gas-station:runtime-preflight/);
});

test("direct Docker Gas Station fallback builds and stays opt-in", () => {
  const dockerDirect = packageJson.scripts?.["gas-station:docker-direct"];

  assert.equal(
    dockerDirect,
    "npm run build && tsx scripts/gas-station-docker-direct.ts",
    "npm run gas-station:docker-direct must not depend on pre-existing ignored dist artifacts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /gas-station:docker-direct/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /gas-station:docker-direct/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /gas-station:docker-direct/);
});

test("local docker compose wires official Gas Station behind loopback ports", () => {
  assert.match(localDockerCompose, /image: \$\{IOTA_GAS_STATION_IMAGE:-iotaledger\/gas-station:latest\}/);
  assert.match(localDockerCompose, /"--config-path", "\/app\/config.yaml"/);
  assert.match(localDockerCompose, /127\.0\.0\.1:9527:9527/);
  assert.match(localDockerCompose, /127\.0\.0\.1:9184:9184/);
  assert.match(localDockerCompose, /GAS_STATION_AUTH: \$\{GAS_STATION_AUTH:-\}/);
  assert.match(localDockerCompose, /config\.local\.yaml/);
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

test("payment provider readiness proof is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["proof:payment-provider-readiness"],
    "npm run build && tsx scripts/check-payment-provider-readiness.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /payment-provider-readiness/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /payment-provider-readiness/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /payment-provider-readiness/);
});

test("A2A public proof plan is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["a2a:write-public-proof-plan"],
    "npm run build && tsx scripts/write-a2a-public-proof-plan.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-public-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-public-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-public-proof-plan/);
});

test("operator live gate report writer is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["operator:write-live-gate-report"],
    "npm run build && tsx scripts/check-operator-live-gates.ts --json --out tmp/gaskit/operator-live-gates.json",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-live-gate-report/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-live-gate-report/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-live-gate-report/);
});

test("A2A static discovery bundle tools are opt-in and excluded from local verification", () => {
  assert.equal(
    packageJson.scripts?.["a2a:write-static-discovery-bundle"],
    "npm run build && tsx scripts/write-a2a-static-discovery-bundle.ts",
  );
  assert.equal(
    packageJson.scripts?.["a2a:check-static-discovery-bundle"],
    "npm run build && tsx scripts/check-a2a-static-discovery-bundle.ts",
  );
  assert.equal(
    packageJson.scripts?.["a2a:write-static-hosting-review"],
    "npm run build && tsx scripts/write-a2a-static-hosting-review.ts",
  );
  assert.equal(
    packageJson.scripts?.["smoke:a2a-static-discovery-local"],
    "npm run build && tsx scripts/smoke-a2a-static-discovery-local.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-static-discovery-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-static-discovery-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-static-discovery-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /check-static-discovery-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /check-static-discovery-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /check-static-discovery-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-static-hosting-review/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-static-hosting-review/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-static-hosting-review/);
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /a2a-static-discovery-local/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /a2a-static-discovery-local/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /a2a-static-discovery-local/);
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

test("local smoke scripts are built and wired into local verification", () => {
  const localSmokes: ReadonlyArray<readonly [scriptName: string, entrypoint: string]> = [
    ["smoke:agent-escrow", "scripts/smoke-agent-escrow.ts"],
    ["smoke:paid-mcp-tool", "scripts/smoke-paid-mcp-tool.ts"],
    ["smoke:data-license", "scripts/smoke-data-license.ts"],
    ["smoke:service-bounty", "scripts/smoke-service-bounty.ts"],
    ["smoke:reputation-receipt", "scripts/smoke-reputation-receipt.ts"],
    ["smoke:subscription", "scripts/smoke-subscription.ts"],
    ["smoke:a2a-well-known", "scripts/smoke-a2a-well-known.ts"],
    ["smoke:a2a-signed-card", "scripts/smoke-a2a-signed-card.ts"],
    ["smoke:a2a-task-message", "scripts/smoke-a2a-task-message.ts"],
    ["smoke:a2a-http", "scripts/smoke-a2a-http.ts"],
    ["smoke:a2a-local-server", "scripts/smoke-a2a-local-server.ts"],
    ["smoke:marketplace-read-model", "scripts/smoke-marketplace-read-model.ts"],
  ];

  for (const [scriptName, entrypoint] of localSmokes) {
    assert.equal(packageJson.scripts?.[scriptName], `npm run build && tsx ${entrypoint}`);
    assert.match(verifyLocalScript, new RegExp(`npm run ${escapeRegExp(scriptName)}(\\s|$)`));
  }
});

test("live proof commands stay opt-in and excluded from local verification", () => {
  const optInLiveCommands: ReadonlyArray<readonly [scriptName: string, expectedCommand: string]> = [
    ["smoke:iota-names-live", "npm run build && tsx scripts/smoke-iota-names-live.ts"],
    ["smoke:iota-identity-live", "npm run build && tsx scripts/smoke-iota-identity-live.ts"],
    ["proof:live-status", "npm run build && tsx scripts/check-live-proof-status.ts"],
  ];

  for (const [scriptName, expectedCommand] of optInLiveCommands) {
    assert.equal(packageJson.scripts?.[scriptName], expectedCommand);
    assert.doesNotMatch(verifyLocalScript, new RegExp(`npm run ${escapeRegExp(scriptName)}(\\s|$)`));
  }
});

test("non-networked product readiness proofs are wired into local verification", () => {
  const localProofs: ReadonlyArray<readonly [scriptName: string, expectedCommand: string]> = [
    ["proof:product-status", "npm run build && tsx scripts/check-product-status.ts"],
    ["proof:launch-readiness", "npm run build && tsx scripts/check-launch-readiness.ts"],
    ["proof:operator-gates", "npm run build && tsx scripts/check-operator-live-gates.ts"],
  ];

  for (const [scriptName, expectedCommand] of localProofs) {
    assert.equal(packageJson.scripts?.[scriptName], expectedCommand);
    assert.match(verifyLocalScript, new RegExp(`npm run ${escapeRegExp(scriptName)}(\\s|$)`));
  }
  assert.match(
    verifyLocalScript,
    /npm run proof:product-status && npm run proof:launch-readiness && npm run proof:operator-gates && npm run docs:check/,
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
  assert.ok(apexProfile.authority?.executionTruth?.includes("docs/agentic-gaskit/launch-readiness-evidence.md"));
  assert.ok(apexProfile.authority?.executionTruth?.includes("docs/agentic-gaskit/testnet-digest-proof.md"));
  assert.ok(apexProfile.authority?.executionTruth?.includes("docs/reviewer-walkthrough.md"));
  assert.ok(!apexProfile.authority?.executionTruth?.includes("docs/milestone-0-proof.md"));
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
