import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkA2APublicReadiness } from "./check-a2a-public-readiness.js";
import { checkPackagePublicationReadiness } from "./check-package-publication-readiness.js";
import { loadIotaIdentityLiveReport } from "./iota-identity-live-report.js";
import { loadIotaNamesLiveReport } from "./iota-names-live-report.js";
import { loadTestnetDigestReport } from "./testnet-digest-report.js";
import { loadTestnetUpstreamReport } from "./testnet-upstream-report.js";
import {
  buildOperatorReportTemplate,
  writeOperatorReportTemplate,
} from "./write-operator-report-template.js";

test("operator report template builds testnet upstream guidance without accepted diagnostic shape", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-testnet-upstream-template-"));
  const outFile = join(cwd, "testnet-upstream-report-template.json");

  await writeOperatorReportTemplate({
    kind: "testnet-upstream",
    now: new Date("2026-06-14T12:00:00.000Z"),
    outFile,
  });

  const parsed = JSON.parse(await readFile(outFile, "utf8")) as Record<string, unknown>;
  assert.equal(parsed.kind, "vallum.testnet-upstream-proof-template");
  assert.equal(parsed.result, "pending-operator-proof");
  assert.equal(parsed.diagnosticReportKind, "vallum.testnet-upstream-diagnostic");
  assert.equal(parsed.acceptedReportEnv, "VALLUM_TESTNET_UPSTREAM_REPORT");
  assert.equal(parsed.sponsorFundingReportEnv, "VALLUM_SPONSOR_FUNDING_REPORT");
  assert.deepEqual(parsed.supportedRuntimeModes, ["local-docker", "managed-upstream"]);
  assert.deepEqual(parsed.requiredEnv, ["IOTA_RPC_URL", "GAS_STATION_URL", "GAS_STATION_BEARER_TOKEN"]);
  assert.ok((parsed.commands as string[]).includes("npm run diagnose:gas-station -- --skip-reserve --report <ignored-json-path>"));
  assert.ok((parsed.commands as string[]).includes("npm run diagnose:gas-station -- --report <ignored-json-path>"));
  assert.ok(
    (parsed.commands as string[]).indexOf("npm run diagnose:gas-station -- --skip-reserve --report <ignored-json-path>")
      < (parsed.commands as string[]).indexOf("npm run diagnose:gas-station -- --report <ignored-json-path>"),
  );
  assert.ok((parsed.commands as string[]).includes("npm run gas-station:docker-direct -- --status"));
  assert.ok((parsed.commands as string[]).includes("npm run sponsor:write-funding-request -- --out tmp/vallum/sponsor-funding-request.json"));
  assert.ok((parsed.commands as string[]).includes("npm run sponsor:request-faucet-funds -- --execute --out tmp/vallum/sponsor-faucet-request.json"));
  assert.ok((parsed.commands as string[]).includes("npm run sponsor:check-funding -- --report tmp/vallum/sponsor-funding-report.json"));
  assert.ok((parsed.checks as string[]).includes("sponsor-funding-readiness"));
  assert.ok((parsed.checks as string[]).includes("reserve-gas-compatibility"));
  assert.ok((parsed.notes as string[]).some((note) => note.includes("--skip-reserve diagnostic is reachability triage only")));

  await assert.rejects(
    () => loadTestnetUpstreamReport(outFile),
    /invalid shape/,
  );
});

test("operator report template builds testnet digest guidance without accepted proof shape", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-testnet-digest-template-"));
  const outFile = join(cwd, "testnet-digest-report-template.json");

  await writeOperatorReportTemplate({
    kind: "testnet-digest",
    now: new Date("2026-06-14T12:00:00.000Z"),
    outFile,
  });

  const mode = (await stat(outFile)).mode & 0o777;
  assert.equal(mode, 0o600);

  const parsed = JSON.parse(await readFile(outFile, "utf8")) as Record<string, unknown>;
  assert.equal(parsed.kind, "vallum.testnet-digest-proof-template");
  assert.equal(parsed.result, "pending-operator-proof");
  assert.equal(parsed.acceptedReportKind, "vallum.testnet-digest-proof-report");
  assert.equal(parsed.acceptedReportEnv, "VALLUM_TESTNET_DIGEST_REPORT");
  assert.deepEqual(parsed.requiredEnv, ["IOTA_RPC_URL"]);
  assert.ok((parsed.commands as string[]).includes("npm run proof:testnet-digest"));
  assert.ok((parsed.commands as string[]).includes("npm run proof:testnet-digest:live -- --report tmp/vallum/testnet-digest-proof.json"));
  assert.ok(
    (parsed.commands as string[]).indexOf("npm run proof:testnet-digest")
      < (parsed.commands as string[]).indexOf("npm run proof:testnet-digest:live -- --report tmp/vallum/testnet-digest-proof.json"),
  );
  assert.ok((parsed.commands as string[]).includes("npm run proof:live-status"));
  assert.ok((parsed.checks as string[]).includes("read-only-live-lookup"));
  assert.ok((parsed.checks as string[]).includes("successful-effects-status"));
  assert.ok((parsed.notes as string[]).some((note) => note.includes("not accepted as passing digest evidence")));
  assert.ok((parsed.notes as string[]).some((note) => note.includes("does not sign, reserve gas, execute transactions, or spend sponsor gas")));

  await assert.rejects(
    () => loadTestnetDigestReport(outFile),
    /invalid shape/,
  );
});

