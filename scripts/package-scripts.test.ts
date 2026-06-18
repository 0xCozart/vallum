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
const codebaseMap = await readFile(resolve(repoRoot, "docs/CODEBASE_MAP.md"), "utf8");
const apexProfile = JSON.parse(await readFile(resolve(repoRoot, "apex.workflow.json"), "utf8")) as {
  name?: string;
  authority?: { executionTruth?: string[]; doNotUseAsAuthority?: string[] };
  setup?: { reviewNeeded?: unknown; reviewRequiredBeforeFirstSlice?: boolean };
  modes?: Array<{ id?: string }>;
  tracker?: { provider?: string };
  codeIntelligence?: { provider?: string };
  manifest?: { defaultDir?: string };
  verification?: { presets?: { readiness_slice?: { commands?: string[] } } };
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

test("sponsor funding check builds and stays opt-in", () => {
  const sponsorFunding = packageJson.scripts?.["sponsor:check-funding"];

  assert.equal(
    sponsorFunding,
    "npm run build && tsx scripts/check-sponsor-funding.ts",
    "npm run sponsor:check-funding must not depend on pre-existing ignored dist artifacts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /sponsor:check-funding/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /sponsor:check-funding/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /sponsor:check-funding/);
});

test("sponsor funding request writer builds and stays opt-in", () => {
  const sponsorFundingRequest = packageJson.scripts?.["sponsor:write-funding-request"];

  assert.equal(
    sponsorFundingRequest,
    "npm run build && tsx scripts/write-sponsor-funding-request.ts",
    "npm run sponsor:write-funding-request must not depend on pre-existing ignored dist artifacts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /sponsor:write-funding-request/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /sponsor:write-funding-request/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /sponsor:write-funding-request/);
});

test("sponsor faucet request builds and stays opt-in", () => {
  const sponsorFaucetRequest = packageJson.scripts?.["sponsor:request-faucet-funds"];

  assert.equal(
    sponsorFaucetRequest,
    "npm run build && tsx scripts/request-sponsor-faucet-funds.ts",
    "npm run sponsor:request-faucet-funds must not depend on pre-existing ignored dist artifacts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /sponsor:request-faucet-funds/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /sponsor:request-faucet-funds/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /sponsor:request-faucet-funds/);
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

test("live proof plan and identity proof bundle are non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["live:write-proof-plan"],
    "npm run build && tsx scripts/write-live-proof-plan.ts",
  );
  assert.equal(
    packageJson.scripts?.["live:write-identity-proof-bundle"],
    "npm run build && tsx scripts/write-identity-proof-bundle.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-live-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-live-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-live-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-identity-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-identity-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-identity-proof-bundle/);
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

test("A2A public push delivery smoke is opt-in and excluded from local verification", () => {
  assert.equal(
    packageJson.scripts?.["smoke:a2a-public-push-delivery"],
    "npm run build && tsx scripts/smoke-a2a-public-push-delivery.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /a2a-public-push-delivery/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /a2a-public-push-delivery/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /a2a-public-push-delivery/);
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

test("payment provider live smoke is opt-in and excluded from local verification", () => {
  assert.equal(
    packageJson.scripts?.["smoke:payment-provider-live"],
    "npm run build && tsx scripts/smoke-payment-provider-live.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /smoke:payment-provider-live/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /smoke:payment-provider-live/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /smoke:payment-provider-live/);
});

test("payment provider proof plan is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["payment:write-provider-proof-plan"],
    "npm run build && tsx scripts/write-payment-provider-proof-plan.ts",
  );
  assert.equal(
    packageJson.scripts?.["payment:write-provider-proof-bundle"],
    "npm run build && tsx scripts/write-payment-provider-proof-bundle.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-provider-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-provider-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-provider-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-provider-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-provider-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-provider-proof-bundle/);
});

test("package publication readiness proof is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["proof:package-publication-readiness"],
    "npm run build && tsx scripts/check-package-publication-readiness.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /package-publication-readiness/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /package-publication-readiness/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /package-publication-readiness/);
});

test("npm registry package consumer proof is networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["smoke:npm-registry-paid-mcp-consumer"],
    "tsx scripts/smoke-npm-registry-paid-mcp-consumer.ts --out tmp/vallum/npm-registry-consumer-proof.json",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /npm-registry-paid-mcp-consumer/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /npm-registry-paid-mcp-consumer/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /npm-registry-paid-mcp-consumer/);
});

test("package publication proof plan is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["package:write-publication-proof-plan"],
    "npm run build && tsx scripts/write-package-publication-proof-plan.ts",
  );
  assert.equal(
    packageJson.scripts?.["package:write-publication-proof-bundle"],
    "npm run build && tsx scripts/write-package-publication-proof-bundle.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-publication-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-publication-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-publication-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-publication-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-publication-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-publication-proof-bundle/);
});

test("marketplace readiness proof is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["proof:marketplace-readiness"],
    "npm run build && tsx scripts/check-marketplace-readiness.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /marketplace-readiness/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /marketplace-readiness/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /marketplace-readiness/);
});

test("marketplace production proof plan is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["marketplace:write-production-proof-plan"],
    "npm run build && tsx scripts/write-marketplace-production-proof-plan.ts",
  );
  assert.equal(
    packageJson.scripts?.["marketplace:write-production-proof-bundle"],
    "npm run build && tsx scripts/write-marketplace-production-proof-bundle.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-production-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-production-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-production-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-production-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-production-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-production-proof-bundle/);
});

test("custody readiness proof is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["proof:custody-readiness"],
    "npm run build && tsx scripts/check-custody-readiness.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /custody-readiness/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /custody-readiness/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /custody-readiness/);
});

test("custody production proof plan is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["custody:write-production-proof-plan"],
    "npm run build && tsx scripts/write-custody-production-proof-plan.ts",
  );
  assert.equal(
    packageJson.scripts?.["custody:write-production-proof-bundle"],
    "npm run build && tsx scripts/write-custody-production-proof-bundle.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-custody-production-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-custody-production-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-custody-production-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-custody-production-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-custody-production-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-custody-production-proof-bundle/);
});

test("device access safety readiness proof is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["proof:device-access-safety-readiness"],
    "npm run build && tsx scripts/check-device-access-safety-readiness.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /device-access-safety-readiness/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /device-access-safety-readiness/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /device-access-safety-readiness/);
});

test("device access safety proof plan is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["device-access:write-safety-proof-plan"],
    "npm run build && tsx scripts/write-device-access-safety-proof-plan.ts",
  );
  assert.equal(
    packageJson.scripts?.["device-access:write-safety-proof-bundle"],
    "npm run build && tsx scripts/write-device-access-safety-proof-bundle.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-safety-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-safety-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-safety-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-safety-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-safety-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-safety-proof-bundle/);
});

