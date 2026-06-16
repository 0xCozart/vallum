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

This package is a programmatic MCP-shaped facade. It does not yet provide a
standalone `bin`, stdio transport, hosted MCP server, or Claude/Cursor/Codex
configuration snippet. A runnable MCP entrypoint is planned later; AgentRail is
broader than MCP, and this package is one adapter surface.

## Usage

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
