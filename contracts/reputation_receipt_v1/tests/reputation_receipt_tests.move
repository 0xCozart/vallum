#[test_only]
module reputation_receipt_v1::reputation_receipt_tests {
    use reputation_receipt_v1::reputation_receipt;
    use iota::test_scenario as ts;

    const ISSUER: address = @0xA11CE;
    const SUBJECT: address = @0xB0B;
    const ATTACKER: address = @0xBAD;

    #[test]
    fun create_and_attest_reputation_receipt() {
        let mut scenario = ts::begin(ISSUER);
        let mut receipt = reputation_receipt::create_receipt(
            ISSUER,
            SUBJECT,
            b"task-research-summary-1",
            b"sha256-reputation-criteria",
            b"idem-reputation-1",
            b"receipt-reputation-1",
            ts::ctx(&mut scenario),
        );

        reputation_receipt::attest_reputation(
            &mut receipt,
            5,
            b"sha256-reputation-evidence",
            b"sha256-reputation-attestation",
            ts::ctx(&mut scenario),
        );

        assert!(reputation_receipt::status(&receipt) == reputation_receipt::status_attested(), 0);
        assert!(reputation_receipt::score(&receipt) == 5, 0);
        assert!(*reputation_receipt::evidence_hash(&receipt) == b"sha256-reputation-evidence", 0);
        assert!(*reputation_receipt::attestation_hash(&receipt) == b"sha256-reputation-attestation", 0);
        reputation_receipt::destroy_for_testing(receipt);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 2, location=reputation_receipt_v1::reputation_receipt)]
    fun unauthorized_create_is_denied() {
        let mut scenario = ts::begin(ATTACKER);
        let receipt = reputation_receipt::create_receipt(
            ISSUER,
            SUBJECT,
            b"task-research-summary-1",
            b"sha256-reputation-criteria",
            b"idem-reputation-unauthorized",
            b"receipt-reputation-unauthorized",
            ts::ctx(&mut scenario),
        );
        reputation_receipt::destroy_for_testing(receipt);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 2, location=reputation_receipt_v1::reputation_receipt)]
    fun unauthorized_attestation_is_denied() {
        let mut scenario = ts::begin(ISSUER);
        let mut receipt = new_receipt(&mut scenario);

        ts::next_tx(&mut scenario, ATTACKER);
        reputation_receipt::attest_reputation(
            &mut receipt,
            5,
            b"sha256-stolen-evidence",
            b"sha256-stolen-attestation",
            ts::ctx(&mut scenario),
        );
        reputation_receipt::destroy_for_testing(receipt);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 3, location=reputation_receipt_v1::reputation_receipt)]
    fun invalid_score_is_denied() {
        let mut scenario = ts::begin(ISSUER);
        let mut receipt = new_receipt(&mut scenario);

        reputation_receipt::attest_reputation(
            &mut receipt,
            6,
            b"sha256-reputation-evidence",
            b"sha256-reputation-attestation",
            ts::ctx(&mut scenario),
        );
        reputation_receipt::destroy_for_testing(receipt);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 1, location=reputation_receipt_v1::reputation_receipt)]
    fun attested_receipt_cannot_fail() {
        let mut scenario = ts::begin(ISSUER);
        let mut receipt = new_receipt(&mut scenario);

        reputation_receipt::attest_reputation(
            &mut receipt,
            5,
            b"sha256-reputation-evidence",
            b"sha256-reputation-attestation",
            ts::ctx(&mut scenario),
        );
        reputation_receipt::fail_receipt(&mut receipt, b"late-failure", ts::ctx(&mut scenario));
        reputation_receipt::destroy_for_testing(receipt);
        ts::end(scenario);
    }

    fun new_receipt(scenario: &mut ts::Scenario): reputation_receipt::ReputationReceipt {
        reputation_receipt::create_receipt(
            ISSUER,
            SUBJECT,
            b"task-research-summary-1",
            b"sha256-reputation-criteria",
            b"idem-reputation-test",
            b"receipt-reputation-test",
            ts::ctx(scenario),
        )
    }
}
