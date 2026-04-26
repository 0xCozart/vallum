import assert from "node:assert/strict";
import { test } from "node:test";

import { GasKitPolicyError } from "@iota-gaskit/sdk";

import {
  DEMO_FUNCTION_NAME,
  DEMO_PACKAGE_ID,
  DEMO_TRANSACTION_BYTES,
  DEMO_USER_SIGNATURE,
  DEMO_WALLET_ADDRESS,
  formatDemoGrantFlowResult,
  runDemoGrantFlow,
  type DemoGrantFlowClient,
} from "./local-flow.js";

test("runDemoGrantFlow reserves gas then executes the sponsored transaction", async () => {
  const calls: string[] = [];
  const client: DemoGrantFlowClient = {
    async reserveGas(request) {
      calls.push("reserve");
      assert.deepEqual(request, {
        gasBudget: 1,
        walletAddress: DEMO_WALLET_ADDRESS,
        packageId: DEMO_PACKAGE_ID,
        functionName: DEMO_FUNCTION_NAME,
      });
      return {
        reservationId: "reservation-1",
        gasKitTransactionId: "gaskit_tx_1",
        sponsorAddress: "0xSPONSOR",
        raw: {},
      };
    },
    async executeSponsoredTransaction(request) {
      calls.push("execute");
      assert.deepEqual(request, {
        reservationId: "reservation-1",
        gasKitTransactionId: "gaskit_tx_1",
        transactionBytes: DEMO_TRANSACTION_BYTES,
        userSignature: DEMO_USER_SIGNATURE,
      });
      return { digest: "digest-1", raw: {} };
    },
  };

  const result = await runDemoGrantFlow(client);

  assert.deepEqual(calls, ["reserve", "execute"]);
  assert.deepEqual(result, {
    reservationId: "reservation-1",
    gasKitTransactionId: "gaskit_tx_1",
    sponsorAddress: "0xSPONSOR",
    digest: "digest-1",
  });
});

test("runDemoGrantFlow propagates policy rejection and does not execute", async () => {
  let executeCalled = false;
  const client: DemoGrantFlowClient = {
    async reserveGas() {
      throw new GasKitPolicyError("Package not allowed", "PACKAGE_NOT_ALLOWED", 400, {});
    },
    async executeSponsoredTransaction() {
      executeCalled = true;
      return { digest: "unexpected", raw: {} };
    },
  };

  await assert.rejects(
    () => runDemoGrantFlow(client),
    (error) => error instanceof GasKitPolicyError && error.reasonCode === "PACKAGE_NOT_ALLOWED",
  );
  assert.equal(executeCalled, false);
});

test("runDemoGrantFlow fails if execute returns no digest", async () => {
  const client: DemoGrantFlowClient = {
    async reserveGas() {
      return {
        reservationId: "reservation-1",
        gasKitTransactionId: "gaskit_tx_1",
        raw: {},
      };
    },
    async executeSponsoredTransaction() {
      return { raw: {} };
    },
  };

  await assert.rejects(
    () => runDemoGrantFlow(client),
    /did not return a transaction digest/,
  );
});

test("formatDemoGrantFlowResult does not include credentials", () => {
  const formatted = formatDemoGrantFlowResult({
    reservationId: "reservation-1",
    gasKitTransactionId: "gaskit_tx_1",
    sponsorAddress: "0xSPONSOR",
    digest: "digest-1",
  });

  assert.match(formatted, /IOTA GasKit demo dApp local flow passed/);
  assert.match(formatted, /reservationId=reservation-1/);
  assert.match(formatted, /digest=digest-1/);
  assert.doesNotMatch(formatted, /apiKey|Bearer|local-dev-demo-key/i);
});
