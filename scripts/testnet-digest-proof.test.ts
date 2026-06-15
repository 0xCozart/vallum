import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  checkTestnetDigestProof,
  DOCUMENTED_TESTNET_DIGEST,
  formatTestnetDigestProofReport,
} from "./check-testnet-digest-proof.js";
import {
  buildTestnetDigestEvidenceReport,
  formatTestnetDigestEvidenceReport,
  loadTestnetDigestReport,
  validateTestnetDigestReport,
} from "./testnet-digest-report.js";

test("testnet digest proof checks documented evidence without network", async () => {
  const cwd = await writeDigestDocs(DOCUMENTED_TESTNET_DIGEST);
  try {
    const report = await checkTestnetDigestProof({ cwd });
    const formatted = formatTestnetDigestProofReport(report);

    assert.equal(report.status, "documented-local");
    assert.equal(report.documented, true);
    assert.equal(report.liveChecked, false);
    assert.equal(report.verified, false);
    assert.match(formatted, /proof:testnet-digest:live/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("testnet digest proof fails closed when docs do not contain the digest", async () => {
  const cwd = await writeDigestDocs("missing-digest-placeholder");
  try {
    const report = await checkTestnetDigestProof({ cwd });
    const formatted = formatTestnetDigestProofReport(report);

    assert.equal(report.status, "blocked-live");
    assert.equal(report.blocker, "TESTNET_DIGEST_DOCS_MISSING");
    assert.match(formatted, /TESTNET_DIGEST_DOCS_MISSING/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("testnet digest proof fails closed when required docs are missing", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentrail-testnet-digest-missing-"));
  try {
    const report = await checkTestnetDigestProof({ cwd });
    const formatted = formatTestnetDigestProofReport(report);

    assert.equal(report.status, "blocked-live");
    assert.equal(report.blocker, "TESTNET_DIGEST_DOCS_MISSING");
    assert.match(formatted, /TESTNET_DIGEST_DOCS_MISSING/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("testnet digest live proof verifies a successful transaction through injected client", async () => {
  const cwd = await writeDigestDocs(DOCUMENTED_TESTNET_DIGEST);
  try {
    const report = await checkTestnetDigestProof({
      cwd,
      live: true,
      client: {
        async getTransactionBlock(input) {
          assert.equal(input.digest, DOCUMENTED_TESTNET_DIGEST);
          assert.equal(input.options?.showEffects, true);
          assert.ok(input.signal);
          return {
            digest: DOCUMENTED_TESTNET_DIGEST,
            checkpoint: "12345",
            timestampMs: "1781136000000",
            effects: {
              status: { status: "success" },
              executedEpoch: "42",
              gasObject: { reference: { objectId: "0x1", version: "1", digest: "gas" }, owner: { AddressOwner: "0x2" } },
              gasUsed: {
                computationCost: "1",
                computationCostBurned: "0",
                storageCost: "1",
                storageRebate: "0",
                nonRefundableStorageFee: "0",
              },
              messageVersion: "v1",
              transactionDigest: DOCUMENTED_TESTNET_DIGEST,
            },
          };
        },
      },
    });

    assert.equal(report.status, "verified-testnet");
    assert.equal(report.liveChecked, true);
    assert.equal(report.verified, true);
    assert.equal(report.effectsStatus, "success");
    assert.equal(report.checkpoint, "12345");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("testnet digest live proof can be persisted as a validated local report", async () => {
  const cwd = await writeDigestDocs(DOCUMENTED_TESTNET_DIGEST);
  try {
    const report = await checkTestnetDigestProof({
      cwd,
      live: true,
      client: {
        async getTransactionBlock() {
          return {
            digest: DOCUMENTED_TESTNET_DIGEST,
            checkpoint: "12345",
            timestampMs: "1781136000000",
            effects: {
              status: { status: "success" },
              executedEpoch: "42",
              gasObject: { reference: { objectId: "0x1", version: "1", digest: "gas" }, owner: { AddressOwner: "0x2" } },
              gasUsed: {
                computationCost: "1",
                computationCostBurned: "0",
                storageCost: "1",
                storageRebate: "0",
                nonRefundableStorageFee: "0",
              },
              messageVersion: "v1",
              transactionDigest: DOCUMENTED_TESTNET_DIGEST,
            },
          };
        },
      },
    });
    const evidence = buildTestnetDigestEvidenceReport(report, new Date("2026-06-14T00:00:00.000Z"));
    const raw = formatTestnetDigestEvidenceReport(evidence);
    const outFile = join(cwd, "tmp/agentrail/testnet-digest-proof.json");

    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, `${raw}\n`, { mode: 0o600 });

    const loaded = await loadTestnetDigestReport(outFile);
    const validation = validateTestnetDigestReport(loaded, new Date("2026-06-14T00:10:00.000Z"));
    const mode = (await stat(outFile)).mode & 0o777;

    assert.equal(mode, 0o600);
    assert.equal(loaded.kind, "agentrail.testnet-digest-proof-report");
    assert.equal(validation.ok, true);
    assert.equal(validation.code, "TESTNET_SPONSORED_EXECUTE_DIGEST_VERIFIED");
    assert.doesNotMatch(await readFile(outFile, "utf8"), /secret|private|mnemonic|iotaprivkey/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("testnet digest report validation rejects stale or unverified reports", async () => {
  const verified = buildTestnetDigestEvidenceReport({
    digest: DOCUMENTED_TESTNET_DIGEST,
    rpcUrl: "https://api.testnet.iota.cafe",
    documented: true,
    liveChecked: true,
    verified: true,
    status: "verified-testnet",
    effectsStatus: "success",
    next: "ok",
  }, new Date("2026-06-12T00:00:00.000Z"));
  const stale = validateTestnetDigestReport(verified, new Date("2026-06-14T00:00:01.000Z"));
  const unverified = validateTestnetDigestReport({
    ...verified,
    observedAt: "2026-06-14T00:00:00.000Z",
    status: "documented-local",
    liveChecked: false,
    verified: false,
    effectsStatus: undefined,
  }, new Date("2026-06-14T00:10:00.000Z"));

  assert.equal(stale.ok, false);
  assert.equal(stale.code, "TESTNET_DIGEST_REPORT_STALE");
  assert.equal(unverified.ok, false);
  assert.equal(unverified.code, "TESTNET_DIGEST_NOT_VERIFIED");
});

test("testnet digest live proof blocks failed or mismatched transactions", async () => {
  const cwd = await writeDigestDocs(DOCUMENTED_TESTNET_DIGEST);
  try {
    const report = await checkTestnetDigestProof({
      cwd,
      live: true,
      client: {
        async getTransactionBlock() {
          return {
            digest: "not-the-documented-digest",
            effects: {
              status: { status: "failure", error: "MoveAbort" },
              executedEpoch: "42",
              gasObject: { reference: { objectId: "0x1", version: "1", digest: "gas" }, owner: { AddressOwner: "0x2" } },
              gasUsed: {
                computationCost: "1",
                computationCostBurned: "0",
                storageCost: "1",
                storageRebate: "0",
                nonRefundableStorageFee: "0",
              },
              messageVersion: "v1",
              transactionDigest: "not-the-documented-digest",
            },
          };
        },
      },
    });

    assert.equal(report.status, "blocked-live");
    assert.equal(report.blocker, "TESTNET_DIGEST_NOT_SUCCESSFUL");
    assert.equal(report.verified, false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("testnet digest live proof blocks lookup errors without leaking details", async () => {
  const cwd = await writeDigestDocs(DOCUMENTED_TESTNET_DIGEST);
  try {
    const report = await checkTestnetDigestProof({
      cwd,
      live: true,
      client: {
        async getTransactionBlock() {
          throw new Error("secret local proxy failure with token-like-value");
        },
      },
    });
    const formatted = formatTestnetDigestProofReport(report);

    assert.equal(report.status, "blocked-live");
    assert.equal(report.blocker, "TESTNET_DIGEST_LOOKUP_FAILED");
    assert.doesNotMatch(formatted, /token-like-value|secret local proxy/i);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("tracked testnet evidence redaction audit catches unsafe execute fields", () => {
  const unsafe = [
    "ephemeralUserAddress=0x80b3fadd46ab8aac6563a1e733deda1c63ca5e54c667662ab63cc8f4e3253b5b",
    "reservationId=13",
    "agentRailTransactionId=agentrail_5dc3c921-8b51-4f2c-ad54-795e0503b726",
    "sponsorAddress=0xd046a4fb78f6ad84a08232db7f4f23164f6e406063ac021f8c86d0cf29b9b868",
  ].join("\n");

  assert.deepEqual(unsafeTrackedTestnetEvidenceLines(unsafe), [
    "1:ephemeralUserAddress=0x80b3fadd46ab8aac6563a1e733deda1c63ca5e54c667662ab63cc8f4e3253b5b",
    "2:reservationId=13",
    "3:agentRailTransactionId=agentrail_5dc3c921-8b51-4f2c-ad54-795e0503b726",
    "4:sponsorAddress=0xd046a4fb78f6ad84a08232db7f4f23164f6e406063ac021f8c86d0cf29b9b868",
  ]);
});

test("tracked testnet attempts evidence keeps addresses and execution ids redacted", async () => {
  const attempts = await readFile("docs/testnet-attempts.md", "utf8");

  assert.deepEqual(unsafeTrackedTestnetEvidenceLines(attempts), []);
});

async function writeDigestDocs(digest: string): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "agentrail-testnet-digest-"));
  for (const path of [
    "docs/testnet-attempts.md",
    "docs/agentrail/testnet-digest-proof.md",
    "docs/reviewer-walkthrough.md",
  ]) {
    const file = join(cwd, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `public digest evidence: ${digest}\n`);
  }
  return cwd;
}

function unsafeTrackedTestnetEvidenceLines(content: string): string[] {
  const unsafe: string[] = [];
  const checks: readonly RegExp[] = [
    /^ephemeralUserAddress=0x[0-9a-fA-F]{64}$/,
    /^sponsorAddress=0x[0-9a-fA-F]{64}$/,
    /^reservationId=(?!<redacted-id>$)[^\s.][^\s]*$/,
    /^agentRailTransactionId=agentrail_[A-Za-z0-9_-]+$/,
  ];

  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (checks.some((check) => check.test(line))) {
      unsafe.push(`${index + 1}:${line}`);
    }
  }
  return unsafe;
}
