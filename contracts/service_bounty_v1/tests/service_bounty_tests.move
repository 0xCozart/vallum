#[test_only]
module service_bounty_v1::service_bounty_tests {
    use service_bounty_v1::service_bounty;
    use iota::test_scenario as ts;

    const REQUESTER: address = @0xA11CE;
    const PROVIDER: address = @0xB0B;
    const ATTACKER: address = @0xBAD;

    #[test]
    fun post_complete_and_release_bounty() {
        let mut scenario = ts::begin(REQUESTER);
        let mut bounty = service_bounty::post_bounty(
            REQUESTER,
            PROVIDER,
            1200,
            b"USD",
            b"bounty-research-summary-1",
            b"sha256-expected-deliverable",
            b"idem-service-bounty-1",
            b"receipt-service-bounty-1",
            ts::ctx(&mut scenario),
        );

        ts::next_tx(&mut scenario, PROVIDER);
        service_bounty::complete_bounty(&mut bounty, b"sha256-completion-proof", ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, REQUESTER);
        service_bounty::release_bounty(&mut bounty, b"sha256-release-proof", ts::ctx(&mut scenario));

        assert!(service_bounty::status(&bounty) == service_bounty::status_released(), 0);
        assert!(*service_bounty::completion_proof_hash(&bounty) == b"sha256-completion-proof", 0);
        assert!(*service_bounty::release_proof_hash(&bounty) == b"sha256-release-proof", 0);
        service_bounty::destroy_for_testing(bounty);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 2, location=service_bounty_v1::service_bounty)]
    fun unauthorized_completion_is_denied() {
        let mut scenario = ts::begin(REQUESTER);
        let mut bounty = new_bounty(&mut scenario);

        ts::next_tx(&mut scenario, ATTACKER);
        service_bounty::complete_bounty(&mut bounty, b"sha256-stolen-completion", ts::ctx(&mut scenario));
        service_bounty::destroy_for_testing(bounty);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 3, location=service_bounty_v1::service_bounty)]
    fun unauthorized_release_is_denied() {
        let mut scenario = ts::begin(REQUESTER);
        let mut bounty = new_bounty(&mut scenario);

        ts::next_tx(&mut scenario, PROVIDER);
        service_bounty::complete_bounty(&mut bounty, b"sha256-completion-proof", ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, ATTACKER);
        service_bounty::release_bounty(&mut bounty, b"sha256-stolen-release", ts::ctx(&mut scenario));
        service_bounty::destroy_for_testing(bounty);
        ts::end(scenario);
    }

    #[test]
    fun requester_can_cancel_before_release() {
        let mut scenario = ts::begin(REQUESTER);
        let mut bounty = new_bounty(&mut scenario);

        service_bounty::cancel_bounty(&mut bounty, b"requester-cancelled", ts::ctx(&mut scenario));

        assert!(service_bounty::status(&bounty) == service_bounty::status_cancelled(), 0);
        assert!(*service_bounty::cancellation_reason(&bounty) == b"requester-cancelled", 0);
        service_bounty::destroy_for_testing(bounty);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 1, location=service_bounty_v1::service_bounty)]
    fun released_bounty_cannot_cancel() {
        let mut scenario = ts::begin(REQUESTER);
        let mut bounty = new_bounty(&mut scenario);

        ts::next_tx(&mut scenario, PROVIDER);
        service_bounty::complete_bounty(&mut bounty, b"sha256-completion-proof", ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, REQUESTER);
        service_bounty::release_bounty(&mut bounty, b"sha256-release-proof", ts::ctx(&mut scenario));
        service_bounty::cancel_bounty(&mut bounty, b"late-cancel", ts::ctx(&mut scenario));
        service_bounty::destroy_for_testing(bounty);
        ts::end(scenario);
    }

    fun new_bounty(scenario: &mut ts::Scenario): service_bounty::ServiceBounty {
        service_bounty::post_bounty(
            REQUESTER,
            PROVIDER,
            1200,
            b"USD",
            b"bounty-research-summary-1",
            b"sha256-expected-deliverable",
            b"idem-service-bounty-test",
            b"receipt-service-bounty-test",
            ts::ctx(scenario),
        )
    }
}
