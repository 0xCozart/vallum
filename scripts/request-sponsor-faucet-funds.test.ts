import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";

import {
  formatSponsorFaucetRequestReport,
  requestSponsorFaucetFunds,
  type SponsorFaucetRequester,
} from "./request-sponsor-faucet-funds.js";

const keypair = Ed25519Keypair.generate();
const sponsorKey = keypair.getSecretKey();
const sponsorAddress = keypair.toIotaAddress();

test("sponsor faucet request requires explicit execute before contacting live services", async () => {
  let calls = 0;
  const report = await requestSponsorFaucetFunds({
    env: {
      GAS_STATION_KEYPAIR: sponsorKey,
      IOTA_FAUCET_URL: "https://faucet.testnet.example",
    },
    requestFunds: async () => {
      calls += 1;
      return 100;
    },
  });
  const formatted = formatSponsorFaucetRequestReport(report);

  assert.equal(report.result, "blocked");
  assert.equal(report.code, "SPONSOR_FAUCET_APPROVAL_REQUIRED");
  assert.equal(report.contactsLiveService, false);
  assert.equal(calls, 0);
  assert.doesNotMatch(formatted, new RegExp(escapeRegExp(sponsorAddress)));
  assert.doesNotMatch(formatted, new RegExp(escapeRegExp(sponsorKey)));
});

test("sponsor faucet request blocks missing faucet configuration", async () => {
  const report = await requestSponsorFaucetFunds({
    env: { GAS_STATION_KEYPAIR: sponsorKey },
    execute: true,
  });

  assert.equal(report.result, "blocked");
  assert.equal(report.code, "SPONSOR_FAUCET_CONFIG_MISSING");
  assert.equal(report.contactsLiveService, false);
});

test("sponsor faucet request rejects unsafe faucet URLs without contacting them", async () => {
  let calls = 0;
  const report = await requestSponsorFaucetFunds({
    env: { GAS_STATION_KEYPAIR: sponsorKey },
    execute: true,
    faucetUrl: "http://192.168.0.20:9123",
    requestFunds: async () => {
      calls += 1;
      return 100;
    },
  });

  assert.equal(report.result, "blocked");
  assert.equal(report.code, "SPONSOR_FAUCET_URL_UNSAFE");
  assert.equal(report.contactsLiveService, false);
  assert.equal(calls, 0);
});

test("sponsor faucet request calls injected faucet and writes sanitized report", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "gaskit-sponsor-faucet-"));
  const outFile = join(cwd, "tmp/gaskit/sponsor-faucet-request.json");
  let recipient = "";
  const requestFunds: SponsorFaucetRequester = async (input) => {
    assert.equal(input.host, "https://faucet.testnet.example");
    recipient = input.recipient;
    return 1_000_000_000;
  };

  const report = await requestSponsorFaucetFunds({
    env: {
      GAS_STATION_KEYPAIR: sponsorKey,
      IOTA_FAUCET_URL: "https://faucet.testnet.example",
    },
    execute: true,
    outFile,
    requestFunds,
  });
  const artifact = JSON.parse(await readFile(outFile, "utf8")) as typeof report;
  const mode = (await stat(outFile)).mode & 0o777;
  const formatted = formatSponsorFaucetRequestReport(report);

  assert.equal(recipient, sponsorAddress);
  assert.equal(report.result, "passed");
  assert.equal(report.code, "SPONSOR_FAUCET_REQUESTED");
  assert.equal(report.contactsLiveService, true);
  assert.equal(report.amountMist, "1000000000");
  assert.equal(artifact.sponsorAddressRedacted, report.sponsorAddressRedacted);
  assert.equal(mode, 0o600);
  assert.doesNotMatch(JSON.stringify(artifact), new RegExp(escapeRegExp(sponsorAddress)));
  assert.doesNotMatch(JSON.stringify(artifact), new RegExp(escapeRegExp(sponsorKey)));
  assert.doesNotMatch(formatted, new RegExp(escapeRegExp(sponsorAddress)));
});

test("sponsor faucet request redacts failed faucet responses", async () => {
  const rawError = "upstream leaked body with pretend secret";
  const report = await requestSponsorFaucetFunds({
    env: {
      GAS_STATION_KEYPAIR: sponsorKey,
      IOTA_FAUCET_URL: "https://faucet.testnet.example",
    },
    execute: true,
    requestFunds: async () => {
      throw new Error(rawError);
    },
  });
  const formatted = formatSponsorFaucetRequestReport(report);

  assert.equal(report.result, "failed");
  assert.equal(report.code, "SPONSOR_FAUCET_FAILED");
  assert.equal(report.contactsLiveService, true);
  assert.doesNotMatch(formatted, new RegExp(escapeRegExp(rawError)));
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
