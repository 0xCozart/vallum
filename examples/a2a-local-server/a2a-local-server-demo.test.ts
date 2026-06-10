import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatA2ALocalServerDemoResult,
  runA2ALocalServerDemo,
} from "./a2a-local-server-demo.js";

test("A2A local server demo proves signed discovery and authorized task flow over loopback HTTP", async () => {
  const result = await runA2ALocalServerDemo();
  const formatted = formatA2ALocalServerDemoResult(result);

  assert.equal(result.boundToLoopback, true);
  assert.equal(result.agentCardStatus, 200);
  assert.equal(result.signatureVerified, true);
  assert.equal(result.unauthorizedStatus, 401);
  assert.equal(result.sentStatus, 200);
  assert.equal(result.taskStatus, "TASK_STATE_WORKING");
  assert.equal(result.hiddenArtifacts, true);
  assert.equal(result.listedCount, 1);
  assert.equal(result.canceledStatus, "TASK_STATE_CANCELED");
  assert.equal(result.streamingStatus, 501);
  assert.equal(result.logLeaksSecretMaterial, false);
  assert.doesNotMatch(formatted, /Bearer|signer_ref|wallet_demo_secret|payment-secret|private prompt|PRIVATE KEY/i);
});
