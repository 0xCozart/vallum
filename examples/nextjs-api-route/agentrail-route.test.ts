import assert from "node:assert/strict";
import test from "node:test";

import { AgentRailPolicyError } from "../../packages/sdk/src/index.js";
import type {
  ExecuteSponsoredTransactionRequest,
  ExecuteSponsoredTransactionResponse,
  ReserveGasRequest,
  ReserveGasResponse,
} from "../../packages/sdk/src/index.js";
import { createAgentRailNextApiRoutes } from "./agentrail-route.js";

async function readJson(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>;
}

function postJson(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("reserve route forwards safe request fields to the server-owned SDK client", async () => {
  const reserveCalls: ReserveGasRequest[] = [];
  const routes = createAgentRailNextApiRoutes({
    client: {
      async reserveGas(request: ReserveGasRequest): Promise<ReserveGasResponse> {
        reserveCalls.push(request);
        return {
          reservationId: "reservation-1",
          agentRailTransactionId: "agentrail-1",
          sponsorAddress: "0xSPONSOR",
          gasCoins: [{ objectId: "coin-hidden-from-frontend" }],
          raw: { upstreamDebug: "do-not-return" },
        };
      },
      async executeSponsoredTransaction(): Promise<ExecuteSponsoredTransactionResponse> {
        throw new Error("execute should not be called by reserve route");
      },
    },
  });

  const response = await routes.reserve(
    postJson("/api/agentrail/reserve", {
      walletAddress: "0xUSER",
      packageId: "0xDEMO_PACKAGE",
      functionName: "mint_badge",
      gasBudget: 50_000_000,
      reserveDurationSecs: 30,
      apiKey: "browser-supplied-key-must-be-ignored",
      bearerToken: "browser-supplied-token-must-be-ignored",
    }),
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
  assert.deepEqual(reserveCalls, [
    {
      walletAddress: "0xUSER",
      packageId: "0xDEMO_PACKAGE",
      functionName: "mint_badge",
      gasBudget: 50_000_000,
      reserveDurationSecs: 30,
    },
  ]);
  const body = await readJson(response);
  assert.deepEqual(body, {
    reservationId: "reservation-1",
    agentRailTransactionId: "agentrail-1",
    sponsorAddress: "0xSPONSOR",
  });
  assert.doesNotMatch(JSON.stringify(body), /coin-hidden|do-not-return|browser-supplied|apiKey|bearer/i);
});

test("execute route returns only safe execution fields", async () => {
  const executeCalls: ExecuteSponsoredTransactionRequest[] = [];
  const routes = createAgentRailNextApiRoutes({
    client: {
      async reserveGas(): Promise<ReserveGasResponse> {
        throw new Error("reserve should not be called by execute route");
      },
      async executeSponsoredTransaction(
        request: ExecuteSponsoredTransactionRequest,
      ): Promise<ExecuteSponsoredTransactionResponse> {
        executeCalls.push(request);
        return {
          digest: "demo-digest-1",
          raw: {
            transactionBytes: "raw-bytes-that-should-stay-server-side",
            userSignature: "raw-signature-that-should-stay-server-side",
          },
        };
      },
    },
  });

  const response = await routes.execute(
    postJson("/api/agentrail/execute", {
      reservationId: "reservation-1",
      agentRailTransactionId: "agentrail-1",
      transactionBytes: "client-transaction-bytes",
      userSignature: "client-user-signature",
      raw: "browser-raw-field-must-be-ignored",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(executeCalls, [
    {
      reservationId: "reservation-1",
      agentRailTransactionId: "agentrail-1",
      transactionBytes: "client-transaction-bytes",
      userSignature: "client-user-signature",
    },
  ]);
  const body = await readJson(response);
  assert.deepEqual(body, { digest: "demo-digest-1" });
  assert.doesNotMatch(
    JSON.stringify(body),
    /raw-bytes|raw-signature|client-transaction-bytes|client-user-signature|browser-raw/i,
  );
});

test("routes fail closed on malformed bodies before calling the SDK client", async () => {
  let calls = 0;
  const routes = createAgentRailNextApiRoutes({
    client: {
      async reserveGas(): Promise<ReserveGasResponse> {
        calls += 1;
        throw new Error("reserve should not be called");
      },
      async executeSponsoredTransaction(): Promise<ExecuteSponsoredTransactionResponse> {
        calls += 1;
        throw new Error("execute should not be called");
      },
    },
  });

  const invalidJson = await routes.reserve(
    new Request("http://localhost/api/agentrail/reserve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not valid json",
    }),
  );
  const arrayBody = await routes.execute(postJson("/api/agentrail/execute", []));
  const wrongMethod = await routes.reserve(new Request("http://localhost/api/agentrail/reserve", { method: "GET" }));
  const wrongContentType = await routes.reserve(
    new Request("http://localhost/api/agentrail/reserve", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ gasBudget: 1 }),
    }),
  );

  assert.equal(invalidJson.status, 400);
  assert.equal(arrayBody.status, 400);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("allow"), "POST");
  assert.equal(wrongContentType.status, 415);
  assert.equal(calls, 0);
});

