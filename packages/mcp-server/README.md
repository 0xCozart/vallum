# @sacredlabs/agentrail-mcp-server

MCP tool facade for AgentRail sponsored IOTA actions.

This package exposes tool descriptors and a local callable server facade that
routes sponsored actions through the AgentRail SDK and policy gateway. It
does not directly call IOTA, Gas Station, or transaction submission APIs.

## Install

For the npm prerelease, install:

```sh
npm install @sacredlabs/agentrail-mcp-server@next
```

## Current Status

This source package builds both:

- a programmatic MCP-shaped facade; and
- a stdio CLI bin, `agentrail-mcp`, for local MCP hosts.

The CLI reads gateway configuration from the MCP server process environment
and routes tool calls through the AgentRail SDK and policy gateway. It does not
directly call IOTA, Gas Station, or transaction submission APIs.

The already-published `0.0.0-prerelease` package predates this runnable bin.
The runnable MCP package is published as
`@sacredlabs/agentrail-mcp-server@0.0.1-mcp.0` on the npm `next` dist-tag.
Registry install plus local stdio execution is covered by
`npm run smoke:npm-registry-mcp-stdio-consumer`.

## Usage

Run the stdio server from a package install or local tarball consumer:

```sh
AGENTRAIL_GATEWAY_URL=http://127.0.0.1:8787 \
AGENTRAIL_API_KEY=replace-with-server-side-secret \
npm exec -- agentrail-mcp
```

Use placeholders in MCP host configuration files. Do not commit real
`AGENTRAIL_API_KEY` values.

The programmatic facade remains available:

```ts
import { createIotaMcpServer } from "@sacredlabs/agentrail-mcp-server";

const server = createIotaMcpServer({
  gatewayBaseUrl: process.env.AGENTRAIL_GATEWAY_URL!,
  apiKey: process.env.AGENTRAIL_API_KEY!,
});

const tools = server.listTools();
const result = await server.callTool("iota.request_sponsored_transaction", {
  manifest,
});
```

Keep `AGENTRAIL_API_KEY`, Gas Station bearer tokens, sponsor keys, raw
transaction bytes, and user signatures server-side. See
https://github.com/0xCozart/agentic-gaskit/blob/main/docs/agentrail/package-integration-guide.md
for the full package map and configuration boundary.
