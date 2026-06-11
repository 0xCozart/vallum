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
if (result.extendedAgentCardStatus !== 200 || result.extendedAgentCardSkillCount < 2) {
  throw new Error("A2A HTTP demo did not prove authenticated extended Agent Card access.");
}
if (result.pushConfigStatus !== 200 || result.pushConfigListCount !== 1) {
  throw new Error("A2A HTTP demo did not prove local push notification config storage.");
}
if (result.pushDeliveryCount !== 1 || result.pushDeliveryStatus !== 202) {
  throw new Error("A2A HTTP demo did not prove injected local push notification delivery.");
}
if (result.pushConfigCredentialRejectionStatus !== 400) {
  throw new Error("A2A HTTP demo did not reject push notification credential storage.");
}

console.log(formatA2AHttpDemoResult(result));
