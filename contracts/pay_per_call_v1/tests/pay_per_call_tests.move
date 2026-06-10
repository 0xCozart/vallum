#[test_only]
module pay_per_call_v1::pay_per_call_tests {
    use pay_per_call_v1::pay_per_call;
    use iota::test_scenario as ts;

    const BUYER: address = @0xA11CE;
    const PROVIDER: address = @0xB0B;
    const ATTACKER: address = @0xBAD;

    #[test]
    fun create_and_deliver_paid_call() {
        let mut scenario = ts::begin(BUYER);
        let mut call = pay_per_call::create(
            BUYER,
            PROVIDER,
            25,
            b"USD",
            b"analysis_tool",
            b"idem-paid-call-1",
            b"receipt-paid-call-1",
            ts::ctx(&mut scenario),
        );

        ts::next_tx(&mut scenario, PROVIDER);
        pay_per_call::deliver(&mut call, b"sha256-paid-result", ts::ctx(&mut scenario));

        assert!(pay_per_call::status(&call) == pay_per_call::status_delivered(), 0);
        assert!(*pay_per_call::result_hash(&call) == b"sha256-paid-result", 0);
        pay_per_call::destroy_for_testing(call);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 2, location=pay_per_call_v1::pay_per_call)]
    fun unauthorized_delivery_is_denied() {
        let mut scenario = ts::begin(BUYER);
        let mut call = pay_per_call::create(
            BUYER,
            PROVIDER,
            25,
            b"USD",
            b"analysis_tool",
            b"idem-paid-call-2",
            b"receipt-paid-call-2",
            ts::ctx(&mut scenario),
        );

        ts::next_tx(&mut scenario, ATTACKER);
        pay_per_call::deliver(&mut call, b"sha256-stolen-result", ts::ctx(&mut scenario));
        pay_per_call::destroy_for_testing(call);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 1, location=pay_per_call_v1::pay_per_call)]
    fun double_delivery_is_denied() {
        let mut scenario = ts::begin(PROVIDER);
        let mut call = pay_per_call::create(
            BUYER,
            PROVIDER,
            25,
            b"USD",
            b"analysis_tool",
            b"idem-paid-call-3",
            b"receipt-paid-call-3",
            ts::ctx(&mut scenario),
        );

        pay_per_call::deliver(&mut call, b"sha256-paid-result", ts::ctx(&mut scenario));
        pay_per_call::deliver(&mut call, b"sha256-paid-result-again", ts::ctx(&mut scenario));
        pay_per_call::destroy_for_testing(call);
        ts::end(scenario);
    }

    #[test]
    fun refund_prevents_later_delivery() {
        let mut scenario = ts::begin(BUYER);
        let mut call = pay_per_call::create(
            BUYER,
            PROVIDER,
            25,
            b"USD",
            b"analysis_tool",
            b"idem-paid-call-4",
            b"receipt-paid-call-4",
            ts::ctx(&mut scenario),
        );

        pay_per_call::refund(&mut call, b"payment-failed", ts::ctx(&mut scenario));

        assert!(pay_per_call::status(&call) == pay_per_call::status_refunded(), 0);
        assert!(*pay_per_call::refund_reason(&call) == b"payment-failed", 0);
        pay_per_call::destroy_for_testing(call);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 1, location=pay_per_call_v1::pay_per_call)]
    fun refunded_call_cannot_deliver() {
        let mut scenario = ts::begin(BUYER);
        let mut call = pay_per_call::create(
            BUYER,
            PROVIDER,
            25,
            b"USD",
            b"analysis_tool",
            b"idem-paid-call-5",
            b"receipt-paid-call-5",
            ts::ctx(&mut scenario),
        );

        pay_per_call::refund(&mut call, b"payment-failed", ts::ctx(&mut scenario));
        ts::next_tx(&mut scenario, PROVIDER);
        pay_per_call::deliver(&mut call, b"sha256-late-result", ts::ctx(&mut scenario));
        pay_per_call::destroy_for_testing(call);
        ts::end(scenario);
    }
}
