# TODO

## Current Next Move

MCP stdio adoption is complete. `@vallum/mcp-server@0.0.1-mcp.0` carries the
published `vallum-mcp` bin, and the repo has local plus npm-registry MCP stdio
consumer smoke wiring.

The package publication report, sponsored testnet digest report, local testnet
readiness env, Docker-backed Gas Station runtime, sponsor funding report, and
testnet upstream diagnostic report are reconciled under ignored local state.
With those reports configured, `npm run proof:live-status` and
`npm run proof:product-status` classify package publication plus the current
testnet/Gas Station checks as ready-for-approval or ready-live evidence.

IOTA Names live proof is also reconciled under ignored local state with a
current sanitized report from the opt-in public testnet GraphQL smoke. That
report is time-bounded evidence; refresh it with
`npm run smoke:iota-names-live -- --report <ignored-json-path>` when the
operator-owned name/address inputs change or the report ages out.

IOTA Identity and VC validation are reconciled under ignored local state with a
current sanitized report from the opt-in loopback proof endpoint harness. That
report proves the repo's DID-resolution request path, credential evidence
handling, and VC trust-policy evaluation; it does not prove production key
management, public provider verification, mainnet operation, or a production
identity service.

Public A2A discovery and push delivery have current sanitized structured
reports from an operator-approved temporary public HTTPS Agent Card/JWKS plus
callback probe, and the non-networked public-readiness gate now accepts both
reports under ignored local state. Public external conformance is also
reconciled under ignored local state with a current sanitized
`smoke:a2a-external-conformance` report. This is ready-for-approval evidence,
not official A2A TCK certification or durable production hosting proof.

The official A2A TCK HTTP+JSON diagnostic has been advanced locally against
Vallum's loopback server. It fixed Agent Card security requirement scope
shape, AIP-193 HTTP+JSON error formatting, opt-in unmanifested official A2A
task creation, official `SendMessageResponse` task wrapping, raw GetTask and
ListTasks response shape, SubscribeToTask routing, stream-response status
updates, request `Content-Type` rejection, and the push-not-supported HTTP
status in A2A compatibility mode.
The latest auth-injecting loopback proxy run reports 98.4% overall
compatibility and HTTP+JSON 73/88, with only one MUST failure left:
the upstream TCK requirement metadata for `CORE-SEND-003` omits the expected
`ContentTypeNotSupportedError` binding even though Vallum returns the
standards-shaped 415 response. A temporary local TCK metadata patch that adds
that expected error binding passes the full HTTP+JSON diagnostic at 100.0%
overall and HTTP+JSON 74/88.
This remains diagnostic only, not a passing external conformance report,
because it uses a local loopback server plus auth-injecting proxy rather than
an operator-owned public endpoint/report.
The repo now has an opt-in public external conformance smoke:
`npm run smoke:a2a-external-conformance -- --report <ignored-json-path>`.
It requires `A2A_PUBLIC_TASK_AUTH_DECISION=bearer` plus a local
`A2A_PUBLIC_TASK_BEARER_TOKEN`, fetches the configured public Agent Card, sends
one bearer-authenticated public `message:send`, and writes the accepted
redacted report shape only after both probes pass. OAuth2 and mTLS task routes
still require an operator-owned conformance report.

The active next move is to work through the remaining open gates without
treating templates or local mocks as production proof:

- Live payment provider, production marketplace, and production custody:
  dedicated proof bundles/templates now exist under ignored local state, but
  each gate still requires an operator-approved provider/review run and a
  redacted structured report before setting the corresponding report env vars.
  The direct readiness checks now hydrate those report env vars from local
  `.env` when present, matching the live smoke and aggregate status flows.
- Physical-device access now has an ignored owner-supplied status-only safety
  report at `tmp/vallum/device-access-safety-report.json`, with
  `DEVICE_ACCESS_SAFETY_REPORT` configured locally. That clears the
  non-networked readiness gate for manual owner review only; it does not prove
  any live device operation, provider system access, actuator control, or
  safety-critical integration.

With the A2A and device-access reports configured, the current remaining
product blockers are live payment-provider proof, production marketplace
review, and production custody review. Keep generated templates, bundles, and
local mocks separate from production proof.

## Roadmap Gates After MCP Adoption

The older local roadmap plans remain useful as operator-gate references, but
they are not the immediate product center. They are ignored local artifacts and
may be stale where package publication is concerned because the active package
line is now the published `@vallum/*` prerelease package set.

- `docs/vallum/local-plans/2026-06-15-executable-now-implementation-plan.md`
  - Use it for non-networked proof refreshes and ignored proof-preparation
    bundles.
  - Reconcile any `tmp/gaskit/` paths to current `tmp/vallum/` paths before
    executing commands from it.

- `docs/vallum/local-plans/2026-06-15-owner-completion-checklist.md`
  - Use it for one operator-owned blocker at a time: IOTA Names, IOTA Identity,
    VC trust policy, public A2A, live payment provider, production marketplace,
    production custody, physical-device safety, and future package release or
    namespace migration proof.
  - Do not treat its old npm-publication language as current; future package
    work now means a stable package channel, a new versioned release, or a
    future namespace migration such as `@vallum/*`.

## Agent Notes

- Do not paste secrets, endpoint values, private keys, raw responses, raw
  transaction bytes, signatures, payment credentials, or local secret paths into
  tracked files or chat.
- Keep generated reports and proof bundles under ignored local paths such as
  `tmp/vallum/`.
- Do not delete or modify `tmp/npm_token.txt`; it is local secret-adjacent
  operator state and is ignored.
- When working through roadmap gates, pick one blocker at a time, then rerun:

```bash
npm run proof:product-status
npm run proof:launch-readiness
npm run proof:operator-gates
npm run proof:roadmap-completion
```
