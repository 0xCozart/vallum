import {
  formatA2ASignedCardDemoResult,
  runA2ASignedCardDemo,
} from "../examples/a2a-signed-card/a2a-signed-card-demo.js";

const result = runA2ASignedCardDemo();

if (!result.verificationOk) {
  throw new Error("A2A signed-card demo did not verify the signed card.");
}
if (result.tamperedCode !== "A2A_SIGNATURE_INVALID") {
  throw new Error("A2A signed-card demo did not fail closed after card tampering.");
}
if (result.expiredCode !== "A2A_SIGNATURE_EXPIRED") {
  throw new Error("A2A signed-card demo did not fail closed after signature expiry.");
}
if (result.unsignedCode !== "A2A_SIGNATURE_MISSING") {
  throw new Error("A2A signed-card demo did not fail closed for unsigned cards.");
}
if (
  result.redaction.signerRefExposed
  || result.redaction.walletIdExposed
  || result.redaction.credentialRefExposed
  || result.redaction.privateKeyExposed
) {
  throw new Error("A2A signed-card demo exposed private card or key material.");
}

console.log(formatA2ASignedCardDemoResult(result));
