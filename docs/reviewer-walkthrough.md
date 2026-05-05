# Reviewer Walkthrough

Date: 2026-05-05

Purpose: give grant reviewers a short, reproducible path through the IOTA GasKit repo while clearly separating deterministic local proof and documented live testnet evidence from remaining production milestone work.

## 1. Start with the thesis

Read:

- `README.md`
- `docs/grant-scope.md`
- `docs/managed-service-roadmap.md`

What to verify:

- GasKit is framed as an open-source toolkit around IOTA Gas Station.
- The grant-funded core remains self-hostable and inspectable.
- Future managed hosting/support is separated from the grant MVP.

## 2. Check repository hygiene

Read:

- `LICENSE`
- `NOTICE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/pull_request_template.md`

What to verify:

- The repository is Apache-2.0 licensed.
- Contributors and security reporters have a clear path.
- Sensitive sponsor-wallet material is explicitly forbidden.

## 3. Review the proposed architecture and safety model

Read:

- `docs/architecture.md`
- `docs/assets/iota-gaskit-architecture.svg`
- `docs/threat-model.md`
- `docs/production-hardening.md`
- `docs/security/sponsor-wallet.md`
- `docs/security/secrets.md`
- `docs/observability.md`
- `docs/testnet-readiness.md`

What to verify:

- The policy gateway sits between apps/SDKs and IOTA Gas Station.
- Sponsor-wallet safety is treated as the primary security boundary.
- Allowlists, quotas, denial rules, policy simulation, observability, and private Gas Station access are represented.
- The deterministic proof does not require sponsor keys, real IOTA RPC, Docker, or private prototype files.
- The optional live proof is isolated in `npm run execute:testnet-demo` and requires operator-owned local credentials.

## 4. Verify the current local proof

Run from the repository root:

```bash
npm install
npm run grant:check
```

For faster spot checks, reviewers can also run individual commands:

```bash
npm test
npm run typecheck
npm run smoke:local
npm run smoke:demo-dapp
npm run smoke:demo-browser
npm run readiness:testnet:example
npm run pack:check
npm run secrets:scan
```

Expected current result:

- workspace packages build to local `dist/` folders;
- package, app, script, and example tests pass;
- TypeScript typecheck passes;
- local policy gateway smoke passes against an in-process mock upstream;
- local demo dApp CLI and browser-wrapper smokes pass using loopback-only calls without external network, live IOTA RPC, or official Gas Station calls;
- example testnet-readiness preflight validates placeholders without reading real secrets;
- package dry-runs complete for publishable workspace packages;
- tracked-file secret scan passes.

Important source and test files:

- `packages/shared-types/src/policy.ts`
- `packages/policy-gateway/src/policy.ts`
- `packages/policy-gateway/src/policy.test.ts`
- `packages/sdk/src/client.ts`
- `packages/sdk/src/client.test.ts`
- `apps/policy-gateway-service/src/server.ts`
- `apps/policy-gateway-service/src/server.test.ts`
- `apps/policy-gateway-service/src/events.test.ts`
- `apps/policy-gateway-service/src/usage.test.ts`
- `apps/demo-dapp/src/local-flow.ts`
- `apps/demo-dapp/src/browser.test.ts`
- `scripts/smoke-local-gateway.ts`
- `scripts/smoke-demo-dapp-local.ts`
- `scripts/smoke-demo-dapp-browser.ts`

What to verify:

- policy decisions are typed and reason-coded;
- package/function allowlists fail closed when configured metadata is missing;
- app auth and quota checks happen before upstream proxy calls;
- `POST /v1/policy/simulate` is authenticated, gateway-local/offline, and does not mutate quota counters;
- SDK success responses validate required identifiers instead of silently returning empty strings;
- `client.simulatePolicy(...)` returns policy rejections as typed decision data while keeping auth/malformed transport failures as SDK errors;
- sanitized decision events and local usage snapshots omit credentials, raw bodies, transaction bytes, and user signatures.

## 5. Inspect examples and quickstart with the right expectation

Read:

- `docs/quickstart.md`
- `docs/deployment.md`
- `deploy/docker-compose/docker-compose.local.yml`
- `deploy/gas-station/config.example.yaml`
- `examples/policies/demo-dapp.yaml`
- `examples/node-backend/README.md`
- `examples/nextjs-api-route/README.md`
- `apps/demo-dapp/README.md`

What to verify:

- the local smoke paths are runnable and deterministic today;
- app credentials stay server-side in SDK/backend/route examples;
- the browser wrapper uses a same-origin local API so the browser does not receive the app key;
- local/testnet-first defaults are documented;
- the optional live testnet execute command and public digest evidence are documented in `docs/testnet-attempts.md`;
- dashboard UI, production persistence, production monitoring, and final demo assets remain later milestone boundaries.

## 6. Review grant plan and remaining work

Read:

- `docs/product-requirements.md`
- `docs/continuation-brief-2026-04-26.md`
- `docs/grant-application.md`
- `docs/grant-milestones.md`
- `docs/milestone-0-proof.md`
- `docs/demo-script.md`
- `docs/reviewer-checklist.md`

What to verify:

- the recommended Tier 2 ask is tied to concrete deliverables;
- current deterministic proof is strong and the real testnet execute evidence is documented;
- remaining milestones are measurable: durable usage store, dashboard, monitoring/alerts, package release operations, and final demo assets.

## Reviewer-safe conclusion

This repo currently proves a clean, licensed, tested, security-conscious open-source GasKit toolkit with deterministic local gateway, SDK, examples, policy simulation, observability, usage read-model, demo dApp proof paths, package dry-runs, tracked-file secret scan, and documented real IOTA testnet sponsored execute evidence. It does not ask reviewers to treat the durable dashboard, production persistence, production monitoring, package publication, or final video as complete. Those remain explicit grant milestone work.
