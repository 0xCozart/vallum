# Contributing to AgentRail

Thanks for helping improve AgentRail. This project exists to make sponsored IOTA transactions easier and safer for the ecosystem.

## Development principles

- Keep the open-source toolkit independently deployable.
- Do not require the future managed service for core functionality.
- Prefer small, testable modules.
- Add tests for policy logic, SDK request construction, and gateway behavior.
- Never commit secrets, sponsor keys, API keys, tokens, local databases, or generated build artifacts.

## Local setup

```bash
npm install
npm test
npm run typecheck
```

More complete local Gas Station instructions are in `docs/quickstart.md`.

## Pull requests

A good pull request includes:

- clear motivation;
- tests for behavior changes;
- documentation updates for user-visible changes;
- no unrelated formatting churn;
- no secrets or generated artifacts.

## Good first issues

Good first contributions include:

- policy reason-code docs;
- SDK examples;
- dashboard copy polish;
- deployment troubleshooting notes;
- threat-model improvements;
- additional policy tests.