test("operator report template builds IOTA Names guidance without accepted report shape", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-iota-names-template-"));
  const outFile = join(cwd, "iota-names-live-report-template.json");

  await writeOperatorReportTemplate({
    kind: "iota-names-live",
    now: new Date("2026-06-14T12:00:00.000Z"),
    outFile,
  });

  const mode = (await stat(outFile)).mode & 0o777;
  assert.equal(mode, 0o600);

  const parsed = JSON.parse(await readFile(outFile, "utf8")) as Record<string, unknown>;
  assert.equal(parsed.kind, "vallum.iota-names-live-smoke-template");
  assert.equal(parsed.result, "pending-operator-proof");
  assert.equal(parsed.acceptedReportKind, "vallum.iota-names-live-smoke-report");
  assert.equal(parsed.acceptedReportEnv, "IOTA_NAMES_LIVE_REPORT");
  assert.deepEqual(parsed.requiredEnv, ["IOTA_NAMES_GRAPHQL_URL", "IOTA_NAMES_NAME", "IOTA_NAMES_EXPECTED_ADDRESS"]);
  assert.ok((parsed.commands as string[]).includes("npm run live:write-proof-plan"));
  assert.ok((parsed.commands as string[]).includes("npm run smoke:iota-names-live -- --report tmp/vallum/iota-names-live-report.json"));
  assert.ok((parsed.checks as string[]).includes("expected-address-match"));
  assert.ok((parsed.notes as string[]).some((note) => note.includes("not accepted as passing IOTA Names evidence")));

  await assert.rejects(
    () => loadIotaNamesLiveReport(outFile),
    /invalid shape/,
  );
});

test("operator report template builds IOTA Identity guidance without accepted report shape", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-iota-identity-template-"));
  const outFile = join(cwd, "iota-identity-live-report-template.json");

  await writeOperatorReportTemplate({
    kind: "iota-identity-live",
    now: new Date("2026-06-14T12:00:00.000Z"),
    outFile,
  });

  const parsed = JSON.parse(await readFile(outFile, "utf8")) as Record<string, unknown>;
  assert.equal(parsed.kind, "vallum.iota-identity-live-smoke-template");
  assert.equal(parsed.result, "pending-operator-proof");
  assert.equal(parsed.acceptedReportKind, "vallum.iota-identity-live-smoke-report");
  assert.equal(parsed.acceptedReportEnv, "IOTA_IDENTITY_LIVE_REPORT");
  assert.deepEqual(parsed.requiredEnv, [
    "IOTA_IDENTITY_PROOF_ENDPOINT",
    "IOTA_IDENTITY_PROFILE_PATH",
    "IOTA_IDENTITY_TRUSTED_ISSUER_DIDS",
    "IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS",
    "IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES",
    "IOTA_IDENTITY_ACCEPTED_STATUS_TYPES",
    "IOTA_IDENTITY_CACHE_TTL_MS",
  ]);
  assert.ok((parsed.commands as string[]).includes("npm run smoke:iota-identity-live -- --report tmp/vallum/iota-identity-live-report.json"));
  assert.ok((parsed.checks as string[]).includes("credential-evidence-validation"));
  assert.ok((parsed.notes as string[]).some((note) => note.includes("not accepted as passing IOTA Identity evidence")));

  await assert.rejects(
    () => loadIotaIdentityLiveReport(outFile),
    /invalid shape/,
  );
});

test("operator report template builds VC validation guidance against identity report evidence", async () => {
  const template = await buildOperatorReportTemplate({
    kind: "vc-validation-live",
    now: new Date("2026-06-14T12:00:00.000Z"),
  });

  assert.equal(template.kind, "vallum.vc-validation-live-template");
  assert.equal(template.result, "pending-operator-proof");
  assert.equal(template.acceptedReportKind, "vallum.iota-identity-live-smoke-report");
  assert.equal(template.acceptedReportEnv, "IOTA_IDENTITY_LIVE_REPORT");
  assert.ok((template.requiredEnv as string[]).includes("IOTA_IDENTITY_TRUSTED_ISSUER_DIDS"));
  assert.ok((template.requiredEnv as string[]).includes("IOTA_IDENTITY_PROOF_ENDPOINT"));
  assert.ok((template.commands as string[]).includes("npm run smoke:iota-identity-live -- --report tmp/vallum/iota-identity-live-report.json"));
  assert.ok((template.checks as string[]).includes("credential-evidence-present"));
  assert.ok((template.notes as string[]).some((note) => note.includes("uses the accepted IOTA Identity live smoke report")));
});

