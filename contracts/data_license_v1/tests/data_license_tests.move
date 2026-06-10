#[test_only]
module data_license_v1::data_license_tests {
    use data_license_v1::data_license;
    use iota::test_scenario as ts;

    const BUYER: address = @0xA11CE;
    const PROVIDER: address = @0xB0B;
    const ATTACKER: address = @0xBAD;

    #[test]
    fun request_and_grant_data_license() {
        let mut scenario = ts::begin(BUYER);
        let mut license = data_license::request_license(
            BUYER,
            PROVIDER,
            750,
            b"USD",
            b"dataset-pricing-feed-v1",
            b"sha256-data-license-terms",
            b"idem-data-license-1",
            b"receipt-data-license-1",
            ts::ctx(&mut scenario),
        );

        ts::next_tx(&mut scenario, PROVIDER);
        data_license::grant_access(&mut license, b"sha256-access-proof", ts::ctx(&mut scenario));

        assert!(data_license::status(&license) == data_license::status_granted(), 0);
        assert!(*data_license::access_proof_hash(&license) == b"sha256-access-proof", 0);
        data_license::destroy_for_testing(license);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 2, location=data_license_v1::data_license)]
    fun unauthorized_grant_is_denied() {
        let mut scenario = ts::begin(BUYER);
        let mut license = data_license::request_license(
            BUYER,
            PROVIDER,
            750,
            b"USD",
            b"dataset-pricing-feed-v1",
            b"sha256-data-license-terms",
            b"idem-data-license-2",
            b"receipt-data-license-2",
            ts::ctx(&mut scenario),
        );

        ts::next_tx(&mut scenario, ATTACKER);
        data_license::grant_access(&mut license, b"sha256-stolen-access", ts::ctx(&mut scenario));
        data_license::destroy_for_testing(license);
        ts::end(scenario);
    }

    #[test]
    fun revoke_prevents_later_grant() {
        let mut scenario = ts::begin(PROVIDER);
        let mut license = data_license::request_license(
            BUYER,
            PROVIDER,
            750,
            b"USD",
            b"dataset-pricing-feed-v1",
            b"sha256-data-license-terms",
            b"idem-data-license-3",
            b"receipt-data-license-3",
            ts::ctx(&mut scenario),
        );

        data_license::revoke_access(&mut license, b"provider-rotated-key", ts::ctx(&mut scenario));

        assert!(data_license::status(&license) == data_license::status_revoked(), 0);
        assert!(*data_license::revocation_reason(&license) == b"provider-rotated-key", 0);
        data_license::destroy_for_testing(license);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 2, location=data_license_v1::data_license)]
    fun unauthorized_revoke_is_denied() {
        let mut scenario = ts::begin(BUYER);
        let mut license = data_license::request_license(
            BUYER,
            PROVIDER,
            750,
            b"USD",
            b"dataset-pricing-feed-v1",
            b"sha256-data-license-terms",
            b"idem-data-license-5",
            b"receipt-data-license-5",
            ts::ctx(&mut scenario),
        );

        ts::next_tx(&mut scenario, ATTACKER);
        data_license::revoke_access(&mut license, b"stolen-revoke", ts::ctx(&mut scenario));
        data_license::destroy_for_testing(license);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 1, location=data_license_v1::data_license)]
    fun revoked_license_cannot_grant() {
        let mut scenario = ts::begin(PROVIDER);
        let mut license = data_license::request_license(
            BUYER,
            PROVIDER,
            750,
            b"USD",
            b"dataset-pricing-feed-v1",
            b"sha256-data-license-terms",
            b"idem-data-license-4",
            b"receipt-data-license-4",
            ts::ctx(&mut scenario),
        );

        data_license::revoke_access(&mut license, b"provider-rotated-key", ts::ctx(&mut scenario));
        data_license::grant_access(&mut license, b"sha256-late-access", ts::ctx(&mut scenario));
        data_license::destroy_for_testing(license);
        ts::end(scenario);
    }
}
