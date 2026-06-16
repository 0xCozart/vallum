import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { LaunchReadinessReport } from "./check-launch-readiness.js";
import type { OperatorLiveGateReport } from "./check-operator-live-gates.js";
import type { ProductStatusReport } from "./check-product-status.js";
import {
  buildRoadmapCompletionArtifact,
  buildRoadmapCompletionReport,
  formatRoadmapCompletionArtifact,
  formatRoadmapCompletionReport,
  writeRoadmapCompletionArtifact,
} from "./check-roadmap-completion.js";

test("roadmap completion audit stays incomplete while any roadmap gate is open", () => {
  const report = buildRoadmapCompletionReport({
    productStatus: productStatusFixture(),
    launchReadiness: launchReadinessFixture(),
    operatorLiveGates: operatorGatesFixture(),
  });
  const formatted = formatRoadmapCompletionReport(report);

  assert.equal(report.roadmapComplete, false);
  assert.equal(report.localProofOk, true);
  assert.equal(report.productComplete, false);
  assert.equal(report.launchReady, false);
  assert.equal(report.operatorGatesClear, false);
  assert.ok(report.completionBlockers.some((blocker) => blocker.code === "IOTA_NAMES_LIVE_CONFIG_MISSING"));
  assert.ok(report.completionBlockers.some((blocker) => blocker.code === "PUBLIC_A2A_HOSTING_UNPROVEN"));
  assert.ok(report.completionBlockers.some((blocker) => blocker.code === "DEVICE_ACCESS_SAFETY_DEFERRED"));
  assert.ok(report.nextCommands.some((command) => command.includes("operator:write-report-template -- --kind iota-names-live")));
  assert.match(formatted, /roadmap completion not-complete/);
  assert.doesNotMatch(formatted, /operator-live-gates: sponsor-funding/);
  assert.doesNotMatch(formatted, /iotaprivkey|bearer-token-value|seed-phrase|mnemonic-value|graphql\.testnet\.example/i);
});

test("roadmap completion artifact summarizes blockers without configured values", () => {
  const report = buildRoadmapCompletionReport({
    productStatus: productStatusFixture(),
    launchReadiness: launchReadinessFixture(),
    operatorLiveGates: operatorGatesFixture(),
  });
  const artifact = buildRoadmapCompletionArtifact(report, new Date("2026-06-14T12:00:00.000Z"));
  const raw = formatRoadmapCompletionArtifact(artifact);
  const parsed = JSON.parse(raw) as typeof artifact;

  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.kind, "vallum.roadmap-completion-audit");
  assert.equal(parsed.generatedAt, "2026-06-14T12:00:00.000Z");
  assert.equal(parsed.roadmapComplete, false);
  assert.deepEqual(parsed.blockedProductCheckIds, [
    "iota-names-live",
    "public-a2a-hosting",
    "physical-device-access",
  ]);
  assert.deepEqual(parsed.blockedLaunchAreaIds, [
    "phase-2-identity-and-vc",
    "phase-4-standards-bridges",
    "phase-3-contract-workflows",
  ]);
  assert.deepEqual(parsed.blockedOperatorGateIds, [
    "iota-names-live",
    "public-a2a-hosting",
    "physical-device-access",
  ]);
  assert.ok(parsed.approvalRequiredGateIds.includes("sponsor-funding"));
  assert.ok(parsed.liveServiceGateIds.includes("public-a2a-hosting"));
  assert.equal(parsed.blockerCodes.includes("SPONSOR_FUNDING_REPORT_VALID"), false);
  assert.match(parsed.boundaries.join("\n"), /roadmapComplete=false/);
  assert.doesNotMatch(raw, /0x1111111111111111111111111111111111111111111111111111111111111111/);
  assert.doesNotMatch(raw, /local-secret|private-key|bearer-token-value|raw faucet|graphql\.testnet\.example/i);
});