test("A2A public proof plan is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["a2a:write-public-proof-plan"],
    "npm run build && tsx scripts/write-a2a-public-proof-plan.ts",
  );
  assert.equal(
    packageJson.scripts?.["a2a:write-public-proof-bundle"],
    "npm run build && tsx scripts/write-a2a-public-proof-bundle.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-public-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-public-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-public-proof-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-public-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-public-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-public-proof-bundle/);
});

test("A2A TCK conformance wrapper is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["a2a:wrap-tck-conformance"],
    "npm run build && tsx scripts/wrap-a2a-tck-conformance.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /wrap-tck-conformance/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /wrap-tck-conformance/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /wrap-tck-conformance/);
});

test("A2A external conformance smoke is networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["smoke:a2a-external-conformance"],
    "npm run build && tsx scripts/smoke-a2a-external-conformance.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /a2a-external-conformance/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /a2a-external-conformance/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /a2a-external-conformance/);
});

test("operator live gate report writer is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["operator:write-blocker-resolution-plan"],
    "npm run build && tsx scripts/write-blocker-resolution-plan.ts",
  );
  assert.equal(
    packageJson.scripts?.["operator:write-live-gate-report"],
    "npm run build && tsx scripts/check-operator-live-gates.ts --json --out tmp/vallum/operator-live-gates.json",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-blocker-resolution-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-blocker-resolution-plan/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-blocker-resolution-plan/);
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-live-gate-report/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-live-gate-report/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-live-gate-report/);
});

