#[test_only]
module escrow_v1::escrow_tests {
    use escrow_v1::escrow;
    use iota::coin::{Self, Coin};
    use iota::iota::IOTA;
    use iota::test_scenario as ts;

    const OWNER: address = @0xA11CE;
    const PROVIDER: address = @0xB0B;
    const VERIFIER: address = @0xC0DE;
    const REFUND_AUTHORITY: address = @0xCAFE;
    const REFUND_DESTINATION: address = @0xF00D;
    const FEE_RECIPIENT: address = @0xFEE;
    const ATTACKER: address = @0xBAD;

    #[test]
    fun funded_open_locks_payment_terms() {
        let mut scenario = ts::begin(OWNER);
        let payment = coin::mint_for_testing<IOTA>(100, ts::ctx(&mut scenario));
        let escrow = escrow::open<IOTA>(
            payment,
            OWNER,
            PROVIDER,
            VERIFIER,
            REFUND_AUTHORITY,
            REFUND_DESTINATION,
            100,
            90,
            10,
            FEE_RECIPIENT,
            b"idem-1",
            b"receipt-1",
            b"reference-1",
            1000,
            false,
            ts::ctx(&mut scenario),
        );

        assert!(escrow::status(&escrow) == escrow::status_open(), 0);
        assert!(escrow::balance(&escrow) == 100, 0);
        assert!(escrow::payer(&escrow) == OWNER, 0);
        assert!(escrow::payee(&escrow) == PROVIDER, 0);
        assert!(escrow::release_authority(&escrow) == VERIFIER, 0);
        assert!(escrow::refund_authority(&escrow) == REFUND_AUTHORITY, 0);
        assert!(escrow::refund_destination(&escrow) == REFUND_DESTINATION, 0);
        assert!(escrow::payee_amount(&escrow) == 90, 0);
        assert!(escrow::fee_amount(&escrow) == 10, 0);
        assert!(escrow::fee_recipient(&escrow) == FEE_RECIPIENT, 0);
        assert!(*escrow::idempotency_key(&escrow) == b"idem-1", 0);
        assert!(*escrow::receipt_id(&escrow) == b"receipt-1", 0);
        assert!(*escrow::reference_id(&escrow) == b"reference-1", 0);
        assert!(escrow::refund_after_epoch_ms(&escrow) == 1000, 0);
        assert!(!escrow::allow_payee_release(&escrow), 0);
        assert!(escrow::asset(&escrow).length() > 0, 0);
        escrow::destroy_for_testing(escrow);
        ts::end(scenario);
    }

    #[test]
    fun authorized_release_pays_configured_split() {
        let mut scenario = ts::begin(OWNER);
        let mut escrow = funded_escrow(&mut scenario, false, 1000);

        ts::next_tx(&mut scenario, VERIFIER);
        escrow::release(&mut escrow, b"sha256-release-proof", ts::ctx(&mut scenario));

        assert!(escrow::status(&escrow) == escrow::status_released(), 0);
        assert!(escrow::balance(&escrow) == 0, 0);
        assert!(*escrow::release_proof_hash(&escrow) == b"sha256-release-proof", 0);
        escrow::destroy_for_testing(escrow);

        ts::next_tx(&mut scenario, OWNER);
        let provider_coin = ts::take_from_address<Coin<IOTA>>(&scenario, PROVIDER);
        let fee_coin = ts::take_from_address<Coin<IOTA>>(&scenario, FEE_RECIPIENT);
        assert!(coin::value(&provider_coin) == 90, 0);
        assert!(coin::value(&fee_coin) == 10, 0);
        coin::burn_for_testing(provider_coin);
        coin::burn_for_testing(fee_coin);
        ts::end(scenario);
    }

    #[test]
    fun configured_refund_authority_returns_full_balance_to_refund_destination() {
        let mut scenario = ts::begin(OWNER);
        let mut escrow = funded_escrow(&mut scenario, false, 1000);

        ts::next_tx(&mut scenario, REFUND_AUTHORITY);
        escrow::refund(&mut escrow, b"provider-timeout", ts::ctx(&mut scenario));

        assert!(escrow::status(&escrow) == escrow::status_refunded(), 0);
        assert!(escrow::balance(&escrow) == 0, 0);
        assert!(*escrow::refund_reason(&escrow) == b"provider-timeout", 0);
        escrow::destroy_for_testing(escrow);

        ts::next_tx(&mut scenario, OWNER);
        let refund_coin = ts::take_from_address<Coin<IOTA>>(&scenario, REFUND_DESTINATION);
        assert!(coin::value(&refund_coin) == 100, 0);
        coin::burn_for_testing(refund_coin);
        ts::end(scenario);
    }

    #[test]
    fun timeout_refund_returns_full_balance_without_reroute() {
        let mut scenario = ts::begin(OWNER);
        let mut escrow = funded_escrow(&mut scenario, false, 50);

        ts::later_epoch(&mut scenario, 60, ATTACKER);
        escrow::refund_after_timeout(&mut escrow, b"timeout", ts::ctx(&mut scenario));

        assert!(escrow::status(&escrow) == escrow::status_expired(), 0);
        assert!(escrow::balance(&escrow) == 0, 0);
        escrow::destroy_for_testing(escrow);

        ts::next_tx(&mut scenario, OWNER);
        let refund_coin = ts::take_from_address<Coin<IOTA>>(&scenario, REFUND_DESTINATION);
        assert!(coin::value(&refund_coin) == 100, 0);
        coin::burn_for_testing(refund_coin);
        ts::end(scenario);
    }

