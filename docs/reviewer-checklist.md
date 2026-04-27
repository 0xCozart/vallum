# Reviewer Checklist

Use this checklist to distinguish what is complete for grant submission/local proof from what remains as funded milestone work.

## Before submission / current deterministic local proof

- [x] Public repo exists.
- [x] README explains open-source toolkit value.
- [x] License exists.
- [x] Contribution guide exists.
- [x] Security policy exists.
- [x] Threat model exists.
- [x] Grant milestones are mapped to deliverables.
- [x] Demo script exists.
- [x] Tests pass locally.
- [x] No obvious secrets are committed in the clean scaffold.
- [x] Reviewer walkthrough exists.
- [x] Local policy gateway smoke works against a mock upstream.
- [x] SDK is tested and used by local examples.
- [x] Policy simulation preflight is authenticated, gateway-local/offline, and does not proxy to Gas Station or contact IOTA RPC.
- [x] Sanitized decision events and local usage read-model are covered by tests.
- [x] Node backend and Next.js route examples keep credentials server-side and return safe projections.
- [x] Demo dApp CLI and browser-wrapper smokes run without real IOTA network, Docker, sponsor keys, or private prototype files.
- [x] Offline testnet-readiness preflight validates `.env.example` placeholders without contacting live services.

## Before grant completion / remaining milestone work

- [ ] Full local quickstart works end-to-end against official IOTA Gas Station.
- [ ] Real testnet sponsored transaction is executed with operator-provided secrets.
- [ ] Sponsor wallet funding, sponsor key validity, and IOTA RPC connectivity are verified in an approved live/testnet slice.
- [ ] Durable app/project persistence and API key lifecycle are complete.
- [ ] Durable usage store and authenticated operator dashboard are complete.
- [ ] Dashboard shows health, app usage, wallet usage, rejection logs, quota views, and CSV export.
- [ ] Production monitoring, alerts, and final demo video are complete.
