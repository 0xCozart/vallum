import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  checkLaunchReadiness,
  formatLaunchReadinessReport,
} from "./check-launch-readiness.js";
import type { ProductStatusReport } from "./check-product-status.js";

test("launch readiness maps local evidence to live and production blockers", async () => {
  const report = await checkLaunchReadiness();
  const formatted = formatLaunchReadinessReport(report);

  assert.equal(report.launchReady, false);
  assert.equal(report.localEvidenceOk, true);
  assert.equal(report.areas.find((area) => area.id === "phase-1-sponsored-policy-mvp")?.status, "proven-local");
  assert.equal(report.areas.find((area) => area.id === "phase-2-identity-and-vc")?.status, "blocked-live");
  assert.equal(report.areas.find((area) => area.id === "phase-4-standards-bridges")?.status, "blocked-production");
  assert.equal(report.areas.find((area) => area.id === "phase-6-package-release")?.status, "blocked-production");
  assert.equal(report.areas.find((area) => area.id === "phase-3-contract-workflows")?.status, "deferred-safety");
  assert.match(formatted, /TESTNET_ENV_FILE_MISSING/);
  assert.match(formatted, /NPM_PUBLICATION_UNRUN/);
  assert.match(formatted, /PUBLIC_A2A_HOSTING_UNPROVEN/);
  assert.match(formatted, /DEVICE_ACCESS_SAFETY_DEFERRED/);
  assert.doesNotMatch(formatted, /private-key|mnemonic-value|local-secret|bearer-token-value/i);
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
    "packages/manifest/src/validate.ts",
    "packages/policy-gateway/src/evaluatePolicy.ts",
    "packages/sdk/src/requestSponsoredAction.ts",
    "packages/mcp-server/src/tools.ts",
    "packages/receipts/src/index.ts",
    "contracts/escrow_v1/Move.toml",
    "contracts/receipt_v1/Move.toml",
    "examples/agent-escrow/agent-escrow-demo.ts",
    "packages/registry/src/profileSchema.ts",
    "packages/registry/src/iotaNamesAdapter.ts",
    "packages/registry/src/iotaIdentityAdapter.ts",
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
    "scripts/smoke-a2a-local-server.ts",
    "packages/marketplace/src/index.ts",
    "scripts/smoke-marketplace-read-model.ts",
    "docs/marketplace-readiness.md",
    "docs/agentic-gaskit/package-release-strategy.md",
    "scripts/package-publish-dry-run.ts",
    "scripts/smoke-package-install.ts",
    "scripts/package-publish.test.ts",
    "scripts/package-install-smoke.test.ts",
    "docs/agentic-gaskit/product-status.md",
    "scripts/check-product-status.ts",
    "docs/agentic-gaskit/operator-live-gates.md",
    "scripts/check-operator-live-gates.ts",
    "docs/agentic-gaskit/full-roadmap-execution-goal.md",
    "docs/agentic-gaskit/handoff-next-product-build.md",
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