    #[test]
    fun payee_can_self_release_only_when_policy_allows_it() {
        let mut scenario = ts::begin(OWNER);
        let mut escrow = funded_escrow(&mut scenario, true, 1000);

        ts::next_tx(&mut scenario, PROVIDER);
        escrow::release(&mut escrow, b"sha256-provider-release", ts::ctx(&mut scenario));

        assert!(escrow::status(&escrow) == escrow::status_released(), 0);
        escrow::destroy_for_testing(escrow);

        ts::next_tx(&mut scenario, OWNER);
        let provider_coin = ts::take_from_address<Coin<IOTA>>(&scenario, PROVIDER);
        let fee_coin = ts::take_from_address<Coin<IOTA>>(&scenario, FEE_RECIPIENT);
        coin::burn_for_testing(provider_coin);
        coin::burn_for_testing(fee_coin);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 2, location=escrow_v1::escrow)]
    fun payee_self_release_is_denied_without_policy() {
        let mut scenario = ts::begin(OWNER);
        let mut escrow = funded_escrow(&mut scenario, false, 1000);

        ts::next_tx(&mut scenario, PROVIDER);
        escrow::release(&mut escrow, b"sha256-release-proof", ts::ctx(&mut scenario));
        escrow::destroy_for_testing(escrow);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 3, location=escrow_v1::escrow)]
    fun verifier_cannot_refund_unless_configured_as_refund_authority() {
        let mut scenario = ts::begin(OWNER);
        let mut escrow = funded_escrow(&mut scenario, false, 1000);

        ts::next_tx(&mut scenario, VERIFIER);
        escrow::refund(&mut escrow, b"silent-reroute-attempt", ts::ctx(&mut scenario));
        escrow::destroy_for_testing(escrow);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 6, location=escrow_v1::escrow)]
    fun timeout_refund_is_denied_before_deadline() {
        let mut scenario = ts::begin(OWNER);
        let mut escrow = funded_escrow(&mut scenario, false, 1000);

        ts::next_tx(&mut scenario, ATTACKER);
        escrow::refund_after_timeout(&mut escrow, b"early-timeout", ts::ctx(&mut scenario));
        escrow::destroy_for_testing(escrow);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 5, location=escrow_v1::escrow)]
    fun invalid_split_is_denied_at_open() {
        let mut scenario = ts::begin(OWNER);
        let payment = coin::mint_for_testing<IOTA>(100, ts::ctx(&mut scenario));
        let escrow = escrow::open<IOTA>(
            payment,
            OWNER,
            PROVIDER,
            VERIFIER,
            REFUND_AUTHORITY,
            REFUND_DESTINATION,
            100,
            90,
            9,
            FEE_RECIPIENT,
            b"idem-invalid-split",
            b"receipt-invalid-split",
            b"reference-invalid-split",
            1000,
            false,
            ts::ctx(&mut scenario),
        );
        escrow::destroy_for_testing(escrow);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 8, location=escrow_v1::escrow)]
    fun past_refund_deadline_is_denied_at_open() {
        let mut scenario = ts::begin(OWNER);
        ts::later_epoch(&mut scenario, 60, OWNER);
        let payment = coin::mint_for_testing<IOTA>(100, ts::ctx(&mut scenario));
        let escrow = escrow::open<IOTA>(
            payment,
            OWNER,
            PROVIDER,
            VERIFIER,
            REFUND_AUTHORITY,
            REFUND_DESTINATION,
            100,
            90,
            10,
            FEE_RECIPIENT,
            b"idem-past-refund-deadline",
            b"receipt-past-refund-deadline",
            b"reference-past-refund-deadline",
            50,
            false,
            ts::ctx(&mut scenario),
        );
        escrow::destroy_for_testing(escrow);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 7, location=escrow_v1::escrow)]
    fun open_requires_payer_to_match_transaction_sender() {
        let mut scenario = ts::begin(ATTACKER);
        let payment = coin::mint_for_testing<IOTA>(100, ts::ctx(&mut scenario));
        let escrow = escrow::open<IOTA>(
            payment,
            OWNER,
            PROVIDER,
            VERIFIER,
            REFUND_AUTHORITY,
            REFUND_DESTINATION,
            100,
            90,
            10,
            FEE_RECIPIENT,
            b"idem-wrong-payer",
            b"receipt-wrong-payer",
            b"reference-wrong-payer",
            1000,
            false,
            ts::ctx(&mut scenario),
        );
        escrow::destroy_for_testing(escrow);
        ts::end(scenario);
    }

    fun funded_escrow(scenario: &mut ts::Scenario, allow_payee_release: bool, refund_after_epoch_ms: u64): escrow::Escrow<IOTA> {
        let payment = coin::mint_for_testing<IOTA>(100, ts::ctx(scenario));
        escrow::open<IOTA>(
            payment,
            OWNER,
            PROVIDER,
            VERIFIER,
            REFUND_AUTHORITY,
            REFUND_DESTINATION,
            100,
            90,
            10,
            FEE_RECIPIENT,
            b"idem-funded",
            b"receipt-funded",
            b"reference-funded",
            refund_after_epoch_ms,
            allow_payee_release,
            ts::ctx(scenario),
        )
    }
}
