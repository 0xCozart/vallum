import {
  formatServiceBountyDemoResult,
  runServiceBountyDemo,
} from "../examples/service-bounty/service-bounty-demo.js";

const result = await runServiceBountyDemo();
console.log(formatServiceBountyDemoResult(result));
