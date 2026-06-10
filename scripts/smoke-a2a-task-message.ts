import {
  formatA2ATaskMessageDemoResult,
  runA2ATaskMessageDemo,
} from "../examples/a2a-task-message/a2a-task-message-demo.js";

const result = await runA2ATaskMessageDemo();
if (result.logLeaksSecretMaterial) {
  throw new Error("A2A task/message demo leaked secret-looking material into log-safe output.");
}

console.log(formatA2ATaskMessageDemoResult(result));
