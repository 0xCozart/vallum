import assert from "node:assert/strict";
import { test } from "node:test";

import { formatServiceBountyDemoResult, runServiceBountyDemo } from "./service-bounty-demo.js";

test("service-bounty demo releases only after policy and proof while withholding failures", async () => {
  const result = await runServiceBountyDemo();

  assert.equal(result.approved.released, true);
  assert.equal(result.approved.receipt.status, "released");
  assert.equal(result.denied.released, false);
  assert.equal(result.denied.receipt.status, "denied");
  assert.equal(result.failedCompletion.released, false);
  assert.equal(result.failedCompletion.receipt.status, "failed");

  const output = formatServiceBountyDemoResult(result);
  assert.match(output, /Service bounty demo passed/);
  assert.doesNotMatch(output, /demo-api-key|Bearer|signer_ref|private|secret/i);
});
