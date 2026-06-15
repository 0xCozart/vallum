# A2A Task/Message Demo

This local demo shows how AgentRail can model current A2A task and message
operations without operating a public A2A server.

It proves:

- a new A2A message creates a policy-approved completed task;
- policy denial returns a rejected task without artifacts;
- input-required tasks accept matching follow-up messages;
- working tasks can be canceled;
- task log output redacts prompt text, signer refs, wallet internals, payment
  credentials, bearer tokens, and key-like material.

Run:

```bash
npm run smoke:a2a-task-message
```

This command is local-only. It does not host a public A2A endpoint, sign Agent
Cards, contact A2A peers, call IOTA RPC, spend IOTA testnet gas, or operate live
payment rails.
