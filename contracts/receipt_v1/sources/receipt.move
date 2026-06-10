/// Minimal Agentic GasKit receipt lifecycle contract.
module receipt_v1::receipt {
    const EInvalidStatus: u64 = 1;

    const STATUS_ATTEMPTED: u8 = 0;
    const STATUS_DENIED: u8 = 1;
    const STATUS_APPROVED: u8 = 2;
    const STATUS_SPONSORED: u8 = 3;
    const STATUS_SUBMITTED: u8 = 4;
    const STATUS_COMPLETED: u8 = 5;
    const STATUS_RELEASED: u8 = 6;
    const STATUS_REFUNDED: u8 = 7;
    const STATUS_FAILED: u8 = 8;

    public struct Receipt has key, store {
        id: UID,
        receipt_id: vector<u8>,
        manifest_id: vector<u8>,
        idempotency_key: vector<u8>,
        agent_id: vector<u8>,
        owner: address,
        status: u8,
        sponsorship_id: vector<u8>,
        transaction_digest: vector<u8>,
        evidence_hash: vector<u8>,
        terminal_reason: vector<u8>,
    }

    public fun create(
        receipt_id: vector<u8>,
        manifest_id: vector<u8>,
        idempotency_key: vector<u8>,
        agent_id: vector<u8>,
        owner: address,
        ctx: &mut TxContext,
    ): Receipt {
        Receipt {
            id: object::new(ctx),
            receipt_id,
            manifest_id,
            idempotency_key,
            agent_id,
            owner,
            status: STATUS_ATTEMPTED,
            sponsorship_id: vector[],
            transaction_digest: vector[],
            evidence_hash: vector[],
            terminal_reason: vector[],
        }
    }

    public fun deny(receipt: &mut Receipt, reason: vector<u8>) {
        assert!(receipt.status == STATUS_ATTEMPTED, EInvalidStatus);
        receipt.status = STATUS_DENIED;
        receipt.terminal_reason = reason;
    }

    public fun approve(receipt: &mut Receipt) {
        assert!(receipt.status == STATUS_ATTEMPTED, EInvalidStatus);
        receipt.status = STATUS_APPROVED;
    }

    public fun sponsor(receipt: &mut Receipt, sponsorship_id: vector<u8>) {
        assert!(receipt.status == STATUS_APPROVED, EInvalidStatus);
        receipt.status = STATUS_SPONSORED;
        receipt.sponsorship_id = sponsorship_id;
    }

    public fun submit(receipt: &mut Receipt, transaction_digest: vector<u8>) {
        assert!(receipt.status == STATUS_SPONSORED, EInvalidStatus);
        receipt.status = STATUS_SUBMITTED;
        receipt.transaction_digest = transaction_digest;
    }

    public fun complete(receipt: &mut Receipt, evidence_hash: vector<u8>) {
        assert!(receipt.status == STATUS_SUBMITTED, EInvalidStatus);
        receipt.status = STATUS_COMPLETED;
        receipt.evidence_hash = evidence_hash;
    }

    public fun release(receipt: &mut Receipt) {
        assert!(receipt.status == STATUS_COMPLETED, EInvalidStatus);
        receipt.status = STATUS_RELEASED;
    }

    public fun refund(receipt: &mut Receipt, reason: vector<u8>) {
        assert!(
            receipt.status == STATUS_ATTEMPTED ||
                receipt.status == STATUS_APPROVED ||
                receipt.status == STATUS_SPONSORED ||
                receipt.status == STATUS_SUBMITTED ||
                receipt.status == STATUS_COMPLETED,
            EInvalidStatus,
        );
        receipt.status = STATUS_REFUNDED;
        receipt.terminal_reason = reason;
    }

    public fun fail(receipt: &mut Receipt, reason: vector<u8>) {
        assert!(
            receipt.status == STATUS_ATTEMPTED ||
                receipt.status == STATUS_APPROVED ||
                receipt.status == STATUS_SPONSORED ||
                receipt.status == STATUS_SUBMITTED,
            EInvalidStatus,
        );
        receipt.status = STATUS_FAILED;
        receipt.terminal_reason = reason;
    }

    public fun status(receipt: &Receipt): u8 {
        receipt.status
    }

    public fun status_denied(): u8 {
        STATUS_DENIED
    }

    public fun status_released(): u8 {
        STATUS_RELEASED
    }

    public fun status_refunded(): u8 {
        STATUS_REFUNDED
    }

    public fun receipt_id(receipt: &Receipt): &vector<u8> {
        &receipt.receipt_id
    }

    public fun manifest_id(receipt: &Receipt): &vector<u8> {
        &receipt.manifest_id
    }

    public fun idempotency_key(receipt: &Receipt): &vector<u8> {
        &receipt.idempotency_key
    }

    public fun agent_id(receipt: &Receipt): &vector<u8> {
        &receipt.agent_id
    }

    public fun owner(receipt: &Receipt): address {
        receipt.owner
    }

    public fun sponsorship_id(receipt: &Receipt): &vector<u8> {
        &receipt.sponsorship_id
    }

    public fun transaction_digest(receipt: &Receipt): &vector<u8> {
        &receipt.transaction_digest
    }

    public fun evidence_hash(receipt: &Receipt): &vector<u8> {
        &receipt.evidence_hash
    }

    public fun terminal_reason(receipt: &Receipt): &vector<u8> {
        &receipt.terminal_reason
    }

    #[test_only]
    public fun destroy_for_testing(receipt: Receipt) {
        let Receipt {
            id,
            receipt_id: _,
            manifest_id: _,
            idempotency_key: _,
            agent_id: _,
            owner: _,
            status: _,
            sponsorship_id: _,
            transaction_digest: _,
            evidence_hash: _,
            terminal_reason: _,
        } = receipt;
        id.delete();
    }
}
