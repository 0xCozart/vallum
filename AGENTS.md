# Agent Instructions

<!-- apex-workflow:start -->
## Apex Workflow Harness

Use `$apex-workflow` for meaningful execution in this repo only after an
`apex.workflow.json` profile exists.

- Profile: `apex.workflow.json`
- Review `setup.reviewNeeded`, `setup.inferredPaths`, and `operatorCautions` before the first implementation slice.
- Select the lightest safe mode before implementation.
- For meaningful code-facing work, create or update a slice manifest under `tmp/apex-workflow/`.
- Use the configured tracker, code-intelligence, browser, and UI/UX adapters from the profile.
- Refresh this harness config from the repo root with:

```bash
node /home/sacred/code/apex-workflow/scripts/init-harness.mjs --target=. --yes --force
```

Current migration note: this Agentic GasKit fork was created before an Apex
profile was present in the source repo. Read
`docs/agentic-gaskit/migration-plan.md` before broad changes. If the Apex
profile is still absent, do not claim Apex verification; either initialize it in
a dedicated setup slice or proceed with the repo-local npm/docs checks.

<!-- apex-workflow:end -->
