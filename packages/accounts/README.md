# @vallum/accounts

Signer-reference-first account and wallet primitives for Vallum.

This package is intentionally local/mock-first. It lets tests and demos create
agent wallet accounts while returning wallet addresses and scoped signer
references instead of seeds, mnemonics, private keys, raw keypairs, raw
transaction bytes, user signatures, sponsor keys, app API keys, or bearer
tokens.

Production custody, KMS integrations, and recovery/export workflows are outside
this first package slice.

The package also exposes a status-only custody production review snapshot
builder. The snapshot tracks required signer-reference, no-secret-exposure,
KMS/external-signer, lifecycle, recovery, backup, rotation, audit, legal,
incident-response, and redaction checks as `pending`, `passed`, or `blocked`,
with redacted notes and explicit blocker codes. Missing operator checks remain
pending; a local snapshot is preparation material, not production custody
proof.
