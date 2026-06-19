# @vallum/mcp-server

MCP tool facade for Vallum sponsored IOTA actions.

This package exposes tool descriptors and a local callable server facade that
routes sponsored actions through the Vallum SDK and policy gateway. It
does not directly call IOTA, Gas Station, or transaction submission APIs.

## Install

For the npm release, install:

```sh
npm install @vallum/mcp-server
```

## Current Status

This source package builds both:

- a programmatic MCP-shaped facade; and
- a stdio CLI bin, `vallum-mcp`, for local MCP hosts.

The CLI reads gateway configuration from the MCP server process environment
and routes tool calls through the Vallum SDK and policy gateway. It does not
directly call IOTA, Gas Station, or transaction submission APIs.

The already-published `0.0.0-prerelease` package predates this runnable bin.
The runnable MCP package is published on the official `0.1.1` package line
through the npm `latest` dist-tag.
Registry install plus local stdio execution is covered by
`npm run smoke:npm-registry-mcp-stdio-consumer`.

## Usage

Run the stdio server from a package install or local tarball consumer:

```sh
VALLUM_GATEWAY_URL=http://127.0.0.1:8787 \
VALLUM_API_KEY=replace-with-server-side-secret \
npm exec -- vallum-mcp
```

Use placeholders in MCP host configuration files. Do not commit real
`VALLUM_API_KEY` values.

The programmatic facade remains available:

```ts
import { createIotaMcpServer } from "@vallum/mcp-server";

const server = createIotaMcpServer({
  gatewayBaseUrl: process.env.VALLUM_GATEWAY_URL!,
  apiKey: process.env.VALLUM_API_KEY!,
});

const tools = server.listTools();
const result = await server.callTool("iota.request_sponsored_transaction", {
  manifest,
});
```

Keep `VALLUM_API_KEY`, Gas Station bearer tokens, sponsor keys, raw
transaction bytes, and user signatures server-side. See
https://github.com/0xCozart/vallum/blob/main/docs/vallum/package-integration-guide.md
for the full package map and configuration boundary.
