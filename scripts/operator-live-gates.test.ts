import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  checkOperatorLiveGates,
  formatOperatorLiveGateArtifact,
  formatOperatorLiveGateReport,
  writeOperatorLiveGateArtifact,
  type OperatorLiveGateReport,
} from "./check-operator-live-gates.js";
import type { ProductStatusReport } from "./check-product-status.js";

test("operator live gates report current blockers without secret values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-operator-gates-"));
  try {
    await writeFile(join(cwd, "package.json"), JSON.stringify({ scripts: {} }));
    const report = await checkOperatorLiveGates({
      cwd,
      gasStationRuntimeReport: blockedGasStationRuntime(),
      env: {
        IOTA_NAMES_GRAPHQL_URL: "https://graphql.testnet.example/iota",
        IOTA_NAMES_NAME: "researcher.demo.iota",
        IOTA_NAMES_EXPECTED_ADDRESS: "0x1111111111111111111111111111111111111111111111111111111111111111",
        IOTA_IDENTITY_PROOF_ENDPOINT: "https://identity.testnet.example/proof",
        IOTA_IDENTITY_PROFILE_PATH: "profiles/researcher.json",
      },
    });
    const formatted = formatOperatorLiveGateReport(report);

    assert.equal(report.allGatesClear, false);
    assert.equal(report.localOnly, false);
    assert.equal(findGate(report, "local-verification").status, "blocked-production");
    assert.equal(findGate(report, "iota-names-live").status, "blocked-config");
    assert.equal(findGate(report, "iota-names-live").approvalRequired, true);
    assert.equal(findGate(report, "iota-names-live").contactsLiveService, true);
    assert.equal(findGate(report, "iota-identity-live").status, "blocked-config");
    assert.equal(findGate(report, "testnet-readiness").status, "blocked-config");
    assert.equal(findGate(report, "gas-station-runtime").status, "blocked-config");
    assert.equal(findGate(report, "gas-station-runtime").approvalRequired, false);
    assert.equal(findGate(report, "gas-station-runtime").contactsLiveService, false);
    assert.equal(findGate(report, "gas-station-runtime").command, "npm run gas-station:runtime-preflight");
    assert.equal(findGate(report, "sponsor-funding").status, "blocked-config");
    assert.equal(findGate(report, "sponsor-funding").approvalRequired, true);
    assert.equal(findGate(report, "sponsor-funding").contactsLiveService, true);
    assert.equal(
      findGate(report, "sponsor-funding").command,
      "npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json",
    );
    assert.equal(findGate(report, "testnet-upstream").status, "blocked-config");
    assert.equal(findGate(report, "testnet-upstream").command, "npm run diagnose:gas-station");
    assert.equal(
      findGate(report, "iota-names-live").command,
      "npm run live:write-proof-plan && npm run smoke:iota-names-live -- --report <ignored-json-path>",
    );
    assert.equal(
      findGate(report, "iota-identity-live").command,
      "npm run live:write-proof-plan && npm run smoke:iota-identity-live -- --report <ignored-json-path>",
    );
    assert.equal(findGate(report, "npm-registry-publication").status, "requires-approval");
    assert.equal(
      findGate(report, "npm-registry-publication").command,
      "npm run package:write-publication-proof-plan && npm run proof:package-publication-readiness && operator-approved npm publish workflow",
    );
    assert.equal(
      findGate(report, "public-a2a-hosting").command,
      "npm run proof:a2a-public-readiness && npm run smoke:a2a-public-discovery",
    );
    assert.equal(
      findGate(report, "live-payment-provider").command,
      "npm run payment:write-provider-proof-plan && npm run proof:payment-provider-readiness",
    );
    assert.equal(
      findGate(report, "production-marketplace").command,
      "npm run marketplace:write-production-proof-plan && npm run proof:marketplace-readiness && dedicated production marketplace readiness slice",
    );
    assert.equal(
      findGate(report, "production-custody").command,
      "npm run custody:write-production-proof-plan && npm run proof:custody-readiness && dedicated custody/security design slice",
    );
    assert.equal(findGate(report, "physical-device-access").status, "deferred-safety");
    assert.doesNotMatch(formatted, /graphql\.testnet\.example|researcher\.demo\.iota|identity\.testnet\.example|profiles\/researcher\.json/);
    assert.doesNotMatch(formatted, /0x1111111111111111111111111111111111111111111111111111111111111111/);
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

test("operator live gates mark configured testnet readiness as ready-to-run without live contact", async () => {
  const report = await checkOperatorLiveGates({
    productStatus: productStatusFixture([
      {
        id: "testnet-readiness",
        status: "ready-live",
        code: "TESTNET_READINESS_CONFIG_PRESENT",
        message: "Local testnet readiness configuration passes non-network validation.",
      },
    ]),
  });
  const testnet = findGate(report, "testnet-readiness");

  assert.equal(testnet.status, "ready-to-run");
  assert.equal(testnet.approvalRequired, false);
  assert.equal(testnet.contactsLiveService, false);
  assert.equal(testnet.command, "npm run readiness:testnet");
});

test("operator live gates keep Gas Station runtime preflight local-only", async () => {
  const report = await checkOperatorLiveGates({
    productStatus: productStatusFixture([
      {
        id: "gas-station-runtime",
        status: "ready-live",
        code: "GAS_STATION_RUNTIME_READY",
        message: "Local Gas Station runtime prerequisites are present.",
      },
    ]),
  });
  const runtime = findGate(report, "gas-station-runtime");

  assert.equal(runtime.status, "ready-to-run");
  assert.equal(runtime.approvalRequired, false);
  assert.equal(runtime.contactsLiveService, false);
  assert.equal(runtime.command, "npm run gas-station:runtime-preflight");
});

test("operator live gates require approval for configured live endpoint smokes", async () => {
  const report = await checkOperatorLiveGates({
    productStatus: productStatusFixture([
      {
        id: "sponsor-funding",
        status: "ready-live",
        code: "SPONSOR_FUNDING_REPORT_VALID",
        message: "Sponsor funding report proves enough sampled IOTA balance for the requested reserve budget.",
      },
      {
        id: "testnet-upstream",
        status: "ready-live",
        code: "TESTNET_UPSTREAM_REPORT_VALID",
        message: "Testnet upstream diagnostic report proves current IOTA RPC, Gas Station, and reserve_gas compatibility.",
      },
      {
        id: "iota-names-live",
        status: "ready-live",
        code: "IOTA_NAMES_LIVE_REPORT_VALID",
        message: "IOTA Names live smoke report proves the configured name/address binding.",
      },
      {
        id: "iota-identity-live",
        status: "ready-live",
        code: "IOTA_IDENTITY_LIVE_REPORT_VALID",
        message: "IOTA Identity live smoke report proves profile DID and credential evidence.",
      },
    ]),
  });

  for (const id of ["sponsor-funding", "testnet-upstream", "iota-names-live", "iota-identity-live"]) {
    const gate = findGate(report, id);
    assert.equal(gate.status, "requires-approval");
    assert.equal(gate.approvalRequired, true);
    assert.equal(gate.contactsLiveService, true);
  }
});

test("operator live gates can clear only when every product check is local-proven", async () => {
  const report = await checkOperatorLiveGates({
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
        {
          id: "package-release-local",
          status: "proven-local",
          code: "PACKAGE_RELEASE_GATES_CONFIGURED",
          message: "Local package gates are configured.",
        },
      ],
    },
  });

  assert.equal(report.allGatesClear, true);
  assert.equal(report.localOnly, true);
  assert.deepEqual(report.gates.map((gate) => gate.status), ["proven-local", "proven-local"]);
});

