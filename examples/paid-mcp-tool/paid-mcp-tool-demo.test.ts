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
  assert.match(output, /boundary\.localOnly=true/);
  assert.match(output, /boundary\.liveNetwork=false/);
  assert.match(output, /boundary\.route=SDK->mock-policy-gateway/);
  assert.match(output, /request\.intent=Purchase one premium MCP tool result\./);
  assert.match(output, /request\.action=pay_per_call\.request_call/);
  assert.match(output, /manifest\.signerReference\.internal=true/);
  assert.match(output, /manifest\.signerReference\.exposed=false/);
  assert.match(output, /manifest\.receiptRequired=true/);
  assert.match(output, /manifest\.simulationRequired=true/);
  assert.match(output, /approved.status=completed/);
  assert.match(output, /approved\.paid=true/);
  assert.match(output, /approved\.receiptId=receipt_paid_mcp_tool_approved_1/);
  assert.match(output, /approved\.receiptManifestId=redacted/);
  assert.match(output, /approved\.receiptEvents=pay_per_call_created,approved,sponsored,submitted,completed/);
  assert.match(output, /denied.status=denied/);
  assert.match(output, /denied\.paid=false/);
  assert.match(output, /denied\.reason=GAS_BUDGET_TOO_HIGH/);
  assert.match(output, /denied\.receiptEvents=pay_per_call_created,denied/);
  assert.match(output, /failedPayment.status=failed/);
  assert.match(output, /failedPayment\.paid=false/);
  assert.match(output, /failedPayment\.reason=mock-payment-failed/);
  assert.match(output, /failedPayment\.receiptEvents=pay_per_call_created,approved,sponsored,failed/);
  assert.match(output, /gateway\.audit=approved:none,denied:GAS_BUDGET_TOO_HIGH,approved:none/);
  assert.match(output, /secrets\.apiKey\.exposed=false/);
  assert.match(output, /secrets\.rawTransactionBytes\.exposed=false/);
  assert.match(output, /secrets\.userSignature\.exposed=false/);
  assert.doesNotMatch(output, /demo-api-key|signer_ref_paid_mcp_tool_demo|Bearer|privateKey|mnemonic|seed|rawTransactionBytes=|userSignature=/i);
});
