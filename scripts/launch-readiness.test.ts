import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  buildLaunchReadinessArtifact,
  checkLaunchReadiness,
  formatLaunchReadinessArtifact,
  formatLaunchReadinessReport,
  writeLaunchReadinessArtifact,
} from "./check-launch-readiness.js";
import type { ProductStatusReport } from "./check-product-status.js";

test("launch readiness maps local evidence to live and production blockers", async () => {
  const report = await checkLaunchReadiness({
    productStatus: productStatusWithLiveBlockers(),
  });
  const formatted = formatLaunchReadinessReport(report);

  assert.equal(report.launchReady, false);
  assert.equal(report.localEvidenceOk, true);
  assert.equal(report.areas.find((area) => area.id === "phase-1-sponsored-policy-mvp")?.status, "blocked-live");
  const phase1 = report.areas.find((area) => area.id === "phase-1-sponsored-policy-mvp");
  assert.ok(phase1?.evidencePaths.includes("scripts/write-sponsor-funding-request.ts"));
  assert.ok(phase1?.evidencePaths.includes("scripts/request-sponsor-faucet-funds.ts"));
  assert.ok(phase1?.commands.includes("npm run operator:write-report-template -- --kind custody-production --out tmp/gaskit/custody-production-report-template.json"));
  assert.ok(phase1?.commands.includes("npm run sponsor:write-funding-request -- --out tmp/gaskit/sponsor-funding-request.json"));
  assert.ok(phase1?.commands.includes("npm run sponsor:request-faucet-funds -- --execute --out tmp/gaskit/sponsor-faucet-request.json"));
  assert.ok(phase1?.commands.includes("npm run sponsor:write-funding-request -- --faucet-report tmp/gaskit/sponsor-faucet-request.json --out tmp/gaskit/sponsor-funding-request.json"));
  assert.ok(phase1?.commands.includes("npm run operator:write-report-template -- --kind testnet-digest --out tmp/gaskit/testnet-digest-report-template.json"));
  assert.ok(phase1?.commands.includes("npm run proof:testnet-digest:live -- --report tmp/gaskit/testnet-digest-proof.json"));
  assert.equal(phase1?.commands.includes("npm run proof:testnet-digest:live"), false);
  assert.ok(phase1?.commands.includes("npm run proof:live-status"));
  assert.ok(phase1?.commands.includes("npm run operator:write-report-template -- --kind testnet-upstream --out tmp/gaskit/testnet-upstream-report-template.json"));
  assert.ok(
    (phase1?.commands.indexOf("npm run sponsor:write-funding-request -- --faucet-report tmp/gaskit/sponsor-faucet-request.json --out tmp/gaskit/sponsor-funding-request.json") ?? -1)
      < (phase1?.commands.indexOf("npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json") ?? -1),
  );
  assert.ok(
    (phase1?.commands.indexOf("npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json") ?? -1)
      < (phase1?.commands.indexOf("npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json") ?? -1),
  );
  assert.match(phase1?.next ?? "", /funding request/);
  assert.ok(phase1?.commands.includes("npm run diagnose:gas-station -- --skip-reserve --report tmp/gaskit/testnet-upstream-diagnostic.json"));
  assert.ok(phase1?.commands.includes("npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json"));
  assert.ok(
    (phase1?.commands.indexOf("npm run diagnose:gas-station -- --skip-reserve --report tmp/gaskit/testnet-upstream-diagnostic.json") ?? -1)
      < (phase1?.commands.indexOf("npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json") ?? -1),
  );
  assert.ok(
    (phase1?.commands.indexOf("npm run operator:write-report-template -- --kind testnet-upstream --out tmp/gaskit/testnet-upstream-report-template.json") ?? -1)
      < (phase1?.commands.indexOf("npm run diagnose:gas-station -- --skip-reserve --report tmp/gaskit/testnet-upstream-diagnostic.json") ?? -1),
  );
  assert.ok(
    (phase1?.commands.indexOf("npm run proof:testnet-digest:live -- --report tmp/gaskit/testnet-digest-proof.json") ?? -1)
      < (phase1?.commands.indexOf("npm run execute:testnet-demo") ?? -1),
  );
  const phase2 = report.areas.find((area) => area.id === "phase-2-identity-and-vc");
  assert.equal(phase2?.status, "blocked-live");
  assert.ok(phase2?.commands.includes("npm run live:write-identity-proof-bundle -- --out tmp/gaskit/identity-proof-bundle.json"));
  assert.ok(phase2?.commands.includes("npm run operator:write-report-template -- --kind iota-names-live --out tmp/gaskit/iota-names-live-report-template.json"));
  assert.ok(phase2?.commands.includes("npm run operator:write-report-template -- --kind iota-identity-live --out tmp/gaskit/iota-identity-live-report-template.json"));
  assert.ok(phase2?.commands.includes("npm run operator:write-report-template -- --kind vc-validation-live --out tmp/gaskit/vc-validation-live-report-template.json"));
  assert.ok(
    (phase2?.commands.indexOf("npm run operator:write-report-template -- --kind iota-names-live --out tmp/gaskit/iota-names-live-report-template.json") ?? -1)
      < (phase2?.commands.indexOf("npm run smoke:iota-names-live -- --report tmp/gaskit/iota-names-live-report.json") ?? -1),
  );
  assert.ok(
    (phase2?.commands.indexOf("npm run operator:write-report-template -- --kind iota-identity-live --out tmp/gaskit/iota-identity-live-report-template.json") ?? -1)
      < (phase2?.commands.indexOf("npm run smoke:iota-identity-live -- --report tmp/gaskit/iota-identity-live-report.json") ?? -1),
  );
  const standards = report.areas.find((area) => area.id === "phase-4-standards-bridges");
  assert.equal(standards?.status, "blocked-production");
  assert.ok(standards?.commands.includes("npm run operator:write-report-template -- --kind payment-provider-live --out tmp/gaskit/payment-provider-live-report-template.json"));
  assert.ok(standards?.commands.includes("npm run operator:write-report-template -- --kind a2a-public-discovery --out tmp/gaskit/a2a-public-discovery-report-template.json"));
  assert.ok(standards?.commands.includes("npm run operator:write-report-template -- --kind a2a-public-push-delivery --out tmp/gaskit/a2a-public-push-delivery-report-template.json"));
  assert.ok(standards?.commands.includes("npm run operator:write-report-template -- --kind a2a-external-conformance --out tmp/gaskit/a2a-external-conformance-report-template.json"));
  assert.ok(standards?.commands.includes("npm run a2a:write-public-proof-bundle -- --out tmp/gaskit/a2a-public-proof-bundle.json"));
  assert.ok(standards?.commands.includes("npm run a2a:write-public-proof-plan"));
  assert.ok(standards?.commands.includes("npm run proof:a2a-public-readiness"));
  assert.ok(
    (standards?.commands.indexOf("npm run operator:write-report-template -- --kind payment-provider-live --out tmp/gaskit/payment-provider-live-report-template.json") ?? -1)
      < (standards?.commands.indexOf("npm run payment:write-provider-proof-plan") ?? -1),
  );
  assert.ok(
    (standards?.commands.indexOf("npm run a2a:write-public-proof-plan") ?? -1)
      < (standards?.commands.indexOf("npm run proof:a2a-public-readiness") ?? -1),
  );
  const marketplace = report.areas.find((area) => area.id === "phase-5-marketplace-operator");
  assert.equal(marketplace?.status, "blocked-production");
  assert.ok(marketplace?.commands.includes("npm run operator:write-report-template -- --kind marketplace-production --out tmp/gaskit/marketplace-production-report-template.json"));
  const packageRelease = report.areas.find((area) => area.id === "phase-6-package-release");
  assert.equal(packageRelease?.status, "blocked-production");
  assert.ok(packageRelease?.commands.includes("npm run operator:write-report-template -- --kind package-publication --out tmp/gaskit/package-publication-report-template.json"));
  assert.equal(report.areas.find((area) => area.id === "phase-3-contract-workflows")?.status, "deferred-safety");
  assert.ok(
    report.areas
      .find((area) => area.id === "packet-h-final-product-status")
      ?.blockerCodes.includes("GAS_STATION_DOCKER_DAEMON_UNAVAILABLE"),
  );
  assert.ok(
    report.areas
      .find((area) => area.id === "packet-h-final-product-status")
      ?.commands.includes("npm run operator:write-report-template -- --kind <kind> --out <ignored-report-template.json>"),
  );
  assert.match(formatted, /TESTNET_ENV_FILE_MISSING/);
  assert.match(formatted, /GAS_STATION_DOCKER_DAEMON_UNAVAILABLE/);
  assert.match(formatted, /NPM_PUBLICATION_UNRUN/);
  assert.match(formatted, /PUBLIC_A2A_HOSTING_UNPROVEN/);
  assert.match(formatted, /DEVICE_ACCESS_SAFETY_DEFERRED/);
  assert.doesNotMatch(formatted, /private-key|mnemonic-value|local-secret|bearer-token-value/i);
});

