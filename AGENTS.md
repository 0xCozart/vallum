# Agent Instructions

<!-- apex-workflow:start -->
## Apex Workflow Harness

Use `$apex-workflow` for meaningful execution in this repo only after an
`apex.workflow.json` profile exists.

- Profile: `apex.workflow.json`
- Review `operatorCautions` before live/testnet or security-sensitive work.
- `setup.reviewNeeded` is expected to stay empty; any new inferred or guessed
  setup path must be resolved before the next implementation slice.
- Select the lightest safe mode before implementation.
- For meaningful code-facing work, create or update a slice manifest under `tmp/apex-workflow/`.
- Use the configured tracker, code-intelligence, browser, and UI/UX adapters from the profile.
- Refresh this harness config from the repo root with:

```bash
node /home/sacred/code/apex-workflow/scripts/init-harness.mjs --target=. --yes --force
```

Current migration note: this Vallum fork was created before an Apex
profile was present in the source repo. The fork now has a reviewed local
profile. Read `docs/vallum/migration-plan.md` before broad changes, and
do not claim Apex verification unless `apex-doctor` plus the current slice
manifest/detect evidence pass.

<!-- apex-workflow:end -->
