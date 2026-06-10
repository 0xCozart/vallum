#[test_only]
module subscription_v1::subscription_tests {
    use subscription_v1::subscription;
    use iota::test_scenario as ts;

    const SUBSCRIBER: address = @0xA11CE;
    const PROVIDER: address = @0xB0B;
    const ATTACKER: address = @0xBAD;

    #[test]
    fun start_renew_and_cancel_subscription() {
        let mut scenario = ts::begin(SUBSCRIBER);
        let mut sub = subscription::start_subscription(
            SUBSCRIBER,
            PROVIDER,
            b"plan-research-feed-monthly",
            b"sha256-subscription-terms",
            1_781_092_800,
            1_783_684_800,
            b"idem-subscription-1",
            b"receipt-subscription-1",
            ts::ctx(&mut scenario),
        );

        ts::next_tx(&mut scenario, PROVIDER);
        subscription::activate_subscription(&mut sub, b"sha256-activation-proof", ts::ctx(&mut scenario));
        subscription::renew_subscription(&mut sub, 1_786_276_800, b"sha256-renewal-proof", ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, SUBSCRIBER);
        subscription::cancel_subscription(&mut sub, b"subscriber-canceled", ts::ctx(&mut scenario));

        assert!(subscription::status(&sub) == subscription::status_canceled(), 0);
        assert!(subscription::renewal_count(&sub) == 1, 0);
        assert!(*subscription::activation_proof_hash(&sub) == b"sha256-activation-proof", 0);
        assert!(*subscription::renewal_proof_hash(&sub) == b"sha256-renewal-proof", 0);
        assert!(*subscription::cancellation_reason(&sub) == b"subscriber-canceled", 0);
        subscription::destroy_for_testing(sub);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 2, location=subscription_v1::subscription)]
    fun unauthorized_create_is_denied() {
        let mut scenario = ts::begin(ATTACKER);
        let sub = subscription::start_subscription(
            SUBSCRIBER,
            PROVIDER,
            b"plan-research-feed-monthly",
            b"sha256-subscription-terms",
            1_781_092_800,
            1_783_684_800,
            b"idem-subscription-unauthorized",
            b"receipt-subscription-unauthorized",
            ts::ctx(&mut scenario),
        );
        subscription::destroy_for_testing(sub);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 3, location=subscription_v1::subscription)]
    fun unauthorized_activation_is_denied() {
        let mut scenario = ts::begin(SUBSCRIBER);
        let mut sub = new_subscription(&mut scenario);

        ts::next_tx(&mut scenario, ATTACKER);
        subscription::activate_subscription(&mut sub, b"sha256-stolen-activation", ts::ctx(&mut scenario));
        subscription::destroy_for_testing(sub);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 1, location=subscription_v1::subscription)]
    fun renewal_after_cancel_is_denied() {
        let mut scenario = ts::begin(SUBSCRIBER);
        let mut sub = new_subscription(&mut scenario);

        ts::next_tx(&mut scenario, PROVIDER);
        subscription::activate_subscription(&mut sub, b"sha256-activation-proof", ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, SUBSCRIBER);
        subscription::cancel_subscription(&mut sub, b"subscriber-canceled", ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, PROVIDER);
        subscription::renew_subscription(&mut sub, 1_786_276_800, b"sha256-late-renewal", ts::ctx(&mut scenario));
        subscription::destroy_for_testing(sub);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 4, location=subscription_v1::subscription)]
    fun backwards_renewal_period_is_denied() {
        let mut scenario = ts::begin(SUBSCRIBER);
        let mut sub = new_subscription(&mut scenario);

        ts::next_tx(&mut scenario, PROVIDER);
        subscription::activate_subscription(&mut sub, b"sha256-activation-proof", ts::ctx(&mut scenario));
        subscription::renew_subscription(&mut sub, 1_783_684_800, b"sha256-backwards-renewal", ts::ctx(&mut scenario));
        subscription::destroy_for_testing(sub);
        ts::end(scenario);
    }

    fun new_subscription(scenario: &mut ts::Scenario): subscription::Subscription {
        subscription::start_subscription(
            SUBSCRIBER,
            PROVIDER,
            b"plan-research-feed-monthly",
            b"sha256-subscription-terms",
            1_781_092_800,
            1_783_684_800,
            b"idem-subscription-test",
            b"receipt-subscription-test",
            ts::ctx(scenario),
        )
    }
}
