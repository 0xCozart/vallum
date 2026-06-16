import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  formatLiveProofPlan,
  writeLiveProofPlan,
} from "./write-live-proof-plan.js";

test("live proof plan reports current blockers without configured values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-live-proof-plan-"));
  try {
    const plan = await writeLiveProofPlan({
      cwd,
      env: {
        IOTA_NAMES_GRAPHQL_URL: "https://graphql.testnet.example/iota",
        IOTA_NAMES_NAME: "researcher.demo.iota",
        IOTA_NAMES_EXPECTED_ADDRESS: "0x1111111111111111111111111111111111111111111111111111111111111111",
        IOTA_IDENTITY_PROOF_ENDPOINT: "https://identity.testnet.example/proof",
        IOTA_IDENTITY_PROFILE_PATH: "profiles/researcher.json",
        IOTA_IDENTITY_TRUSTED_ISSUER_DIDS: "did:iota:issuer:agent-registry",
        IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS: "#agent-capability-key-1",
        IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES: "VerifiableCredential,AgentCapabilityCredential",
        IOTA_IDENTITY_ACCEPTED_STATUS_TYPES: "RevocationBitmap2022",
        IOTA_IDENTITY_CACHE_TTL_MS: "60000",
      },
      gasStationRuntimeReport: blockedGasStationRuntime(),
      now: new Date("2026-06-13T12:00:00.000Z"),
    });
    const formatted = formatLiveProofPlan(plan);

    assert.equal(plan.kind, "vallum.live-proof-plan");
    assert.equal(plan.status, "blocked");
    assert.equal(plan.liveProofReady, false);
    assert.ok(plan.blockerCodes.includes("TESTNET_ENV_FILE_MISSING"));
    assert.ok(plan.blockerCodes.includes("GAS_STATION_DOCKER_DAEMON_UNAVAILABLE"));
    assert.ok(plan.blockerCodes.includes("SPONSOR_FUNDING_REPORT_MISSING"));
    assert.ok(plan.blockerCodes.includes("TESTNET_UPSTREAM_REPORT_MISSING"));
    assert.ok(plan.blockerCodes.includes("TESTNET_DIGEST_REPORT_MISSING"));
    assert.ok(plan.blockerCodes.includes("IOTA_NAMES_LIVE_REPORT_MISSING"));
    assert.ok(plan.blockerCodes.includes("IOTA_IDENTITY_LIVE_REPORT_MISSING"));
    assert.ok(plan.blockerCodes.includes("VC_VALIDATION_LIVE_REPORT_MISSING"));
    assert.ok(plan.requiredOperatorInputs.includes("VALLUM_SPONSOR_FUNDING_REPORT"));
    assert.ok(plan.requiredOperatorInputs.includes("VALLUM_TESTNET_DIGEST_REPORT"));
    assert.ok(plan.optionalOperatorInputs.includes("VALLUM_SPONSOR_FAUCET_REPORT"));
    assert.ok(plan.requiredEvidenceArtifacts.includes("sanitized sponsor funding report"));
    assert.ok(plan.requiredEvidenceArtifacts.includes("sanitized testnet sponsored execute digest proof report"));
    assert.ok(plan.requiredOperatorInputs.includes("IOTA_NAMES_GRAPHQL_URL"));
    assert.ok(plan.requiredOperatorInputs.includes("IOTA_NAMES_LIVE_REPORT"));
    assert.ok(plan.requiredEvidenceArtifacts.includes("sanitized IOTA Names live smoke report"));
    assert.ok(plan.requiredOperatorInputs.includes("IOTA_IDENTITY_PROOF_ENDPOINT"));
    assert.ok(plan.requiredOperatorInputs.includes("IOTA_IDENTITY_LIVE_REPORT"));
    assert.ok(plan.requiredEvidenceArtifacts.includes("sanitized IOTA Identity live smoke report with credential evidence"));
    assert.ok(plan.commands.some((command) => command.id === "write-sponsor-funding-request" && !command.contactsLiveService));
    assert.ok(plan.commands.some((command) => command.id === "request-sponsor-faucet-funds" && command.requiresOperatorApproval));
    assert.ok(plan.commands.some((command) => command.id === "check-sponsor-funding" && command.contactsLiveService));
    assert.ok(plan.commands.some((command) => command.id === "triage-testnet-upstream-reachability" && command.command.includes("--skip-reserve")));
    assert.ok(plan.commands.some((command) => command.id === "write-testnet-upstream-report-template" && command.command.includes("--kind testnet-upstream") && !command.contactsLiveService));
    assert.ok(plan.commands.some((command) => command.id === "diagnose-testnet-upstream" && command.contactsLiveService));
    assert.ok(plan.commands.some((command) => command.id === "write-testnet-digest-report-template" && command.command.includes("--kind testnet-digest") && !command.requiresOperatorApproval));
    assert.ok(plan.commands.some((command) => command.id === "check-testnet-digest-live" && command.command.includes("proof:testnet-digest:live -- --report")));
    assert.ok(plan.commands.some((command) => command.id === "write-iota-names-live-report-template" && command.command.includes("--kind iota-names-live")));
    assert.ok(plan.commands.some((command) => command.id === "write-iota-identity-live-report-template" && command.command.includes("--kind iota-identity-live")));
    assert.ok(plan.commands.some((command) => command.id === "write-vc-validation-live-report-template" && command.command.includes("--kind vc-validation-live")));
    assert.ok(
      plan.commands.findIndex((command) => command.id === "triage-testnet-upstream-reachability")
      < plan.commands.findIndex((command) => command.id === "write-testnet-upstream-report-template"),
    );
    assert.ok(
      plan.commands.findIndex((command) => command.id === "write-testnet-upstream-report-template")
      < plan.commands.findIndex((command) => command.id === "diagnose-testnet-upstream"),
    );
    assert.ok(
      plan.commands.findIndex((command) => command.id === "diagnose-testnet-upstream")
      < plan.commands.findIndex((command) => command.id === "write-testnet-digest-report-template"),
    );
    assert.ok(
      plan.commands.findIndex((command) => command.id === "write-testnet-digest-report-template")
      < plan.commands.findIndex((command) => command.id === "check-testnet-digest-live"),
    );
    assert.ok(plan.commands.some((command) => command.id === "smoke-iota-names-live" && command.command.includes("--report")));
    assert.ok(plan.commands.some((command) => command.id === "smoke-iota-identity-live" && command.command.includes("--report")));
    assert.ok(
      plan.commands.findIndex((command) => command.id === "write-iota-names-live-report-template")
      < plan.commands.findIndex((command) => command.id === "smoke-iota-names-live"),
    );
    assert.ok(
      plan.commands.findIndex((command) => command.id === "write-iota-identity-live-report-template")
      < plan.commands.findIndex((command) => command.id === "smoke-iota-identity-live"),
    );
    assert.ok(
      plan.commands.findIndex((command) => command.id === "smoke-iota-identity-live")
      < plan.commands.findIndex((command) => command.id === "write-vc-validation-live-report-template"),
    );
    assert.equal(
      plan.checks.find((check) => check.id === "sponsor-funding")?.evidence,
      "missing=VALLUM_SPONSOR_FUNDING_REPORT",
    );
    assert.ok(plan.boundaries.some((boundary) => boundary.includes("only a passing sponsor funding report")));
    assert.ok(plan.boundaries.some((boundary) => boundary.includes("testnet digest report is a read-only IOTA RPC lookup")));
    assert.ok(plan.boundaries.some((boundary) => boundary.includes("--skip-reserve upstream diagnostic is reachability triage only")));
    assert.doesNotMatch(formatted, /graphql\.testnet\.example|researcher\.demo\.iota|identity\.testnet\.example|profiles\/researcher\.json/);
    assert.doesNotMatch(formatted, /0x1111111111111111111111111111111111111111111111111111111111111111/);
    assert.doesNotMatch(formatted, /agent-registry|agent-capability-key-1/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof plan can write a redacted local artifact", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-live-proof-plan-"));
  try {
    const outFile = join(cwd, "tmp", "live-proof-plan.json");
    const plan = await writeLiveProofPlan({
      cwd,
      outFile,
      env: {},
      gasStationRuntimeReport: blockedGasStationRuntime(),
      now: new Date("2026-06-13T12:00:00.000Z"),
    });
    const mode = (await stat(outFile)).mode & 0o777;
    const parsed = JSON.parse(await readFile(outFile, "utf8")) as typeof plan;

    assert.equal(mode, 0o600);
    assert.equal(parsed.kind, "vallum.live-proof-plan");
    assert.deepEqual(parsed.blockerCodes, plan.blockerCodes);
    assert.ok(parsed.boundaries.some((boundary) => boundary.includes("non-networked")));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

function blockedGasStationRuntime() {
  return {
    ready: false,
    code: "GAS_STATION_DOCKER_DAEMON_UNAVAILABLE" as const,
    message: "Docker daemon is not reachable.",
    checks: [],
  };
}
