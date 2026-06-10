import {
  formatSubscriptionDemoResult,
  runSubscriptionDemo,
} from "../examples/subscription/subscription-demo.js";

const result = await runSubscriptionDemo();
console.log(formatSubscriptionDemoResult(result));
