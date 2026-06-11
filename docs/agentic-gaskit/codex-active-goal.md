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

As of the latest completed update, Slice 4.27 is complete: A2A static discovery
bundle. Agentic GasKit can now package a signed Agent Card and public JWKS
response as local deployable JSON artifacts for
`/.well-known/agent-card.json` and `/.well-known/jwks.json`. The helper
requires public HTTPS URLs without credentials, query strings, fragments,
loopback hosts, or private-network hosts; binds Agent Card signature `jku`
values to the configured public JWKS URL; requires every signing key id to
appear in JWKS; and rejects private or secret-like fields before bundle
generation. `npm run proof:a2a-public-readiness` reports
`A2A_STATIC_DISCOVERY_BUNDLE_LOCAL_PROOF_CONFIGURED` as local static bundle
support. This does not deploy public A2A hosting, prove endpoint ownership,
store private keys, prove production key rotation, accept public discovery
evidence, run external A2A conformance, prove public push delivery, or prove
live IOTA behavior. Public hosting acceptance, production keys/auth, public
webhook infrastructure, live IOTA proof, npm publication, payment/provider,
marketplace, custody, device-safety, and external conformance claims remain
blocked.

As of the latest live-read-only refresh on 2026-06-11, the existing documented
public IOTA testnet digest was successfully retrieved from the default IOTA
testnet RPC with `effectsStatus=success`, `checkpoint=210668352`, and
transaction timestamp `2026-05-05T06:13:17.133Z`. This confirms current
read-only RPC reachability for the documented digest only. It does not prove a
new sponsored transaction, local `.env` readiness, current sponsor wallet
funding, current Gas Station availability, or production readiness.

As of the latest full local verification refresh on 2026-06-11, `npm run
verify:local` passed from the current state. The full gate covered 420
deterministic TypeScript tests, 33 Move tests, typecheck, local gateway and
demo smokes, agent workflow smokes, local A2A smokes, marketplace read-model
smoke, example testnet-readiness preflight, non-networked digest proof,
package dry-runs, package install smoke for 11 packages, A2A public-readiness,
verification-profile, product-status, launch-readiness, operator-gate, docs,
and secret-scan checks. This is full local/reviewer evidence only; it does not
clear live/operator blockers.

As of the latest local testnet-readiness refresh on 2026-06-11, `.env` is
populated outside Git with generated local testnet-readiness values and
`npm run readiness:testnet` passes. `npm run proof:live-status` and
`npm run proof:operator-gates` now report testnet readiness as configured /
ready-to-run. The follow-up `testnet-upstream` gate now requires a sanitized
diagnostic report proving IOTA RPC, Gas Station reachability, and reserve_gas
compatibility before fresh sponsored execution is treated as ready. The latest
`npm run diagnose:gas-station -- --skip-reserve --report
tmp/gaskit/testnet-upstream-diagnostic.json` reached the configured IOTA
testnet RPC with HTTP 200 and latest checkpoint `226298093`, but the
configured local Gas Station loopback root and `/v1/health` endpoint were
unreachable. Current gate code is `TESTNET_UPSTREAM_REPORT_FAILED`. This does
not prove a new sponsored transaction, current sponsor funding, Gas Station
availability, IOTA Names/Identity/VC live proof, or production readiness.

As of the latest local Gas Station setup refresh on 2026-06-11,
`npm run gas-station:render-config` renders the ignored
`deploy/gas-station/config.local.yaml` from local `.env`. Shape-only validation
confirmed the rendered config exists, contains a 33-byte official-style local
signer key, points at the configured IOTA testnet RPC, and uses the compose
Redis service URL. The local Docker Compose template now includes Redis and the
official `iotaledger/gas-station` container on loopback ports. The container
was not started because this WSL session cannot reach the Docker daemon, the
Docker Compose plugin is unavailable, and the standalone Docker Desktop
`docker-compose` shim reports WSL integration is not active.

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
