import assert from "node:assert/strict";
import { test } from "node:test";

import { formatReputationReceiptDemoResult, runReputationReceiptDemo } from "./reputation-receipt-demo.js";

test("reputation receipt demo proves approved, denied, and failed evidence paths without leaking secrets", async () => {
  const result = await runReputationReceiptDemo();
  const output = formatReputationReceiptDemoResult(result);

  assert.equal(result.approved.attested, true);
  assert.equal(result.approved.receipt.status, "completed");
  assert.equal(result.denied.attested, false);
  assert.equal(result.denied.receipt.status, "denied");
  assert.equal(result.failedEvidence.attested, false);
  assert.equal(result.failedEvidence.receipt.status, "failed");
  assert.doesNotMatch(output, /demo-api-key|Bearer|signer_ref|private|secret|payment credential|rawTransactionBytes|userSignature/i);
});
