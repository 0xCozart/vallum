import {
  formatA2AHttpDemoResult,
  runA2AHttpDemo,
} from "../examples/a2a-http/a2a-http-demo.js";

const result = await runA2AHttpDemo();
if (result.logLeaksSecretMaterial) {
  throw new Error("A2A HTTP demo leaked secret-looking material into output.");
}
if (!result.hiddenArtifacts) {
  throw new Error("A2A HTTP demo exposed artifacts on the default task read path.");
}

console.log(formatA2AHttpDemoResult(result));
