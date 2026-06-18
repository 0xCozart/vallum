# @vallum/marketplace

Read-only local marketplace evidence views for Vallum.

This package helps a future marketplace consume existing Vallum truth:
registry profiles, policy compatibility, contract template metadata, receipts,
manifests, and standards bridge evidence. It does not operate a marketplace,
onboard providers, settle payments, custody funds, verify providers, moderate
listings, or contact live IOTA/x402/AP2/A2A services.

It also exposes a status-only production review snapshot builder. The snapshot
tracks the required provider, moderation, access-control, settlement, dispute,
operations, incident-response, and redaction review checks as `pending`,
`passed`, or `blocked`, with redacted notes and explicit blocker codes. Missing
operator checks remain pending; a local snapshot is preparation material, not
production marketplace proof.
