import assert from "node:assert/strict";

import { formatAgentEscrowDemoResult, runAgentEscrowDemo } from "../examples/agent-escrow/agent-escrow-demo.js";

const result = await runAgentEscrowDemo();
const output = formatAgentEscrowDemoResult(result);

assert.equal(result.approved.receipt.status, "released");
assert.equal(result.approved.receipt.escrow.status, "released");
assert.equal(result.denied.receipt.status, "denied");
assert.match(output, /approved.status=released/);
assert.match(output, /denied.reason=GAS_BUDGET_TOO_HIGH/);
assert.doesNotMatch(output, /demo-api-key|signer_ref|Bearer|privateKey|mnemonic|seed|rawTransactionBytes|userSignature/i);

console.log(output);
