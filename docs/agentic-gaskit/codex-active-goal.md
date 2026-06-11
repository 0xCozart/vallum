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

As of the latest completed update, Slice 4.20 is complete: A2A push callback
URL hardening. Local A2A push notification config and injected HTTP transport
now reject callback URLs with query strings before storage or delivery, so
query-token webhook patterns do not enter local config state or outbound
transport requests. `npm run proof:a2a-public-readiness` now reports
`A2A_PUSH_CALLBACK_URL_HARDENING_LOCAL_PROOF_CONFIGURED` as local proof. This
does not send A2A task messages to public endpoints, post real webhook
callbacks, run background workers, persist queues, store webhook credentials,
run external A2A conformance, publish JWKS, prove production key rotation, or
prove public push delivery. Public hosting acceptance, production keys/auth,
public webhook infrastructure, live IOTA proof, and external conformance claims
remain blocked.

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
