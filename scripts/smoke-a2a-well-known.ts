import {
  formatA2AWellKnownDemoResult,
  runA2AWellKnownDemo,
} from "../examples/a2a-well-known/a2a-well-known-demo.js";

const result = runA2AWellKnownDemo();
console.log(formatA2AWellKnownDemoResult(result));
