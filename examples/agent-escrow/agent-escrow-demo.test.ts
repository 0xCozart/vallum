import assert from "node:assert/strict";
import { test } from "node:test";

import { formatAgentEscrowDemoResult, runAgentEscrowDemo } from "./agent-escrow-demo.js";

test("agent escrow demo shows approved release, policy denial, and sanitized logs", async () => {
  const result = await runAgentEscrowDemo();
  const output = formatAgentEscrowDemoResult(result);

  assert.equal(result.approved.receipt.status, "released");
  assert.equal(result.approved.receipt.escrow.status, "released");
  assert.equal(result.approved.receipt.sponsorshipId, "mock_sponsorship_agent_escrow_1");
  assert.equal(result.denied.receipt.status, "denied");
  assert.equal(result.denied.sponsoredAction.approved, false);
  assert.equal(result.denied.sponsoredAction.decision.reasonCode, "GAS_BUDGET_TOO_HIGH");
  assert.deepEqual(result.approved.receipt.events.map((event) => event.type), [
    "escrow_created",
    "approved",
    "sponsored",
    "submitted",
    "completed",
    "released",
  ]);
  assert.deepEqual(result.gatewayEvents.map((event) => event.outcome), ["approved", "denied"]);

  assert.match(output, /Agentic GasKit agent escrow demo passed/);
  assert.match(output, /approved.status=released/);
  assert.match(output, /denied.reason=GAS_BUDGET_TOO_HIGH/);
  assert.match(output, /gateway.events=approved,denied/);
  assert.doesNotMatch(output, /demo-api-key|signer_ref|Bearer|privateKey|mnemonic|seed|rawTransactionBytes|userSignature/i);
});
