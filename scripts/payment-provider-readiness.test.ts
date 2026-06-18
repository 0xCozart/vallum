import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  buildPaymentProviderReadinessArtifact,
  checkPaymentProviderReadiness,
  formatPaymentProviderReadinessArtifact,
  formatPaymentProviderReadinessReport,
  type PaymentProviderReadinessReport,
  writePaymentProviderReadinessArtifact,
} from "./check-payment-provider-readiness.js";

const NOW = new Date("2026-06-11T12:00:00.000Z");

test("payment provider readiness reports local proof while live report remains missing", async () => {
  const cwd = await writeLocalPaymentProviderEvidence();
  try {
    const report = await checkPaymentProviderReadiness({ cwd, env: {}, now: NOW });
    const formatted = formatPaymentProviderReadinessReport(report);
    const artifact = buildPaymentProviderReadinessArtifact(report, NOW);
    const artifactJson = formatPaymentProviderReadinessArtifact(artifact);

    assert.equal(report.localProofOk, true);
    assert.equal(report.liveReady, false);
    assert.equal(artifact.kind, "vallum.payment-provider-readiness-report");
    assert.equal(artifact.localProofOk, true);
    assert.equal(artifact.liveReady, false);
    assert.ok(artifact.provenLocalCheckIds.includes("local-standards-proof"));
    assert.ok(artifact.blockedCheckIds.includes("live-payment-provider-report"));
    assert.ok(artifact.blockerCodes.includes("PAYMENT_PROVIDER_LIVE_REPORT_MISSING"));
    assert.equal(findCheck(report, "local-standards-proof").status, "proven-local");
    assert.equal(findCheck(report, "local-standards-proof").code, "PAYMENT_PROVIDER_LOCAL_PROOF_CONFIGURED");
    assert.equal(findCheck(report, "live-payment-provider-report").status, "blocked-config");
    assert.equal(findCheck(report, "live-payment-provider-report").code, "PAYMENT_PROVIDER_LIVE_REPORT_MISSING");
    assert.match(formatted, /Vallum payment provider readiness blocked/);
    assert.match(formatted, /operator:write-report-template -- --kind payment-provider-live/);
    assert.doesNotMatch(formatted, /secret|token|private|mnemonic|seed|authorization/i);
    assert.doesNotMatch(
      artifactJson,
      /unsafe-secret-report|Bearer secret-value|0x[0-9a-fA-F]{64}/,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("payment provider readiness artifact writer uses restrictive local file permissions", async () => {
  const cwd = await writeLocalPaymentProviderEvidence();
  try {
    const outFile = "tmp/vallum/payment-provider-readiness.json";
    const artifact = await writePaymentProviderReadinessArtifact({
      cwd,
      env: {},
      now: NOW,
      outFile,
    });
    const written = JSON.parse(await readFile(join(cwd, outFile), "utf8")) as typeof artifact;
    const mode = (await stat(join(cwd, outFile))).mode & 0o777;

    assert.equal(artifact.kind, "vallum.payment-provider-readiness-report");
    assert.equal(written.kind, "vallum.payment-provider-readiness-report");
    assert.equal(written.liveReady, false);
    assert.equal(written.blockerCodes.includes("PAYMENT_PROVIDER_LIVE_REPORT_MISSING"), true);
    assert.equal(mode, 0o600);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("payment provider readiness accepts valid structured live report without printing path or values", async () => {
  const cwd = await writeLocalPaymentProviderEvidence();
  try {
    await writeJsonReport(join(cwd, "tmp/payment-provider-live-report.json"), validLiveReport());
    const report = await checkPaymentProviderReadiness({
      cwd,
      env: {
        PAYMENT_PROVIDER_LIVE_REPORT: "tmp/payment-provider-live-report.json",
      },
      now: NOW,
    });
    const formatted = formatPaymentProviderReadinessReport(report);

    assert.equal(report.localProofOk, true);
    assert.equal(report.liveReady, true);
    assert.equal(findCheck(report, "live-payment-provider-report").status, "ready-approval");
    assert.equal(findCheck(report, "live-payment-provider-report").code, "PAYMENT_PROVIDER_LIVE_REPORT_VALID");
    assert.match(formatted, /Vallum payment provider readiness ready-for-approval/);
    assert.doesNotMatch(formatted, /payment-provider-live-report|tmp\/|x402-verify|x402-payment-response|ap2-payment-receipt/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("payment provider readiness hydrates live report path from local env", async () => {
  const cwd = await writeLocalPaymentProviderEvidence();
  try {
    await writeJsonReport(join(cwd, "tmp/payment-provider-live-report.json"), validLiveReport());
    await writeFile(join(cwd, ".env"), [
      "PAYMENT_PROVIDER_LIVE_REPORT=tmp/payment-provider-live-report.json",
      "PAYMENT_PROVIDER_AUTH_BEARER_TOKEN=secret-token-value",
      "",
    ].join("\n"));

    const report = await checkPaymentProviderReadiness({ cwd, now: NOW });
    const formatted = formatPaymentProviderReadinessReport(report);

    assert.equal(report.localProofOk, true);
    assert.equal(report.liveReady, true);
    assert.equal(findCheck(report, "live-payment-provider-report").code, "PAYMENT_PROVIDER_LIVE_REPORT_VALID");
    assert.doesNotMatch(formatted, /payment-provider-live-report|secret-token-value|tmp\//i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("payment provider readiness rejects reports without x402 and AP2 proof summaries", async () => {
  const cwd = await writeLocalPaymentProviderEvidence();
  try {
    await writeJsonReport(join(cwd, "missing-x402-report.json"), {
      ...validLiveReport(),
      x402Proof: undefined,
    });
    await writeJsonReport(join(cwd, "failed-x402-report.json"), {
      ...validLiveReport(),
      x402Proof: {
        verifyResult: "passed",
        settleResult: "failed",
        paymentResponse: "present-redacted",
      },
    });
    await writeJsonReport(join(cwd, "missing-ap2-report.json"), {
      ...validLiveReport(),
      ap2Proof: {
        mandateChain: "validated",
        checkoutReceipt: "validated",
        paymentReceipt: "validated",
      },
    });

    const missingX402 = await checkPaymentProviderReadiness({
      cwd,
      env: { PAYMENT_PROVIDER_LIVE_REPORT: "missing-x402-report.json" },
      now: NOW,
    });
    const failedX402 = await checkPaymentProviderReadiness({
      cwd,
      env: { PAYMENT_PROVIDER_LIVE_REPORT: "failed-x402-report.json" },
      now: NOW,
    });
    const missingAp2 = await checkPaymentProviderReadiness({
      cwd,
      env: { PAYMENT_PROVIDER_LIVE_REPORT: "missing-ap2-report.json" },
      now: NOW,
    });
    const formatted = [
      formatPaymentProviderReadinessReport(missingX402),
      formatPaymentProviderReadinessReport(failedX402),
      formatPaymentProviderReadinessReport(missingAp2),
    ].join("\n");

    assert.equal(
      findCheck(missingX402, "live-payment-provider-report").code,
      "PAYMENT_PROVIDER_LIVE_REPORT_X402_PROOF_MISSING",
    );
    assert.equal(
      findCheck(failedX402, "live-payment-provider-report").code,
      "PAYMENT_PROVIDER_LIVE_REPORT_X402_SETTLE_NOT_PASSED",
    );
    assert.equal(
      findCheck(missingAp2, "live-payment-provider-report").code,
      "PAYMENT_PROVIDER_LIVE_REPORT_AP2_ACCOUNTABILITY_REVIEW_MISSING",
    );
    assert.doesNotMatch(formatted, /missing-x402-report|failed-x402-report|missing-ap2-report|paymentResponse/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("payment provider readiness rejects unsafe, malformed, and stale reports without printing configured paths", async () => {
  const cwd = await writeLocalPaymentProviderEvidence();
  try {
    await writeJsonReport(join(cwd, "unsafe-secret-report.json"), {
      ...validLiveReport(),
      authorizationHeader: "Bearer secret-value",
    });
    await writeJsonReport(join(cwd, "unsafe-value-report.json"), {
      ...validLiveReport(),
      notes: ["facilitator response included Bearer secret-value"],
    });
    await writeFile(join(cwd, "malformed-secret-report.json"), "passed but not json\n");
    await writeJsonReport(join(cwd, "stale-secret-report.json"), {
      ...validLiveReport(),
      observedAt: "2026-04-01T12:00:00.000Z",
    });

    const unsafe = await checkPaymentProviderReadiness({
      cwd,
      env: { PAYMENT_PROVIDER_LIVE_REPORT: "unsafe-secret-report.json" },
      now: NOW,
    });
    const malformed = await checkPaymentProviderReadiness({
      cwd,
      env: { PAYMENT_PROVIDER_LIVE_REPORT: "malformed-secret-report.json" },
      now: NOW,
    });
    const unsafeValue = await checkPaymentProviderReadiness({
      cwd,
      env: { PAYMENT_PROVIDER_LIVE_REPORT: "unsafe-value-report.json" },
      now: NOW,
    });
    const stale = await checkPaymentProviderReadiness({
      cwd,
      env: { PAYMENT_PROVIDER_LIVE_REPORT: "stale-secret-report.json" },
      now: NOW,
    });
    const formatted = [
      formatPaymentProviderReadinessReport(unsafe),
      formatPaymentProviderReadinessReport(malformed),
      formatPaymentProviderReadinessReport(stale),
    ].join("\n");

    assert.equal(findCheck(unsafe, "live-payment-provider-report").code, "PAYMENT_PROVIDER_LIVE_REPORT_UNSAFE_FIELDS");
    assert.equal(findCheck(unsafeValue, "live-payment-provider-report").code, "PAYMENT_PROVIDER_LIVE_REPORT_UNSAFE_FIELDS");
    assert.equal(findCheck(malformed, "live-payment-provider-report").code, "PAYMENT_PROVIDER_LIVE_REPORT_INVALID_JSON");
    assert.equal(findCheck(stale, "live-payment-provider-report").code, "PAYMENT_PROVIDER_LIVE_REPORT_STALE");
    assert.doesNotMatch(formatted, /unsafe-secret-report|malformed-secret-report|stale-secret-report|Bearer secret-value/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("payment provider readiness fails local proof when source evidence is missing", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-payment-provider-readiness-"));
  try {
    const report = await checkPaymentProviderReadiness({ cwd, env: {}, now: NOW });
    const local = findCheck(report, "local-standards-proof");

    assert.equal(report.localProofOk, false);
    assert.equal(report.liveReady, false);
    assert.equal(local.status, "blocked-local");
    assert.equal(local.code, "PAYMENT_PROVIDER_LOCAL_PROOF_INCOMPLETE");
    assert.match(local.evidence ?? "", /packages\/manifest\/src\/x402Mapping\.ts/);
    assert.match(local.evidence ?? "", /packages\/standards\/src\/ap2\.test\.ts/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

async function writeLocalPaymentProviderEvidence(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-payment-provider-readiness-"));
  for (const path of [
    "packages/manifest/src/x402Mapping.ts",
    "packages/manifest/src/x402Mapping.test.ts",
    "packages/manifest/src/ap2Mapping.ts",
    "packages/manifest/src/ap2Mapping.test.ts",
    "packages/receipts/src/x402Receipt.ts",
    "packages/receipts/src/x402Receipt.test.ts",
    "packages/receipts/src/ap2Receipt.ts",
    "packages/receipts/src/ap2Receipt.test.ts",
    "packages/standards/src/x402.ts",
    "packages/standards/src/x402.test.ts",
    "packages/standards/src/ap2.ts",
    "packages/standards/src/ap2.test.ts",
  ]) {
    await writeFileWithParents(join(cwd, path), "export {};\n");
  }
  return cwd;
}

async function writeJsonReport(path: string, value: unknown): Promise<void> {
  await writeFileWithParents(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFileWithParents(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

function validLiveReport() {
  return {
    schemaVersion: 1,
    kind: "vallum.payment-provider-live-proof",
    result: "passed",
    observedAt: NOW.toISOString(),
    environment: "testnet",
    providerKinds: ["x402", "ap2"],
    checks: [
      "x402-verify",
      "x402-settle",
      "x402-payment-response",
      "ap2-mandate-chain",
      "ap2-checkout-receipt",
      "ap2-payment-receipt",
      "ap2-accountability-review",
      "redaction-review",
    ],
    x402Proof: {
      facilitator: "provider-reviewed-redacted",
      verifyResult: "passed",
      settleResult: "passed",
      paymentResponse: "present-redacted",
    },
    ap2Proof: {
      mandateChain: "validated",
      checkoutReceipt: "validated",
      paymentReceipt: "validated",
      accountabilityReview: "passed",
    },
  };
}

function findCheck(report: PaymentProviderReadinessReport, id: string) {
  const check = report.checks.find((candidate) => candidate.id === id);
  assert.ok(check, `expected ${id} check`);
  return check;
}
