import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const grantFacingDocs = [
  "docs/grant-application.md",
  "docs/product-requirements.md",
  "docs/grant-scope.md",
  "docs/reviewer-walkthrough.md",
  "docs/milestone-0-proof.md",
] as const;

const publicApiDocsAndExamples = [
  "README.md",
  "docs/quickstart.md",
  "docs/best-practices.md",
  "docs/sdk.md",
  "packages/sdk/README.md",
  "packages/policy-gateway/README.md",
  "packages/shared-types/README.md",
  "examples/node-backend/README.md",
  "examples/nextjs-api-route/README.md",
  "apps/demo-dapp/README.md",
] as const;

async function readDoc(path: string): Promise<string> {
  return readFile(resolve(repoRoot, path), "utf8");
}

function literalPattern(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

test("milestone proof reflects the current verified local surface", async () => {
  const [proof, readme] = await Promise.all([readDoc("docs/milestone-0-proof.md"), readDoc("README.md")]);

  assert.match(proof, /tests 381\s+pass 381\s+fail 0/s);
  assert.doesNotMatch(proof, /tests 376\s+pass 376/s);
  assert.doesNotMatch(proof, /tests 372\s+pass 372/s);
  assert.doesNotMatch(proof, /tests 132\s+pass 132/s);
  assert.doesNotMatch(proof, /tests 110\s+pass 110/s);
  assert.doesNotMatch(proof, /tests 16\s+pass 16/s);
  assert.doesNotMatch(proof, /tests 94\s+pass 94/s);
  assert.doesNotMatch(proof, /tests 97\s+pass 97/s);
  assert.doesNotMatch(proof, /tests 98\s+pass 98/s);
  assert.match(proof, /npm run verify:local/);
  assert.match(proof, /npm test && npm run contracts:test && npm run typecheck && npm run smoke:local && npm run smoke:demo-dapp && npm run smoke:demo-browser && npm run smoke:agent-escrow && npm run smoke:paid-mcp-tool && npm run smoke:data-license && npm run smoke:service-bounty && npm run smoke:reputation-receipt && npm run smoke:subscription && npm run smoke:a2a-well-known && npm run smoke:a2a-signed-card && npm run smoke:a2a-task-message && npm run smoke:a2a-http && npm run smoke:a2a-local-server && npm run smoke:marketplace-read-model && npm run readiness:testnet:example && npm run pack:check && npm run smoke:package-install && npm run proof:product-status && npm run proof:launch-readiness && npm run proof:operator-gates && npm run docs:check && npm run secrets:scan/);
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

test("README is product-first and avoids grant or funding framing", async () => {
  const readme = await readDoc("README.md");

  assert.match(readme, /open-source GasKit toolkit/);
  assert.match(readme, /Roadmap/);
  assert.match(readme, /npm run verify:local/);
  assert.match(readme, /Documentation site/);
  assert.match(readme, /npm run docs:build/);
  assert.match(readme, /Agent access/);
  assert.match(readme, /skills\/iota-gaskit\/SKILL\.md/);
  assert.match(readme, /docs\/agent-guide\.md/);
  assert.doesNotMatch(readme, /\bgrant\b|\bGrant\b|\bmilestone\b|\bMilestone\b/);
  assert.doesNotMatch(readme, /\$39,000|\$49,000|Tier 2|funded|funding/);
  assert.doesNotMatch(readme, /docs\/grant-milestones\.md/);
});

test("docs hosting source list includes best-practices and reviewer paths", async () => {
  const [config, bestPractices, docsReadme] = await Promise.all([
    readDoc("apps/docs-site/docs.config.mjs"),
    readDoc("docs/best-practices.md"),
    readDoc("apps/docs-site/README.md"),
  ]);

  for (const source of [
    "docs/concepts.md",
    "docs/overview.md",
    "docs/quickstart.md",
    "docs/best-practices.md",
    "docs/examples.md",
    "docs/agent-guide.md",
    "docs/reviewer-walkthrough.md",
    "docs/agentic-gaskit/product-status.md",
    "docs/agentic-gaskit/launch-readiness-evidence.md",
    "docs/agentic-gaskit/operator-live-gates.md",
    "docs/security/sponsor-wallet.md",
    "docs/security/secrets.md",
  ]) {
    assert.match(config, literalPattern(source));
  }

  assert.match(bestPractices, /Keep Secrets Server-side/);
  assert.match(bestPractices, /Use Policy Simulation First/);
  assert.match(bestPractices, /Bound Sponsor Spend/);
  assert.match(bestPractices, /npm run verify:local/);
  assert.match(docsReadme, /build command: `npm run docs:build`/);
  assert.match(docsReadme, /output directory: `apps\/docs-site\/dist`/);
});

test("public docs include concrete integration code examples", async () => {
  const [examples, sdk] = await Promise.all([readDoc("docs/examples.md"), readDoc("docs/sdk.md")]);

  for (const expected of [
    "createGasKitClient",
    "simulatePolicy",
    "reserveGas",
    "executeSponsoredTransaction",
    "app/api/gaskit/reserve/route.ts",
    'fetch("/api/gaskit/reserve"',
    "curl -i",
    "allowed_packages",
    "examples/node-backend",
    "examples/nextjs-api-route",
  ]) {
    assert.match(examples, literalPattern(expected));
  }

  assert.doesNotMatch(sdk, /Planned API/);
  assert.match(sdk, /Backend API Example/);
  assert.match(sdk, /Code Examples/);
});

test("docs site shell includes a persistent dark-mode toggle", async () => {
  const [builder, styles] = await Promise.all([
    readDoc("apps/docs-site/scripts/build.mjs"),
    readDoc("apps/docs-site/src/styles.css"),
  ]);

  assert.match(builder, /data-theme-toggle/);
  assert.match(builder, /gaskit-docs-theme/);
  assert.match(builder, /prefers-color-scheme: dark/);
  assert.match(builder, /localStorage\.setItem\(key, theme\)/);
  assert.match(styles, /\[data-theme="dark"\]/);
  assert.match(styles, /color-scheme: dark/);
  assert.match(styles, /\.theme-toggle/);
  assert.match(styles, /\.theme-toggle-thumb/);
});

test("repo ships a GasKit agent skill with safety and navigation boundaries", async () => {
  const [skill, openai, guide, config] = await Promise.all([
    readDoc("skills/iota-gaskit/SKILL.md"),
    readDoc("skills/iota-gaskit/agents/openai.yaml"),
    readDoc("docs/agent-guide.md"),
    readDoc("apps/docs-site/docs.config.mjs"),
  ]);

  assert.match(skill, /^---\nname: iota-gaskit\n/m);
  assert.match(skill, /Use when working in the iota-gaskit repo or integrating GasKit/);
  assert.match(skill, /Required Startup/);
  assert.match(skill, /Source Map/);
  assert.match(skill, /Safety Boundaries/);
  assert.match(skill, /Verification Ladder/);
  assert.match(skill, /npm run verify:local/);
  assert.match(skill, /npm run readiness:testnet/);
  assert.match(skill, /npm run execute:testnet-demo/);
  assert.match(skill, /Keep `GAS_STATION_AUTH` and `GAS_STATION_BEARER_TOKEN` distinct/);
  assert.match(skill, /Run live commands.*only when the user explicitly asks/s);
  assert.match(openai, /display_name: "IOTA GasKit"/);
  assert.match(openai, /default_prompt: "Use \$iota-gaskit/);
  assert.match(guide, /skills\/iota-gaskit\/SKILL\.md/);
  assert.match(guide, /The skill is not an MCP server/);
  assert.match(config, /docs\/agent-guide\.md/);
});

test("hosted public docs avoid internal milestone framing in operator paths", async () => {
  const [concepts, overview, quickstart, deployment] = await Promise.all([
    readDoc("docs/concepts.md"),
    readDoc("docs/overview.md"),
    readDoc("docs/quickstart.md"),
    readDoc("docs/deployment.md"),
  ]);

  assert.match(concepts, /IOTA in Plain English/);
  assert.match(concepts, /Sponsored gas means the user still approves the action/);
  assert.match(concepts, /Where GasKit Fits/);
  assert.match(concepts, /Terms You Will See/);
  assert.match(concepts, /IOTA Gas Station is the lower-level sponsored-transaction component/);
  assert.match(overview, /What Exists Today/);
  assert.match(overview, /Why This Exists/);
  assert.match(overview, /Relationship to IOTA Gas Station/);
  assert.match(overview, /\| Area \| Current status \| Start here \|/);
  assert.match(overview, /What Is Still Roadmap/);
  assert.doesNotMatch(quickstart, /Milestone 1|M1 target/);
  assert.doesNotMatch(deployment, /Milestone 1|M4 work|grant demo/);
  assert.match(quickstart, /deterministic local proof paths/);
  assert.match(deployment, /Local proof path/);
  assert.match(deployment, /\| Checkpoint \| Command or action \| Failure means \|/);
  assert.match(deployment, /The current repo already exposes sanitized decision events/);
});

test("architecture docs explain why the layers exist for non-specialist readers", async () => {
  const architecture = await readDoc("docs/architecture.md");

  assert.match(architecture, /Why This Architecture/);
  assert.match(architecture, /Keep Sponsor Secrets Away From Browsers/);
  assert.match(architecture, /Check Policy Before Spending Gas/);
  assert.match(architecture, /Make Sponsorship Explainable/);
  assert.match(architecture, /Trust Boundaries/);
  assert.match(architecture, /Why Not Call IOTA Gas Station Directly/);
});

test("reviewer walkthrough points reviewers at runnable local proof paths", async () => {
  const walkthrough = await readDoc("docs/reviewer-walkthrough.md");

  for (const command of [
    "npm install",
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
  assert.match(walkthrough, /Reviewer quick verification/);
  assert.match(walkthrough, /2Db6NiwZdR26JenPkWMFno7QgMePwhQ6rQQTA6jDJa7H/);
  assert.match(walkthrough, /loopback-only calls without external network, live IOTA RPC, or official Gas Station calls/);
  assert.match(walkthrough, /gateway-local\/offline/);
});

test("grant-facing docs reflect publication status and open-source scope without budget tables", async () => {
  const [readme, application, team] = await Promise.all([
    readDoc("README.md"),
    readDoc("docs/grant-application.md"),
    readDoc("docs/team.md"),
  ]);

  for (const doc of [readme, application]) {
    assert.doesNotMatch(doc, /\$49,000/);
    assert.match(doc, /Package Publication|package publication|publication-ready artifacts/);
  }

  assert.doesNotMatch(application, /\| M1 Deployment Kit and Testnet Demo \| 2 weeks \| \$8,000 \|/);
  assert.doesNotMatch(application, /Total ask/);
  assert.doesNotMatch(application, /Recommended ask|\$39,000/);
  assert.match(application, /Reviewer quick verification/);
  assert.match(application, /not currently funded by another grant, employer, or customer contract/);
  assert.match(application, /self-hostable, inspectable, forkable/);
  assert.match(team, /0xCozart/);
  assert.match(team, /documented public IOTA testnet sponsored execute evidence/);
});

test("grant-facing docs avoid stale private-hosted and package-publication overclaims", async () => {
  for (const path of grantFacingDocs) {
    const doc = await readDoc(path);

    assert.doesNotMatch(doc, /\$49,000|49k|\$45,000-\$50,000/);
    assert.doesNotMatch(doc, /private SaaS|hosted SaaS|closed managed SaaS/);
    assert.doesNotMatch(doc, /currently published to npm|published to npm today|already published to npm/);
    assert.doesNotMatch(doc, /dashboard UI is complete|complete production usage database|complete production stack/);
  }
});

test("public docs and examples expose gasKitTransactionId instead of legacy aliases", async () => {
  for (const path of publicApiDocsAndExamples) {
    const doc = await readDoc(path);

    assert.doesNotMatch(doc, /_saas_tx_id/);
  }

  const quickstart = await readDoc("docs/quickstart.md");
  const sdkDoc = await readDoc("docs/sdk.md");

  assert.match(quickstart, /gasKitTransactionId/);
  assert.match(sdkDoc, /gasKitTransactionId/);
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

  assert.match(brief, /Status update after grant-readiness and live testnet proof slices/);
  assert.match(brief, /policy simulation endpoint is implemented/);
  assert.match(brief, /SDK is proven against deterministic local gateway and demo smoke paths/);
  assert.match(brief, /sanitized gateway decision events and in-memory local usage read model are implemented/);
  assert.match(brief, /real sponsored IOTA testnet transaction has executed/);
  assert.match(brief, /2Db6NiwZdR26JenPkWMFno7QgMePwhQ6rQQTA6jDJa7H/);

  assert.match(grantApplication, /`npm test`: 132 deterministic tests passed, 0 failed/);
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
