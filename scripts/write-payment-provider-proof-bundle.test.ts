import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { writePaymentProviderProofBundle } from "./write-payment-provider-proof-bundle.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

test("payment provider proof bundle writes template, plan, and blocked summary without provider secrets", async () => {
  const cwd = await writePaymentProviderEvidence();
  try {
    const bundle = await writePaymentProviderProofBundle({
      cwd,
      now: NOW,
      env: {
        PAYMENT_PROVIDER_LIVE_REPORT: "missing-payment-report.json",
      },
    });
    const bundleRaw = await readFile(join(cwd, "tmp/vallum/payment-provider-proof-bundle.json"), "utf8");
    const planRaw = await readFile(join(cwd, "tmp/vallum/payment-provider-proof-plan.json"), "utf8");
    const readinessRaw = await readFile(join(cwd, "tmp/vallum/payment-provider-readiness.json"), "utf8");
    const templateRaw = await readFile(join(cwd, "tmp/vallum/payment-provider-live-report-template.json"), "utf8");

    assert.equal(bundle.kind, "vallum.payment-provider-proof-bundle");
    assert.equal(bundle.status, "blocked");
    assert.equal(bundle.localProofOk, true);
    assert.equal(bundle.liveReady, false);
    assert.deepEqual(bundle.templateArtifacts, [
      {
        id: "payment-provider-live",
        path: "tmp/vallum/payment-provider-live-report-template.json",
        acceptedReportEnv: "PAYMENT_PROVIDER_LIVE_REPORT",
      },
    ]);
    assert.equal(bundle.planArtifact, "tmp/vallum/payment-provider-proof-plan.json");
    assert.equal(bundle.readinessArtifact, "tmp/vallum/payment-provider-readiness.json");
    assert.ok(bundle.blockerCodes.includes("PAYMENT_PROVIDER_LIVE_REPORT_NOT_FOUND"));
    assert.equal(bundle.readyApprovalCodes.length, 0);
    assert.ok(bundle.requiredOperatorInputs.includes("PAYMENT_PROVIDER_LIVE_REPORT"));
    assert.ok(bundle.requiredOperatorInputs.includes("PAYMENT_PROVIDER_X402_VERIFY_URL"));
    assert.ok(bundle.requiredOperatorInputs.includes("PAYMENT_PROVIDER_X402_SETTLE_URL"));
    assert.ok(bundle.requiredOperatorInputs.includes("PAYMENT_PROVIDER_X402_REQUEST"));
    assert.ok(bundle.requiredOperatorInputs.includes("PAYMENT_PROVIDER_AP2_PROOF"));
    assert.deepEqual(bundle.conditionalOperatorInputs, [
      {
        input: "PAYMENT_PROVIDER_AUTH_BEARER_TOKEN",
        requiredWhen: "selected x402 facilitator requires Authorization",
        secret: true,
      },
    ]);
    assert.ok(bundle.requiredStructuredReportFields.includes("providerKinds"));
    assert.ok(bundle.requiredStructuredReportFields.includes("x402Proof"));
    assert.ok(bundle.requiredStructuredReportFields.includes("ap2Proof"));
    assert.ok(bundle.requiredStructuredReportCheckIds.includes("x402-verify"));
    assert.ok(bundle.requiredStructuredReportCheckIds.includes("x402-payment-response"));
    assert.ok(bundle.requiredStructuredReportCheckIds.includes("ap2-mandate-chain"));
    assert.ok(bundle.requiredStructuredReportCheckIds.includes("ap2-accountability-review"));
    assert.ok(bundle.requiredEvidenceArtifacts.includes("sanitized payment-provider structured report"));
    assert.ok(bundle.requiredEvidenceArtifacts.includes("x402 payment response confirmation"));
    assert.ok(bundle.requiredEvidenceArtifacts.includes("status-only AP2 accountability review"));
    assert.equal(bundle.steps.find((step) => step.id === "run-approved-x402-provider-proof")?.contactsPaymentProvider, true);
    assert.match(bundle.steps.find((step) => step.id === "run-approved-x402-provider-proof")?.command ?? "", /smoke:payment-provider-live/);
    assert.equal(bundle.steps.find((step) => step.id === "write-payment-provider-template")?.contactsPaymentProvider, false);

    await assertMode(join(cwd, "tmp/vallum/payment-provider-proof-bundle.json"), 0o600);
    await assertMode(join(cwd, "tmp/vallum/payment-provider-proof-plan.json"), 0o600);
    await assertMode(join(cwd, "tmp/vallum/payment-provider-readiness.json"), 0o600);
    await assertMode(join(cwd, "tmp/vallum/payment-provider-live-report-template.json"), 0o600);

    const allOutput = `${JSON.stringify(bundle)}\n${bundleRaw}\n${planRaw}\n${readinessRaw}\n${templateRaw}`;
    assert.doesNotMatch(
      allOutput,
      /missing-payment-report|facilitator\.example|Bearer secret-value|paymentInstrumentRef|settlement-123|private-key-value|mnemonic-value/i,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("payment provider proof bundle is ready for approval when structured report passes", async () => {
  const cwd = await writePaymentProviderEvidence();
  try {
    await writeJsonReport(join(cwd, "payment-provider-live-report.json"), validLiveReport());

    const bundle = await writePaymentProviderProofBundle({
      cwd,
      now: NOW,
      env: {
        PAYMENT_PROVIDER_LIVE_REPORT: "payment-provider-live-report.json",
      },
    });
    const bundleRaw = await readFile(join(cwd, "tmp/vallum/payment-provider-proof-bundle.json"), "utf8");

    assert.equal(bundle.status, "ready-for-approval");
    assert.equal(bundle.liveReady, true);
    assert.deepEqual(bundle.blockerCodes, []);
    assert.ok(bundle.readyApprovalCodes.includes("PAYMENT_PROVIDER_LIVE_REPORT_VALID"));
    assert.equal(bundle.checks.find((check) => check.id === "live-payment-provider-report")?.status, "ready-approval");
    assert.doesNotMatch(
      bundleRaw,
      /facilitator\.example|Bearer secret-value|paymentInstrumentRef|settlement-123|private-key-value|mnemonic-value/i,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

async function writePaymentProviderEvidence(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-payment-proof-bundle-"));
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

async function assertMode(path: string, expected: number): Promise<void> {
  const mode = (await stat(path)).mode & 0o777;
  assert.equal(mode, expected);
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
