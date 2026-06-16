# A2A HTTP Demo

Deterministic local proof for the Vallum A2A HTTP boundary.

This demo does not start a public server or contact live A2A clients. It uses
the pure local handler from `@vallum/standards` to prove:

- public Agent Card discovery at `/.well-known/agent-card.json`;
- bearer-authenticated extended Agent Card access at `/extendedAgentCard`;
- bearer-authenticated task/message routes;
- local task send/get/list/cancel semantics;
- local push notification configuration create/list/get/delete semantics
  and injected push delivery without default outbound webhook calls;
- rejection of webhook credential storage and unsafe local callback URLs;
- artifact omission on read endpoints unless explicitly requested;
- safe error output without task auth tokens, signer refs, wallet internals,
  payment credentials, or private prompt text.

Run through:

```bash
npm run smoke:a2a-http
```
