# TODO

## Resume AgentRail Roadmap Completion

Later agents should start from these local planning docs:

- `docs/agentrail/local-plans/2026-06-15-executable-now-implementation-plan.md`
  - What it is: a hardened implementation plan for the work Codex can execute
    without new owner-supplied inputs.
  - Why execute it: it refreshes local proof, writes ignored proof-preparation
    bundles, keeps roadmap blocker evidence current, and prevents local proof
    from being overclaimed as live or production readiness.

- `docs/agentrail/local-plans/2026-06-15-owner-completion-checklist.md`
  - What it is: the owner-guided checklist for the remaining external blockers:
    IOTA Names, IOTA Identity, VC trust policy, npm publication, public A2A,
    live payment provider, production marketplace, production custody, and
    physical-device safety.
  - Why execute it: the roadmap cannot complete until these operator-owned
    configs, reports, approvals, or explicit out-of-scope decisions are handled
    one gate at a time.

Notes for agents:

- Do not paste secrets, endpoint values, private keys, raw responses, raw
  transaction bytes, signatures, payment credentials, or local secret paths into
  tracked files or chat.
- Keep generated reports and proof bundles under ignored local paths such as
  `tmp/agentrail/`.
- Use the checklist one blocker at a time, then rerun:

```bash
npm run proof:product-status
npm run proof:launch-readiness
npm run proof:operator-gates
npm run proof:roadmap-completion
```
