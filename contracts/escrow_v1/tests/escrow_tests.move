#[test_only]
module escrow_v1::escrow_tests {
    use escrow_v1::escrow;
    use iota::test_scenario as ts;

    const OWNER: address = @0xA11CE;
    const PROVIDER: address = @0xB0B;
    const VERIFIER: address = @0xC0DE;
    const ATTACKER: address = @0xBAD;

    #[test]
    fun create_and_release_escrow() {
        let mut scenario = ts::begin(OWNER);
        let mut escrow = escrow::create(
            OWNER,
            PROVIDER,
            VERIFIER,
            100,
            b"USD",
            b"idem-1",
            b"receipt-1",
            ts::ctx(&mut scenario),
        );

        ts::next_tx(&mut scenario, VERIFIER);
        escrow::release(&mut escrow, b"sha256-release-proof", ts::ctx(&mut scenario));

        assert!(escrow::status(&escrow) == escrow::status_released(), 0);
        assert!(*escrow::release_proof_hash(&escrow) == b"sha256-release-proof", 0);
        escrow::destroy_for_testing(escrow);
        ts::end(scenario);
    }

    #[test]
    fun create_and_refund_escrow() {
        let mut scenario = ts::begin(OWNER);
        let mut escrow = escrow::create(
            OWNER,
            PROVIDER,
            VERIFIER,
            100,
            b"USD",
            b"idem-2",
            b"receipt-2",
            ts::ctx(&mut scenario),
        );

        escrow::refund(&mut escrow, b"provider-timeout", ts::ctx(&mut scenario));

        assert!(escrow::status(&escrow) == escrow::status_refunded(), 0);
        assert!(*escrow::refund_reason(&escrow) == b"provider-timeout", 0);
        escrow::destroy_for_testing(escrow);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 1, location=escrow_v1::escrow)]
    fun double_release_is_denied() {
        let mut scenario = ts::begin(VERIFIER);
        let mut escrow = escrow::create(
            OWNER,
            PROVIDER,
            VERIFIER,
            100,
            b"USD",
            b"idem-3",
            b"receipt-3",
            ts::ctx(&mut scenario),
        );

        escrow::release(&mut escrow, b"sha256-release-proof", ts::ctx(&mut scenario));
        escrow::release(&mut escrow, b"sha256-second-release-proof", ts::ctx(&mut scenario));
        escrow::destroy_for_testing(escrow);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 2, location=escrow_v1::escrow)]
    fun unauthorized_verifier_is_denied() {
        let mut scenario = ts::begin(OWNER);
        let mut escrow = escrow::create(
            OWNER,
            PROVIDER,
            VERIFIER,
            100,
            b"USD",
            b"idem-4",
            b"receipt-4",
            ts::ctx(&mut scenario),
        );

        ts::next_tx(&mut scenario, ATTACKER);
        escrow::release(&mut escrow, b"sha256-release-proof", ts::ctx(&mut scenario));
        escrow::destroy_for_testing(escrow);
        ts::end(scenario);
    }
}
