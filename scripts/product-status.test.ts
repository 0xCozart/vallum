import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  checkProductStatus,
  formatProductStatusReport,
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
      custodyReadiness: blockedCustodyReadiness(),
      gasStationRuntimeReport: blockedGasStationRuntime(),
      scripts: completeScripts(),
      marketplaceReadiness: blockedMarketplaceReadiness(),
      packagePublicationReadiness: blockedPackagePublicationReadiness(),
      paymentProviderReadiness: blockedPaymentProviderReadiness(),
    });
    const formatted = formatProductStatusReport(report);

    assert.equal(report.complete, false);
    assert.equal(report.localProofOk, true);
    assert.deepEqual(
      report.checks.slice(0, 9).map((check) => [check.id, check.status, check.code]),
      [
        ["local-verification", "proven-local", "LOCAL_VERIFY_SURFACE_CONFIGURED"],
        ["package-release-local", "proven-local", "PACKAGE_RELEASE_GATES_CONFIGURED"],
        ["operator-report-template", "proven-local", "OPERATOR_REPORT_TEMPLATE_WRITER_CONFIGURED"],
        ["testnet-readiness", "blocked-live", "TESTNET_ENV_FILE_MISSING"],
        ["gas-station-runtime", "blocked-live", "GAS_STATION_DOCKER_DAEMON_UNAVAILABLE"],
        ["testnet-upstream", "blocked-live", "TESTNET_UPSTREAM_REPORT_MISSING"],
        ["iota-names-live", "blocked-live", "IOTA_NAMES_LIVE_CONFIG_MISSING"],
        ["iota-identity-live", "blocked-live", "IOTA_IDENTITY_LIVE_CONFIG_MISSING"],
        ["vc-validation-live", "blocked-live", "VC_TRUST_POLICY_CONFIG_MISSING"],
      ],
    );
    assert.match(formatted, /not-complete/);
    assert.match(formatted, /NPM_PUBLICATION_UNRUN/);
    assert.match(formatted, /npm run proof:package-publication-readiness/);
    assert.match(formatted, /PUBLIC_A2A_HOSTING_UNPROVEN/);
    assert.match(formatted, /LIVE_PAYMENT_PROVIDER_UNPROVEN/);
    assert.match(formatted, /npm run proof:payment-provider-readiness/);
    assert.match(formatted, /PRODUCTION_MARKETPLACE_BLOCKED/);
    assert.match(formatted, /npm run proof:marketplace-readiness/);
    assert.match(formatted, /PRODUCTION_CUSTODY_OUT_OF_SCOPE/);
    assert.match(formatted, /npm run proof:custody-readiness/);
    assert.match(formatted, /DEVICE_ACCESS_SAFETY_DEFERRED/);
    assert.doesNotMatch(formatted, /local-secret|iotaprivkey|fake-private-key|seed-phrase|mnemonic-value/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("product status marks configured live gates ready without contacting endpoints", async () => {
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

    const report = await checkProductStatus({
      cwd,
      scripts: completeScripts(),
      custodyReadiness: blockedCustodyReadiness(),
      marketplaceReadiness: blockedMarketplaceReadiness(),
      packagePublicationReadiness: blockedPackagePublicationReadiness(),
      gasStationRuntimeReport: readyGasStationRuntime(),
      env: {
        GASKIT_TESTNET_UPSTREAM_REPORT: "upstream-report.json",
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
    });
    const formatted = formatProductStatusReport(report);

    assert.equal(report.complete, false);
    assert.equal(report.localProofOk, true);
    assert.equal(report.checks.find((check) => check.id === "testnet-readiness")?.status, "ready-live");
    assert.equal(report.checks.find((check) => check.id === "gas-station-runtime")?.status, "ready-live");
    assert.equal(report.checks.find((check) => check.id === "testnet-upstream")?.status, "ready-live");
    assert.equal(report.checks.find((check) => check.id === "iota-names-live")?.status, "ready-live");
    assert.equal(report.checks.find((check) => check.id === "iota-identity-live")?.status, "ready-live");
    assert.equal(report.checks.find((check) => check.id === "vc-validation-live")?.status, "ready-live");
    assert.equal(report.checks.find((check) => check.id === "npm-registry-publication")?.status, "blocked-production");
    assert.doesNotMatch(
      formatted,
      /graphql\.testnet\.example|identity\.testnet\.example|researcher\.json|fake-testnet-sponsor-key|fake-gas-station-auth|jwt-secret|fake-upstream-bearer/,
    );
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
      gasStationRuntimeRunner: async () => {
        throw new Error("managed-upstream product status must not inspect Docker");
      },
      scripts: completeScripts(),
      custodyReadiness: blockedCustodyReadiness(),
      marketplaceReadiness: blockedMarketplaceReadiness(),
      packagePublicationReadiness: blockedPackagePublicationReadiness(),
      paymentProviderReadiness: blockedPaymentProviderReadiness(),
    });
    const formatted = formatProductStatusReport(report);

    assert.equal(report.complete, false);
    assert.equal(report.checks.find((check) => check.id === "gas-station-runtime")?.status, "ready-live");
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
      gasStationRuntimeReport: blockedGasStationRuntime(),
      scripts: completeScripts(),
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
      gasStationRuntimeReport: blockedGasStationRuntime(),
      scripts: completeScripts(),
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

test("product status can mark marketplace report ready for approval without exposing report values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-product-status-"));
  try {
    const report = await checkProductStatus({
      cwd,
      env: {},
      gasStationRuntimeReport: blockedGasStationRuntime(),
      scripts: completeScripts(),
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
      gasStationRuntimeReport: blockedGasStationRuntime(),
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
      gasStationRuntimeReport: blockedGasStationRuntime(),
      scripts,
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