test("routes reject invalid SDK request field shapes before calling the SDK client", async () => {
  let calls = 0;
  const routes = createAgentRailNextApiRoutes({
    client: {
      async reserveGas(): Promise<ReserveGasResponse> {
        calls += 1;
        throw new Error("reserve should not be called");
      },
      async executeSponsoredTransaction(): Promise<ExecuteSponsoredTransactionResponse> {
        calls += 1;
        throw new Error("execute should not be called");
      },
    },
  });

  const zeroGas = await routes.reserve(postJson("/api/agentrail/reserve", { gasBudget: 0 }));
  const fractionalGas = await routes.reserve(postJson("/api/agentrail/reserve", { gasBudget: 1.5 }));
  const wrongPackageType = await routes.reserve(postJson("/api/agentrail/reserve", { gasBudget: 1, packageId: 123 }));
  const wrongDurationType = await routes.reserve(
    postJson("/api/agentrail/reserve", { gasBudget: 1, reserveDurationSecs: "30" }),
  );
  const emptyExecuteId = await routes.execute(
    postJson("/api/agentrail/execute", {
      reservationId: "",
      agentRailTransactionId: "agentrail-1",
      transactionBytes: "client-transaction-bytes",
      userSignature: "client-user-signature",
    }),
  );
  const blankSignature = await routes.execute(
    postJson("/api/agentrail/execute", {
      reservationId: "reservation-1",
      agentRailTransactionId: "agentrail-1",
      transactionBytes: "client-transaction-bytes",
      userSignature: "   ",
    }),
  );

  for (const response of [zeroGas, fractionalGas, wrongPackageType, wrongDurationType, emptyExecuteId, blankSignature]) {
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});

test("routes map SDK errors without exposing raw upstream bodies", async () => {
  const routes = createAgentRailNextApiRoutes({
    client: {
      async reserveGas(): Promise<ReserveGasResponse> {
        throw new AgentRailPolicyError("raw upstream policy body leaked", "PACKAGE_NOT_ALLOWED", 400, {
          apiKey: "secret-app-key",
          raw: "raw-upstream-error-body",
        });
      },
      async executeSponsoredTransaction(): Promise<ExecuteSponsoredTransactionResponse> {
        throw new Error("execute should not be called by reserve route");
      },
    },
  });

  const response = await routes.reserve(postJson("/api/agentrail/reserve", { gasBudget: 1 }));

  assert.equal(response.status, 400);
  const body = await readJson(response);
  assert.deepEqual(body, {
    error: "POLICY_REJECTED",
    message: "Request rejected by AgentRail policy.",
    reasonCode: "PACKAGE_NOT_ALLOWED",
  });
  assert.doesNotMatch(JSON.stringify(body), /secret|raw upstream|raw-upstream|apiKey/i);
});
