# Device Access Safety Gate

Last updated: 2026-06-10.

## Decision

Physical device operation remains blocked. Vallum may model device
access only as a future virtual or simulated workflow until safety,
authorization, provider accountability, and audit requirements are explicit.

This gate closes the current Phase 3 ambiguity around `device_access_lease_v1`.
The template is not implemented, deployed, published, or exposed through SDK,
MCP, A2A, marketplace, or docs examples. Any future implementation must start
with virtual or simulated devices only and must preserve the existing Vallum
policy, receipt, redaction, and signer-reference boundaries.

## Allowed Next Slice

A future implementation slice may build a **virtual device access lease** only
if it satisfies all of these constraints:

- No physical actuator, vehicle, medical, industrial, lock, access-control, or
  safety-critical system is controlled.
- The leased resource is a deterministic simulator, mock device, emulator, or
  non-physical API fixture.
- Access is represented as entitlement evidence, not an instruction to operate
  a real device.
- The SDK helper routes through `requestSponsoredAction` and the policy
  gateway.
- The receipt state records lease id, provider id, requester id, resource id,
  terms hash, start/end time, grant proof, revoke/expiry/failure evidence,
  sponsorship id, and transaction digest without device secrets or private
  payloads.
- Contract metadata uses a stable template id and version, and policy rejects
  unknown packages or mismatched versions.
- Demo output and docs label the proof as local/mock or virtual only.

## Blocked Until Explicit Approval

These surfaces remain out of scope:

- physical device control
- live door, vehicle, drone, robot, sensor-actuator, medical, industrial, or
  safety-critical access
- production provider onboarding or verification
- public marketplace listing for device access
- real-world safety enforcement, emergency stop, or regulatory compliance
- custody, staking, bonding, slashing, insurance, or legal lease automation
- live device credentials, private access tokens, or operator secrets

## Required Design Before Physical Device Work

Physical device access cannot start until a later owner-approved design records:

- device class and hazard analysis
- provider identity and accountability requirements
- requester authorization model
- revocation and emergency-stop semantics
- lease expiry behavior under network failure
- audit event retention and privacy rules
- dispute and incident response process
- live credential storage and rotation plan
- localnet/testnet proof path that cannot trigger real-world motion or access
- legal and regulatory review owner, if the device class requires one

## Verification For This Gate

This gate is verified by docs and regression tests only:

- docs state the physical-device blocker and virtual-only future path
- no `contracts/device_access_lease_v1` implementation is claimed
- no SDK, receipt, metadata, marketplace, MCP, or package script exposes device
  access as a working product path
- docs check and secret scan pass

## Known Unproven Claims

- No device access Move contract exists.
- No SDK helper exists.
- No receipt state exists.
- No local, localnet, testnet, or live device workflow exists.
- No physical safety, provider verification, compliance, or marketplace
  operation is proven.
