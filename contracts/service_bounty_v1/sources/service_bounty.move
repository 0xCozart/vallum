/// Minimal AgentRail service-bounty state contract.
///
/// This MVP records bounty completion and release proof hashes. It does not
/// custody funds, implement marketplace listing, verify providers, or enforce
/// legal service terms.
module service_bounty_v1::service_bounty {
    const EInvalidStatus: u64 = 1;
    const EUnauthorizedProvider: u64 = 2;
    const EUnauthorizedRequester: u64 = 3;

    const STATUS_OPEN: u8 = 0;
    const STATUS_COMPLETED: u8 = 1;
    const STATUS_RELEASED: u8 = 2;
    const STATUS_CANCELLED: u8 = 3;

    public struct ServiceBounty has key, store {
        id: UID,
        requester: address,
        provider: address,
        amount: u64,
        asset: vector<u8>,
        bounty_id: vector<u8>,
        deliverable_hash: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        status: u8,
        completion_proof_hash: vector<u8>,
        release_proof_hash: vector<u8>,
        cancellation_reason: vector<u8>,
    }

    public fun post_bounty(
        requester: address,
        provider: address,
        amount: u64,
        asset: vector<u8>,
        bounty_id: vector<u8>,
        deliverable_hash: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        ctx: &mut TxContext,
    ): ServiceBounty {
        ServiceBounty {
            id: object::new(ctx),
            requester,
            provider,
            amount,
            asset,
            bounty_id,
            deliverable_hash,
            idempotency_key,
            receipt_id,
            status: STATUS_OPEN,
            completion_proof_hash: vector[],
            release_proof_hash: vector[],
            cancellation_reason: vector[],
        }
    }

    public fun create(
        requester: address,
        provider: address,
        amount: u64,
        asset: vector<u8>,
        bounty_id: vector<u8>,
        deliverable_hash: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        ctx: &mut TxContext,
    ): ServiceBounty {
        post_bounty(requester, provider, amount, asset, bounty_id, deliverable_hash, idempotency_key, receipt_id, ctx)
    }

    public fun complete_bounty(bounty: &mut ServiceBounty, completion_proof_hash: vector<u8>, ctx: &TxContext) {
        assert!(bounty.status == STATUS_OPEN, EInvalidStatus);
        assert!(tx_context::sender(ctx) == bounty.provider, EUnauthorizedProvider);
        bounty.status = STATUS_COMPLETED;
        bounty.completion_proof_hash = completion_proof_hash;
    }

    public fun release_bounty(bounty: &mut ServiceBounty, release_proof_hash: vector<u8>, ctx: &TxContext) {
        assert!(bounty.status == STATUS_COMPLETED, EInvalidStatus);
        assert!(tx_context::sender(ctx) == bounty.requester, EUnauthorizedRequester);
        bounty.status = STATUS_RELEASED;
        bounty.release_proof_hash = release_proof_hash;
    }

    public fun cancel_bounty(bounty: &mut ServiceBounty, cancellation_reason: vector<u8>, ctx: &TxContext) {
        assert!(bounty.status == STATUS_OPEN || bounty.status == STATUS_COMPLETED, EInvalidStatus);
        assert!(tx_context::sender(ctx) == bounty.requester, EUnauthorizedRequester);
        bounty.status = STATUS_CANCELLED;
        bounty.cancellation_reason = cancellation_reason;
    }

    public fun status(bounty: &ServiceBounty): u8 {
        bounty.status
    }

    public fun status_open(): u8 {
        STATUS_OPEN
    }

    public fun status_completed(): u8 {
        STATUS_COMPLETED
    }

    public fun status_released(): u8 {
        STATUS_RELEASED
    }

    public fun status_cancelled(): u8 {
        STATUS_CANCELLED
    }

    public fun requester(bounty: &ServiceBounty): address {
        bounty.requester
    }

    public fun provider(bounty: &ServiceBounty): address {
        bounty.provider
    }

    public fun amount(bounty: &ServiceBounty): u64 {
        bounty.amount
    }

    public fun asset(bounty: &ServiceBounty): &vector<u8> {
        &bounty.asset
    }

    public fun bounty_id(bounty: &ServiceBounty): &vector<u8> {
        &bounty.bounty_id
    }

    public fun deliverable_hash(bounty: &ServiceBounty): &vector<u8> {
        &bounty.deliverable_hash
    }

    public fun idempotency_key(bounty: &ServiceBounty): &vector<u8> {
        &bounty.idempotency_key
    }

    public fun receipt_id(bounty: &ServiceBounty): &vector<u8> {
        &bounty.receipt_id
    }

    public fun completion_proof_hash(bounty: &ServiceBounty): &vector<u8> {
        &bounty.completion_proof_hash
    }

    public fun release_proof_hash(bounty: &ServiceBounty): &vector<u8> {
        &bounty.release_proof_hash
    }

    public fun cancellation_reason(bounty: &ServiceBounty): &vector<u8> {
        &bounty.cancellation_reason
    }

    #[test_only]
    public fun destroy_for_testing(bounty: ServiceBounty) {
        let ServiceBounty {
            id,
            requester: _,
            provider: _,
            amount: _,
            asset: _,
            bounty_id: _,
            deliverable_hash: _,
            idempotency_key: _,
            receipt_id: _,
            status: _,
            completion_proof_hash: _,
            release_proof_hash: _,
            cancellation_reason: _,
        } = bounty;
        id.delete();
    }
}
