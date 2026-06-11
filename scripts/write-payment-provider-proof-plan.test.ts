import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  formatPaymentProviderProofPlan,
  writePaymentProviderProofPlan,
} from "./write-payment-provider-proof-plan.js";

const NOW = new Date("2026-06-11T12:00:00.000Z");

test("payment provider proof plan reports current blockers without configured values", async () => {
  const cwd = await writePaymentProviderEvidence();
  try {
    await writeJsonReport(join(cwd, "tmp/secret-payment-report.json"), validLiveReport());
    const plan = await writePaymentProviderProofPlan({
      cwd,
      now: NOW,
      env: {
        PAYMENT_PROVIDER_LIVE_REPORT: "tmp/secret-payment-report.json",
      },
    });
    const formatted = formatPaymentProviderProofPlan(plan);

    assert.equal(plan.schemaVersion, 1);
    assert.equal(plan.kind, "payment-provider-proof-plan");
    assert.equal(plan.status, "ready-for-approval");
    assert.equal(plan.localProofOk, true);
    assert.equal(plan.liveReady, true);
    assert.deepEqual(plan.blockerCodes, []);
    assert.ok(plan.readyApprovalCodes.includes("PAYMENT_PROVIDER_LIVE_REPORT_VALID"));
    assert.ok(plan.requiredOperatorInputs.includes("PAYMENT_PROVIDER_LIVE_REPORT"));
    assert.ok(plan.requiredStructuredReportFields.includes("observedAt"));
    assert.ok(plan.requiredStructuredReportCheckIds.includes("x402-verify"));
    assert.ok(plan.commands.some((command) => command.id === "run-local-standards-proof" && !command.contactsPaymentProvider));
    assert.ok(plan.commands.some((command) => command.id === "run-approved-x402-provider-proof" && command.contactsPaymentProvider));
    assert.ok(plan.commands.some((command) => command.id === "check-payment-provider-readiness" && !command.requiresOperatorApproval));
    assert.doesNotMatch(
      formatted,
      /secret-payment-report|tmp\/|facilitator\.example|Bearer secret-value|paymentInstrumentRef|settlement-123|private-key-value|mnemonic-value/i,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("payment provider proof plan can write a redacted local JSON artifact", async () => {
  const cwd = await writePaymentProviderEvidence();
  try {
    const plan = await writePaymentProviderProofPlan({
      cwd,
      now: NOW,
      outFile: "tmp/gaskit/payment-provider-proof-plan.json",
      env: {},
    });
    const raw = await readFile(join(cwd, "tmp/gaskit/payment-provider-proof-plan.json"), "utf8");
    const written = JSON.parse(raw) as typeof plan;

    assert.equal(written.kind, "payment-provider-proof-plan");
    assert.equal(written.status, "blocked");
    assert.deepEqual(written.blockerCodes, plan.blockerCodes);
    assert.ok(written.blockerCodes.includes("PAYMENT_PROVIDER_LIVE_REPORT_MISSING"));
    assert.ok(written.boundaries.some((boundary) => boundary.includes("non-networked")));
    assert.doesNotMatch(raw, /payment-provider-proof-plan\.json|secret-payment-report|facilitator\.example|Bearer|paymentInstrument/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("payment provider proof plan reports local proof blockers without live contact", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-payment-provider-proof-plan-"));
  try {
    const plan = await writePaymentProviderProofPlan({
      cwd,
      now: NOW,
      env: {
        PAYMENT_PROVIDER_LIVE_REPORT: "missing-secret-report.json",
      },
    });
    const formatted = formatPaymentProviderProofPlan(plan);

    assert.equal(plan.localProofOk, false);
    assert.equal(plan.liveReady, false);
    assert.equal(plan.status, "blocked");
    assert.ok(plan.blockerCodes.includes("PAYMENT_PROVIDER_LOCAL_PROOF_INCOMPLETE"));
    assert.ok(plan.blockerCodes.includes("PAYMENT_PROVIDER_LIVE_REPORT_NOT_FOUND"));
    assert.doesNotMatch(formatted, /missing-secret-report/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

async function writePaymentProviderEvidence(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-payment-provider-proof-plan-"));
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
    kind: "agentic-gaskit.payment-provider-live-proof",
    result: "passed",
    observedAt: NOW.toISOString(),
    providerKinds: ["x402", "ap2"],
    checks: [
      "x402-verify",
      "x402-settle",
      "ap2-checkout-receipt",
      "ap2-payment-receipt",
      "redaction-review",
    ],
  };
}
