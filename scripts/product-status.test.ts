import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildProductStatusArtifact,
  checkProductStatus,
  formatProductStatusArtifact,
  formatProductStatusReport,
  writeProductStatusArtifact,
} from "./check-product-status.js";

const validPolicy = `apps:
  demo-dapp:
    api_key_name: demo-dapp-key
    status: active
    daily_budget_iota: 1
    daily_request_limit: 10
    max_requests_per_wallet_per_day: 2
    max_gas_budget_per_tx: 5000000
    allowed_packages:
      - "0x1234567890abcdef"
    allowed_functions:
      - "mint_badge"
    denied_wallets: []
`;

test("product status reports local proof gates and explicit live blockers without secrets", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-product-status-"));
  try {
    const report = await checkProductStatus({
      cwd,
      env: {},
      a2aPublicReadiness: blockedA2APublicReadiness(),
      custodyReadiness: blockedCustodyReadiness(),
      gasStationRuntimeReport: blockedGasStationRuntime(),
      scripts: completeScripts(),
      marketplaceReadiness: blockedMarketplaceReadiness(),
      packagePublicationReadiness: blockedPackagePublicationReadiness(),
      paymentProviderReadiness: blockedPaymentProviderReadiness(),
      testnetDigestProof: blockedTestnetDigestProof(),
    });
    const formatted = formatProductStatusReport(report);

    assert.equal(report.complete, false);
    assert.equal(report.localProofOk, true);
    assert.deepEqual(
      report.checks.slice(0, 11).map((check) => [check.id, check.status, check.code]),
      [
        ["local-verification", "proven-local", "LOCAL_VERIFY_SURFACE_CONFIGURED"],
        ["package-release-local", "proven-local", "PACKAGE_RELEASE_GATES_CONFIGURED"],
        ["operator-report-template", "proven-local", "OPERATOR_REPORT_TEMPLATE_WRITER_CONFIGURED"],
        ["testnet-readiness", "blocked-live", "TESTNET_ENV_FILE_MISSING"],
        ["gas-station-runtime", "blocked-live", "GAS_STATION_DOCKER_DAEMON_UNAVAILABLE"],
        ["sponsor-funding", "blocked-live", "SPONSOR_FUNDING_REPORT_MISSING"],
        ["testnet-upstream", "blocked-live", "TESTNET_UPSTREAM_REPORT_MISSING"],
        ["testnet-sponsored-execute", "blocked-live", "TESTNET_DIGEST_DOCS_MISSING"],
        ["iota-names-live", "blocked-live", "IOTA_NAMES_LIVE_CONFIG_MISSING"],
        ["iota-identity-live", "blocked-live", "IOTA_IDENTITY_LIVE_CONFIG_MISSING"],
        ["vc-validation-live", "blocked-live", "VC_TRUST_POLICY_CONFIG_MISSING"],
      ],
    );
    assert.match(formatted, /not-complete/);
    assert.match(formatted, /NPM_PUBLICATION_UNRUN/);
    assert.match(formatted, /operator:write-report-template -- --kind package-publication/);
    assert.match(formatted, /npm run proof:package-publication-readiness/);
    assert.match(formatted, /npm run package:write-publication-proof-plan/);
    assert.match(formatted, /PUBLIC_A2A_HOSTING_UNPROVEN/);
    assert.match(formatted, /operator:write-report-template -- --kind a2a-public-discovery/);
    assert.match(formatted, /operator:write-report-template -- --kind a2a-public-push-delivery/);
    assert.match(formatted, /operator:write-report-template -- --kind a2a-external-conformance/);
    assert.match(formatted, /npm run a2a:write-public-proof-plan/);
    assert.match(formatted, /npm run smoke:a2a-public-discovery only with operator-approved public A2A config/);
    assert.match(formatted, /LIVE_PAYMENT_PROVIDER_UNPROVEN/);
    assert.match(formatted, /operator:write-report-template -- --kind payment-provider-live/);
    assert.match(formatted, /npm run proof:payment-provider-readiness/);
    assert.match(formatted, /PRODUCTION_MARKETPLACE_BLOCKED/);
    assert.match(formatted, /operator:write-report-template -- --kind marketplace-production/);
    assert.match(formatted, /npm run proof:marketplace-readiness/);
    assert.match(formatted, /npm run marketplace:write-production-proof-plan/);
    assert.match(formatted, /PRODUCTION_CUSTODY_OUT_OF_SCOPE/);
    assert.match(formatted, /operator:write-report-template -- --kind custody-production/);
    assert.match(formatted, /npm run proof:custody-readiness/);
    assert.match(formatted, /npm run custody:write-production-proof-plan/);
    assert.match(formatted, /DEVICE_ACCESS_SAFETY_DEFERRED/);
    assert.doesNotMatch(formatted, /see-status/);
    assert.doesNotMatch(formatted, /local-secret|iotaprivkey|fake-private-key|seed-phrase|mnemonic-value/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("product status artifact summarizes blockers without secret values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-product-status-"));
  try {
    const report = await checkProductStatus({
      cwd,
      env: {},
      a2aPublicReadiness: blockedA2APublicReadiness(),
      custodyReadiness: blockedCustodyReadiness(),
      gasStationRuntimeReport: blockedGasStationRuntime(),
      scripts: completeScripts(),
      marketplaceReadiness: blockedMarketplaceReadiness(),
      packagePublicationReadiness: blockedPackagePublicationReadiness(),
      paymentProviderReadiness: blockedPaymentProviderReadiness(),
      testnetDigestProof: blockedTestnetDigestProof(),
    });
    const artifact = buildProductStatusArtifact(report, new Date("2026-06-14T12:00:00.000Z"));
    const json = formatProductStatusArtifact(artifact);
    const parsed = JSON.parse(json) as typeof artifact;

    assert.equal(parsed.kind, "agentic-gaskit.product-status-report");
    assert.equal(parsed.complete, false);
    assert.equal(parsed.localProofOk, true);
    assert.deepEqual(parsed.provenLocalCheckIds, [
      "local-verification",
      "package-release-local",
      "operator-report-template",
    ]);
    assert.equal(parsed.blockerCodes.includes("SPONSOR_FUNDING_REPORT_MISSING"), true);
    assert.equal(parsed.blockerCodes.includes("TESTNET_DIGEST_DOCS_MISSING"), true);
    assert.equal(parsed.blockerCodes.includes("NPM_PUBLICATION_UNRUN"), true);
    assert.equal(parsed.blockerCodes.includes("PUBLIC_A2A_HOSTING_UNPROVEN"), true);
    assert.match(parsed.boundaries.join("\n"), /complete=false/);
    assert.doesNotMatch(json, /local-secret|iotaprivkey|fake-private-key|seed-phrase|mnemonic-value/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("product status artifact writer uses restrictive local file permissions", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-product-status-"));
  try {
    const outFile = "tmp/gaskit/product-status.json";
    const artifact = await writeProductStatusArtifact({
      cwd,
      env: {},
      a2aPublicReadiness: blockedA2APublicReadiness(),
      custodyReadiness: blockedCustodyReadiness(),
      gasStationRuntimeReport: blockedGasStationRuntime(),
      scripts: completeScripts(),
      marketplaceReadiness: blockedMarketplaceReadiness(),
      packagePublicationReadiness: blockedPackagePublicationReadiness(),
      paymentProviderReadiness: blockedPaymentProviderReadiness(),
      testnetDigestProof: blockedTestnetDigestProof(),
      now: new Date("2026-06-14T12:00:00.000Z"),
      outFile,
    });
    const written = await readFile(join(cwd, outFile), "utf8");
    const mode = (await stat(join(cwd, outFile))).mode & 0o777;

    assert.equal(artifact.kind, "agentic-gaskit.product-status-report");
    assert.equal(JSON.parse(written).kind, "agentic-gaskit.product-status-report");
    assert.equal(mode, 0o600);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("product status marks report-backed live gates ready without contacting endpoints", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-product-status-"));
  try {
    await writeFile(join(cwd, "policy.yaml"), validPolicy);
    await writeFile(
      join(cwd, ".env"),
      [
        "IOTA_RPC_URL=https://api.testnet.iota.cafe",
        "GAS_STATION_KEYPAIR=fake-testnet-sponsor-key-with-enough-entropy-for-preflight",
        "GAS_STATION_AUTH=fake-gas-station-auth-value-with-enough-entropy",
        "JWT_SECRET=jwt-secret-with-at-least-thirty-two-characters",
        "DATABASE_URL=file:./data/gaskit.sqlite3",
        "GASKIT_GATEWAY_HOST=127.0.0.1",
        "GASKIT_GATEWAY_PORT=8787",
        "GASKIT_POLICY_PATH=policy.yaml",
        "GASKIT_DEMO_APP_KEY=demo-app-key-with-enough-entropy",
        "GAS_STATION_URL=http://127.0.0.1:9527",
        "GAS_STATION_BEARER_TOKEN=fake-upstream-bearer-value-with-enough-entropy",
      ].join("\n"),
    );
    await writeFile(join(cwd, "upstream-report.json"), JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.testnet-upstream-diagnostic",
      observedAt: new Date().toISOString(),
      gasStationRoot: { configured: true, ok: true, status: 200 },
      gasStationV1Health: { configured: true, ok: false, status: 404 },
      iotaRpc: { configured: true, ok: true, status: 200 },
      reserveGas: { skipped: false, ok: true, status: 200 },
      ok: true,
    }));
    await writeFile(join(cwd, "sponsor-funding-report.json"), JSON.stringify(readySponsorFundingReport()));
    await writeFile(join(cwd, "testnet-digest-report.json"), JSON.stringify(readyTestnetDigestReport()));
    await writeFile(join(cwd, "iota-names-report.json"), JSON.stringify(readyIotaNamesReport()));
    await writeFile(join(cwd, "iota-identity-report.json"), JSON.stringify(readyIotaIdentityReport()));

    const report = await checkProductStatus({
      cwd,
      scripts: completeScripts(),
      a2aPublicReadiness: blockedA2APublicReadiness(),
      custodyReadiness: blockedCustodyReadiness(),
      marketplaceReadiness: blockedMarketplaceReadiness(),
      packagePublicationReadiness: blockedPackagePublicationReadiness(),
      gasStationRuntimeReport: readyGasStationRuntime(),
      env: {
        GASKIT_SPONSOR_FUNDING_REPORT: "sponsor-funding-report.json",
        GASKIT_TESTNET_UPSTREAM_REPORT: "upstream-report.json",
        GASKIT_TESTNET_DIGEST_REPORT: "testnet-digest-report.json",
        IOTA_NAMES_GRAPHQL_URL: "https://graphql.testnet.example/iota",
        IOTA_NAMES_NAME: "researcher.demo.iota",
        IOTA_NAMES_EXPECTED_ADDRESS: "0x1111111111111111111111111111111111111111111111111111111111111111",
        IOTA_NAMES_LIVE_REPORT: "iota-names-report.json",
        IOTA_IDENTITY_PROOF_ENDPOINT: "https://identity.testnet.example/proof",
        IOTA_IDENTITY_PROFILE_PATH: "profiles/researcher.json",
        IOTA_IDENTITY_LIVE_REPORT: "iota-identity-report.json",
        IOTA_IDENTITY_TRUSTED_ISSUER_DIDS: "did:iota:issuer:agent-registry",
        IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS: "#agent-capability-key-1",
        IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES: "VerifiableCredential,AgentCapabilityCredential",
        IOTA_IDENTITY_ACCEPTED_STATUS_TYPES: "RevocationBitmap2022",
        IOTA_IDENTITY_CACHE_TTL_MS: "60000",
      },
    });
    const formatted = formatProductStatusReport(report);

    assert.equal(report.complete, false);
    assert.equal(report.localProofOk, true);
    assert.equal(report.checks.find((check) => check.id === "testnet-readiness")?.status, "ready-live");
    assert.equal(report.checks.find((check) => check.id === "gas-station-runtime")?.status, "ready-live");
    assert.match(report.checks.find((check) => check.id === "gas-station-runtime")?.next ?? "", /diagnose:gas-station/);
    assert.doesNotMatch(report.checks.find((check) => check.id === "gas-station-runtime")?.next ?? "", /Start the local Gas Station/);
    assert.equal(report.checks.find((check) => check.id === "sponsor-funding")?.status, "ready-live");
    assert.equal(report.checks.find((check) => check.id === "testnet-upstream")?.status, "ready-live");
    assert.equal(report.checks.find((check) => check.id === "testnet-sponsored-execute")?.status, "ready-live");
    assert.equal(report.checks.filter((check) => check.id === "testnet-sponsored-execute").length, 1);
    assert.equal(
      report.checks.find((check) => check.id === "testnet-sponsored-execute")?.code,
      "TESTNET_SPONSORED_EXECUTE_DIGEST_VERIFIED",
    );
    assert.equal(report.checks.find((check) => check.id === "sponsor-funding")?.evidence, "sponsor-funding-report-valid-redacted");
    assert.equal(report.checks.find((check) => check.id === "testnet-upstream")?.evidence, "testnet-upstream-report-valid-redacted");
    assert.equal(report.checks.find((check) => check.id === "testnet-sponsored-execute")?.evidence, "testnet-digest-report-valid-redacted");
    assert.equal(report.checks.find((check) => check.id === "iota-names-live")?.status, "ready-live");
    assert.equal(report.checks.find((check) => check.id === "iota-identity-live")?.status, "ready-live");
    assert.equal(report.checks.find((check) => check.id === "vc-validation-live")?.status, "ready-live");
    assert.equal(report.checks.find((check) => check.id === "npm-registry-publication")?.status, "blocked-production");
    assert.doesNotMatch(formatted, /see-status/);
    assert.doesNotMatch(
      formatted,
      /graphql\.testnet\.example|identity\.testnet\.example|researcher\.json|fake-testnet-sponsor-key|fake-gas-station-auth|jwt-secret|fake-upstream-bearer/,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("product status blocks stale configured testnet digest reports without contacting live RPC", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-product-status-digest-report-"));
  try {
    await writeFile(join(cwd, "testnet-digest-report.json"), JSON.stringify({
      ...readyTestnetDigestReport(),
      observedAt: "2026-06-12T00:00:00.000Z",
    }));

    const report = await checkProductStatus({
      cwd,
      scripts: completeScripts(),
      a2aPublicReadiness: blockedA2APublicReadiness(),
      custodyReadiness: blockedCustodyReadiness(),
      marketplaceReadiness: blockedMarketplaceReadiness(),
      packagePublicationReadiness: blockedPackagePublicationReadiness(),
      paymentProviderReadiness: blockedPaymentProviderReadiness(),
      gasStationRuntimeReport: blockedGasStationRuntime(),
      env: {
        GASKIT_TESTNET_DIGEST_REPORT: "testnet-digest-report.json",
      },
    });
    const sponsoredExecute = report.checks.find((check) => check.id === "testnet-sponsored-execute");

    assert.equal(sponsoredExecute?.status, "blocked-live");
    assert.equal(sponsoredExecute?.code, "TESTNET_DIGEST_REPORT_STALE");
    assert.equal(sponsoredExecute?.evidence, "blocked=TESTNET_DIGEST_REPORT_STALE");
    assert.match(sponsoredExecute?.next ?? "", /proof:testnet-digest:live/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("product status can mark managed upstream runtime ready while upstream proof remains separate", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-product-status-"));
  try {
    const report = await checkProductStatus({
      cwd,
      env: {
        GASKIT_GAS_STATION_RUNTIME_MODE: "managed-upstream",
        GAS_STATION_URL: "https://gas-station.testnet.example",
      },
      a2aPublicReadiness: blockedA2APublicReadiness(),
      gasStationRuntimeRunner: async () => {
        throw new Error("managed-upstream product status must not inspect Docker");
      },
      scripts: completeScripts(),
      custodyReadiness: blockedCustodyReadiness(),
      marketplaceReadiness: blockedMarketplaceReadiness(),
      packagePublicationReadiness: blockedPackagePublicationReadiness(),
      paymentProviderReadiness: blockedPaymentProviderReadiness(),
      testnetDigestProof: blockedTestnetDigestProof(),
    });
    const formatted = formatProductStatusReport(report);

    assert.equal(report.complete, false);
    assert.equal(report.checks.find((check) => check.id === "gas-station-runtime")?.status, "ready-live");
    assert.equal(report.checks.find((check) => check.id === "sponsor-funding")?.code, "SPONSOR_FUNDING_REPORT_MISSING");
    assert.equal(report.checks.find((check) => check.id === "testnet-upstream")?.code, "TESTNET_UPSTREAM_REPORT_MISSING");
    assert.doesNotMatch(formatted, /gas-station\.testnet\.example/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("product status can mark package publication report ready for approval without exposing report values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-product-status-"));
  try {
    const report = await checkProductStatus({
      cwd,
      env: {},
      a2aPublicReadiness: blockedA2APublicReadiness(),
      gasStationRuntimeReport: blockedGasStationRuntime(),
      scripts: completeScripts(),
      testnetDigestProof: verifiedTestnetDigestProof(),
      packagePublicationReadiness: {
        localProofOk: true,
        liveReady: true,
        packageNames: ["@iota-gaskit/sdk"],
        checks: [
          {
            id: "local-package-publication-proof",
            status: "proven-local",
            code: "PACKAGE_PUBLICATION_LOCAL_PROOF_CONFIGURED",
            message: "Local package publication proof exists.",
            next: "Keep local proof current.",
          },
          {
            id: "npm-registry-publication-report",
            status: "ready-approval",
            code: "PACKAGE_PUBLICATION_REPORT_VALID",
            message: "Structured report is valid.",
            evidence: "local-structured-report-valid-redacted",
            next: "Review manually.",
          },
        ],
      },
    });
    const formatted = formatProductStatusReport(report);
    const publication = report.checks.find((check) => check.id === "npm-registry-publication");
    const sponsoredExecute = report.checks.find((check) => check.id === "testnet-sponsored-execute");

    assert.equal(sponsoredExecute?.status, "ready-live");
    assert.equal(sponsoredExecute?.code, "TESTNET_SPONSORED_EXECUTE_DIGEST_VERIFIED");
    assert.equal(sponsoredExecute?.evidence, "testnet-digest-report-valid-redacted");
    assert.equal(publication?.status, "ready-live");
    assert.equal(publication?.code, "PACKAGE_PUBLICATION_REPORT_VALID");
    assert.match(formatted, /PACKAGE_PUBLICATION_REPORT_VALID/);
    assert.doesNotMatch(formatted, /registry-install|provenance-review|rollback-review|package-publication-report/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("product status can mark payment provider report ready for approval without exposing report values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-product-status-"));
  try {
    const report = await checkProductStatus({
      cwd,
      env: {},
      a2aPublicReadiness: blockedA2APublicReadiness(),
      gasStationRuntimeReport: blockedGasStationRuntime(),
      scripts: completeScripts(),
      testnetDigestProof: blockedTestnetDigestProof(),
      paymentProviderReadiness: {
        localProofOk: true,
        liveReady: true,
        checks: [
          {
            id: "local-standards-proof",
            status: "proven-local",
            code: "PAYMENT_PROVIDER_LOCAL_PROOF_CONFIGURED",
            message: "Local x402/AP2 proof exists.",
            next: "Keep local proof current.",
          },
          {
            id: "live-payment-provider-report",
            status: "ready-approval",
            code: "PAYMENT_PROVIDER_LIVE_REPORT_VALID",
            message: "Structured report is valid.",
            evidence: "local-structured-report-valid-redacted",
            next: "Review manually.",
          },
        ],
      },
    });
    const formatted = formatProductStatusReport(report);
    const payment = report.checks.find((check) => check.id === "live-payment-provider");

    assert.equal(payment?.status, "ready-live");
    assert.equal(payment?.code, "PAYMENT_PROVIDER_LIVE_REPORT_VALID");
    assert.match(formatted, /PAYMENT_PROVIDER_LIVE_REPORT_VALID/);
    assert.doesNotMatch(formatted, /payment-provider-live-report|x402-verify|ap2-payment-receipt/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("product status can mark public A2A readiness ready for approval without exposing report values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-product-status-"));
  try {
    const report = await checkProductStatus({
      cwd,
      env: {},
      a2aPublicReadiness: readyA2APublicReadiness(),
      gasStationRuntimeReport: blockedGasStationRuntime(),
      scripts: completeScripts(),
      testnetDigestProof: blockedTestnetDigestProof(),
    });
    const formatted = formatProductStatusReport(report);
    const publicA2A = report.checks.find((check) => check.id === "public-a2a-hosting");

    assert.equal(publicA2A?.status, "ready-live");
    assert.equal(publicA2A?.code, "A2A_PUBLIC_READINESS_REPORTS_VALID");
    assert.match(formatted, /A2A_PUBLIC_READINESS_REPORTS_VALID/);
    assert.doesNotMatch(formatted, /a2a-public-discovery-report|public\.example|callback\.example|private-key|bearer-token/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("product status can mark marketplace report ready for approval without exposing report values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-product-status-"));
  try {
    const report = await checkProductStatus({
      cwd,
      env: {},
      a2aPublicReadiness: blockedA2APublicReadiness(),
      gasStationRuntimeReport: blockedGasStationRuntime(),
      scripts: completeScripts(),
      testnetDigestProof: blockedTestnetDigestProof(),
      marketplaceReadiness: {
        localProofOk: true,
        productionReady: true,
        checks: [
          {
            id: "local-marketplace-read-model-proof",
            status: "proven-local",
            code: "MARKETPLACE_LOCAL_PROOF_CONFIGURED",
            message: "Local marketplace proof exists.",
            next: "Keep local proof current.",
          },
          {
            id: "production-marketplace-report",
            status: "ready-approval",
            code: "MARKETPLACE_PRODUCTION_REPORT_VALID",
            message: "Structured report is valid.",
            evidence: "local-structured-report-valid-redacted",
            next: "Review manually.",
          },
        ],
      },
    });
    const formatted = formatProductStatusReport(report);
    const marketplace = report.checks.find((check) => check.id === "production-marketplace");

    assert.equal(marketplace?.status, "ready-live");
    assert.equal(marketplace?.code, "MARKETPLACE_PRODUCTION_REPORT_VALID");
    assert.match(formatted, /MARKETPLACE_PRODUCTION_REPORT_VALID/);
    assert.doesNotMatch(formatted, /provider-verification-review|session-auth-review|marketplace-production-report/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("product status can mark custody report ready for approval without exposing report values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-product-status-"));
  try {
    const report = await checkProductStatus({
      cwd,
      env: {},
      a2aPublicReadiness: blockedA2APublicReadiness(),
      custodyReadiness: {
        localProofOk: true,
        productionReady: true,
        checks: [
          {
            id: "local-signer-reference-proof",
            status: "proven-local",
            code: "CUSTODY_LOCAL_SIGNER_REFERENCE_PROOF_CONFIGURED",
            message: "Local signer-reference proof exists.",
            next: "Keep local proof current.",
          },
          {
            id: "production-custody-report",
            status: "ready-approval",
            code: "CUSTODY_PRODUCTION_REPORT_VALID",
            message: "Structured report is valid.",
            evidence: "local-structured-report-valid-redacted",
            next: "Review manually.",
          },
        ],
      },
      gasStationRuntimeReport: blockedGasStationRuntime(),
      scripts: completeScripts(),
      testnetDigestProof: blockedTestnetDigestProof(),
    });
    const formatted = formatProductStatusReport(report);
    const custody = report.checks.find((check) => check.id === "production-custody");

    assert.equal(custody?.status, "ready-live");
    assert.equal(custody?.code, "CUSTODY_PRODUCTION_REPORT_VALID");
    assert.match(formatted, /CUSTODY_PRODUCTION_REPORT_VALID/);
    assert.doesNotMatch(formatted, /kms-external-signer-review|recovery-export-review|custody-production-report/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("product status fails the local proof surface when required commands are missing", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-product-status-"));
  try {
    const report = await checkProductStatus({
      cwd,
      env: {},
      a2aPublicReadiness: blockedA2APublicReadiness(),
      gasStationRuntimeReport: blockedGasStationRuntime(),
      testnetDigestProof: blockedTestnetDigestProof(),
      scripts: {
        "verify:local": "npm test && npm run docs:check",
        "pack:check": "npm pack --dry-run",
        "smoke:package-install": "tsx scripts/smoke-package-install.ts",
        "publish:dry-run": "tsx scripts/package-publish-dry-run.ts",
      },
    });
    const local = report.checks.find((check) => check.id === "local-verification");

    assert.equal(report.localProofOk, false);
    assert.equal(local?.status, "blocked-production");
    assert.equal(local?.code, "LOCAL_VERIFY_SURFACE_INCOMPLETE");
    assert.match(local?.evidence ?? "", /npm run contracts:test/);
    assert.match(local?.evidence ?? "", /npm run proof:product-status/);
    assert.match(local?.evidence ?? "", /npm run proof:launch-readiness/);
    assert.match(local?.evidence ?? "", /npm run proof:operator-gates/);
    assert.match(local?.evidence ?? "", /npm run proof:testnet-digest/);
    assert.match(local?.evidence ?? "", /npm run proof:a2a-public-readiness/);
    assert.match(local?.evidence ?? "", /npm run proof:verification-profiles/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("product status keeps publish dry-run opt-in", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-product-status-"));
  try {
    const scripts = completeScripts({
      "verify:local": `${completeScripts()["verify:local"]} && npm run publish:dry-run`,
    });
    const report = await checkProductStatus({
      cwd,
      env: {},
      a2aPublicReadiness: blockedA2APublicReadiness(),
      gasStationRuntimeReport: blockedGasStationRuntime(),
      scripts,
      testnetDigestProof: blockedTestnetDigestProof(),
    });
    const release = report.checks.find((check) => check.id === "package-release-local");

    assert.equal(report.localProofOk, false);
    assert.equal(release?.status, "blocked-production");
    assert.equal(release?.code, "PACKAGE_RELEASE_GATES_INCOMPLETE");
    assert.match(release?.evidence ?? "", /publish:dry-run must stay opt-in/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

function blockedTestnetDigestProof() {
  return {
    digest: "FLdnYRUACAKQn8CwugEv1u6gYTh9jBr8rGMk2JZ2adsd",
    rpcUrl: "https://api.testnet.iota.cafe",
    documented: false,
    liveChecked: false,
    verified: false,
    status: "blocked-live" as const,
    blocker: "TESTNET_DIGEST_DOCS_MISSING",
    next: "Restore the documented public digest evidence before accepting testnet proof docs.",
  };
}

function documentedTestnetDigestProof() {
  return {
    digest: "FLdnYRUACAKQn8CwugEv1u6gYTh9jBr8rGMk2JZ2adsd",
    rpcUrl: "https://api.testnet.iota.cafe",
    documented: true,
    liveChecked: false,
    verified: false,
    status: "documented-local" as const,
    next: "Run npm run proof:testnet-digest:live for an opt-in read-only IOTA testnet lookup.",
  };
}

function verifiedTestnetDigestProof() {
  return {
    digest: "FLdnYRUACAKQn8CwugEv1u6gYTh9jBr8rGMk2JZ2adsd",
    rpcUrl: "https://api.testnet.iota.cafe",
    documented: true,
    liveChecked: true,
    verified: true,
    status: "verified-testnet" as const,
    effectsStatus: "success",
    checkpoint: "123",
    timestampMs: "1781480000000",
    next: "The documented public digest is retrievable from the configured IOTA testnet RPC.",
  };
}

function readyTestnetDigestReport() {
  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.testnet-digest-proof-report",
    observedAt: new Date().toISOString(),
    ...verifiedTestnetDigestProof(),
  };
}

function completeScripts(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    "verify:local": [
      "npm test",
      "npm run contracts:test",
      "npm run typecheck",
      "npm run smoke:local",
      "npm run smoke:demo-dapp",
      "npm run smoke:demo-browser",
      "npm run smoke:agent-escrow",
      "npm run smoke:paid-mcp-tool",
      "npm run smoke:data-license",
      "npm run smoke:service-bounty",
      "npm run smoke:reputation-receipt",
      "npm run smoke:subscription",
      "npm run smoke:a2a-well-known",
      "npm run smoke:a2a-signed-card",
      "npm run smoke:a2a-task-message",
      "npm run smoke:a2a-http",
      "npm run smoke:a2a-local-server",
      "npm run smoke:marketplace-read-model",
      "npm run readiness:testnet:example",
      "npm run proof:testnet-digest",
      "npm run pack:check",
      "npm run smoke:package-install",
      "npm run proof:a2a-public-readiness",
      "npm run proof:verification-profiles",
      "npm run proof:product-status",
      "npm run proof:launch-readiness",
      "npm run proof:operator-gates",
      "npm run docs:check",
      "npm run secrets:scan",
    ].join(" && "),
    "pack:check": "npm run build && npm pack --dry-run -w @iota-gaskit/sdk",
    "smoke:package-install": "npm run build && tsx scripts/smoke-package-install.ts",
    "publish:dry-run": "npm run build && tsx scripts/package-publish-dry-run.ts",
    "operator:write-report-template": "npm run build && tsx scripts/write-operator-report-template.ts",
    build: "npm run build -w @iota-gaskit/marketplace",
    "smoke:marketplace-read-model": "npm run build && tsx scripts/smoke-marketplace-read-model.ts",
    ...overrides,
  };
}

function blockedPaymentProviderReadiness() {
  return {
    localProofOk: true,
    liveReady: false,
    checks: [
      {
        id: "local-standards-proof",
        status: "proven-local" as const,
        code: "PAYMENT_PROVIDER_LOCAL_PROOF_CONFIGURED",
        message: "Local x402/AP2 proof exists.",
        next: "Keep local proof current.",
      },
      {
        id: "live-payment-provider-report",
        status: "blocked-config" as const,
        code: "PAYMENT_PROVIDER_LIVE_REPORT_MISSING",
        message: "Structured report is missing.",
        evidence: "missing=PAYMENT_PROVIDER_LIVE_REPORT",
        next: "Provide a redacted structured report.",
      },
    ],
  };
}

function blockedA2APublicReadiness() {
  return {
    localProofOk: true,
    publicReady: false,
    checks: [
      {
        id: "local-a2a-proof",
        status: "proven-local" as const,
        code: "A2A_LOCAL_PROOF_CONFIGURED",
        message: "Local A2A proof exists.",
        next: "Keep local proof current.",
      },
      {
        id: "public-discovery",
        status: "blocked-conformance" as const,
        code: "A2A_PUBLIC_DISCOVERY_REPORT_MISSING",
        message: "Structured public discovery report is missing.",
        evidence: "missing=A2A_PUBLIC_DISCOVERY_REPORT",
        next: "Provide a redacted structured report.",
      },
    ],
  };
}

function readyA2APublicReadiness() {
  return {
    localProofOk: true,
    publicReady: true,
    checks: [
      {
        id: "local-a2a-proof",
        status: "proven-local" as const,
        code: "A2A_LOCAL_PROOF_CONFIGURED",
        message: "Local A2A proof exists.",
        next: "Keep local proof current.",
      },
      {
        id: "public-agent-card-url",
        status: "ready-approval" as const,
        code: "A2A_PUBLIC_AGENT_CARD_URL_CONFIG_PRESENT",
        message: "Public Agent Card URL is configured.",
        evidence: "configuration-present-redacted",
        next: "Review manually.",
      },
      {
        id: "public-discovery",
        status: "ready-approval" as const,
        code: "A2A_PUBLIC_DISCOVERY_REPORT_VALID",
        message: "Structured public discovery report is valid.",
        evidence: "local-structured-report-valid-redacted",
        next: "Review manually.",
      },
      {
        id: "public-push-delivery",
        status: "ready-approval" as const,
        code: "A2A_PUBLIC_PUSH_DELIVERY_REPORT_VALID",
        message: "Structured public push delivery report is valid.",
        evidence: "local-structured-report-valid-redacted",
        next: "Review manually.",
      },
      {
        id: "external-conformance",
        status: "ready-approval" as const,
        code: "A2A_EXTERNAL_CONFORMANCE_REPORT_VALID",
        message: "Structured external conformance report is valid.",
        evidence: "local-structured-report-valid-redacted",
        next: "Review manually.",
      },
    ],
  };
}

function blockedPackagePublicationReadiness() {
  return {
    localProofOk: true,
    liveReady: false,
    packageNames: ["@iota-gaskit/sdk"],
    checks: [
      {
        id: "local-package-publication-proof",
        status: "proven-local" as const,
        code: "PACKAGE_PUBLICATION_LOCAL_PROOF_CONFIGURED",
        message: "Local package publication proof exists.",
        next: "Keep local proof current.",
      },
      {
        id: "npm-registry-publication-report",
        status: "blocked-config" as const,
        code: "PACKAGE_PUBLICATION_REPORT_MISSING",
        message: "Structured report is missing.",
        evidence: "missing=PACKAGE_PUBLICATION_REPORT",
        next: "Provide a redacted structured report.",
      },
    ],
  };
}

function blockedMarketplaceReadiness() {
  return {
    localProofOk: true,
    productionReady: false,
    checks: [
      {
        id: "local-marketplace-read-model-proof",
        status: "proven-local" as const,
        code: "MARKETPLACE_LOCAL_PROOF_CONFIGURED",
        message: "Local marketplace proof exists.",
        next: "Keep local proof current.",
      },
      {
        id: "production-marketplace-report",
        status: "blocked-config" as const,
        code: "MARKETPLACE_PRODUCTION_REPORT_MISSING",
        message: "Structured report is missing.",
        evidence: "missing=MARKETPLACE_PRODUCTION_REPORT",
        next: "Provide a redacted structured report.",
      },
    ],
  };
}

function blockedCustodyReadiness() {
  return {
    localProofOk: true,
    productionReady: false,
    checks: [
      {
        id: "local-signer-reference-proof",
        status: "proven-local" as const,
        code: "CUSTODY_LOCAL_SIGNER_REFERENCE_PROOF_CONFIGURED",
        message: "Local signer-reference proof exists.",
        next: "Keep local proof current.",
      },
      {
        id: "production-custody-report",
        status: "blocked-config" as const,
        code: "CUSTODY_PRODUCTION_REPORT_MISSING",
        message: "Structured report is missing.",
        evidence: "missing=CUSTODY_PRODUCTION_REPORT",
        next: "Provide a redacted structured report.",
      },
    ],
  };
}

function readyGasStationRuntime() {
  return {
    ready: true,
    code: "GAS_STATION_RUNTIME_READY" as const,
    message: "Local Gas Station runtime prerequisites are present.",
    checks: [],
  };
}

function blockedGasStationRuntime() {
  return {
    ready: false,
    code: "GAS_STATION_DOCKER_DAEMON_UNAVAILABLE" as const,
    message: "Docker daemon is not reachable.",
    checks: [],
  };
}

function readySponsorFundingReport() {
  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.sponsor-funding-report",
    observedAt: new Date().toISOString(),
    ready: true,
    code: "SPONSOR_FUNDING_READY",
    message: "Sponsor wallet has enough sampled IOTA balance for the requested reserve budget.",
    contactsLiveService: true,
    spendsGas: false,
    signsTransactions: false,
    sponsorAddressRedacted: "0x12345678...90abcdef",
    coinType: "0x2::iota::IOTA",
    requiredMist: "50000000",
    totalBalanceMist: "100000000",
    coinObjectCount: 1,
    sampledCoinCount: 1,
    maxSampledCoinBalanceMist: "100000000",
    hasNextCoinPage: false,
  };
}

function readyIotaNamesReport() {
  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.iota-names-live-smoke-report",
    observedAt: new Date().toISOString(),
    result: "passed",
    code: "IOTA_NAMES_LIVE_SMOKE_PASSED",
    message: "IOTA Names live smoke resolved the configured name to the expected address.",
    contactsLiveService: true,
    endpointConfigured: true,
    nameConfigured: true,
    expectedAddressConfigured: true,
    addressMatched: true,
    resolvedAddressRedacted: "0x11111111...11111111",
  };
}

function readyIotaIdentityReport() {
  return {
    schemaVersion: 1,
    kind: "agentic-gaskit.iota-identity-live-smoke-report",
    observedAt: new Date().toISOString(),
    result: "passed",
    code: "IOTA_IDENTITY_LIVE_SMOKE_PASSED",
    message: "IOTA Identity live smoke verified profile DID and credential evidence.",
    contactsLiveService: true,
    endpointConfigured: true,
    profilePathConfigured: true,
    trustPolicyConfigured: true,
    identityVerified: true,
    credentialRefsChecked: 1,
  };
}
