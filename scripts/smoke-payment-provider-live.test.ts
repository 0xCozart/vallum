import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { checkPaymentProviderReadiness } from "./check-payment-provider-readiness.js";
import {
  formatPaymentProviderLiveSmokeResult,
  resolvePaymentProviderLiveEnv,
  runPaymentProviderLiveSmoke,
} from "./smoke-payment-provider-live.js";

const NOW = new Date("2026-06-17T12:00:00.000Z");

test("payment-provider live env hydrates local .env and preserves explicit overrides", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-payment-live-env-"));
  try {
    await writeFile(join(cwd, ".env"), [
      "PAYMENT_PROVIDER_X402_VERIFY_URL=https://payments.example/v2/x402/verify",
      "PAYMENT_PROVIDER_X402_SETTLE_URL=https://payments.example/v2/x402/settle",
      "PAYMENT_PROVIDER_X402_REQUEST=request.json",
      "PAYMENT_PROVIDER_AP2_PROOF=ap2.json",
    ].join("\n"));

    const env = await resolvePaymentProviderLiveEnv(cwd, {
      PAYMENT_PROVIDER_X402_REQUEST: "override-request.json",
    });

    assert.equal(env.PAYMENT_PROVIDER_X402_VERIFY_URL, "https://payments.example/v2/x402/verify");
    assert.equal(env.PAYMENT_PROVIDER_X402_SETTLE_URL, "https://payments.example/v2/x402/settle");
    assert.equal(env.PAYMENT_PROVIDER_AP2_PROOF, "ap2.json");
    assert.equal(env.PAYMENT_PROVIDER_X402_REQUEST, "override-request.json");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("payment-provider live smoke blocks missing config without provider calls", async () => {
  let calls = 0;
  const result = await runPaymentProviderLiveSmoke({
    reportFile: "tmp/vallum/payment-provider-live-report.json",
    env: {},
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "PAYMENT_PROVIDER_LIVE_CONFIG_MISSING");
  assert.equal(calls, 0);
  assert.match(formatPaymentProviderLiveSmokeResult(result), /PAYMENT_PROVIDER_X402_VERIFY_URL/);
});

test("payment-provider live smoke rejects unsafe public endpoint config", async () => {
  const cwd = await writeInputs();
  const result = await runPaymentProviderLiveSmoke({
    cwd,
    reportFile: "tmp/vallum/payment-provider-live-report.json",
    env: env({
      PAYMENT_PROVIDER_X402_VERIFY_URL: "http://127.0.0.1/verify",
    }),
    fetchImpl: async () => jsonResponse({}),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "PAYMENT_PROVIDER_LIVE_URL_UNSAFE");
});

test("payment-provider live smoke writes accepted redacted report after x402 and AP2 status proof pass", async () => {
  const cwd = await writeInputs();
  const calls: Array<{ url: string; authorization?: string }> = [];
  const fixtureBearer = "fixture-provider-token";

  const result = await runPaymentProviderLiveSmoke({
    cwd,
    now: NOW,
    reportFile: "tmp/vallum/payment-provider-live-report.json",
    env: env({ PAYMENT_PROVIDER_AUTH_BEARER_TOKEN: fixtureBearer }),
    fetchImpl: async (url, init) => {
      calls.push({
        url: String(url),
        authorization: new Headers(init?.headers).get("authorization") ?? undefined,
      });
      return jsonResponse(String(url).endsWith("/verify") ? { isValid: true } : { success: true });
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls.map((call) => call.url), [
    "https://payments.example/v2/x402/verify",
    "https://payments.example/v2/x402/settle",
  ]);
  assert.equal(calls[0]?.authorization, `Bearer ${fixtureBearer}`);

  const reportPath = join(cwd, "tmp/vallum/payment-provider-live-report.json");
  const raw = await readFile(reportPath, "utf8");
  const written = JSON.parse(raw) as {
    kind?: string;
    result?: string;
    x402Proof?: { verifyResult?: string; settleResult?: string; paymentResponse?: string };
    ap2Proof?: { mandateChain?: string; checkoutReceipt?: string; paymentReceipt?: string; accountabilityReview?: string };
  };
  assert.equal(written.kind, "vallum.payment-provider-live-proof");
  assert.equal(written.result, "passed");
  assert.deepEqual(written.x402Proof, {
    verifyResult: "passed",
    settleResult: "passed",
    paymentResponse: "present-redacted",
  });
  assert.deepEqual(written.ap2Proof, {
    mandateChain: "validated",
    checkoutReceipt: "validated",
    paymentReceipt: "validated",
    accountabilityReview: "passed",
  });
  assert.doesNotMatch(raw, /fixture-provider-token|signature|authorization|payments\.example|request\.json|ap2\.json/);
  assert.equal((await stat(reportPath)).mode & 0o777, 0o600);

  const readiness = await checkPaymentProviderReadiness({
    cwd,
    now: new Date("2026-06-18T12:00:00.000Z"),
    env: { PAYMENT_PROVIDER_LIVE_REPORT: "tmp/vallum/payment-provider-live-report.json" },
  });
  assert.equal(readiness.liveReady, true);
});

test("payment-provider live smoke fails closed when verify, settle, or AP2 proof fails", async () => {
  const cwd = await writeInputs();
  const verifyFailed = await runPaymentProviderLiveSmoke({
    cwd,
    reportFile: "tmp/vallum/payment-provider-live-report.json",
    env: env(),
    fetchImpl: async () => jsonResponse({ isValid: false }),
  });
  assert.equal(verifyFailed.ok, false);
  assert.equal(verifyFailed.code, "PAYMENT_PROVIDER_X402_VERIFY_NOT_PASSED");

  const settleFailed = await runPaymentProviderLiveSmoke({
    cwd,
    reportFile: "tmp/vallum/payment-provider-live-report.json",
    env: env(),
    fetchImpl: async (url) => jsonResponse(String(url).endsWith("/verify") ? { isValid: true } : { success: false }),
  });
  assert.equal(settleFailed.ok, false);
  assert.equal(settleFailed.code, "PAYMENT_PROVIDER_X402_SETTLE_NOT_PASSED");

  await writeJson(join(cwd, "ap2.json"), {
    mandateChain: "validated",
    checkoutReceipt: "missing",
    paymentReceipt: "validated",
    accountabilityReview: "passed",
  });
  const ap2Failed = await runPaymentProviderLiveSmoke({
    cwd,
    reportFile: "tmp/vallum/payment-provider-live-report.json",
    env: env(),
    fetchImpl: async () => jsonResponse({ isValid: true }),
  });
  assert.equal(ap2Failed.ok, false);
  assert.equal(ap2Failed.code, "PAYMENT_PROVIDER_AP2_PROOF_INCOMPLETE");
});

async function writeInputs(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-payment-live-smoke-"));
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
    await writeJson(join(cwd, path), {});
  }
  await writeJson(join(cwd, "request.json"), {
    x402Version: 2,
    paymentPayload: {
      x402Version: 2,
      accepted: {
        scheme: "exact",
        network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        amount: "1000",
        payTo: "0x122F8Fcaf2152420445Aa424E1D8C0306935B5c9",
        maxTimeoutSeconds: 60,
      },
      payload: {
        signature: "redacted-local-fixture",
        authorization: {
          from: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
          to: "0x122F8Fcaf2152420445Aa424E1D8C0306935B5c9",
          value: "1000",
        },
      },
    },
    paymentRequirements: {
      scheme: "exact",
      network: "eip155:84532",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      amount: "1000",
      payTo: "0x122F8Fcaf2152420445Aa424E1D8C0306935B5c9",
      maxTimeoutSeconds: 60,
    },
  });
  await writeJson(join(cwd, "ap2.json"), {
    mandateChain: "validated",
    checkoutReceipt: "validated",
    paymentReceipt: "validated",
    accountabilityReview: "passed",
  });
  return cwd;
}

function env(extra: Record<string, string> = {}): Record<string, string> {
  return {
    PAYMENT_PROVIDER_X402_VERIFY_URL: "https://payments.example/v2/x402/verify",
    PAYMENT_PROVIDER_X402_SETTLE_URL: "https://payments.example/v2/x402/settle",
    PAYMENT_PROVIDER_X402_REQUEST: "request.json",
    PAYMENT_PROVIDER_AP2_PROOF: "ap2.json",
    ...extra,
  };
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function jsonResponse(value: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: { "content-type": "application/json" },
  });
}
