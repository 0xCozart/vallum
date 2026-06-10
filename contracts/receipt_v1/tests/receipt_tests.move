#[test_only]
module receipt_v1::receipt_tests {
    use receipt_v1::receipt;

    const OWNER: address = @0xA11CE;

    #[test]
    fun receipt_updates_through_release_lifecycle() {
        let mut ctx = tx_context::dummy();
        let mut receipt = receipt::create(
            b"receipt-1",
            b"manifest-1",
            b"idem-1",
            b"agent-1",
            OWNER,
            &mut ctx,
        );

        receipt::approve(&mut receipt);
        receipt::sponsor(&mut receipt, b"sponsorship-1");
        receipt::submit(&mut receipt, b"digest-1");
        receipt::complete(&mut receipt, b"evidence-1");
        receipt::release(&mut receipt);

        assert!(receipt::status(&receipt) == receipt::status_released(), 0);
        assert!(*receipt::sponsorship_id(&receipt) == b"sponsorship-1", 0);
        assert!(*receipt::transaction_digest(&receipt) == b"digest-1", 0);
        assert!(*receipt::evidence_hash(&receipt) == b"evidence-1", 0);
        receipt::destroy_for_testing(receipt);
    }

    #[test]
    fun denied_receipt_is_terminal() {
        let mut ctx = tx_context::dummy();
        let mut receipt = receipt::create(
            b"receipt-2",
            b"manifest-2",
            b"idem-2",
            b"agent-2",
            OWNER,
            &mut ctx,
        );

        receipt::deny(&mut receipt, b"policy-denied");

        assert!(receipt::status(&receipt) == receipt::status_denied(), 0);
        assert!(*receipt::terminal_reason(&receipt) == b"policy-denied", 0);
        receipt::destroy_for_testing(receipt);
    }

    #[test]
    fun completed_receipt_can_refund_before_release() {
        let mut ctx = tx_context::dummy();
        let mut receipt = receipt::create(
            b"receipt-3",
            b"manifest-3",
            b"idem-3",
            b"agent-3",
            OWNER,
            &mut ctx,
        );

        receipt::approve(&mut receipt);
        receipt::sponsor(&mut receipt, b"sponsorship-3");
        receipt::submit(&mut receipt, b"digest-3");
        receipt::complete(&mut receipt, b"evidence-3");
        receipt::refund(&mut receipt, b"verifier-rejected");

        assert!(receipt::status(&receipt) == receipt::status_refunded(), 0);
        assert!(*receipt::terminal_reason(&receipt) == b"verifier-rejected", 0);
        receipt::destroy_for_testing(receipt);
    }

    #[test]
    #[expected_failure(abort_code = 1, location=receipt_v1::receipt)]
    fun released_receipt_cannot_refund() {
        let mut ctx = tx_context::dummy();
        let mut receipt = receipt::create(
            b"receipt-4",
            b"manifest-4",
            b"idem-4",
            b"agent-4",
            OWNER,
            &mut ctx,
        );

        receipt::approve(&mut receipt);
        receipt::sponsor(&mut receipt, b"sponsorship-4");
        receipt::submit(&mut receipt, b"digest-4");
        receipt::complete(&mut receipt, b"evidence-4");
        receipt::release(&mut receipt);
        receipt::refund(&mut receipt, b"too-late");
        receipt::destroy_for_testing(receipt);
    }
}