test("operator report template builds package publication schema without marking it passed", async () => {
  const template = await buildOperatorReportTemplate({
    kind: "package-publication",
    now: new Date("2026-06-14T12:00:00.000Z"),
  });

  assert.equal(template.schemaVersion, 1);
  assert.equal(template.kind, "vallum.package-publication-proof");
  assert.equal(template.result, "pending-operator-proof");
  assert.equal(template.registry, "npm");
  assert.ok(Array.isArray(template.packageNames));
  assert.ok((template.packageNames as string[]).includes("@vallum/sdk"));
  assert.deepEqual(template.checks, [
    "npm-pack-dry-run",
    "local-tarball-install",
    "npm-publish-dry-run",
    "npm-registry-paid-mcp-consumer",
    "npm-registry-mcp-stdio-consumer",
    "registry-install",
    "provenance-review",
    "rollback-review",
  ]);
});

test("operator report template writes private local artifact and remains not-passed evidence", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-report-template-"));
  const outFile = join(cwd, "package-report.json");

  await writeOperatorReportTemplate({
    cwd: process.cwd(),
    kind: "package-publication",
    now: new Date("2026-06-14T12:00:00.000Z"),
    outFile,
  });

  const mode = (await stat(outFile)).mode & 0o777;
  assert.equal(mode, 0o600);

  const report = await checkPackagePublicationReadiness({
    env: { PACKAGE_PUBLICATION_REPORT: outFile },
    now: new Date("2026-06-14T12:00:00.000Z"),
  });
  const reportCheck = report.checks.find((check) => check.id === "npm-registry-publication-report");
  assert.equal(reportCheck?.code, "PACKAGE_PUBLICATION_REPORT_NOT_PASSED");
});

test("operator report template builds A2A discovery report fields without unsafe report keys", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-a2a-template-"));
  const outFile = join(cwd, "a2a-discovery-report.json");

  await writeOperatorReportTemplate({
    kind: "a2a-public-discovery",
    now: new Date("2026-06-14T12:00:00.000Z"),
    outFile,
    publicBaseUrl: "https://agent.example.com",
    publicAgentCardUrl: "https://agent.example.com/.well-known/agent-card.json",
    publicJwksUrl: "https://agent.example.com/.well-known/jwks.json",
    taskAuthDecision: "bearer",
  });

  const parsed = JSON.parse(await readFile(outFile, "utf8")) as Record<string, unknown>;
  assert.equal(parsed.kind, "a2a-public-discovery");
  assert.equal(parsed.result, "pending-operator-proof");
  assert.equal(parsed.publicBaseUrl, "https://agent.example.com");
  assert.equal(parsed.publicAgentCardUrl, "https://agent.example.com/.well-known/agent-card.json");
  assert.equal(parsed.publicJwksUrl, "https://agent.example.com/.well-known/jwks.json");
  assert.equal(parsed.taskAuthDecision, "bearer");

  const readiness = await checkA2APublicReadiness({
    env: {
      A2A_PUBLIC_BASE_URL: "https://agent.example.com",
      A2A_PUBLIC_AGENT_CARD_URL: "https://agent.example.com/.well-known/agent-card.json",
      A2A_PUBLIC_JWKS_URL: "https://agent.example.com/.well-known/jwks.json",
      A2A_PUBLIC_TASK_AUTH_DECISION: "bearer",
      A2A_PUBLIC_DISCOVERY_REPORT: outFile,
    },
    now: new Date("2026-06-14T12:00:00.000Z"),
  });
  const discovery = readiness.checks.find((check) => check.id === "public-discovery");
  assert.equal(discovery?.code, "A2A_PUBLIC_DISCOVERY_REPORT_NOT_PASSED");
});

test("operator report template builds production custody and marketplace choices", async () => {
  const custody = await buildOperatorReportTemplate({
    kind: "custody-production",
    custodyMode: "kms",
    now: new Date("2026-06-14T12:00:00.000Z"),
  });
  const marketplace = await buildOperatorReportTemplate({
    kind: "marketplace-production",
    environment: "production",
    now: new Date("2026-06-14T12:00:00.000Z"),
  });

  assert.equal(custody.kind, "vallum.custody-production-proof");
  assert.equal(custody.custodyMode, "kms");
  assert.ok((custody.checks as string[]).includes("incident-response-review"));
  assert.equal(marketplace.kind, "vallum.marketplace-production-proof");
  assert.equal(marketplace.environment, "production");
  assert.ok((marketplace.checks as string[]).includes("operations-incident-review"));
});
