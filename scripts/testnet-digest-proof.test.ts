import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  checkTestnetDigestProof,
  DOCUMENTED_TESTNET_DIGEST,
  formatTestnetDigestProofReport,
} from "./check-testnet-digest-proof.js";

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

async function writeDigestDocs(digest: string): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-testnet-digest-"));
  for (const path of [
    "docs/testnet-attempts.md",
    "docs/milestone-0-proof.md",
    "docs/reviewer-walkthrough.md",
  ]) {
    const file = join(cwd, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `public digest evidence: ${digest}\n`);
  }
  return cwd;
}
