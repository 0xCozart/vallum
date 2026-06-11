import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatA2AHttpDemoResult,
  runA2AHttpDemo,
} from "./a2a-http-demo.js";

test("A2A HTTP demo proves public discovery authorized task flow and safe output", async () => {
  const result = await runA2AHttpDemo();
  const formatted = formatA2AHttpDemoResult(result);

  assert.equal(result.agentCardStatus, 200);
  assert.equal(result.unauthorizedStatus, 401);
  assert.equal(result.sentStatus, 200);
  assert.equal(result.taskStatus, "TASK_STATE_WORKING");
  assert.equal(result.hiddenArtifacts, true);
  assert.equal(result.listedCount, 1);
  assert.equal(result.canceledStatus, "TASK_STATE_CANCELED");
  assert.equal(result.pushConfigStatus, 200);
  assert.equal(result.pushConfigListCount, 1);
  assert.equal(result.pushConfigCredentialRejectionStatus, 400);
  assert.equal(result.logLeaksSecretMaterial, false);
  assert.doesNotMatch(formatted, /Bearer|push-secret|signer_ref|wallet_demo_secret|payment-secret|private prompt/i);
});
