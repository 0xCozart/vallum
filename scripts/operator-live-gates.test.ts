import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  checkOperatorLiveGates,
  formatOperatorLiveGateReport,
  type OperatorLiveGateReport,
} from "./check-operator-live-gates.js";
import type { ProductStatusReport } from "./check-product-status.js";

test("operator live gates report current blockers without secret values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-operator-gates-"));
  try {
    await writeFile(join(cwd, "package.json"), JSON.stringify({ scripts: {} }));
    const report = await checkOperatorLiveGates({
      cwd,
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
    assert.equal(findGate(report, "iota-names-live").status, "requires-approval");
    assert.equal(findGate(report, "iota-names-live").approvalRequired, true);
    assert.equal(findGate(report, "iota-names-live").contactsLiveService, true);
    assert.equal(findGate(report, "iota-identity-live").status, "requires-approval");
    assert.equal(findGate(report, "testnet-readiness").status, "blocked-config");
    assert.equal(findGate(report, "npm-registry-publication").status, "requires-approval");
    assert.equal(findGate(report, "public-a2a-hosting").command, "npm run proof:a2a-public-readiness");
    assert.equal(findGate(report, "physical-device-access").status, "deferred-safety");
    assert.doesNotMatch(formatted, /graphql\.testnet\.example|researcher\.demo\.iota|identity\.testnet\.example|profiles\/researcher\.json/);
    assert.doesNotMatch(formatted, /0x1111111111111111111111111111111111111111111111111111111111111111/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

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

test("operator live gates require approval for configured live endpoint smokes", async () => {
  const report = await checkOperatorLiveGates({
    productStatus: productStatusFixture([
      {
        id: "iota-names-live",
        status: "ready-live",
        code: "IOTA_NAMES_LIVE_CONFIG_PRESENT",
        message: "IOTA Names live smoke configuration is present.",
      },
      {
        id: "iota-identity-live",
        status: "ready-live",
        code: "IOTA_IDENTITY_LIVE_CONFIG_PRESENT",
        message: "IOTA Identity live proof endpoint configuration is present.",
      },
    ]),
  });

  for (const id of ["iota-names-live", "iota-identity-live"]) {
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
