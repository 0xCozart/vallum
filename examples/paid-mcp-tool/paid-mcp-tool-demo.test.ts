import assert from "node:assert/strict";
import { test } from "node:test";

import { formatPaidMcpToolDemoResult, runPaidMcpToolDemo } from "./paid-mcp-tool-demo.js";

test("paid MCP tool demo delivers result only after payment and withholds failures", async () => {
  const result = await runPaidMcpToolDemo();
  const output = formatPaidMcpToolDemoResult(result);

  assert.equal(result.approved.paid, true);
  if (result.approved.paid) {
    assert.equal(result.approved.result, "premium-analysis: market demand is high");
  }
  assert.equal(result.approved.receipt.status, "completed");
  assert.equal(result.denied.paid, false);
  assert.equal(result.denied.receipt.status, "denied");
  assert.equal(result.failedPayment.paid, false);
  assert.equal(result.failedPayment.receipt.status, "failed");
  assert.deepEqual(result.gatewayEvents.map((event) => event.outcome), ["approved", "denied", "approved"]);

  assert.match(output, /Paid MCP tool demo passed/);
  assert.match(output, /approved.status=completed/);
  assert.match(output, /denied.status=denied/);
  assert.match(output, /failedPayment.status=failed/);
  assert.doesNotMatch(output, /demo-api-key|signer_ref|Bearer|privateKey|mnemonic|seed|rawTransactionBytes|userSignature/i);
});
