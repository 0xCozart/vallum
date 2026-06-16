# Verification Profiles

Vallum has two local verification profiles:

```bash
npm run verify:fast
npm run verify:local
```

Use `npm run verify:fast` while iterating on code or docs that should not need
Move tests, package dry-runs, product smokes, or live/operator-gated commands.
It runs the workspace build, deterministic TypeScript test suite, docs check,
secret scan, and the non-networked product-status, launch-readiness, and
operator-gate reports.

Use `npm run verify:local` before accepting a roadmap slice, handoff, release
claim, launch-readiness claim, or reviewer/grant-facing proof. It remains the
full deterministic local gate and includes:

- TypeScript tests;
- Move contract tests;
- typecheck;
- local gateway, demo, contract-workflow, A2A, marketplace, testnet-readiness,
  digest, package, A2A public-readiness, product-status, launch-readiness, and
  operator-gate proofs;
- docs check;
- secret scan.

`npm run proof:verification-profiles` audits the wiring and reports whether:

- `verify:fast` exists and stays bounded to deterministic non-live checks;
- `verify:local` still includes the complete local evidence surface;
- `grant:check` still points to `npm run verify:local`.

For a redacted machine-readable artifact, use:

```bash
npm run proof:verification-profiles -- --json
npm run proof:verification-profiles -- --out tmp/vallum/verification-profiles.json
```

The `--out` file is written with mode `600`. It is a local audit artifact, not
passing evidence by itself, and it must stay outside committed files.

The fast profile is not launch evidence by itself. It is a productivity profile
for the build/test/improve loop. The full local gate remains the evidence
surface for roadmap completion, reviewer proof, and launch-status documents.

The profile proof does not contact IOTA, IOTA Names, IOTA Identity, npm,
payment providers, public A2A hosts, marketplace systems, or physical devices.
