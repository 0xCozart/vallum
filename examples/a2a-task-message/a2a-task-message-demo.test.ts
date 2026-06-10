import assert from "node:assert/strict";
import { test } from "node:test";

import { runA2ATaskMessageDemo } from "./a2a-task-message-demo.js";

test("A2A task/message demo proves local approved, denied, follow-up, cancel, and redaction paths", async () => {
  const result = await runA2ATaskMessageDemo();

  assert.equal(result.approved.status.state, "TASK_STATE_COMPLETED");
  assert.equal(result.denied.status.state, "TASK_STATE_REJECTED");
  assert.equal(result.followUp.status.state, "TASK_STATE_COMPLETED");
  assert.equal(result.canceled.status.state, "TASK_STATE_CANCELED");
  assert.equal(result.listedCount, 4);
  assert.equal(result.logLeaksSecretMaterial, false);
});
