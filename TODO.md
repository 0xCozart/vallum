# TODO

## Current Next Move

Build the runnable MCP adapter after the package/docs adoption path, not before
it. The next implementation plan is:

- `docs/vallum/mcp-server-design-and-implementation-plan.md`
  - What it is: the Apex-planned design and implementation contract for turning
    `@vallum/mcp-server` from a programmatic facade into a
    runnable MCP stdio package.
  - Why execute it: it gives agents a concrete install-and-run path while
    preserving the larger Vallum product boundary: MCP is an adapter, not
    the product.

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
