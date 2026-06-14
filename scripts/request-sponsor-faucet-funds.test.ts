import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";

import {
  classifyFaucetError,
  formatSponsorFaucetRequestReport,
  loadSponsorFaucetRequestReport,
  requestIotaFromDocumentedFaucet,
  requestIotaFromDefaultFaucet,
  requestSponsorFaucetFunds,
  validateSponsorFaucetRequestReport,
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
    outFile: await tempFaucetReportPath(),
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
  assert.ok(report.nextCommands.some((command) => command.includes("sponsor:request-faucet-funds") && command.includes("--execute")));
  assert.equal(report.nextCommands.some((command) => command.includes("diagnose:gas-station")), false);
  assert.doesNotMatch(formatted, new RegExp(escapeRegExp(sponsorAddress)));
  assert.doesNotMatch(formatted, new RegExp(escapeRegExp(sponsorKey)));
});

test("sponsor faucet request blocks missing faucet configuration", async () => {
  const report = await requestSponsorFaucetFunds({
    env: { GAS_STATION_KEYPAIR: sponsorKey },
    execute: true,
    outFile: await tempFaucetReportPath(),
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
    outFile: await tempFaucetReportPath(),
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
  assert.ok(report.nextCommands.some((command) => command.includes("sponsor:check-funding")));
  assert.ok(report.nextCommands.some((command) => command.includes("diagnose:gas-station")));
  assert.equal(artifact.sponsorAddressRedacted, report.sponsorAddressRedacted);
  assert.equal(mode, 0o600);
  assert.doesNotMatch(JSON.stringify(artifact), new RegExp(escapeRegExp(sponsorAddress)));
  assert.doesNotMatch(JSON.stringify(artifact), new RegExp(escapeRegExp(sponsorKey)));
  assert.doesNotMatch(formatted, new RegExp(escapeRegExp(sponsorAddress)));
});

test("sponsor faucet report validation rejects unsafe full address fields", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "gaskit-sponsor-faucet-"));
  const outFile = join(cwd, "tmp/gaskit/sponsor-faucet-request.json");
  const report = await requestSponsorFaucetFunds({
    env: {
      GAS_STATION_KEYPAIR: sponsorKey,
      IOTA_FAUCET_URL: "https://faucet.testnet.example",
    },
    execute: true,
    outFile,
    requestFunds: async () => 1_000_000_000,
  });
  const loaded = await loadSponsorFaucetRequestReport(outFile);
  const unsafe = {
    ...loaded,
    sponsorAddressRedacted: sponsorAddress,
  };

  assert.equal(validateSponsorFaucetRequestReport(report).ok, true);
  assert.equal(validateSponsorFaucetRequestReport(unsafe).ok, false);
});

test("faucet error classifier maps raw faucet errors to bounded codes", () => {
  assert.equal(classifyFaucetError("Invalid recipient address"), "ADDRESS_INVALID");
  assert.equal(classifyFaucetError("Too many requests from this client"), "REQUEST_RATE_LIMITED");
  assert.equal(classifyFaucetError("Please wait before requesting again"), "REQUEST_COOLDOWN");
  assert.equal(classifyFaucetError("Faucet is out of funds"), "FUNDS_UNAVAILABLE");
  assert.equal(classifyFaucetError("FixedAmountRequest is not supported"), "REQUEST_UNSUPPORTED");
  assert.equal(classifyFaucetError({ code: "INTERNAL", message: "temporarily unavailable" }), "SERVICE_UNAVAILABLE");
  assert.equal(classifyFaucetError({ error: { code: "out_of_funds" } }), "FUNDS_UNAVAILABLE");
  assert.equal(classifyFaucetError({ detail: "unmodeled shape" }), "UNKNOWN");
});