test("roadmap completion artifact writer uses restrictive local file permissions", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-roadmap-completion-"));
  try {
    const artifact = await writeRoadmapCompletionArtifact({
      cwd,
      now: new Date("2026-06-14T12:00:00.000Z"),
      outFile: "tmp/vallum/roadmap-completion-audit.json",
      productStatus: productStatusFixture(),
      launchReadiness: launchReadinessFixture(),
      operatorLiveGates: operatorGatesFixture(),
    });
    const outFile = join(cwd, "tmp/vallum/roadmap-completion-audit.json");
    const raw = await readFile(outFile, "utf8");
    const written = JSON.parse(raw) as typeof artifact;
    const mode = (await stat(outFile)).mode & 0o777;

    assert.equal(mode, 0o600);
    assert.equal(written.kind, "vallum.roadmap-completion-audit");
    assert.equal(written.roadmapComplete, false);
    assert.deepEqual(written.blockerCodes, artifact.blockerCodes);
    assert.doesNotMatch(raw, /tmp\/vallum\/roadmap-completion-audit\.json/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("roadmap completion can become true only when all source reports are clear", () => {
  const report = buildRoadmapCompletionReport({
    productStatus: {
      complete: true,
      localProofOk: true,
      checks: [
        {
          id: "local-verification",
          status: "proven-local",
          code: "LOCAL_VERIFY_SURFACE_CONFIGURED",
          message: "Local verification is configured.",
        },
      ],
    },
    launchReadiness: {
      launchReady: true,
      localEvidenceOk: true,
      areas: [
        {
          id: "packet-h-final-product-status",
          status: "proven-local",
          claim: "Final product status is complete.",
          evidencePaths: [],
          commands: [],
          blockerCodes: [],
          next: "No remaining roadmap action.",
        },
      ],
    },
    operatorLiveGates: {
      allGatesClear: true,
      localOnly: true,
      gates: [
        {
          id: "local-verification",
          status: "proven-local",
          code: "LOCAL_VERIFY_SURFACE_CONFIGURED",
          approvalRequired: false,
          contactsLiveService: false,
          message: "Local verification is configured.",
          next: "No live action is required for this local proof gate.",
        },
      ],
    },
  });

  assert.equal(report.roadmapComplete, true);
  assert.deepEqual(report.completionBlockers, []);
  assert.deepEqual(report.nextCommands, []);
});

function productStatusFixture(): ProductStatusReport {
  return {
    complete: false,
    localProofOk: true,
    checks: [
      {
        id: "local-verification",
        status: "proven-local",
        code: "LOCAL_VERIFY_SURFACE_CONFIGURED",
        message: "Local verification is configured.",
      },
      {
        id: "sponsor-funding",
        status: "ready-live",
        code: "SPONSOR_FUNDING_REPORT_VALID",
        message: "Sponsor funding report is valid.",
        next: "Run npm run diagnose:gas-station -- --report <ignored-json-path>.",
      },
      {
        id: "iota-names-live",
        status: "blocked-live",
        code: "IOTA_NAMES_LIVE_CONFIG_MISSING",
        message: "IOTA Names live proof requires operator config.",
        next: "npm run operator:write-report-template -- --kind iota-names-live --out tmp/vallum/iota-names-live-report-template.json.",
      },
      {
        id: "public-a2a-hosting",
        status: "blocked-production",
        code: "PUBLIC_A2A_HOSTING_UNPROVEN",
        message: "Public A2A hosting is unproven.",
        next: "npm run a2a:write-public-proof-bundle -- --out <ignored-json-path>.",
      },
      {
        id: "physical-device-access",
        status: "deferred-safety",
        code: "DEVICE_ACCESS_SAFETY_DEFERRED",
        message: "Physical device access remains safety-gated.",
        next: "Approve a separate physical safety design.",
      },
    ],
  };
}

function launchReadinessFixture(): LaunchReadinessReport {
  return {
    launchReady: false,
    localEvidenceOk: true,
    areas: [
      {
        id: "phase-2-identity-and-vc",
        status: "blocked-live",
        claim: "Identity and VC live proof remains blocked.",
        evidencePaths: [],
        commands: [],
        blockerCodes: ["IOTA_NAMES_LIVE_CONFIG_MISSING"],
        next: "npm run operator:write-report-template -- --kind iota-names-live --out tmp/vallum/iota-names-live-report-template.json.",
      },
      {
        id: "phase-4-standards-bridges",
        status: "blocked-production",
        claim: "Public A2A proof remains blocked.",
        evidencePaths: [],
        commands: [],
        blockerCodes: ["PUBLIC_A2A_HOSTING_UNPROVEN"],
        next: "npm run a2a:write-public-proof-bundle -- --out <ignored-json-path>.",
      },
      {
        id: "phase-3-contract-workflows",
        status: "deferred-safety",
        claim: "Physical device access remains deferred.",
        evidencePaths: [],
        commands: [],
        blockerCodes: ["DEVICE_ACCESS_SAFETY_DEFERRED"],
        next: "Approve a separate physical safety design.",
      },
    ],
  };
}

function operatorGatesFixture(): OperatorLiveGateReport {
  return {
    allGatesClear: false,
    localOnly: false,
    gates: [
      {
        id: "local-verification",
        status: "proven-local",
        code: "LOCAL_VERIFY_SURFACE_CONFIGURED",
        approvalRequired: false,
        contactsLiveService: false,
        message: "Local verification is configured.",
        next: "No live action is required for this local proof gate.",
      },
      {
        id: "sponsor-funding",
        status: "ready-approval",
        code: "SPONSOR_FUNDING_REPORT_VALID",
        command: "npm run sponsor:check-funding -- --report tmp/vallum/sponsor-funding-report.json",
        approvalRequired: true,
        contactsLiveService: true,
        message: "Sponsor funding report is valid.",
        next: "Run only after explicit operator intent confirms the live proof should execute.",
      },
      {
        id: "iota-names-live",
        status: "blocked-config",
        code: "IOTA_NAMES_LIVE_CONFIG_MISSING",
        command: "npm run operator:write-report-template -- --kind iota-names-live --out tmp/vallum/iota-names-live-report-template.json && npm run smoke:iota-names-live -- --report <ignored-json-path>",
        approvalRequired: true,
        contactsLiveService: true,
        message: "IOTA Names live proof requires operator config.",
        next: "Provide operator-owned local configuration outside committed files, then rerun this gate report.",
      },
      {
        id: "public-a2a-hosting",
        status: "requires-approval",
        code: "PUBLIC_A2A_HOSTING_UNPROVEN",
        command: "npm run a2a:write-public-proof-bundle -- --out tmp/vallum/a2a-public-proof-bundle.json && npm run proof:a2a-public-readiness && npm run smoke:a2a-public-discovery",
        approvalRequired: true,
        contactsLiveService: true,
        message: "Public A2A hosting is unproven.",
        next: "Run public discovery only with operator-approved public A2A config.",
      },
      {
        id: "physical-device-access",
        status: "deferred-safety",
        code: "DEVICE_ACCESS_SAFETY_DEFERRED",
        approvalRequired: true,
        contactsLiveService: false,
        message: "Physical device access remains safety-gated.",
        next: "Approve a separate physical safety design.",
      },
    ],
  };
}
