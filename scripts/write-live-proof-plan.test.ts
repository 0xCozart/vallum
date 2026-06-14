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
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-plan-"));
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

    assert.equal(plan.kind, "agentic-gaskit.live-proof-plan");
    assert.equal(plan.status, "blocked");
    assert.equal(plan.liveProofReady, false);
    assert.ok(plan.blockerCodes.includes("TESTNET_ENV_FILE_MISSING"));
    assert.ok(plan.blockerCodes.includes("GAS_STATION_DOCKER_DAEMON_UNAVAILABLE"));
    assert.ok(plan.blockerCodes.includes("TESTNET_UPSTREAM_REPORT_MISSING"));
    assert.ok(plan.readyCodes.includes("IOTA_NAMES_LIVE_CONFIG_PRESENT"));
    assert.ok(plan.readyCodes.includes("IOTA_IDENTITY_LIVE_CONFIG_PRESENT"));
    assert.ok(plan.readyCodes.includes("VC_TRUST_POLICY_CONFIG_PRESENT"));
    assert.ok(plan.requiredOperatorInputs.includes("IOTA_NAMES_GRAPHQL_URL"));
    assert.ok(plan.requiredOperatorInputs.includes("IOTA_IDENTITY_PROOF_ENDPOINT"));
    assert.ok(plan.commands.some((command) => command.id === "diagnose-testnet-upstream" && command.contactsLiveService));
    assert.doesNotMatch(formatted, /graphql\.testnet\.example|researcher\.demo\.iota|identity\.testnet\.example|profiles\/researcher\.json/);
    assert.doesNotMatch(formatted, /0x1111111111111111111111111111111111111111111111111111111111111111/);
    assert.doesNotMatch(formatted, /agent-registry|agent-capability-key-1/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("live proof plan can write a redacted local artifact", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-live-proof-plan-"));
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
    assert.equal(parsed.kind, "agentic-gaskit.live-proof-plan");
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
