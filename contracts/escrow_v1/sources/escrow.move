/// Generic Vallum IOTA custody escrow.
///
/// Open consumes a payment coin and stores its balance inside the escrow
/// object. Release and refund transfer funds only to recipients configured at
/// open time; callers cannot supply payout destinations during settlement.
module escrow_v1::escrow {
    use iota::balance::{Self, Balance};
    use iota::coin::Coin;
    use std::type_name;

    const EInvalidStatus: u64 = 1;
    const EUnauthorizedRelease: u64 = 2;
    const EUnauthorizedRefund: u64 = 3;
    const EInvalidAmount: u64 = 4;
    const EInvalidSplit: u64 = 5;
    const ERefundNotAllowed: u64 = 6;
    const EUnauthorizedPayer: u64 = 7;
    const EInvalidRefundDeadline: u64 = 8;

    const STATUS_OPEN: u8 = 0;
    const STATUS_RELEASED: u8 = 1;
    const STATUS_REFUNDED: u8 = 2;
    const STATUS_EXPIRED: u8 = 3;

    public struct Escrow<phantom T> has key, store {
        id: UID,
        payer: address,
        payee: address,
        release_authority: address,
        refund_authority: address,
        refund_destination: address,
        amount: u64,
        payee_amount: u64,
        fee_amount: u64,
        fee_recipient: address,
        asset: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        reference_id: vector<u8>,
        refund_after_epoch_ms: u64,
        allow_payee_release: bool,
        status: u8,
        funds: Balance<T>,
        release_proof_hash: vector<u8>,
        refund_reason: vector<u8>,
    }

    public fun open<T>(
        payment: Coin<T>,
        payer: address,
        payee: address,
        release_authority: address,
        refund_authority: address,
        refund_destination: address,
        amount: u64,
        payee_amount: u64,
        fee_amount: u64,
        fee_recipient: address,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        reference_id: vector<u8>,
        refund_after_epoch_ms: u64,
        allow_payee_release: bool,
        ctx: &mut TxContext,
    ): Escrow<T> {
        assert!(amount > 0, EInvalidAmount);
        assert!(payment.value() == amount, EInvalidAmount);
        assert!(payee_amount <= amount && fee_amount == amount - payee_amount, EInvalidSplit);
        assert!(payer == tx_context::sender(ctx), EUnauthorizedPayer);
        assert!(
            refund_after_epoch_ms == 0 || refund_after_epoch_ms > tx_context::epoch_timestamp_ms(ctx),
            EInvalidRefundDeadline,
        );

        Escrow {
            id: object::new(ctx),
            payer,
            payee,
            release_authority,
            refund_authority,
            refund_destination,
            amount,
            payee_amount,
            fee_amount,
            fee_recipient,
            asset: type_name::get_with_original_ids<T>().into_string().into_bytes(),
            idempotency_key,
            receipt_id,
            reference_id,
            refund_after_epoch_ms: refund_after_epoch_ms,
            allow_payee_release,
            status: STATUS_OPEN,
            funds: payment.into_balance(),
            release_proof_hash: vector[],
            refund_reason: vector[],
        }
    }

    public fun create<T>(
        payment: Coin<T>,
        payer: address,
        payee: address,
        release_authority: address,
        refund_authority: address,
        refund_destination: address,
        amount: u64,
        payee_amount: u64,
        fee_amount: u64,
        fee_recipient: address,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        reference_id: vector<u8>,
        refund_after_epoch_ms: u64,
        allow_payee_release: bool,
        ctx: &mut TxContext,
    ): Escrow<T> {
        open(
            payment,
            payer,
            payee,
            release_authority,
            refund_authority,
            refund_destination,
            amount,
            payee_amount,
            fee_amount,
            fee_recipient,
            idempotency_key,
            receipt_id,
            reference_id,
            refund_after_epoch_ms,
            allow_payee_release,
            ctx,
        )
    }

    public entry fun open_shared<T>(
        payment: Coin<T>,
        payer: address,
        payee: address,
        release_authority: address,
        refund_authority: address,
        refund_destination: address,
        amount: u64,
        payee_amount: u64,
        fee_amount: u64,
        fee_recipient: address,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        reference_id: vector<u8>,
        refund_after_epoch_ms: u64,
        allow_payee_release: bool,
        ctx: &mut TxContext,
    ) {
        let escrow = open(
            payment,
            payer,
            payee,
            release_authority,
            refund_authority,
            refund_destination,
            amount,
            payee_amount,
            fee_amount,
            fee_recipient,
            idempotency_key,
            receipt_id,
            reference_id,
            refund_after_epoch_ms,
            allow_payee_release,
            ctx,
        );
        transfer::share_object(escrow);
    }

    public fun release<T>(escrow: &mut Escrow<T>, release_proof_hash: vector<u8>, ctx: &mut TxContext) {
        assert!(escrow.status == STATUS_OPEN, EInvalidStatus);
        let sender = tx_context::sender(ctx);
        assert!(
            sender == escrow.release_authority ||
            (escrow.allow_payee_release && sender == escrow.payee),
            EUnauthorizedRelease,
        );

        escrow.status = STATUS_RELEASED;
        escrow.release_proof_hash = release_proof_hash;
        pay_configured_split(escrow, ctx);
    }

