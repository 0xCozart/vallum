/// Minimal AgentRail data-license state contract.
///
/// This MVP records license access state and proof hashes. It does not custody
/// funds, issue private access tokens, or enforce legal terms.
module data_license_v1::data_license {
    const EInvalidStatus: u64 = 1;
    const EUnauthorizedProvider: u64 = 2;

    const STATUS_PENDING: u8 = 0;
    const STATUS_GRANTED: u8 = 1;
    const STATUS_REVOKED: u8 = 2;

    public struct DataLicense has key, store {
        id: UID,
        buyer: address,
        provider: address,
        price: u64,
        asset: vector<u8>,
        dataset_id: vector<u8>,
        terms_hash: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        status: u8,
        access_proof_hash: vector<u8>,
        revocation_reason: vector<u8>,
    }

    public fun request_license(
        buyer: address,
        provider: address,
        price: u64,
        asset: vector<u8>,
        dataset_id: vector<u8>,
        terms_hash: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        ctx: &mut TxContext,
    ): DataLicense {
        DataLicense {
            id: object::new(ctx),
            buyer,
            provider,
            price,
            asset,
            dataset_id,
            terms_hash,
            idempotency_key,
            receipt_id,
            status: STATUS_PENDING,
            access_proof_hash: vector[],
            revocation_reason: vector[],
        }
    }

    public fun create(
        buyer: address,
        provider: address,
        price: u64,
        asset: vector<u8>,
        dataset_id: vector<u8>,
        terms_hash: vector<u8>,
        idempotency_key: vector<u8>,
        receipt_id: vector<u8>,
        ctx: &mut TxContext,
    ): DataLicense {
        request_license(buyer, provider, price, asset, dataset_id, terms_hash, idempotency_key, receipt_id, ctx)
    }

    public fun grant_access(license: &mut DataLicense, access_proof_hash: vector<u8>, ctx: &TxContext) {
        assert!(license.status == STATUS_PENDING, EInvalidStatus);
        assert!(tx_context::sender(ctx) == license.provider, EUnauthorizedProvider);
        license.status = STATUS_GRANTED;
        license.access_proof_hash = access_proof_hash;
    }

    public fun revoke_access(license: &mut DataLicense, revocation_reason: vector<u8>, ctx: &TxContext) {
        assert!(license.status == STATUS_PENDING || license.status == STATUS_GRANTED, EInvalidStatus);
        assert!(tx_context::sender(ctx) == license.provider, EUnauthorizedProvider);
        license.status = STATUS_REVOKED;
        license.revocation_reason = revocation_reason;
    }

    public fun status(license: &DataLicense): u8 {
        license.status
    }

    public fun status_pending(): u8 {
        STATUS_PENDING
    }

    public fun status_granted(): u8 {
        STATUS_GRANTED
    }

    public fun status_revoked(): u8 {
        STATUS_REVOKED
    }

    public fun buyer(license: &DataLicense): address {
        license.buyer
    }

    public fun provider(license: &DataLicense): address {
        license.provider
    }

    public fun price(license: &DataLicense): u64 {
        license.price
    }

    public fun asset(license: &DataLicense): &vector<u8> {
        &license.asset
    }

    public fun dataset_id(license: &DataLicense): &vector<u8> {
        &license.dataset_id
    }

    public fun terms_hash(license: &DataLicense): &vector<u8> {
        &license.terms_hash
    }

    public fun idempotency_key(license: &DataLicense): &vector<u8> {
        &license.idempotency_key
    }

    public fun receipt_id(license: &DataLicense): &vector<u8> {
        &license.receipt_id
    }

    public fun access_proof_hash(license: &DataLicense): &vector<u8> {
        &license.access_proof_hash
    }

    public fun revocation_reason(license: &DataLicense): &vector<u8> {
        &license.revocation_reason
    }

    #[test_only]
    public fun destroy_for_testing(license: DataLicense) {
        let DataLicense {
            id,
            buyer: _,
            provider: _,
            price: _,
            asset: _,
            dataset_id: _,
            terms_hash: _,
            idempotency_key: _,
            receipt_id: _,
            status: _,
            access_proof_hash: _,
            revocation_reason: _,
        } = license;
        id.delete();
    }
}
