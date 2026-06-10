import assert from "node:assert/strict";
import { test } from "node:test";

import { runA2ASignedCardDemo } from "./a2a-signed-card-demo.js";

test("A2A signed-card demo proves local signing verification and safe output", () => {
  const result = runA2ASignedCardDemo();

  assert.equal(result.agentName, "researcher.demo.iota");
  assert.equal(result.signatureCount, 1);
  assert.equal(result.protectedHeader.alg, "EdDSA");
  assert.equal(result.protectedHeader.typ, "JOSE");
  assert.equal(result.protectedHeader.kid, "agent-card-key-1");
  assert.equal(result.protectedHeader.hasJwksUrl, true);
  assert.equal(result.protectedHeader.hasExpiry, true);
  assert.equal(result.verificationOk, true);
  assert.equal(result.tamperedCode, "A2A_SIGNATURE_INVALID");
  assert.equal(result.expiredCode, "A2A_SIGNATURE_EXPIRED");
  assert.equal(result.unsignedCode, "A2A_SIGNATURE_MISSING");
  assert.equal(result.redaction.signerRefExposed, false);
  assert.equal(result.redaction.walletIdExposed, false);
  assert.equal(result.redaction.credentialRefExposed, false);
  assert.equal(result.redaction.privateKeyExposed, false);
});
