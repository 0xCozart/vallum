/// Minimal Vallum pay-per-call state contract.
///
/// This MVP records paid tool-call state. It does not custody funds.
module pay_per_call_v1::pay_per_call {
    const EInvalidStatus: u64 = 1;
    const EUnauthorizedProvider: u64 = 2;
    const EUnauthorizedRefund: u64 = 3;

    const STATUS_PENDING: u8 = 0;
    const STATUS_DELIVERED: u8 = 1;
    const STATUS_REFUNDED: u8 = 2;

    public struct PaidCall has key, store {
        id: UID,
        buyer: address,
        provider: address,
        price: u64,
        asset: vector<u8>,
        tool_name: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        status: u8,
        result_hash: vector<u8>,
        refund_reason: vector<u8>,
    }

    public fun request_call(
        buyer: address,
        provider: address,
        price: u64,
        asset: vector<u8>,
        tool_name: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        ctx: &mut TxContext,
    ): PaidCall {
        PaidCall {
            id: object::new(ctx),
            buyer,
            provider,
            price,
            asset,
            tool_name,
            idempotency_key,
            receipt_id,
            status: STATUS_PENDING,
            result_hash: vector[],
            refund_reason: vector[],
        }
    }

    public fun create(
        buyer: address,
        provider: address,
        price: u64,
        asset: vector<u8>,
        tool_name: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        ctx: &mut TxContext,
    ): PaidCall {
        request_call(buyer, provider, price, asset, tool_name, idempotency_key, receipt_id, ctx)
    }

    public fun deliver(call: &mut PaidCall, result_hash: vector<u8>, ctx: &TxContext) {
        assert!(call.status == STATUS_PENDING, EInvalidStatus);
        assert!(tx_context::sender(ctx) == call.provider, EUnauthorizedProvider);
        call.status = STATUS_DELIVERED;
        call.result_hash = result_hash;
    }

    public fun refund(call: &mut PaidCall, refund_reason: vector<u8>, ctx: &TxContext) {
        assert!(call.status == STATUS_PENDING, EInvalidStatus);
        let sender = tx_context::sender(ctx);
        assert!(sender == call.buyer || sender == call.provider, EUnauthorizedRefund);
        call.status = STATUS_REFUNDED;
        call.refund_reason = refund_reason;
    }

    public fun status(call: &PaidCall): u8 {
        call.status
    }

    public fun status_pending(): u8 {
        STATUS_PENDING
    }

    public fun status_delivered(): u8 {
        STATUS_DELIVERED
    }

    public fun status_refunded(): u8 {
        STATUS_REFUNDED
    }

    public fun buyer(call: &PaidCall): address {
        call.buyer
    }

    public fun provider(call: &PaidCall): address {
        call.provider
    }

    public fun price(call: &PaidCall): u64 {
        call.price
    }

    public fun asset(call: &PaidCall): &vector<u8> {
        &call.asset
    }

    public fun tool_name(call: &PaidCall): &vector<u8> {
        &call.tool_name
    }

    public fun idempotency_key(call: &PaidCall): &vector<u8> {
        &call.idempotency_key
    }

    public fun receipt_id(call: &PaidCall): &vector<u8> {
        &call.receipt_id
    }

    public fun result_hash(call: &PaidCall): &vector<u8> {
        &call.result_hash
    }

    public fun refund_reason(call: &PaidCall): &vector<u8> {
        &call.refund_reason
    }

    #[test_only]
    public fun destroy_for_testing(call: PaidCall) {
        let PaidCall {
            id,
            buyer: _,
            provider: _,
            price: _,
            asset: _,
            tool_name: _,
            idempotency_key: _,
            receipt_id: _,
            status: _,
            result_hash: _,
            refund_reason: _,
        } = call;
        id.delete();
    }
}
