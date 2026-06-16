# @sacredlabs/agentrail-accounts

Signer-reference-first account and wallet primitives for AgentRail.

This package is intentionally local/mock-first. It lets tests and demos create
agent wallet accounts while returning wallet addresses and scoped signer
references instead of seeds, mnemonics, private keys, raw keypairs, raw
transaction bytes, user signatures, sponsor keys, app API keys, or bearer
tokens.

Production custody, KMS integrations, and recovery/export workflows are outside
this first package slice.