test("operator live gate artifact reports blockers without configured values", async () => {
  const artifact = await writeOperatorLiveGateArtifact({
    now: new Date("2026-06-11T12:00:00.000Z"),
    productStatus: productStatusFixture([
      {
        id: "iota-names-live",
        status: "ready-live",
        code: "IOTA_NAMES_LIVE_REPORT_VALID",
        message: "IOTA Names live smoke report proves the configured name/address binding.",
      },
      {
        id: "public-a2a-hosting",
        status: "blocked-production",
        code: "PUBLIC_A2A_HOSTING_UNPROVEN",
        message: "Public A2A hosting is not proven.",
      },
    ]),
    env: {
      IOTA_NAMES_GRAPHQL_URL: "https://graphql.testnet.example/iota",
      IOTA_NAMES_NAME: "researcher.demo.iota",
      IOTA_NAMES_EXPECTED_ADDRESS: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
  });
  const formatted = formatOperatorLiveGateArtifact(artifact);

  assert.equal(artifact.schemaVersion, 1);
  assert.equal(artifact.kind, "operator-live-gate-report");
  assert.equal(artifact.generatedAt, "2026-06-11T12:00:00.000Z");
  assert.equal(artifact.allGatesClear, false);
  assert.equal(artifact.localOnly, false);
  assert.ok(artifact.blockerCodes.includes("PUBLIC_A2A_HOSTING_UNPROVEN"));
  assert.ok(artifact.blockerCodes.includes("IOTA_NAMES_LIVE_REPORT_VALID"));
  assert.ok(artifact.approvalRequiredGateIds.includes("iota-names-live"));
  assert.ok(artifact.liveServiceGateIds.includes("iota-names-live"));
  assert.ok(artifact.gates.some((gate) => gate.command === "npm run live:write-proof-plan && npm run smoke:iota-names-live -- --report <ignored-json-path>"));
  assert.doesNotMatch(formatted, /graphql\.testnet\.example|researcher\.demo\.iota/);
  assert.doesNotMatch(formatted, /0x1111111111111111111111111111111111111111111111111111111111111111/);
});

test("operator live gate artifact can be written as a local redacted file", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-operator-artifact-"));
  try {
    const artifact = await writeOperatorLiveGateArtifact({
      cwd,
      now: new Date("2026-06-11T12:00:00.000Z"),
      outFile: "tmp/gaskit/operator-live-gates.json",
      productStatus: productStatusFixture([
        {
          id: "testnet-upstream",
          status: "blocked-live",
          code: "TESTNET_UPSTREAM_REPORT_FAILED",
          message: "Testnet upstream diagnostic report did not pass.",
        },
      ]),
    });
    const outFile = join(cwd, "tmp/gaskit/operator-live-gates.json");
    const raw = await readFile(outFile, "utf8");
    const written = JSON.parse(raw) as typeof artifact;
    const mode = (await stat(outFile)).mode & 0o777;

    assert.equal(mode, 0o600);
    assert.equal(written.kind, "operator-live-gate-report");
    assert.deepEqual(written.blockerCodes, artifact.blockerCodes);
    assert.ok(written.blockerCodes.includes("TESTNET_UPSTREAM_REPORT_FAILED"));
    assert.doesNotMatch(raw, /tmp\/gaskit\/operator-live-gates\.json/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

function findGate(report: OperatorLiveGateReport, id: string) {
  const gate = report.gates.find((candidate) => candidate.id === id);
  assert.ok(gate, `expected ${id} gate`);
  return gate;
}

function productStatusFixture(
  checks: ProductStatusReport["checks"],
): ProductStatusReport {
  return {
    complete: false,
    localProofOk: true,
    checks,
  };
}
