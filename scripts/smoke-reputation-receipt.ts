import {
  formatReputationReceiptDemoResult,
  runReputationReceiptDemo,
} from "../examples/reputation-receipt/reputation-receipt-demo.js";

const result = await runReputationReceiptDemo();
console.log(formatReputationReceiptDemoResult(result));
