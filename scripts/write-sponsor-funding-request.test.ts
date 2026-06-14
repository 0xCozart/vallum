import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
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
  assert.equal(request.faucetAttemptContext.configured, false);
  assert.equal(request.operatorFundingOptions.some((option) => option.includes("sponsorAddress")), true);
  assert.equal(request.sponsorAddress, sponsorAddress);
  assert.equal(request.minimumBalanceMist, "60000000");
  assert.match(artifact, new RegExp(escapeRegExp(sponsorAddress)));
  assert.doesNotMatch(artifact, new RegExp(escapeRegExp(sponsorKey)));
  assert.doesNotMatch(summary, new RegExp(escapeRegExp(sponsorAddress)));
  assert.doesNotMatch(summary, new RegExp(escapeRegExp(sponsorKey)));
  assert.match(summary, /containsPublicSponsorAddress=true/);
  assert.match(summary, /faucetContext=none/);
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

test("sponsor funding request includes sanitized faucet attempt context", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "gaskit-sponsor-funding-request-"));
  const faucetReportPath = "tmp/gaskit/sponsor-faucet-request.json";
  await mkdir(join(cwd, "tmp/gaskit"), { recursive: true });
  await writeFile(join(cwd, faucetReportPath), JSON.stringify({
    schemaVersion: 1,
    kind: "agentic-gaskit.sponsor-faucet-request",
    result: "failed",
    code: "SPONSOR_FAUCET_FAILED",
    observedAt: "2026-06-14T08:00:00.000Z",
    network: "iota-testnet",
    message: "Sponsor faucet request failed without exposing raw faucet response details.",
    approvalRequired: true,
    contactsLiveService: true,
    spendsGas: false,
    signsTransactions: false,
    sponsorAddressRedacted: "0x12345678...90abcdef",
    faucetUrlConfigured: true,
    faucetApiVersion: "v0-documented",
    faucetHttpStatus: 405,
    faucetFailureKind: "http-status",
    nextCommands: ["npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json"],
  }));

  const request = await buildSponsorFundingRequest({
    cwd,
    env: { GAS_STATION_KEYPAIR: sponsorKey },
    faucetReportPath,
    now: new Date("2026-06-14T08:00:00.000Z"),
  });
  const artifact = formatSponsorFundingRequest(request);
  const summary = formatSponsorFundingRequestSummary(request);

  assert.deepEqual(request.faucetAttemptContext, {
    configured: true,
    valid: true,
    result: "failed",
    code: "SPONSOR_FAUCET_FAILED",
    faucetApiVersion: "v0-documented",
    faucetHttpStatus: 405,
    faucetFailureKind: "http-status",
    guidance: "Latest sponsor faucet request failed; use another approved faucet, wallet faucet flow, CLI faucet flow, or manual testnet transfer.",
  });
  assert.equal(request.operatorFundingOptions[0], "Avoid repeating the same faucet route until its bounded failure condition changes.");
  assert.doesNotMatch(artifact, /0x1234567890abcdef|task-|faucet\.testnet\.example|raw faucet/i);
  assert.doesNotMatch(summary, new RegExp(escapeRegExp(sponsorAddress)));
  assert.match(summary, /faucetContext=SPONSOR_FAUCET_FAILED/);
});

test("sponsor funding request rejects unsafe faucet report context", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "gaskit-sponsor-funding-request-"));
  const faucetReportPath = "tmp/gaskit/sponsor-faucet-request.json";
  await mkdir(join(cwd, "tmp/gaskit"), { recursive: true });
  await writeFile(join(cwd, faucetReportPath), JSON.stringify({
    schemaVersion: 1,
    kind: "agentic-gaskit.sponsor-faucet-request",
    result: "failed",
    code: "SPONSOR_FAUCET_FAILED",
    observedAt: "2026-06-14T08:00:00.000Z",
    network: "iota-testnet",
    message: "Sponsor faucet request failed without exposing raw faucet response details.",
    approvalRequired: true,
    contactsLiveService: true,
    spendsGas: false,
    signsTransactions: false,
    sponsorAddressRedacted: sponsorAddress,
    faucetUrlConfigured: true,
    faucetApiVersion: "v0-documented",
    faucetHttpStatus: 405,
    faucetFailureKind: "http-status",
    nextCommands: ["npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json"],
  }));

  const request = await buildSponsorFundingRequest({
    cwd,
    env: { GAS_STATION_KEYPAIR: sponsorKey },
    faucetReportPath,
    now: new Date("2026-06-14T08:00:00.000Z"),
  });

  assert.equal(request.faucetAttemptContext.configured, true);
  assert.equal(request.faucetAttemptContext.valid, false);
  assert.equal(request.faucetAttemptContext.code, "SPONSOR_FAUCET_REPORT_INVALID");
  assert.equal("faucetHttpStatus" in request.faucetAttemptContext, false);
});

test("sponsor funding request can read faucet context from env", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "gaskit-sponsor-funding-request-"));
  const faucetReportPath = "tmp/gaskit/sponsor-faucet-request.json";
  await mkdir(join(cwd, "tmp/gaskit"), { recursive: true });
  await writeFile(join(cwd, faucetReportPath), JSON.stringify({
    schemaVersion: 1,
    kind: "agentic-gaskit.sponsor-faucet-request",
    result: "blocked",
    code: "SPONSOR_FAUCET_APPROVAL_REQUIRED",
    observedAt: "2026-06-14T08:00:00.000Z",
    network: "iota-testnet",
    message: "Sponsor faucet request requires explicit --execute before contacting a faucet service.",
    approvalRequired: true,
    contactsLiveService: false,
    spendsGas: false,
    signsTransactions: false,
    sponsorAddressRedacted: "0x12345678...90abcdef",
    faucetUrlConfigured: true,
    nextCommands: ["npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json"],
  }));

  const request = await buildSponsorFundingRequest({
    cwd,
    env: {
      GAS_STATION_KEYPAIR: sponsorKey,
      GASKIT_SPONSOR_FAUCET_REPORT: faucetReportPath,
    },
    now: new Date("2026-06-14T08:00:00.000Z"),
  });

  assert.equal(request.faucetAttemptContext.configured, true);
  assert.equal(request.faucetAttemptContext.valid, true);
  assert.equal(request.faucetAttemptContext.result, "blocked");
  assert.equal(request.faucetAttemptContext.code, "SPONSOR_FAUCET_APPROVAL_REQUIRED");
  assert.match(request.faucetAttemptContext.guidance, /did not contact a faucet/);
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
