# A2A Local Server Demo

Deterministic loopback proof for running the Vallum A2A HTTP boundary
behind a real local HTTP server.

This demo binds to `127.0.0.1` on an ephemeral port and does not contact live
A2A clients or publish a public Agent Card. It proves:

- signed Agent Card discovery at `/.well-known/agent-card.json` over HTTP;
- trusted-key verification of the local card signature;
- bearer-authenticated task/message routes;
- local task send/get/list/cancel semantics over HTTP;
- artifact omission on read endpoints unless explicitly requested;
- local SSE task events from `POST /message:stream`;
- explicit unsupported behavior for push notification routes through the shared
  HTTP handler;
- safe smoke output without task auth tokens, signer refs, wallet internals,
  payment credentials, private keys, or private prompt text.

Run through:

```bash
npm run smoke:a2a-local-server
```
