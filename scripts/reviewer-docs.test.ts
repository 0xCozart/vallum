import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readDoc(path: string): Promise<string> {
  return readFile(resolve(repoRoot, path), "utf8");
}

function literalPattern(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

test("milestone proof reflects the current verified local surface", async () => {
  const [proof, readme] = await Promise.all([readDoc("docs/milestone-0-proof.md"), readDoc("README.md")]);

  assert.match(proof, /tests 118\s+pass 118\s+fail 0/s);
  assert.doesNotMatch(proof, /tests 110\s+pass 110/s);
  assert.doesNotMatch(proof, /tests 16\s+pass 16/s);
  assert.doesNotMatch(proof, /tests 94\s+pass 94/s);
  assert.doesNotMatch(proof, /tests 97\s+pass 97/s);
  assert.doesNotMatch(proof, /tests 98\s+pass 98/s);
  assert.match(proof, /npm test && npm run typecheck && npm run smoke:local && npm run smoke:demo-dapp && npm run smoke:demo-browser && npm run readiness:testnet:example && npm run pack:check && npm run secrets:scan/);
  assert.match(proof, /local policy simulation endpoint/);
  assert.match(proof, /sanitized gateway decision events/);
  assert.match(proof, /in-memory local usage read model/);
  assert.match(proof, /file-backed usage event store/);
  assert.match(proof, /Node backend and Next\.js API route examples/);
  assert.match(proof, /workspace package build and `npm pack --dry-run` succeed/);
  assert.match(proof, /package READMEs and safe prerelease publish metadata/);
  assert.match(readme, /npm publish --dry-run --tag next --access public/);
  assert.match(readme, /Do not run a real `npm publish` without explicit operator approval/);
  assert.match(proof, /real sponsored IOTA testnet execute path has been proven/);
  assert.match(proof, /2Db6NiwZdR26JenPkWMFno7QgMePwhQ6rQQTA6jDJa7H/);
});

test("reviewer walkthrough points reviewers at runnable local proof paths", async () => {
  const walkthrough = await readDoc("docs/reviewer-walkthrough.md");

  for (const command of [
    "npm run grant:check",
    "npm run smoke:local",
    "npm run smoke:demo-dapp",
    "npm run smoke:demo-browser",
    "npm run readiness:testnet:example",
    "npm run secrets:scan",
  ]) {
    assert.match(walkthrough, literalPattern(command));
  }

  for (const path of [
    "apps/policy-gateway-service/src/server.ts",
    "apps/policy-gateway-service/src/events.test.ts",
    "apps/policy-gateway-service/src/usage.test.ts",
    "examples/node-backend/README.md",
    "examples/nextjs-api-route/README.md",
    "docs/observability.md",
    "docs/testnet-readiness.md",
  ]) {
    assert.match(walkthrough, literalPattern(path));
  }

  assert.match(walkthrough, /does not require sponsor keys, real IOTA RPC, Docker, or private prototype files/);
  assert.match(walkthrough, /optional live proof is isolated in `npm run execute:testnet-demo`/);
  assert.match(walkthrough, /loopback-only calls without external network, live IOTA RPC, or official Gas Station calls/);
  assert.match(walkthrough, /gateway-local\/offline/);
});

test("reviewer checklist distinguishes completed local proofs from remaining live milestones", async () => {
  const checklist = await readDoc("docs/reviewer-checklist.md");

  for (const completedItem of [
    "Local policy gateway smoke works against a mock upstream.",
    "SDK is tested and used by local examples.",
    "Policy simulation preflight is authenticated, gateway-local/offline, and does not proxy to Gas Station or contact IOTA RPC.",
    "Sanitized decision events and local usage read-model are covered by tests.",
    "Real testnet sponsored transaction is executed with operator-provided secrets and documented with a public digest.",
    "Deterministic tracked-file secret scan is wired into `npm run grant:check`.",
  ]) {
    assert.match(checklist, new RegExp(`- \\[x\\] ${completedItem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }

  for (const remainingItem of [
    "Durable usage store and authenticated operator dashboard are complete.",
    "Production monitoring, alerts, and final demo video are complete.",
  ]) {
    assert.match(checklist, new RegExp(`- \\[ \\] ${remainingItem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});

test("continuation and grant docs do not contradict current local readiness progress", async () => {
  const [brief, grantApplication] = await Promise.all([
    readDoc("docs/continuation-brief-2026-04-26.md"),
    readDoc("docs/grant-application.md"),
  ]);

  assert.match(brief, /Status update after local readiness slices/);
  assert.match(brief, /policy simulation endpoint is implemented/);
  assert.match(brief, /SDK is proven against deterministic local gateway and demo smoke paths/);
  assert.match(brief, /sanitized gateway decision events and in-memory local usage read model are implemented/);

  assert.match(grantApplication, /`npm test`: 118 deterministic tests passed, 0 failed/);
  assert.match(grantApplication, /local gateway smoke/);
  assert.match(grantApplication, /policy simulation/);
  assert.match(grantApplication, /sanitized decision events/);
  assert.match(grantApplication, /in-memory local usage read model/);
  assert.match(grantApplication, /file-backed local JSONL usage event-store foundation/);
  assert.match(grantApplication, /authenticated local operator usage API|operator usage API/);
  assert.match(grantApplication, /real IOTA testnet sponsored execute path/);
  assert.match(grantApplication, /2Db6NiwZdR26JenPkWMFno7QgMePwhQ6rQQTA6jDJa7H/);

  for (const doc of [brief, grantApplication]) {
    assert.doesNotMatch(doc, /16 tests passed/);
    assert.doesNotMatch(doc, /110 deterministic tests passed/);
    assert.doesNotMatch(doc, /not yet wired into a runnable HTTP proxy\/gateway path/);
    assert.doesNotMatch(doc, /client wrappers exist, but they are not yet proven/);
    assert.doesNotMatch(doc, /Policy simulation endpoint\./);
  }
});
