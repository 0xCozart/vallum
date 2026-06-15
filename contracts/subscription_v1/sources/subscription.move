/// Minimal AgentRail subscription state contract.
///
/// This MVP records local entitlement evidence for subscription activation,
/// renewal, cancellation, and failed proof. It does not operate recurring
/// billing, payment processing, live settlement, legal enforcement, or
/// marketplace subscription listings.
module subscription_v1::subscription {
    const EInvalidStatus: u64 = 1;
    const EUnauthorizedSubscriber: u64 = 2;
    const EUnauthorizedProvider: u64 = 3;
    const EInvalidPeriod: u64 = 4;

    const STATUS_STARTED: u8 = 0;
    const STATUS_ACTIVE: u8 = 1;
    const STATUS_RENEWED: u8 = 2;
    const STATUS_CANCELED: u8 = 3;
    const STATUS_FAILED: u8 = 4;

    public struct Subscription has key, store {
        id: UID,
        subscriber: address,
        provider: address,
        plan_id: vector<u8>,
        terms_hash: vector<u8>,
        period_start: u64,
        period_end: u64,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        status: u8,
        renewal_count: u64,
        activation_proof_hash: vector<u8>,
        renewal_proof_hash: vector<u8>,
        cancellation_reason: vector<u8>,
        failure_reason: vector<u8>,
    }

    public fun start_subscription(
        subscriber: address,
        provider: address,
        plan_id: vector<u8>,
        terms_hash: vector<u8>,
        period_start: u64,
        period_end: u64,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        ctx: &mut TxContext,
    ): Subscription {
        assert!(tx_context::sender(ctx) == subscriber, EUnauthorizedSubscriber);
        assert!(period_end > period_start, EInvalidPeriod);
        Subscription {
            id: object::new(ctx),
            subscriber,
            provider,
            plan_id,
            terms_hash,
            period_start,
            period_end,
            idempotency_key,
            receipt_id,
            status: STATUS_STARTED,
            renewal_count: 0,
            activation_proof_hash: vector[],
            renewal_proof_hash: vector[],
            cancellation_reason: vector[],
            failure_reason: vector[],
        }
    }

    public fun activate_subscription(sub: &mut Subscription, activation_proof_hash: vector<u8>, ctx: &TxContext) {
        assert!(sub.status == STATUS_STARTED, EInvalidStatus);
        assert!(tx_context::sender(ctx) == sub.provider, EUnauthorizedProvider);
        sub.status = STATUS_ACTIVE;
        sub.activation_proof_hash = activation_proof_hash;
    }

    public fun renew_subscription(
        sub: &mut Subscription,
        period_end: u64,
        renewal_proof_hash: vector<u8>,
        ctx: &TxContext,
    ) {
        assert!(sub.status == STATUS_ACTIVE || sub.status == STATUS_RENEWED, EInvalidStatus);
        assert!(tx_context::sender(ctx) == sub.provider, EUnauthorizedProvider);
        assert!(period_end > sub.period_end, EInvalidPeriod);
        sub.status = STATUS_RENEWED;
        sub.period_end = period_end;
        sub.renewal_count = sub.renewal_count + 1;
        sub.renewal_proof_hash = renewal_proof_hash;
    }

    public fun cancel_subscription(sub: &mut Subscription, cancellation_reason: vector<u8>, ctx: &TxContext) {
        assert!(sub.status == STATUS_ACTIVE || sub.status == STATUS_RENEWED, EInvalidStatus);
        assert!(tx_context::sender(ctx) == sub.subscriber, EUnauthorizedSubscriber);
        sub.status = STATUS_CANCELED;
        sub.cancellation_reason = cancellation_reason;
    }

    public fun fail_subscription(sub: &mut Subscription, failure_reason: vector<u8>, ctx: &TxContext) {
        assert!(
            sub.status == STATUS_STARTED || sub.status == STATUS_ACTIVE || sub.status == STATUS_RENEWED,
            EInvalidStatus,
        );
        assert!(tx_context::sender(ctx) == sub.provider, EUnauthorizedProvider);
        sub.status = STATUS_FAILED;
        sub.failure_reason = failure_reason;
    }

    public fun status(sub: &Subscription): u8 {
        sub.status
    }

    public fun status_started(): u8 {
        STATUS_STARTED
    }

    public fun status_active(): u8 {
        STATUS_ACTIVE
    }

    public fun status_renewed(): u8 {
        STATUS_RENEWED
    }

    public fun status_canceled(): u8 {
        STATUS_CANCELED
    }

    public fun status_failed(): u8 {
        STATUS_FAILED
    }

    public fun renewal_count(sub: &Subscription): u64 {
        sub.renewal_count
    }

    public fun activation_proof_hash(sub: &Subscription): &vector<u8> {
        &sub.activation_proof_hash
    }

    public fun renewal_proof_hash(sub: &Subscription): &vector<u8> {
        &sub.renewal_proof_hash
    }

    public fun cancellation_reason(sub: &Subscription): &vector<u8> {
        &sub.cancellation_reason
    }

    public fun failure_reason(sub: &Subscription): &vector<u8> {
        &sub.failure_reason
    }

    #[test_only]
    public fun destroy_for_testing(sub: Subscription) {
        let Subscription {
            id,
            subscriber: _,
            provider: _,
            plan_id: _,
            terms_hash: _,
            period_start: _,
            period_end: _,
            idempotency_key: _,
            receipt_id: _,
            status: _,
            renewal_count: _,
            activation_proof_hash: _,
            renewal_proof_hash: _,
            cancellation_reason: _,
            failure_reason: _,
        } = sub;
        id.delete();
    }
}
