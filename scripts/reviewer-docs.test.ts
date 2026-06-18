import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

test("launch evidence reflects the current public local proof surface", async () => {
  const [proof, readme] = await Promise.all([
    readDoc("docs/vallum/launch-readiness-evidence.md"),
    readDoc("README.md"),
  ]);

  assert.match(proof, /npm run proof:launch-readiness/);
  assert.match(proof, /localEvidenceOk=true/);
  assert.match(proof, /launchReady=false/);
  assert.match(proof, /npm run verify:local/);
  assert.match(proof, /npm run proof:testnet-digest/);
  assert.match(proof, /Phase 1 sponsored policy MVP/);
  assert.match(proof, /Phase 6 package release/);
  assert.match(readme, /npm publish --dry-run --tag next --access public/);
  assert.match(readme, /Do not run a real `npm publish` without explicit operator approval/);
  assert.match(readme, /FLdnYRUACAKQn8CwugEv1u6gYTh9jBr8rGMk2JZ2adsd/);
});

test("testnet attempt log reflects current runtime-ready blocker chain", async () => {
  const attempts = await readDoc("docs/testnet-attempts.md");

  assert.match(attempts, /## 2026-06-14 fresh funded sponsored testnet execute/);
  assert.match(attempts, /SPONSOR_FUNDING_REPORT_VALID/);
  assert.match(attempts, /RESERVE_GAS_READY/);
  assert.match(attempts, /transactionDigest=FLdnYRUACAKQn8CwugEv1u6gYTh9jBr8rGMk2JZ2adsd/);
  assert.match(attempts, /## 2026-06-14 runtime-ready reserve-skipped refresh/);
  assert.match(attempts, /code=DOCKER_DIRECT_STACK_READY/);
  assert.match(attempts, /gasStationReachabilityCode=GAS_STATION_ROOT_READY/);
  assert.match(attempts, /SPONSOR_FUNDING_TOTAL_INSUFFICIENT/);
  assert.match(attempts, /TESTNET_UPSTREAM_REPORT_RESERVE_SKIPPED/);
  assert.match(attempts, /without\s+`--skip-reserve`/);
  assert.match(attempts, /Later entries supersede this runtime blocker/);
  assert.doesNotMatch(
    attempts,
    /Outcome: the real testnet transaction was not retried because the configured upstream Gas Station is offline\/unreachable\. The next required operator action is to start Docker\/Gas Station/,
  );
});

test("README is product-first and avoids grant or funding framing", async () => {
  const readme = await readDoc("README.md");

  assert.match(readme, /open-source Vallum toolkit/);
  assert.match(readme, /Roadmap/);
  assert.match(readme, /npm run verify:local/);
  assert.match(readme, /Documentation site/);
  assert.match(readme, /npm run docs:build/);
  assert.match(readme, /Agent access/);
  assert.match(readme, /skills\/vallum\/SKILL\.md/);
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
    "docs/vallum/installer-process.md",
    "docs/vallum/testnet-digest-proof.md",
    "docs/vallum/a2a-public-readiness.md",
    "docs/vallum/verification-profiles.md",
    "docs/vallum/product-status.md",
    "docs/vallum/launch-readiness-evidence.md",
    "docs/vallum/operator-live-gates.md",
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

test("operator live-gates docs list every report template kind", async () => {
  const docs = await readDoc("docs/vallum/operator-live-gates.md");

  for (const kind of [
    "testnet-upstream",
    "testnet-digest",
    "iota-names-live",
    "iota-identity-live",
    "vc-validation-live",
    "a2a-public-discovery",
    "a2a-public-push-delivery",
    "a2a-external-conformance",
    "payment-provider-live",
    "package-publication",
    "marketplace-production",
    "custody-production",
  ]) {
    assert.match(docs, literalPattern(kind));
    assert.match(docs, literalPattern(`npm run operator:write-report-template -- --kind ${kind}`));
  }

  assert.match(docs, /VALLUM_TESTNET_DIGEST_REPORT/);
  assert.match(docs, /IOTA Names and IOTA Identity report kinds/);
  assert.match(docs, /trust-policy configuration/);
  assert.match(docs, /result=pending-operator-proof/);
});

test("installer process docs cover mode selection, artifacts, and live gates", async () => {
  const [config, installer] = await Promise.all([
    readDoc("apps/docs-site/docs.config.mjs"),
    readDoc("docs/vallum/installer-process.md"),
  ]);

  assert.match(config, /docs\/vallum\/installer-process\.md/);
  assert.match(installer, /Safe local auto-scaffold/);
  assert.match(installer, /Guided operator config/);
  assert.match(installer, /Existing gateway\/client only/);
  assert.match(installer, /Default: Safe local auto-scaffold/);
  assert.match(installer, /\.env\.vallum\.local/);
  assert.match(installer, /\.vallum\/reports\/install-summary\.json/);
  assert.match(installer, /npm run vallum:installer/);
  assert.match(installer, /explicit operator approval/);
  assert.doesNotMatch(installer, /paste.*private key|paste.*bearer token/i);
});

test("hosted docs exclude internal planning and handoff sources", async () => {
  const [config, readme, gitignore] = await Promise.all([
    readDoc("apps/docs-site/docs.config.mjs"),
    readDoc("README.md"),
    readDoc(".gitignore"),
  ]);

  for (const source of [
    "docs/private/",
    "docs/local/",
    "docs/**/private/",
    "docs/**/local/",
    "docs/**/*-private.md",
    "docs/**/*-local.md",
    "docs/**/*-handoff-*.md",
    "docs/**/*-goal-*.md",
    "docs/**/*-audit-*.md",
    "docs/**/*-evidence-local.md",
    "docs/vallum/codex-active-goal.md",
    "docs/vallum/codex-execution-prompt.md",
    "docs/vallum/end-to-end-goal.md",
    "docs/vallum/full-roadmap-execution-goal.md",
    "docs/vallum/handoff-next-product-build.md",
    "docs/vallum/local-dirty-work-review.md",
    "docs/vallum/planning-structure-audit.md",
    "docs/vallum/source-thesis.md",
    "docs/vallum/module-specs.md",
    "docs/vallum/external-api-notes.md",
    "docs/vallum/prds/",
    "docs/grant-application.md",
    "docs/grant-scope.md",
    "docs/managed-service-roadmap.md",
    "docs/team.md",
    "docs/continuation-brief-2026-04-26.md",
    "docs/milestone-0-proof.md",
  ]) {
    assert.doesNotMatch(config, literalPattern(source));
    assert.doesNotMatch(readme, literalPattern(source));
    assert.match(gitignore, literalPattern(source));
  }

  assert.match(readme, /Current public execution entry/);
  assert.match(readme, /Private Codex goals, local handoffs, and scratch planning notes are kept out/);
});

test("public docs include concrete integration code examples", async () => {
  const [examples, sdk] = await Promise.all([readDoc("docs/examples.md"), readDoc("docs/sdk.md")]);

  for (const expected of [
    "createVallumClient",
    "simulatePolicy",
    "reserveGas",
    "executeSponsoredTransaction",
    "app/api/vallum/reserve/route.ts",
    'fetch("/api/vallum/reserve"',
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
  assert.match(builder, /vallum-docs-theme/);
  assert.match(builder, /prefers-color-scheme: dark/);
  assert.match(builder, /localStorage\.setItem\(key, theme\)/);
  assert.match(styles, /\[data-theme="dark"\]/);
  assert.match(styles, /color-scheme: dark/);
  assert.match(styles, /\.theme-toggle/);
  assert.match(styles, /\.theme-toggle-thumb/);
});

test("repo ships a Vallum agent skill with safety and navigation boundaries", async () => {
  const [skill, openai, guide, config] = await Promise.all([
    readDoc("skills/vallum/SKILL.md"),
    readDoc("skills/vallum/agents/openai.yaml"),
    readDoc("docs/agent-guide.md"),
    readDoc("apps/docs-site/docs.config.mjs"),
  ]);

  assert.match(skill, /^---\nname: vallum\n/m);
  assert.match(skill, /Use when working in the vallum repo or integrating Vallum/);
  assert.match(skill, /Required Startup/);
  assert.match(skill, /Source Map/);
  assert.match(skill, /Safety Boundaries/);
  assert.match(skill, /Verification Ladder/);
  assert.match(skill, /npm run verify:local/);
  assert.match(skill, /npm run readiness:testnet/);
  assert.match(skill, /npm run execute:testnet-demo/);
  assert.match(skill, /Keep `GAS_STATION_AUTH` and `GAS_STATION_BEARER_TOKEN` distinct/);
  assert.match(skill, /Run live commands.*only when the user explicitly asks/s);
  assert.match(openai, /display_name: "Vallum"/);
  assert.match(openai, /default_prompt: "Use \$vallum/);
  assert.match(guide, /skills\/vallum\/SKILL\.md/);
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
  assert.match(concepts, /Where Vallum Fits/);
  assert.match(concepts, /Terms You Will See/);
  assert.match(concepts, /IOTA Gas Station is the lower-level sponsored-transaction component/);
  assert.match(overview, /What Exists Today/);
  assert.match(overview, /Why This Exists/);
  assert.match(overview, /Relationship to IOTA Gas Station/);
  assert.match(overview, /Canonical adoption wedge/);
  assert.match(overview, /Package consumer proof/);
  assert.match(overview, /agent-safe sponsored execution through policy, manifests, signer references,\s+and receipts/);
  assert.match(overview, /\| Area \| Current status \| Start here \|/);
  assert.match(overview, /What Is Still Roadmap/);
  assert.doesNotMatch(quickstart, /Milestone 1|M1 target/);
  assert.doesNotMatch(deployment, /Milestone 1|M4 work|grant demo/);
  assert.match(quickstart, /deterministic local proof paths/);
  assert.match(quickstart, /Canonical agent-safe sponsored execution path/);
  assert.match(quickstart, /npm run smoke:paid-mcp-tool/);
  assert.match(quickstart, /npm run smoke:package-paid-mcp-consumer/);
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
    "npm run smoke:paid-mcp-tool",
    "npm run smoke:package-paid-mcp-consumer",
    "npm run readiness:testnet:example",
    "npm run verify:fast",
    "npm run proof:a2a-public-readiness",
    "npm run proof:verification-profiles",
    "npm run proof:package-publication-readiness",
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
    "docs/vallum/package-release-strategy.md",
  ]) {
    assert.match(walkthrough, literalPattern(path));
  }

  assert.match(walkthrough, /does not require sponsor keys, real IOTA RPC, Docker, or private prototype files/);
  assert.match(walkthrough, /optional live proof is isolated in `npm run execute:testnet-demo`/);
  assert.match(walkthrough, /Reviewer quick verification/);
  assert.match(walkthrough, /FLdnYRUACAKQn8CwugEv1u6gYTh9jBr8rGMk2JZ2adsd/);
  assert.match(walkthrough, /loopback-only calls without external network, live IOTA RPC, or official Gas Station calls/);
  assert.match(walkthrough, /gateway-local\/offline/);
  assert.match(walkthrough, /local tarball proof only/);
  assert.match(walkthrough, /package publication readiness reports local package proof as configured/);
});

test("public docs and examples expose agentRailTransactionId instead of legacy aliases", async () => {
  for (const path of publicApiDocsAndExamples) {
    const doc = await readDoc(path);

    assert.doesNotMatch(doc, /_saas_tx_id/);
  }

  const quickstart = await readDoc("docs/quickstart.md");
  const sdkDoc = await readDoc("docs/sdk.md");

  assert.match(quickstart, /agentRailTransactionId/);
  assert.match(sdkDoc, /agentRailTransactionId/);
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