test("launch readiness artifact summarizes areas without secret values", async () => {
  const report = await checkLaunchReadiness({
    productStatus: productStatusWithLiveBlockers(),
  });
  const artifact = buildLaunchReadinessArtifact(report, new Date("2026-06-14T12:00:00.000Z"));
  const json = formatLaunchReadinessArtifact(artifact);
  const parsed = JSON.parse(json) as typeof artifact;

  assert.equal(parsed.kind, "agentic-gaskit.launch-readiness-report");
  assert.equal(parsed.launchReady, false);
  assert.equal(parsed.localEvidenceOk, true);
  assert.equal(parsed.blockedLiveAreaIds.includes("phase-1-sponsored-policy-mvp"), true);
  assert.equal(parsed.blockedProductionAreaIds.includes("phase-4-standards-bridges"), true);
  assert.equal(parsed.deferredSafetyAreaIds.includes("phase-3-contract-workflows"), true);
  assert.equal(parsed.blockerCodes.includes("SPONSOR_FUNDING_REPORT_MISSING"), true);
  assert.equal(parsed.blockerCodes.includes("TESTNET_DIGEST_DOCS_MISSING"), true);
  assert.equal(parsed.blockerCodes.includes("PUBLIC_A2A_HOSTING_UNPROVEN"), true);
  assert.match(parsed.boundaries.join("\n"), /launchReady=false/);
  assert.doesNotMatch(json, /private-key|mnemonic-value|local-secret|bearer-token-value/i);
});