test("documented faucet requester posts fixed amount requests to the /gas endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const recipient = "0x1111111111111111111111111111111111111111111111111111111111111111";
  try {
    globalThis.fetch = (async (url, init) => {
      assert.equal(String(url), "https://faucet.testnet.example/gas");
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        FixedAmountRequest: {
          recipient,
        },
      });
      return new Response(JSON.stringify({
        transferredGasObjects: [
          { amount: 100, id: "coin-1", transferTxDigest: "digest-1" },
          { amount: 200, id: "coin-2", transferTxDigest: "digest-2" },
        ],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const amount = await requestIotaFromDocumentedFaucet({
      host: "https://faucet.testnet.example",
      recipient,
    });

    assert.equal(amount, 300);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sponsor faucet request can select the documented v0 endpoint", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url, init) => {
      assert.equal(String(url), "https://faucet.testnet.example/gas");
      assert.equal(init?.method, "POST");
      return new Response(JSON.stringify({
        transferredGasObjects: [
          { amount: 100, id: "coin-1", transferTxDigest: "digest-1" },
        ],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const report = await requestSponsorFaucetFunds({
      env: {
        GAS_STATION_KEYPAIR: sponsorKey,
      },
      execute: true,
      faucetApiVersion: "v0-documented",
      faucetUrl: "https://faucet.testnet.example",
      outFile: await tempFaucetReportPath(),
    });
    const formatted = formatSponsorFaucetRequestReport(report);

    assert.equal(report.result, "passed");
    assert.equal(report.code, "SPONSOR_FAUCET_REQUESTED");
    assert.equal(report.faucetApiVersion, "v0-documented");
    assert.equal(report.amountMist, "100");
    assert.doesNotMatch(formatted, new RegExp(escapeRegExp(sponsorAddress)));
    assert.doesNotMatch(formatted, /faucet\.testnet\.example/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("default faucet requester uses the batch /v1/gas endpoint and polls status", async () => {
  const originalFetch = globalThis.fetch;
  const recipient = "0x1111111111111111111111111111111111111111111111111111111111111111";
  const seen: string[] = [];
  try {
    globalThis.fetch = (async (url, init) => {
      seen.push(`${init?.method ?? "GET"} ${String(url)}`);
      if (String(url).endsWith("/v1/gas")) {
        assert.equal(init?.method, "POST");
        assert.deepEqual(JSON.parse(String(init?.body)), {
          FixedAmountRequest: {
            recipient,
          },
        });
        return new Response(JSON.stringify({ task: "task-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      assert.equal(String(url), "https://faucet.testnet.example/v1/status/task-1");
      assert.equal(init?.method, "GET");
      return new Response(JSON.stringify({
        status: {
          status: "SUCCEEDED",
          transferred_gas_objects: {
            sent: [
              { amount: 100, id: "coin-1", transferTxDigest: "digest-1" },
              { amount: 200, id: "coin-2", transferTxDigest: "digest-2" },
            ],
          },
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const amount = await requestIotaFromDefaultFaucet({
      host: "https://faucet.testnet.example",
      recipient,
      delayMs: 0,
    });

    assert.equal(amount, 300);
    assert.deepEqual(seen, [
      "POST https://faucet.testnet.example/v1/gas",
      "GET https://faucet.testnet.example/v1/status/task-1",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sponsor faucet auto mode falls back from structurally invalid v1 responses to the documented endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const recipient = sponsorAddress;
  const seen: string[] = [];
  try {
    globalThis.fetch = (async (url, init) => {
      seen.push(`${init?.method ?? "GET"} ${String(url)}`);
      if (String(url).endsWith("/v1/gas")) {
        return new Response("not-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      assert.equal(String(url), "https://faucet.testnet.example/gas");
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        FixedAmountRequest: {
          recipient,
        },
      });
      return new Response(JSON.stringify({
        transferredGasObjects: [
          { amount: 500, id: "coin-1", transferTxDigest: "digest-1" },
        ],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const report = await requestSponsorFaucetFunds({
      env: {
        GAS_STATION_KEYPAIR: sponsorKey,
      },
      execute: true,
      faucetUrl: "https://faucet.testnet.example",
      outFile: await tempFaucetReportPath(),
    });
    const formatted = formatSponsorFaucetRequestReport(report);

    assert.equal(report.result, "passed");
    assert.equal(report.code, "SPONSOR_FAUCET_REQUESTED");
    assert.equal(report.faucetApiVersion, "v0-documented");
    assert.equal(report.amountMist, "500");
    assert.deepEqual(seen, [
      "POST https://faucet.testnet.example/v1/gas",
      "POST https://faucet.testnet.example/gas",
    ]);
    assert.doesNotMatch(formatted, new RegExp(escapeRegExp(sponsorAddress)));
    assert.doesNotMatch(formatted, /faucet\.testnet\.example|not-json/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sponsor faucet auto mode preserves unknown v1 faucet errors as terminal evidence", async () => {
  const originalFetch = globalThis.fetch;
  const rawError = { detail: "unmodeled response" };
  const seen: string[] = [];
  try {
    globalThis.fetch = (async (url, init) => {
      seen.push(`${init?.method ?? "GET"} ${String(url)}`);
      return new Response(JSON.stringify({ error: rawError }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const report = await requestSponsorFaucetFunds({
      env: {
        GAS_STATION_KEYPAIR: sponsorKey,
      },
      execute: true,
      faucetUrl: "https://faucet.testnet.example",
      outFile: await tempFaucetReportPath(),
    });
    const formatted = formatSponsorFaucetRequestReport(report);

    assert.equal(report.result, "failed");
    assert.equal(report.code, "SPONSOR_FAUCET_FAILED");
    assert.equal(report.faucetApiVersion, "v1-batch");
    assert.equal(report.faucetHttpStatus, 200);
    assert.equal(report.faucetFailureKind, "faucet-error");
    assert.equal(report.faucetErrorCode, "UNKNOWN");
    assert.deepEqual(seen, ["POST https://faucet.testnet.example/v1/gas"]);
    assert.doesNotMatch(JSON.stringify(report), /unmodeled response/);
    assert.doesNotMatch(formatted, /faucet\.testnet\.example|unmodeled response/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sponsor faucet auto mode does not fall back on concrete v1 faucet blockers", async () => {
  const originalFetch = globalThis.fetch;
  const seen: string[] = [];
  try {
    globalThis.fetch = (async (url, init) => {
      seen.push(`${init?.method ?? "GET"} ${String(url)}`);
      return new Response(JSON.stringify({ error: "Faucet is out of funds" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const report = await requestSponsorFaucetFunds({
      env: {
        GAS_STATION_KEYPAIR: sponsorKey,
      },
      execute: true,
      faucetUrl: "https://faucet.testnet.example",
      outFile: await tempFaucetReportPath(),
    });

    assert.equal(report.result, "failed");
    assert.equal(report.code, "SPONSOR_FAUCET_FAILED");
    assert.equal(report.faucetApiVersion, "v1-batch");
    assert.equal(report.faucetErrorCode, "FUNDS_UNAVAILABLE");
    assert.deepEqual(seen, ["POST https://faucet.testnet.example/v1/gas"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sponsor faucet request records documented v0 HTTP failure metadata", async () => {
  const originalFetch = globalThis.fetch;
  const rawResponse = "legacy faucet body that should stay hidden";
  try {
    globalThis.fetch = (async (url, init) => {
      assert.equal(String(url), "https://faucet.testnet.example/gas");
      assert.equal(init?.method, "POST");
      return new Response(rawResponse, { status: 405 });
    }) as typeof fetch;

    const report = await requestSponsorFaucetFunds({
      env: {
        GAS_STATION_KEYPAIR: sponsorKey,
      },
      execute: true,
      faucetApiVersion: "v0-documented",
      faucetUrl: "https://faucet.testnet.example",
      outFile: await tempFaucetReportPath(),
    });
    const formatted = formatSponsorFaucetRequestReport(report);

    assert.equal(report.result, "failed");
    assert.equal(report.code, "SPONSOR_FAUCET_FAILED");
    assert.equal(report.faucetApiVersion, "v0-documented");
    assert.equal(report.faucetHttpStatus, 405);
    assert.equal(report.faucetFailureKind, "http-status");
    assert.equal(report.faucetErrorCode, "REQUEST_UNSUPPORTED");
    assert.ok(report.nextCommands.some((command) => command.includes("sponsor:write-funding-request") && command.includes("--faucet-report")));
    assert.ok(report.nextCommands.some((command) => command.includes("GASKIT_SPONSOR_FAUCET_REPORT")));
    assert.equal(report.nextCommands.some((command) => command.includes("diagnose:gas-station")), false);
    assert.doesNotMatch(formatted, new RegExp(escapeRegExp(rawResponse)));
    assert.doesNotMatch(formatted, /faucet\.testnet\.example/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sponsor faucet request records safe HTTP failure metadata without raw response bodies", async () => {
  const originalFetch = globalThis.fetch;
  const rawResponse = "pretend faucet body with secret-looking value";
  try {
    globalThis.fetch = (async () => new Response(rawResponse, { status: 503 })) as typeof fetch;

    const report = await requestSponsorFaucetFunds({
      env: {
        GAS_STATION_KEYPAIR: sponsorKey,
      },
      execute: true,
      faucetUrl: "https://faucet.testnet.example",
      outFile: await tempFaucetReportPath(),
    });
    const formatted = formatSponsorFaucetRequestReport(report);

    assert.equal(report.result, "failed");
    assert.equal(report.code, "SPONSOR_FAUCET_FAILED");
    assert.equal(report.faucetApiVersion, "v1-batch");
    assert.equal(report.faucetHttpStatus, 503);
    assert.equal(report.faucetFailureKind, "http-status");
    assert.equal(report.faucetErrorCode, "SERVICE_UNAVAILABLE");
    assert.doesNotMatch(formatted, new RegExp(escapeRegExp(rawResponse)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sponsor faucet request records bounded faucet error codes without raw body text", async () => {
  const originalFetch = globalThis.fetch;
  const rawError = "Faucet is out of funds for this request";
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: rawError }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

    const report = await requestSponsorFaucetFunds({
      env: {
        GAS_STATION_KEYPAIR: sponsorKey,
      },
      execute: true,
      faucetUrl: "https://faucet.testnet.example",
      outFile: await tempFaucetReportPath(),
    });
    const formatted = formatSponsorFaucetRequestReport(report);

    assert.equal(report.result, "failed");
    assert.equal(report.code, "SPONSOR_FAUCET_FAILED");
    assert.equal(report.faucetApiVersion, "v1-batch");
    assert.equal(report.faucetHttpStatus, 200);
    assert.equal(report.faucetFailureKind, "faucet-error");
    assert.equal(report.faucetErrorCode, "FUNDS_UNAVAILABLE");
    assert.equal(validateSponsorFaucetRequestReport(report).ok, true);
    assert.doesNotMatch(JSON.stringify(report), new RegExp(escapeRegExp(rawError)));
    assert.match(formatted, /faucetErrorCode=FUNDS_UNAVAILABLE/);
    assert.doesNotMatch(formatted, new RegExp(escapeRegExp(rawError)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sponsor faucet request preserves v1 metadata for rate limits", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response("", { status: 429 })) as typeof fetch;

    const report = await requestSponsorFaucetFunds({
      env: {
        GAS_STATION_KEYPAIR: sponsorKey,
      },
      execute: true,
      faucetUrl: "https://faucet.testnet.example",
      outFile: await tempFaucetReportPath(),
    });

    assert.equal(report.result, "failed");
    assert.equal(report.code, "SPONSOR_FAUCET_RATE_LIMITED");
    assert.equal(report.faucetApiVersion, "v1-batch");
    assert.equal(report.faucetHttpStatus, 429);
    assert.equal(report.faucetFailureKind, "http-status");
    assert.equal(report.faucetErrorCode, "REQUEST_RATE_LIMITED");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sponsor faucet request redacts failed faucet responses", async () => {
  const rawError = "upstream leaked body with pretend secret";
  const report = await requestSponsorFaucetFunds({
    env: {
      GAS_STATION_KEYPAIR: sponsorKey,
      IOTA_FAUCET_URL: "https://faucet.testnet.example",
    },
    execute: true,
    outFile: await tempFaucetReportPath(),
    requestFunds: async () => {
      throw new Error(rawError);
    },
  });
  const formatted = formatSponsorFaucetRequestReport(report);

  assert.equal(report.result, "failed");
  assert.equal(report.code, "SPONSOR_FAUCET_FAILED");
  assert.equal(report.contactsLiveService, true);
  assert.equal(report.faucetApiVersion, "v1-batch");
  assert.doesNotMatch(formatted, new RegExp(escapeRegExp(rawError)));
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function tempFaucetReportPath(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "gaskit-sponsor-faucet-"));
  return join(cwd, "tmp/gaskit/sponsor-faucet-request.json");
}
