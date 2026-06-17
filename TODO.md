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
reports under ignored local state. This is not external interoperability
evidence: public A2A is still blocked until an external conformance report
exists and is reviewed.

The active next move is to work through the remaining open gates without
treating templates or local mocks as production proof:

- Public A2A: produce an external conformance report before accepting public
  hosting or interoperability.
- Live payment provider, production marketplace, and production custody:
  dedicated proof bundles/templates now exist under ignored local state, but
  each gate still requires an operator-approved provider/review run and a
  redacted structured report before setting the corresponding report env vars.
- Physical-device access remains deferred safety work until there is a separate
  safety design for provider accountability, revocation, emergency stop,
  privacy, and incident response.

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
