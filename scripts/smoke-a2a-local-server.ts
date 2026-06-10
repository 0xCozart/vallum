import {
  formatA2ALocalServerDemoResult,
  runA2ALocalServerDemo,
} from "../examples/a2a-local-server/a2a-local-server-demo.js";

const result = await runA2ALocalServerDemo();
if (!result.boundToLoopback) {
  throw new Error("A2A local server demo did not bind to loopback.");
}
if (!result.signatureVerified) {
  throw new Error("A2A local server demo did not verify the signed Agent Card.");
}
if (result.logLeaksSecretMaterial) {
  throw new Error("A2A local server demo leaked secret-looking material into output.");
}
if (!result.hiddenArtifacts) {
  throw new Error("A2A local server demo exposed artifacts on the default task read path.");
}
if (result.streamingStatus !== 501) {
  throw new Error("A2A local server demo did not fail closed for unsupported streaming.");
}

console.log(formatA2ALocalServerDemoResult(result));
