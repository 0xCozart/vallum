import {
  formatMarketplaceReadModelDemoResult,
  runMarketplaceReadModelDemo,
} from "../packages/marketplace/src/index.js";

const result = runMarketplaceReadModelDemo();
if (!result.policyAllowed) {
  throw new Error("Marketplace read-model demo did not prove policy compatibility.");
}
if (!result.buyerReceiptAllowed || result.strangerReceiptAllowed) {
  throw new Error("Marketplace read-model demo did not enforce receipt access control.");
}
if (!/^sha256:[a-f0-9]{64}$/.test(result.disputeBundleHash)) {
  throw new Error("Marketplace read-model demo did not produce a stable dispute bundle hash.");
}
if (result.logLeaksSecretMaterial) {
  throw new Error("Marketplace read-model demo leaked secret-looking material into output.");
}

console.log(formatMarketplaceReadModelDemoResult(result));
