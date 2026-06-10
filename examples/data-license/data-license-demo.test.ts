import assert from "node:assert/strict";
import { test } from "node:test";

import { formatDataLicenseDemoResult, runDataLicenseDemo } from "./data-license-demo.js";

test("data-license demo grants access only after policy and proof while withholding failures", async () => {
  const result = await runDataLicenseDemo();

  assert.equal(result.approved.granted, true);
  assert.equal(result.approved.receipt.status, "completed");
  assert.equal(result.denied.granted, false);
  assert.equal(result.denied.receipt.status, "denied");
  assert.equal(result.failedAccess.granted, false);
  assert.equal(result.failedAccess.receipt.status, "failed");

  const output = formatDataLicenseDemoResult(result);
  assert.match(output, /Data license demo passed/);
  assert.doesNotMatch(output, /demo-api-key|Bearer|signer_ref|private|secret/i);
});
