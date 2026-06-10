import assert from "node:assert/strict";
import { test } from "node:test";

import { runA2AWellKnownDemo } from "./a2a-well-known-demo.js";

test("A2A well-known demo proves canonical serving without exposing private profile fields", () => {
  const result = runA2AWellKnownDemo();

  assert.equal(result.canonical.status, 200);
  assert.equal(result.canonical.path, "/.well-known/agent-card.json");
  assert.equal(result.canonical.agentName, "researcher.demo.iota");
  assert.equal(result.canonical.skillIds[0], "research.summary");
  assert.equal(result.legacy.status, 404);
  assert.equal(result.revoked.status, 410);
  assert.equal(result.redaction.signerRefExposed, false);
  assert.equal(result.redaction.walletIdExposed, false);
  assert.equal(result.redaction.credentialRefExposed, false);
  assert.equal(result.redaction.paymentAddressExposed, false);
});
