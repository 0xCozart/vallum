# Codex Active Goal

Last updated: 2026-06-11.

The active `/goal` target for `/home/sacred/code/agentic-gaskit` is now:

- `docs/agentic-gaskit/full-roadmap-execution-goal.md`

Use that document as the execution contract for continuing the roadmap from the
current handoff through an actual local/testnet-verifiable Agentic GasKit
product.

Start with the current handoff state. The latest continuation evidence records
the most recent completed slice and its local verification status; do not treat
local proof as live IOTA testnet, production marketplace, public scoring,
public A2A discovery, production key management, or provider-verification
proof.

As of the latest completed update, Slice 4.18 is complete: an A2A public
discovery proof harness. It adds `npm run smoke:a2a-public-discovery` as an
opt-in networked command for operator-approved public HTTPS Agent Card and JWKS
probing. The command validates public URL safety, Agent Card JSON shape,
HTTP+JSON base URL binding, task-auth decision alignment, JWKS public-key shape,
and absence of secret-like public metadata or private JWK material. It is
excluded from `verify:fast`, `verify:local`, and `grant:check`. It does not send
A2A task messages, post webhook callbacks, run background workers, persist
queues, store webhook credentials, run external A2A conformance, publish JWKS,
or prove production key rotation. Public hosting acceptance, production
keys/auth, public webhook infrastructure, live IOTA proof, and external
conformance claims remain blocked.

The next continuation should choose the next safe roadmap slice from
`docs/agentic-gaskit/full-roadmap-execution-goal.md` and
`docs/agentic-gaskit/handoff-next-product-build.md`. Good next candidates are
an operator-approved public A2A hosting/JWKS/auth/conformance slice, a push
webhook delivery security/infrastructure design slice, or another explicit live
gate such as IOTA Names/Identity/VC, npm release, payment/provider,
marketplace, custody, or device-safety design. Do not claim the full product is
complete while product-status, launch-readiness, and operator-gate reports
still show live, production, publication, custody, payment, A2A, marketplace,
or safety blockers.

Do not use the old Slice 4.5 A2A task/message goal as the active objective.
That slice was previously completed and locally verified.
