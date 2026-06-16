/// Minimal Vallum reputation-receipt state contract.
///
/// This MVP records local reputation attestation evidence for completed
/// interactions. It does not operate a marketplace, verify providers, moderate
/// public reputation, or enforce legal/KYB claims.
module reputation_receipt_v1::reputation_receipt {
    const EInvalidStatus: u64 = 1;
    const EUnauthorizedIssuer: u64 = 2;
    const EInvalidScore: u64 = 3;

    const STATUS_OPEN: u8 = 0;
    const STATUS_ATTESTED: u8 = 1;
    const STATUS_FAILED: u8 = 2;

    public struct ReputationReceipt has key, store {
        id: UID,
        issuer: address,
        subject: address,
        interaction_id: vector<u8>,
        criteria_hash: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        status: u8,
        score: u8,
        evidence_hash: vector<u8>,
        attestation_hash: vector<u8>,
        failure_reason: vector<u8>,
    }

    public fun create_receipt(
        issuer: address,
        subject: address,
        interaction_id: vector<u8>,
        criteria_hash: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        ctx: &mut TxContext,
    ): ReputationReceipt {
        assert!(tx_context::sender(ctx) == issuer, EUnauthorizedIssuer);
        ReputationReceipt {
            id: object::new(ctx),
            issuer,
            subject,
            interaction_id,
            criteria_hash,
            idempotency_key,
            receipt_id,
            status: STATUS_OPEN,
            score: 0,
            evidence_hash: vector[],
            attestation_hash: vector[],
            failure_reason: vector[],
        }
    }

    public fun create(
        issuer: address,
        subject: address,
        interaction_id: vector<u8>,
        criteria_hash: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        ctx: &mut TxContext,
    ): ReputationReceipt {
        create_receipt(issuer, subject, interaction_id, criteria_hash, idempotency_key, receipt_id, ctx)
    }

    public fun attest_reputation(
        receipt: &mut ReputationReceipt,
        score: u8,
        evidence_hash: vector<u8>,
        attestation_hash: vector<u8>,
        ctx: &TxContext,
    ) {
        assert!(receipt.status == STATUS_OPEN, EInvalidStatus);
        assert!(tx_context::sender(ctx) == receipt.issuer, EUnauthorizedIssuer);
        assert!(score >= 1 && score <= 5, EInvalidScore);
        receipt.status = STATUS_ATTESTED;
        receipt.score = score;
        receipt.evidence_hash = evidence_hash;
        receipt.attestation_hash = attestation_hash;
    }

    public fun fail_receipt(receipt: &mut ReputationReceipt, failure_reason: vector<u8>, ctx: &TxContext) {
        assert!(receipt.status == STATUS_OPEN, EInvalidStatus);
        assert!(tx_context::sender(ctx) == receipt.issuer, EUnauthorizedIssuer);
        receipt.status = STATUS_FAILED;
        receipt.failure_reason = failure_reason;
    }

    public fun status(receipt: &ReputationReceipt): u8 {
        receipt.status
    }

    public fun status_open(): u8 {
        STATUS_OPEN
    }

    public fun status_attested(): u8 {
        STATUS_ATTESTED
    }

    public fun status_failed(): u8 {
        STATUS_FAILED
    }

    public fun issuer(receipt: &ReputationReceipt): address {
        receipt.issuer
    }

    public fun subject(receipt: &ReputationReceipt): address {
        receipt.subject
    }

    public fun interaction_id(receipt: &ReputationReceipt): &vector<u8> {
        &receipt.interaction_id
    }

    public fun criteria_hash(receipt: &ReputationReceipt): &vector<u8> {
        &receipt.criteria_hash
    }

    public fun idempotency_key(receipt: &ReputationReceipt): &vector<u8> {
        &receipt.idempotency_key
    }

    public fun receipt_id(receipt: &ReputationReceipt): &vector<u8> {
        &receipt.receipt_id
    }

    public fun score(receipt: &ReputationReceipt): u8 {
        receipt.score
    }

    public fun evidence_hash(receipt: &ReputationReceipt): &vector<u8> {
        &receipt.evidence_hash
    }

    public fun attestation_hash(receipt: &ReputationReceipt): &vector<u8> {
        &receipt.attestation_hash
    }

    public fun failure_reason(receipt: &ReputationReceipt): &vector<u8> {
        &receipt.failure_reason
    }

    #[test_only]
    public fun destroy_for_testing(receipt: ReputationReceipt) {
        let ReputationReceipt {
            id,
            issuer: _,
            subject: _,
            interaction_id: _,
            criteria_hash: _,
            idempotency_key: _,
            receipt_id: _,
            status: _,
            score: _,
            evidence_hash: _,
            attestation_hash: _,
            failure_reason: _,
        } = receipt;
        id.delete();
    }
}