    public fun refund<T>(escrow: &mut Escrow<T>, refund_reason: vector<u8>, ctx: &mut TxContext) {
        assert!(escrow.status == STATUS_OPEN, EInvalidStatus);
        assert!(tx_context::sender(ctx) == escrow.refund_authority, EUnauthorizedRefund);

        escrow.status = STATUS_REFUNDED;
        escrow.refund_reason = refund_reason;
        refund_all(escrow, ctx);
    }

    public fun refund_after_timeout<T>(escrow: &mut Escrow<T>, refund_reason: vector<u8>, ctx: &mut TxContext) {
        assert!(escrow.status == STATUS_OPEN, EInvalidStatus);
        assert!(escrow.refund_after_epoch_ms > 0, ERefundNotAllowed);
        assert!(tx_context::epoch_timestamp_ms(ctx) >= escrow.refund_after_epoch_ms, ERefundNotAllowed);

        escrow.status = STATUS_EXPIRED;
        escrow.refund_reason = refund_reason;
        refund_all(escrow, ctx);
    }

    public fun expire<T>(escrow: &mut Escrow<T>, refund_reason: vector<u8>, ctx: &mut TxContext) {
        refund_after_timeout(escrow, refund_reason, ctx)
    }

    fun pay_configured_split<T>(escrow: &mut Escrow<T>, ctx: &mut TxContext) {
        let payee_coin = escrow.funds.split(escrow.payee_amount).into_coin(ctx);
        transfer::public_transfer(payee_coin, escrow.payee);

        if (escrow.fee_amount > 0) {
            let fee_coin = escrow.funds.split(escrow.fee_amount).into_coin(ctx);
            transfer::public_transfer(fee_coin, escrow.fee_recipient);
        };
        assert!(escrow.funds.value() == 0, EInvalidSplit);
    }

    fun refund_all<T>(escrow: &mut Escrow<T>, ctx: &mut TxContext) {
        let refund_coin = escrow.funds.split(escrow.amount).into_coin(ctx);
        transfer::public_transfer(refund_coin, escrow.refund_destination);
        assert!(escrow.funds.value() == 0, EInvalidAmount);
    }

    public fun status<T>(escrow: &Escrow<T>): u8 {
        escrow.status
    }

    public fun status_open(): u8 {
        STATUS_OPEN
    }

    public fun status_released(): u8 {
        STATUS_RELEASED
    }

    public fun status_refunded(): u8 {
        STATUS_REFUNDED
    }

    public fun status_expired(): u8 {
        STATUS_EXPIRED
    }

    public fun owner<T>(escrow: &Escrow<T>): address {
        escrow.payer
    }

    public fun payer<T>(escrow: &Escrow<T>): address {
        escrow.payer
    }

    public fun provider<T>(escrow: &Escrow<T>): address {
        escrow.payee
    }

    public fun payee<T>(escrow: &Escrow<T>): address {
        escrow.payee
    }

    public fun verifier<T>(escrow: &Escrow<T>): address {
        escrow.release_authority
    }

    public fun release_authority<T>(escrow: &Escrow<T>): address {
        escrow.release_authority
    }

    public fun refund_authority<T>(escrow: &Escrow<T>): address {
        escrow.refund_authority
    }

    public fun refund_destination<T>(escrow: &Escrow<T>): address {
        escrow.refund_destination
    }

    public fun amount<T>(escrow: &Escrow<T>): u64 {
        escrow.amount
    }

    public fun payee_amount<T>(escrow: &Escrow<T>): u64 {
        escrow.payee_amount
    }

    public fun fee_amount<T>(escrow: &Escrow<T>): u64 {
        escrow.fee_amount
    }

    public fun fee_recipient<T>(escrow: &Escrow<T>): address {
        escrow.fee_recipient
    }

    public fun asset<T>(escrow: &Escrow<T>): &vector<u8> {
        &escrow.asset
    }

    public fun idempotency_key<T>(escrow: &Escrow<T>): &vector<u8> {
        &escrow.idempotency_key
    }

    public fun receipt_id<T>(escrow: &Escrow<T>): &vector<u8> {
        &escrow.receipt_id
    }

    public fun reference_id<T>(escrow: &Escrow<T>): &vector<u8> {
        &escrow.reference_id
    }

    public fun refund_after_epoch_ms<T>(escrow: &Escrow<T>): u64 {
        escrow.refund_after_epoch_ms
    }

    public fun allow_payee_release<T>(escrow: &Escrow<T>): bool {
        escrow.allow_payee_release
    }

    public fun balance<T>(escrow: &Escrow<T>): u64 {
        escrow.funds.value()
    }

    public fun release_proof_hash<T>(escrow: &Escrow<T>): &vector<u8> {
        &escrow.release_proof_hash
    }

    public fun refund_reason<T>(escrow: &Escrow<T>): &vector<u8> {
        &escrow.refund_reason
    }

    #[test_only]
    public fun destroy_for_testing<T>(escrow: Escrow<T>) {
        let Escrow {
            id,
            payer: _,
            payee: _,
            release_authority: _,
            refund_authority: _,
            refund_destination: _,
            amount: _,
            payee_amount: _,
            fee_amount: _,
            fee_recipient: _,
            asset: _,
            idempotency_key: _,
            receipt_id: _,
            reference_id: _,
            refund_after_epoch_ms: _,
            allow_payee_release: _,
            status: _,
            funds,
            release_proof_hash: _,
            refund_reason: _,
        } = escrow;
        balance::destroy_for_testing(funds);
        id.delete();
    }
}