test("launch readiness artifact writer uses restrictive local file permissions", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-launch-artifact-"));
  try {
    await writeEvidenceTree(cwd);
    const outFile = "tmp/gaskit/launch-readiness.json";
    const artifact = await writeLaunchReadinessArtifact({
      cwd,
      productStatus: productStatusWithLiveBlockers(),
      now: new Date("2026-06-14T12:00:00.000Z"),
      outFile,
    });
    const written = await readFile(join(cwd, outFile), "utf8");
    const mode = (await stat(join(cwd, outFile))).mode & 0o777;

    assert.equal(artifact.kind, "agentic-gaskit.launch-readiness-report");
    assert.equal(JSON.parse(written).kind, "agentic-gaskit.launch-readiness-report");
    assert.equal(mode, 0o600);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("launch readiness can become ready only when product status is complete and evidence exists", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-launch-ready-"));
  try {
    await writeEvidenceTree(cwd);
    const report = await checkLaunchReadiness({
      cwd,
      productStatus: completeProductStatus(),
    });

    assert.equal(report.localEvidenceOk, true);
    assert.equal(report.launchReady, true);
    assert.ok(report.areas.every((area) => area.status === "proven-local"));
    assert.ok(report.areas.every((area) => area.blockerCodes.length === 0));
    assert.match(
      report.areas.find((area) => area.id === "phase-1-sponsored-policy-mvp")?.next ?? "",
      /public digest current/,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("launch readiness fails local evidence when required source paths are missing", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-launch-missing-"));
  try {
    const report = await checkLaunchReadiness({
      cwd,
      productStatus: completeProductStatus(),
    });
    const phase1 = report.areas.find((area) => area.id === "phase-1-sponsored-policy-mvp");

    assert.equal(report.localEvidenceOk, false);
    assert.equal(report.launchReady, false);
    assert.equal(phase1?.status, "blocked-production");
    assert.ok(phase1?.blockerCodes.some((code) => code.startsWith("EVIDENCE_PATH_MISSING:packages/accounts")));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

async function writeEvidenceTree(cwd: string): Promise<void> {
  const paths = [
    "packages/accounts/src/index.ts",
    "scripts/check-custody-readiness.ts",
    "scripts/write-custody-production-proof-plan.ts",
    "packages/manifest/src/validate.ts",
    "packages/policy-gateway/src/evaluatePolicy.ts",
    "packages/sdk/src/requestSponsoredAction.ts",
    "packages/mcp-server/src/tools.ts",
    "packages/receipts/src/index.ts",
    "contracts/escrow_v1/Move.toml",
    "contracts/receipt_v1/Move.toml",
    "examples/agent-escrow/agent-escrow-demo.ts",
    "docs/testnet-attempts.md",
    "docs/agentic-gaskit/live-proof-status.md",
    "scripts/check-gas-station-runtime-preflight.ts",
    "scripts/write-sponsor-funding-request.ts",
    "scripts/request-sponsor-faucet-funds.ts",
    "scripts/check-sponsor-funding.ts",
    "scripts/check-testnet-digest-proof.ts",
    "packages/registry/src/profileSchema.ts",
    "packages/registry/src/iotaNamesAdapter.ts",
    "packages/registry/src/iotaIdentityAdapter.ts",
    "scripts/write-live-proof-plan.ts",
    "scripts/write-identity-proof-bundle.ts",
    "scripts/smoke-iota-names-live.ts",
    "scripts/smoke-iota-identity-live.ts",
    "docs/agentic-gaskit/live-proof-status.md",
    "contracts/pay_per_call_v1/Move.toml",
    "contracts/data_license_v1/Move.toml",
    "contracts/service_bounty_v1/Move.toml",
    "contracts/reputation_receipt_v1/Move.toml",
    "contracts/subscription_v1/Move.toml",
    "docs/agentic-gaskit/device-access-safety-gate.md",
    "packages/standards/src/x402.ts",
    "packages/standards/src/ap2.ts",
    "packages/standards/src/a2a.ts",
    "packages/standards/src/a2aHttp.ts",
    "packages/standards/src/a2aNodeServer.ts",
    "packages/standards/src/a2aPush.ts",
    "scripts/check-payment-provider-readiness.ts",
    "scripts/check-a2a-public-readiness.ts",
    "scripts/write-a2a-public-proof-bundle.ts",
    "scripts/smoke-a2a-static-discovery-local.ts",
    "docs/agentic-gaskit/a2a-public-readiness.md",
    "scripts/smoke-a2a-local-server.ts",
    "packages/marketplace/src/index.ts",
    "scripts/smoke-marketplace-read-model.ts",
    "scripts/check-marketplace-readiness.ts",
    "scripts/write-marketplace-production-proof-plan.ts",
    "docs/marketplace-readiness.md",
    "docs/agentic-gaskit/package-release-strategy.md",
    "scripts/package-publish-dry-run.ts",
    "scripts/smoke-package-install.ts",
    "scripts/check-package-publication-readiness.ts",
    "scripts/write-package-publication-proof-plan.ts",
    "scripts/package-publish.test.ts",
    "scripts/package-install-smoke.test.ts",
    "docs/agentic-gaskit/product-status.md",
    "scripts/check-product-status.ts",
    "docs/agentic-gaskit/operator-live-gates.md",
    "scripts/check-operator-live-gates.ts",
    "scripts/write-operator-report-template.ts",
    "docs/agentic-gaskit/verification-profiles.md",
    "scripts/check-verification-profiles.ts",
    "docs/agentic-gaskit/execution-slices.md",
    "docs/CODEBASE_MAP.md",
  ];
  for (const path of paths) {
    const file = join(cwd, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, "evidence\n");
  }
}

function completeProductStatus(): ProductStatusReport {
  const checks = [
    "testnet-readiness",
    "gas-station-runtime",
    "sponsor-funding",
    "testnet-upstream",
    "testnet-sponsored-execute",
    "iota-names-live",
    "iota-identity-live",
    "vc-validation-live",
    "physical-device-access",
    "public-a2a-hosting",
    "live-payment-provider",
    "production-marketplace",
    "npm-registry-publication",
    "production-custody",
  ].map((id) => ({
    id,
    status: "proven-local" as const,
    code: `${id.toUpperCase().replaceAll("-", "_")}_PROVEN`,
    message: "Synthetic complete product status for readiness tests.",
  }));

  return {
    complete: true,
    localProofOk: true,
    checks,
  };
}

function productStatusWithLiveBlockers(): ProductStatusReport {
  return {
    complete: false,
    localProofOk: true,
    checks: [
      {
        id: "testnet-readiness",
        status: "blocked-live",
        code: "TESTNET_ENV_FILE_MISSING",
        message: "Synthetic missing testnet env for launch-readiness mapping tests.",
      },
      {
        id: "gas-station-runtime",
        status: "blocked-live",
        code: "GAS_STATION_DOCKER_DAEMON_UNAVAILABLE",
        message: "Synthetic missing Gas Station runtime for launch-readiness mapping tests.",
      },
      {
        id: "sponsor-funding",
        status: "blocked-live",
        code: "SPONSOR_FUNDING_REPORT_MISSING",
        message: "Synthetic missing sponsor funding report for launch-readiness mapping tests.",
      },
      {
        id: "testnet-upstream",
        status: "blocked-live",
        code: "TESTNET_UPSTREAM_REPORT_MISSING",
        message: "Synthetic missing upstream diagnostic report for launch-readiness mapping tests.",
      },
      {
        id: "testnet-sponsored-execute",
        status: "blocked-live",
        code: "TESTNET_DIGEST_DOCS_MISSING",
        message: "Synthetic missing sponsored execute digest proof for launch-readiness mapping tests.",
      },
      {
        id: "iota-names-live",
        status: "blocked-live",
        code: "IOTA_NAMES_LIVE_CONFIG_MISSING",
        message: "Synthetic missing Names config for launch-readiness mapping tests.",
      },
      {
        id: "iota-identity-live",
        status: "blocked-live",
        code: "IOTA_IDENTITY_LIVE_CONFIG_MISSING",
        message: "Synthetic missing Identity config for launch-readiness mapping tests.",
      },
      {
        id: "vc-validation-live",
        status: "blocked-live",
        code: "VC_TRUST_POLICY_CONFIG_MISSING",
        message: "Synthetic missing VC config for launch-readiness mapping tests.",
      },
      {
        id: "physical-device-access",
        status: "deferred-safety",
        code: "DEVICE_ACCESS_SAFETY_DEFERRED",
        message: "Synthetic device-safety blocker for launch-readiness mapping tests.",
      },
      {
        id: "public-a2a-hosting",
        status: "blocked-production",
        code: "PUBLIC_A2A_HOSTING_UNPROVEN",
        message: "Synthetic public A2A blocker for launch-readiness mapping tests.",
      },
      {
        id: "live-payment-provider",
        status: "blocked-production",
        code: "LIVE_PAYMENT_PROVIDER_UNPROVEN",
        message: "Synthetic payment-provider blocker for launch-readiness mapping tests.",
      },
      {
        id: "production-marketplace",
        status: "blocked-production",
        code: "PRODUCTION_MARKETPLACE_BLOCKED",
        message: "Synthetic marketplace blocker for launch-readiness mapping tests.",
      },
      {
        id: "npm-registry-publication",
        status: "blocked-production",
        code: "NPM_PUBLICATION_UNRUN",
        message: "Synthetic npm publication blocker for launch-readiness mapping tests.",
      },
      {
        id: "production-custody",
        status: "blocked-production",
        code: "PRODUCTION_CUSTODY_OUT_OF_SCOPE",
        message: "Synthetic custody blocker for launch-readiness mapping tests.",
      },
    ],
  };
}
