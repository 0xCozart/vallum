import assert from "node:assert/strict";
import { test } from "node:test";

import { formatSubscriptionDemoResult, runSubscriptionDemo } from "./subscription-demo.js";

test("subscription demo proves approved, denied, failed, renewed, and canceled paths without leaking secrets", async () => {
  const result = await runSubscriptionDemo();
  const output = formatSubscriptionDemoResult(result);

  assert.equal(result.approved.active, true);
  assert.equal(result.approved.receipt.status, "active");
  assert.equal(result.denied.active, false);
  assert.equal(result.denied.receipt.status, "denied");
  assert.equal(result.failedProof.active, false);
  assert.equal(result.failedProof.receipt.status, "failed");
  assert.equal(result.renewed.renewed, true);
  assert.equal(result.renewed.receipt.status, "renewed");
  assert.equal(result.canceledStatus, "canceled");
  assert.doesNotMatch(output, /demo-api-key|Bearer|signer_ref|private|secret|payment credential|access-token|rawTransactionBytes|userSignature/i);
});
