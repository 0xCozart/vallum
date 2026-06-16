import assert from "node:assert/strict";
import test from "node:test";

import { createVallumBackendHandlers } from "./vallum-backend.js";
import { VallumAuthError, VallumError, VallumPolicyError } from "../../packages/sdk/src/index.js";
import type {
  ExecuteSponsoredTransactionRequest,
  ExecuteSponsoredTransactionResponse,
  ReserveGasRequest,
  ReserveGasResponse,
} from "../../packages/sdk/src/index.js";

function asJson(value: unknown): string {
  return JSON.stringify(value);
}

test("reserve handler uses the server-owned SDK client and returns only safe reservation fields", async () => {
  const reserveCalls: ReserveGasRequest[] = [];
  const handlers = createVallumBackendHandlers({
    client: {
      async reserveGas(request: ReserveGasRequest): Promise<ReserveGasResponse> {
        reserveCalls.push(request);
        return {
          reservationId: "reservation-1",
          agentRailTransactionId: "vallum-1",
          sponsorAddress: "0xSPONSOR",
          gasCoins: [{ objectId: "coin-that-should-stay-server-side" }],
          raw: { upstreamDebug: "do-not-return" },
        };
      },
      async executeSponsoredTransaction(): Promise<ExecuteSponsoredTransactionResponse> {
        throw new Error("execute should not be called by reserve handler");
      },
    },
  });

  const response = await handlers.reserve({
    walletAddress: "0xUSER",
    packageId: "0xDEMO_PACKAGE",
    functionName: "mint_badge",
    gasBudget: 50_000_000,
    reserveDurationSecs: 30,
  });

  assert.deepEqual(reserveCalls, [
    {
      walletAddress: "0xUSER",
      packageId: "0xDEMO_PACKAGE",
      functionName: "mint_badge",
      gasBudget: 50_000_000,
      reserveDurationSecs: 30,
    },
  ]);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    reservationId: "reservation-1",
    agentRailTransactionId: "vallum-1",
    sponsorAddress: "0xSPONSOR",
  });
  assert.doesNotMatch(asJson(response.body), /do-not-return|coin-that-should-stay-server-side|apiKey|Bearer/i);
});

test("execute handler omits transaction bytes, user signatures, and raw upstream bodies", async () => {
  const executeCalls: ExecuteSponsoredTransactionRequest[] = [];
  const handlers = createVallumBackendHandlers({
    client: {
      async reserveGas(): Promise<ReserveGasResponse> {
        throw new Error("reserve should not be called by execute handler");
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

  const response = await handlers.execute({
    reservationId: "reservation-1",
    agentRailTransactionId: "vallum-1",
    transactionBytes: "client-transaction-bytes",
    userSignature: "client-user-signature",
  });

  assert.deepEqual(executeCalls, [
    {
      reservationId: "reservation-1",
      agentRailTransactionId: "vallum-1",
      transactionBytes: "client-transaction-bytes",
      userSignature: "client-user-signature",
    },
  ]);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { digest: "demo-digest-1" });
  assert.doesNotMatch(
    asJson(response.body),
    /raw-bytes-that-should-stay-server-side|raw-signature-that-should-stay-server-side|client-transaction-bytes|client-user-signature/i,
  );
});

test("handlers map SDK errors to safe frontend responses without raw upstream bodies", async () => {
  const handlers = createVallumBackendHandlers({
    client: {
      async reserveGas(): Promise<ReserveGasResponse> {
        throw new VallumPolicyError("raw upstream policy body leaked", "PACKAGE_NOT_ALLOWED", 400, {
          apiKey: "secret-app-key",
          bearerToken: "secret-bearer-token",
          raw: "raw-upstream-error-body",
        });
      },
      async executeSponsoredTransaction(): Promise<ExecuteSponsoredTransactionResponse> {
        throw new VallumAuthError("raw upstream auth body leaked", 401, {
          apiKey: "secret-app-key",
          bearerToken: "secret-bearer-token",
        });
      },
    },
  });

  const reserve = await handlers.reserve({ gasBudget: 1, packageId: "0xNOT_ALLOWED", functionName: "mint_badge" });
  const execute = await handlers.execute({
    reservationId: "reservation-1",
    agentRailTransactionId: "vallum-1",
    transactionBytes: "client-transaction-bytes",
    userSignature: "client-user-signature",
  });

  assert.deepEqual(reserve.body, {
    error: "POLICY_REJECTED",
    message: "Request rejected by Vallum policy.",
    reasonCode: "PACKAGE_NOT_ALLOWED",
  });
  assert.equal(reserve.status, 400);
  assert.deepEqual(execute.body, {
    error: "AUTH_FAILED",
    message: "Vallum authentication failed.",
  });
  assert.equal(execute.status, 401);
  assert.doesNotMatch(
    asJson([reserve.body, execute.body]),
    /secret|raw upstream|raw-upstream|transaction-bytes|user-signature|apiKey|bearer/i,
  );
});

test("handlers map non-policy SDK errors to generic safe frontend responses", async () => {
  const handlers = createVallumBackendHandlers({
    client: {
      async reserveGas(): Promise<ReserveGasResponse> {
        throw new VallumError("raw upstream gateway body leaked", 502, {
          transactionBytes: "secret-transaction-bytes",
          userSignature: "secret-user-signature",
        });
      },
      async executeSponsoredTransaction(): Promise<ExecuteSponsoredTransactionResponse> {
        throw new Error("execute should not be called by reserve handler");
      },
    },
  });

  const response = await handlers.reserve({ gasBudget: 1 });

  assert.equal(response.status, 502);
  assert.deepEqual(response.body, {
    error: "VALLUM_REQUEST_FAILED",
    message: "Vallum request failed.",
  });
  assert.doesNotMatch(asJson(response.body), /secret|raw upstream|transaction-bytes|user-signature/i);
});

test("handlers omit unknown policy reason codes from safe frontend responses", async () => {
  const handlers = createVallumBackendHandlers({
    client: {
      async reserveGas(): Promise<ReserveGasResponse> {
        throw new VallumPolicyError("raw upstream policy body leaked", "secret-app-key-raw-body", 400, {
          raw: "raw-upstream-error-body",
        });
      },
      async executeSponsoredTransaction(): Promise<ExecuteSponsoredTransactionResponse> {
        throw new Error("execute should not be called by reserve handler");
      },
    },
  });

  const response = await handlers.reserve({ gasBudget: 1 });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: "POLICY_REJECTED",
    message: "Request rejected by Vallum policy.",
  });
  assert.doesNotMatch(asJson(response.body), /secret|raw-upstream|raw upstream/i);
});
