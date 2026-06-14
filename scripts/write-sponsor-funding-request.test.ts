import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";

import {
  buildSponsorFundingRequest,
  formatSponsorFundingRequest,
  formatSponsorFundingRequestSummary,
  writeSponsorFundingRequest,
} from "./write-sponsor-funding-request.js";

const keypair = Ed25519Keypair.generate();
const sponsorKey = keypair.getSecretKey();
const sponsorAddress = keypair.toIotaAddress();

test("sponsor funding request includes public address only in the artifact", async () => {
  const request = await buildSponsorFundingRequest({
    env: { GAS_STATION_KEYPAIR: sponsorKey },
    minBalanceMist: "60000000",
    now: new Date("2026-06-14T08:00:00.000Z"),
  });
  const artifact = formatSponsorFundingRequest(request);
  const summary = formatSponsorFundingRequestSummary(request);

  assert.equal(request.kind, "agentic-gaskit.sponsor-funding-request");
  assert.equal(request.result, "pending-funding");
  assert.equal(request.contactsLiveService, false);
  assert.equal(request.spendsGas, false);
  assert.equal(request.signsTransactions, false);
  assert.equal(request.sponsorAddress, sponsorAddress);
  assert.equal(request.minimumBalanceMist, "60000000");
  assert.match(artifact, new RegExp(escapeRegExp(sponsorAddress)));
  assert.doesNotMatch(artifact, new RegExp(escapeRegExp(sponsorKey)));
  assert.doesNotMatch(summary, new RegExp(escapeRegExp(sponsorAddress)));
  assert.doesNotMatch(summary, new RegExp(escapeRegExp(sponsorKey)));
  assert.match(summary, /containsPublicSponsorAddress=true/);
});

test("sponsor funding request writes an ignored local artifact with restrictive permissions", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "gaskit-sponsor-funding-request-"));
  const outFile = "tmp/gaskit/sponsor-funding-request.json";
  const request = await writeSponsorFundingRequest({
    cwd,
    env: { GAS_STATION_KEYPAIR: sponsorKey },
    outFile,
    now: new Date("2026-06-14T08:00:00.000Z"),
  });
  const artifactPath = join(cwd, outFile);
  const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as typeof request;
  const mode = (await stat(artifactPath)).mode & 0o777;

  assert.equal(artifact.sponsorAddress, sponsorAddress);
  assert.equal(artifact.result, "pending-funding");
  assert.equal(mode, 0o600);
});

test("sponsor funding request fails closed when signer config is unreadable", async () => {
  await assert.rejects(
    buildSponsorFundingRequest({
      env: { GAS_STATION_KEYPAIR: "replace-with-local-testnet-sponsor-key" },
    }),
  );
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
