import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";

import {
  checkSponsorFunding,
  formatSponsorFundingReport,
  sponsorAddressFromGasStationKeypair,
  type SponsorFundingClient,
} from "./check-sponsor-funding.js";
import {
  buildSponsorFundingEvidenceReport,
  formatSponsorFundingEvidenceReport,
  loadSponsorFundingReport,
  validateSponsorFundingReport,
} from "./sponsor-funding-report.js";

const keypair = Ed25519Keypair.generate();
const sponsorKey = keypair.getSecretKey();
const sponsorAddress = keypair.toIotaAddress();

test("sponsor funding reports ready without printing private key or full address", async () => {
  const report = await checkSponsorFunding({
    client: fundingClientFixture({
      totalBalance: "100000000",
      coinObjectCount: 2,
      coins: ["75000000", "25000000"],
    }),
    env: {
      GAS_STATION_KEYPAIR: sponsorKey,
      IOTA_RPC_URL: "https://rpc.testnet.example",
    },
    minBalanceMist: "50000000",
  });
  const formatted = formatSponsorFundingReport(report);

  assert.equal(report.ready, true);
  assert.equal(report.code, "SPONSOR_FUNDING_READY");
  assert.equal(report.totalBalanceMist, "100000000");
  assert.equal(report.maxSampledCoinBalanceMist, "75000000");
  assert.match(formatted, /spendsGas=false/);
  assert.match(formatted, /signsTransactions=false/);
  assert.doesNotMatch(formatted, new RegExp(escapeRegExp(sponsorKey)));
  assert.doesNotMatch(formatted, new RegExp(escapeRegExp(sponsorAddress)));
});

test("sponsor funding blocks total balance below requested reserve budget", async () => {
  const report = await checkSponsorFunding({
    client: fundingClientFixture({
      totalBalance: "1000",
      coinObjectCount: 1,
      coins: ["1000"],
    }),
    env: {
      GAS_STATION_KEYPAIR: sponsorKey,
      IOTA_RPC_URL: "https://rpc.testnet.example",
    },
    minBalanceMist: "50000000",
  });

  assert.equal(report.ready, false);
  assert.equal(report.code, "SPONSOR_FUNDING_TOTAL_INSUFFICIENT");
});

test("sponsor funding blocks fragmented sampled coins separately from total balance", async () => {
  const report = await checkSponsorFunding({
    client: fundingClientFixture({
      totalBalance: "60000000",
      coinObjectCount: 3,
      coins: ["20000000", "20000000", "20000000"],
    }),
    env: {
      GAS_STATION_KEYPAIR: sponsorKey,
      IOTA_RPC_URL: "https://rpc.testnet.example",
    },
    minBalanceMist: "50000000",
  });

  assert.equal(report.ready, false);
  assert.equal(report.code, "SPONSOR_FUNDING_COIN_FRAGMENTED");
  assert.equal(report.maxSampledCoinBalanceMist, "20000000");
});

test("sponsor funding fails closed when signer config is unreadable", async () => {
  const report = await checkSponsorFunding({
    client: fundingClientFixture({
      totalBalance: "100000000",
      coinObjectCount: 1,
      coins: ["100000000"],
    }),
    env: {
      GAS_STATION_KEYPAIR: "replace-with-local-testnet-sponsor-key",
      IOTA_RPC_URL: "https://rpc.testnet.example",
    },
  });
  const formatted = formatSponsorFundingReport(report);

  assert.equal(report.ready, false);
  assert.equal(report.code, "SPONSOR_FUNDING_UNREADABLE");
  assert.doesNotMatch(formatted, /replace-with-local-testnet-sponsor-key/);
});

test("sponsor address derivation matches the SDK keypair address", () => {
  assert.equal(sponsorAddressFromGasStationKeypair(sponsorKey), sponsorAddress);
});

test("sponsor funding evidence report validates readiness without full address", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-sponsor-funding-"));
  try {
    const report = await checkSponsorFunding({
      client: fundingClientFixture({
        totalBalance: "100000000",
        coinObjectCount: 1,
        coins: ["100000000"],
      }),
      env: {
        GAS_STATION_KEYPAIR: sponsorKey,
        IOTA_RPC_URL: "https://rpc.testnet.example",
      },
      minBalanceMist: "50000000",
    });
    const evidence = buildSponsorFundingEvidenceReport(report, new Date("2026-06-14T00:00:00.000Z"));
    const raw = formatSponsorFundingEvidenceReport(evidence);
    await writeFile(join(cwd, "sponsor-funding-report.json"), `${raw}\n`);

    const loaded = await loadSponsorFundingReport(join(cwd, "sponsor-funding-report.json"));
    const validation = validateSponsorFundingReport(loaded, new Date("2026-06-14T00:01:00.000Z"));

    assert.equal(loaded.kind, "agentic-gaskit.sponsor-funding-report");
    assert.equal(validation.ok, true);
    assert.equal(validation.code, "SPONSOR_FUNDING_REPORT_VALID");
    assert.doesNotMatch(raw, new RegExp(escapeRegExp(sponsorAddress)));
    assert.doesNotMatch(raw, new RegExp(escapeRegExp(sponsorKey)));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("sponsor funding evidence report preserves insufficient funding as a gate blocker", async () => {
  const report = await checkSponsorFunding({
    client: fundingClientFixture({
      totalBalance: "0",
      coinObjectCount: 0,
      coins: [],
    }),
    env: {
      GAS_STATION_KEYPAIR: sponsorKey,
      IOTA_RPC_URL: "https://rpc.testnet.example",
    },
    minBalanceMist: "50000000",
  });
  const validation = validateSponsorFundingReport(buildSponsorFundingEvidenceReport(report));

  assert.equal(validation.ok, false);
  assert.equal(validation.code, "SPONSOR_FUNDING_TOTAL_INSUFFICIENT");
});

test("sponsor funding evidence report rejects unsafe full-address fields", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "agentic-gaskit-sponsor-funding-"));
  try {
    await writeFile(join(cwd, "unsafe-report.json"), JSON.stringify({
      schemaVersion: 1,
      kind: "agentic-gaskit.sponsor-funding-report",
      observedAt: new Date().toISOString(),
      ready: true,
      code: "SPONSOR_FUNDING_READY",
      message: "unsafe",
      contactsLiveService: true,
      spendsGas: false,
      signsTransactions: false,
      sponsorAddress,
      sponsorAddressRedacted: "0x1234...abcd",
      coinType: "0x2::iota::IOTA",
      requiredMist: "50000000",
    }));

    await assert.rejects(
      loadSponsorFundingReport(join(cwd, "unsafe-report.json")),
      /invalid shape/,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

function fundingClientFixture(options: {
  totalBalance: string;
  coinObjectCount: number;
  coins: string[];
  hasNextPage?: boolean;
}): SponsorFundingClient {
  return {
    async getBalance() {
      return {
        coinType: "0x2::iota::IOTA",
        coinObjectCount: options.coinObjectCount,
        totalBalance: options.totalBalance,
      };
    },
    async getCoins() {
      return {
        data: options.coins.map((balance) => ({ balance })),
        hasNextPage: options.hasNextPage ?? false,
      };
    },
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