test("operator structured report template writer is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["operator:write-report-template"],
    "npm run build && tsx scripts/write-operator-report-template.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-report-template/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-report-template/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-report-template/);
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
  assert.equal(packageJson.scripts?.["docs:check"], "npm run check -w @vallum/docs-site");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run docs:check/);
});

test("registry, contract metadata, and standards packages are built and included in package dry-runs", () => {
  assert.match(packageJson.scripts?.["build"] ?? "", /npm run build -w @vallum\/registry/);
  assert.match(packageJson.scripts?.["pack:check"] ?? "", /-w @vallum\/registry/);
  assert.match(packageJson.scripts?.["build"] ?? "", /npm run build -w @vallum\/contracts-metadata/);
  assert.match(packageJson.scripts?.["pack:check"] ?? "", /-w @vallum\/contracts-metadata/);
  assert.match(packageJson.scripts?.["build"] ?? "", /npm run build -w @vallum\/standards/);
  assert.match(packageJson.scripts?.["pack:check"] ?? "", /-w @vallum\/standards/);
});

test("marketplace package is built and included in package dry-runs", () => {
  assert.match(packageJson.scripts?.["build"] ?? "", /npm run build -w @vallum\/marketplace/);
  assert.match(packageJson.scripts?.["pack:check"] ?? "", /-w @vallum\/marketplace/);
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

test("package paid MCP consumer smoke is opt-in local tarball proof", () => {
  assert.equal(
    packageJson.scripts?.["smoke:package-paid-mcp-consumer"],
    "npm run build && tsx scripts/smoke-package-paid-mcp-consumer.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /package-paid-mcp-consumer/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /package-paid-mcp-consumer/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /package-paid-mcp-consumer/);
  assert.doesNotMatch(packageJson.scripts?.["smoke:package-paid-mcp-consumer"] ?? "", /\bnpm publish\b/);
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

test("roadmap completion audit is non-networked and opt-in", () => {
  assert.equal(
    packageJson.scripts?.["proof:roadmap-completion"],
    "npm run build && tsx scripts/check-roadmap-completion.ts",
  );
  assert.equal(
    packageJson.scripts?.["roadmap:write-execution-proof-bundle"],
    "npm run build && tsx scripts/write-roadmap-execution-proof-bundle.ts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /roadmap-completion/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /roadmap-completion/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /roadmap-completion/);
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /write-execution-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /write-execution-proof-bundle/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /write-execution-proof-bundle/);
});

test("Move contract tests are wired into local verification", () => {
  assert.equal(packageJson.scripts?.["contracts:test"], "tsx scripts/run-move-tests.ts");
  assert.match(packageJson.scripts?.["verify:local"] ?? "", /npm run contracts:test/);
});

test("root docs scripts build the static hosted documentation site", () => {
  assert.equal(packageJson.scripts?.["docs:build"], "npm run build -w @vallum/docs-site");
  assert.equal(packageJson.scripts?.["docs:check"], "npm run check -w @vallum/docs-site");
  assert.equal(packageJson.scripts?.["docs:serve"], "npm run serve -w @vallum/docs-site --");
});

test("workflow execution truth does not reference deleted milestone docs", () => {
  assert.ok(apexProfile.authority?.executionTruth?.includes("docs/vallum/launch-readiness-evidence.md"));
  assert.ok(apexProfile.authority?.executionTruth?.includes("docs/vallum/testnet-digest-proof.md"));
  assert.ok(apexProfile.authority?.executionTruth?.includes("docs/reviewer-walkthrough.md"));
  assert.ok(!apexProfile.authority?.executionTruth?.includes("docs/milestone-0-proof.md"));
  assert.ok(!apexProfile.authority?.executionTruth?.includes("docs/grant-milestones.md"));
});

test("Apex workflow profile is reviewed and keeps local goal docs out of authority", () => {
  const modeIds = new Set(apexProfile.modes?.map((mode) => mode.id));

  assert.equal(apexProfile.name, "vallum");
  assert.deepEqual(apexProfile.setup?.reviewNeeded, []);
  assert.equal(apexProfile.setup?.reviewRequiredBeforeFirstSlice, false);
  assert.ok(modeIds.has("route-local"));
  assert.ok(modeIds.has("shared-surface"));
  assert.equal(apexProfile.tracker?.provider, "none");
  assert.equal(apexProfile.codeIntelligence?.provider, "focused-search");
  assert.equal(apexProfile.manifest?.defaultDir, "tmp/apex-workflow");
  assert.ok(apexProfile.verification?.presets?.readiness_slice?.commands?.includes("npm run verify:fast"));
  assert.ok(!apexProfile.authority?.executionTruth?.includes("docs/vallum/full-roadmap-execution-goal.md"));
  assert.ok(apexProfile.authority?.doNotUseAsAuthority?.includes("docs/vallum/full-roadmap-execution-goal.md"));
  assert.ok(apexProfile.authority?.doNotUseAsAuthority?.includes("docs/vallum/handoff-next-product-build.md"));
  assert.ok(apexProfile.authority?.doNotUseAsAuthority?.includes("docs/vallum/codex-active-goal.md"));
});

test("codebase map stays reviewed for Apex workflow routing", () => {
  const requiredSections = [
    "High-Level Layout",
    "Architecture Anchors",
    "Core Domains And Ownership Zones",
    "Routes, Commands, And Entry Points",
    "Data, State, Auth, And External Boundaries",
    "Frequent Edit Hotspots",
    "Risk And Coupling Areas",
    "Verification Path By Change Type",
    "Generated Or Ignored Paths",
    "Keeping This Map Current",
    "Map Evidence",
  ];

  assert.match(codebaseMap, /^Status: reviewed$/m);
  assert.doesNotMatch(codebaseMap, /REVIEW NEEDED/);
  for (const section of requiredSections) {
    assert.match(codebaseMap, new RegExp(`^## ${escapeRegExp(section)}$`, "m"));
  }
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

test("MCP stdio smoke builds first and stays opt-in", () => {
  const smokeMcpStdio = packageJson.scripts?.["smoke:mcp-stdio"];

  assert.equal(
    smokeMcpStdio,
    "npm run build && tsx scripts/smoke-mcp-stdio.ts",
    "npm run smoke:mcp-stdio must not depend on pre-existing ignored dist artifacts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /smoke:mcp-stdio/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /smoke:mcp-stdio/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /smoke:mcp-stdio/);
});

test("package MCP stdio consumer smoke builds first and stays opt-in", () => {
  const smokePackageMcpStdio = packageJson.scripts?.["smoke:package-mcp-stdio-consumer"];

  assert.equal(
    smokePackageMcpStdio,
    "npm run build && tsx scripts/smoke-package-mcp-stdio-consumer.ts",
    "npm run smoke:package-mcp-stdio-consumer must not depend on pre-existing ignored dist artifacts",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /package-mcp-stdio-consumer/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /package-mcp-stdio-consumer/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /package-mcp-stdio-consumer/);
});

test("npm registry MCP stdio consumer smoke is networked and opt-in", () => {
  const smokeNpmRegistryMcpStdio = packageJson.scripts?.["smoke:npm-registry-mcp-stdio-consumer"];

  assert.equal(
    smokeNpmRegistryMcpStdio,
    "tsx scripts/smoke-npm-registry-mcp-stdio-consumer.ts --out tmp/vallum/npm-registry-mcp-stdio-consumer-proof.json",
    "npm registry MCP stdio smoke must stay explicit because it contacts npm",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:fast"] ?? "", /npm-registry-mcp-stdio-consumer/);
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /npm-registry-mcp-stdio-consumer/);
  assert.doesNotMatch(packageJson.scripts?.["grant:check"] ?? "", /npm-registry-mcp-stdio-consumer/);
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
