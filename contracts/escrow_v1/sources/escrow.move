/// Minimal Vallum escrow state contract.
///
/// This MVP records verifier-gated escrow status. It does not custody funds.
module escrow_v1::escrow {
    const EInvalidStatus: u64 = 1;
    const EUnauthorizedVerifier: u64 = 2;
    const EUnauthorizedRefund: u64 = 3;

    const STATUS_OPEN: u8 = 0;
    const STATUS_RELEASED: u8 = 1;
    const STATUS_REFUNDED: u8 = 2;
    const STATUS_EXPIRED: u8 = 3;

    public struct Escrow has key, store {
        id: UID,
        owner: address,
        provider: address,
        verifier: address,
        amount: u64,
        asset: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        status: u8,
        release_proof_hash: vector<u8>,
        refund_reason: vector<u8>,
    }

    public fun create(
        owner: address,
        provider: address,
        verifier: address,
        amount: u64,
        asset: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        ctx: &mut TxContext,
    ): Escrow {
        Escrow {
            id: object::new(ctx),
            owner,
            provider,
            verifier,
            amount,
            asset,
            idempotency_key,
            receipt_id,
            status: STATUS_OPEN,
            release_proof_hash: vector[],
            refund_reason: vector[],
        }
    }

    public fun release(escrow: &mut Escrow, release_proof_hash: vector<u8>, ctx: &TxContext) {
        assert!(escrow.status == STATUS_OPEN, EInvalidStatus);
        assert!(tx_context::sender(ctx) == escrow.verifier, EUnauthorizedVerifier);
        escrow.status = STATUS_RELEASED;
        escrow.release_proof_hash = release_proof_hash;
    }

    public fun refund(escrow: &mut Escrow, refund_reason: vector<u8>, ctx: &TxContext) {
        assert!(escrow.status == STATUS_OPEN, EInvalidStatus);
        let sender = tx_context::sender(ctx);
        assert!(sender == escrow.owner || sender == escrow.verifier, EUnauthorizedRefund);
        escrow.status = STATUS_REFUNDED;
        escrow.refund_reason = refund_reason;
    }

    public fun expire(escrow: &mut Escrow, refund_reason: vector<u8>, ctx: &TxContext) {
        assert!(escrow.status == STATUS_OPEN, EInvalidStatus);
        let sender = tx_context::sender(ctx);
        assert!(sender == escrow.owner || sender == escrow.verifier, EUnauthorizedRefund);
        escrow.status = STATUS_EXPIRED;
        escrow.refund_reason = refund_reason;
    }

    public fun status(escrow: &Escrow): u8 {
        escrow.status
    }

    public fun status_open(): u8 {
        STATUS_OPEN
    }

    public fun status_released(): u8 {
        STATUS_RELEASED
    }

    public fun status_refunded(): u8 {
        STATUS_REFUNDED
    }

    public fun status_expired(): u8 {
        STATUS_EXPIRED
    }

    public fun owner(escrow: &Escrow): address {
        escrow.owner
    }

    public fun provider(escrow: &Escrow): address {
        escrow.provider
    }

    public fun verifier(escrow: &Escrow): address {
        escrow.verifier
    }

    public fun amount(escrow: &Escrow): u64 {
        escrow.amount
    }

    public fun asset(escrow: &Escrow): &vector<u8> {
        &escrow.asset
    }

    public fun idempotency_key(escrow: &Escrow): &vector<u8> {
        &escrow.idempotency_key
    }

    public fun receipt_id(escrow: &Escrow): &vector<u8> {
        &escrow.receipt_id
    }

    public fun release_proof_hash(escrow: &Escrow): &vector<u8> {
        &escrow.release_proof_hash
    }

    public fun refund_reason(escrow: &Escrow): &vector<u8> {
        &escrow.refund_reason
    }

    #[test_only]
    public fun destroy_for_testing(escrow: Escrow) {
        let Escrow {
            id,
            owner: _,
            provider: _,
            verifier: _,
            amount: _,
            asset: _,
            idempotency_key: _,
            receipt_id: _,
            status: _,
            release_proof_hash: _,
            refund_reason: _,
        } = escrow;
        id.delete();
    }
}
