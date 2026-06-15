# AgentRail Docs Site

This workspace builds a static documentation site from the canonical Markdown files in the repository root and `docs/`. It is a presentation layer only; edit the source Markdown files, not generated HTML.

## Build

```bash
npm run docs:build
```

The generated site is written to `apps/docs-site/dist/`.

## Preview locally

```bash
npm run docs:serve
```

Open `http://127.0.0.1:4175`.

## Deploy

Any static host can serve `apps/docs-site/dist/`.

Recommended settings:

- build command: `npm run docs:build`
- output directory: `apps/docs-site/dist`
- Node version: `20`

Use a docs subdomain such as `docs.agentrail.dev` when a domain is available.
