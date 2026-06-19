# @vallum/receipts

Receipt and contract workflow state machines for Vallum.

This package models local receipt state transitions for sponsored agent actions,
including escrow, pay-per-call, data-license, and service-bounty workflows. It
does not settle payments, make policy decisions, custody funds, verify
providers, or submit transactions.

Escrow settlement receipts record custody terms such as asset type, gross
amount, split amounts, refund authority, refund destination, absolute
`refundAfterEpochMs` deadline, and payee self-release policy. They are
receipt/state records for auditability; the real fund lock lives in the IOTA
custody escrow Move object.
