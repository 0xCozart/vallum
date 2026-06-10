# External API Notes

Last refreshed: 2026-06-10.

These notes are implementation guardrails, not a substitute for current official
documentation. Recheck every touched API at the start of the relevant slice.

## IOTA Gas Station

Sources:

- https://docs.iota.org/operator/gas-station/
- https://www.iota.org/products/gas-station
- https://github.com/iotaledger/gas-station

Current planning assumptions:

- Gas Station is self-hosted by the application provider.
- Production or commercial sponsorship is not provided network-wide by the IOTA
  Foundation.
- The component supports configurable access control, usage metrics, limits, gas
  coin pool management, and JSON-RPC-style sponsorship/reservation APIs.
- The current official API reference describes an HTTP API secured with Bearer
  Token authentication for gas reservations and transaction execution.
- Gas Station deployments are associated with sponsor wallets; pool deployments
  can share sponsor address and persistent storage.
- Gas Station access policy has a deny-all mode and an allow-all mode. Agentic
  GasKit must use deny-by-default policy before adapter execution.
- The implementation must support mock mode before relying on Docker, Redis,
  localnet, or testnet.

Implementation checks:

- Verify authentication behavior and bearer token requirements.
- Verify reservation/use-gas API shape.
- Verify current Docker and Redis setup.
- Verify current localnet/testnet fullnode URLs.
- Verify error cases for reservation, gas exhaustion, submission failure, and
  reinitialization.

## IOTA Move And TypeScript Tooling

Sources:

- https://docs.iota.org/developer/iota-101/move-overview/
- https://docs.iota.org/developer/ts-sdk/dapp-kit/
- https://docs.iota.org/developer/getting-started/install-iota
- https://docs.iota.org/developer/references/cli/move
- https://docs.iota.org/developer/getting-started/build-test

Current planning assumptions:

- IOTA Move uses object-centric state with programmable IOTA objects and
  explicit transaction inputs.
- TypeScript tooling exists through IOTA SDK/dApp Kit packages.
- Current npm package checks found `@iota/iota-sdk@1.14.0` and
  `@iota/dapp-kit@0.10.2`.
- The official CLI docs describe `iota move build`, `iota move test`, and
  `iota move test --path PATH` for package testing.
- Localnet is installed through a separate `iota-localnet` binary from the IOTA
  repository testnet branch.
- Slice 0.1 keeps the contract command tolerant of missing local IOTA CLI while
  preserving the real `iota move test --path contracts/escrow_v1` execution
  path.
- On 2026-06-09, the official install docs and GitHub latest release were
  rechecked. The Linux x86_64 release archive
  `iota-v1.24.0-linux-x86_64.tgz` provided `iota 1.24.0-2afd70dd05d1`; with
  that binary on `PATH`, `pnpm test:contracts` ran real Move tests for
  `contracts/escrow_v1` and `contracts/receipt_v1`.
- On 2026-06-09, the localnet docs were rechecked. `iota-localnet start
  --force-regenesis --with-faucet --committee-size 1 --fullnode-rpc-port 9000`
  started a local JSON-RPC node, a throwaway temp client received faucet gas,
  and `iota client publish ... --json` successfully published `escrow_v1` and
  `receipt_v1` to localnet.
- On 2026-06-09, Slice 3.2 rechecked the official IOTA CLI docs for Move
  package workflow. The documented flow still uses `iota move build`, `iota
  move test`, `iota client gas`, faucet funding on non-mainnet networks, and
  `iota client publish .` from the package directory.

Implementation checks:

- Verify package names and install commands.
- Verify localnet and Move test commands.
- Verify programmable transaction block APIs.
- Verify how package addresses and upgrades should be tracked for policy.

## IOTA Identity

Sources:

- https://www.iota.org/products/identity
- https://docs.iota.org/developer/iota-identity/explanations/decentralized-identifiers
- https://docs.iota.org/developer/iota-identity/explanations/verifiable-credentials
- https://docs.iota.org/developer/iota-identity/how-tos/decentralized-identifiers/create
- https://docs.iota.org/developer/iota-identity/how-tos/decentralized-identifiers/resolve
- https://docs.iota.org/developer/iota-identity/how-tos/verifiable-credentials/create
- https://docs.iota.org/developer/iota-identity/how-tos/verifiable-credentials/revocation
- https://github.com/iotaledger/identity

Current planning assumptions:

- IOTA Identity supports W3C-aligned DIDs and verifiable credentials.
- Rust and WASM tooling are available for identity management and resolution.
- Identity is appropriate for owner DID, agent DID, capability credentials, and
  revocation design, but exact APIs must be refreshed before implementation.
- Current docs describe DIDs as resolvable to DID Documents containing public
  keys and URIs, and state that IOTA follows the W3C DID specification and the
  `iota` DID method.
- Current docs describe VC issuance and validation as DID-backed: issuers sign
  credentials, public verification material is on the network, and the
  credential itself is stored/transmitted off-chain.
- Current revocation docs describe credential revocation through
  `credentialStatus` and revocation methods including `RevocationBitmap2022`
  and `StatusList2021`. The local Agent Profile schema therefore records
  credential refs, issuer DID, credential status, and revocation references
  without trying to validate live credentials in Slice 2.1.
- On 2026-06-10, Slice 2.3 rechecked the current IOTA Identity docs and
  repository. The current TypeScript examples use `@iota/identity-wasm/node`
  with `@iota/iota-sdk/client`, `IdentityClientReadOnly.createWithPkgId`,
  `Resolver`, and `resolveDid`/`resolve`-style DID document resolution.
- The current Verifiable Credential docs describe JWT credential creation and
  validation where issuers sign credentials and verifiers validate semantic
  structure, signatures against issuer DID Documents, issuance dates, expiry,
  and optional validation settings. Credentials are sent and stored off-chain.
- The current revocation docs still describe `credentialStatus` plus
  `RevocationBitmap2022` and `StatusList2021`; removing a verification method
  can also invalidate credentials signed with that method.
- Slice 2.3 implements dependency-injected Identity adapter interfaces around
  those current DID-resolution and credential-validation shapes. It does not
  import `@iota/identity-wasm`, create live identities, validate live
  credential JWTs, or run localnet/testnet Identity commands.

Implementation checks:

- Keep live DID resolution behind an injected resolver compatible with
  `resolveDid(did)` or `Resolver.resolve(did)`.
- Keep live JWT credential validation behind an injected validator compatible
  with the current IOTA Identity credential-validation examples.
- Verify revocation mechanism and cache strategy before enabling live protected
  actions.
- Verify whether profile metadata should be on-chain, off-chain, or hybrid.

## IOTA Names

Sources:

- https://github.com/iotaledger/iota-names
- https://docs.iota.org/developer/references/iota-api/iota-graphql/reference/operations/queries/resolve-iota-names-address
- https://docs.iota.org/developer/references/iota-api/iota-graphql/reference/types/objects/address

Current planning assumptions:

- IOTA Names has an official repository and mainnet release.
- It is plausible to use IOTA Names as the human-readable agent name/address
  layer.
- Current IOTA GraphQL docs expose `resolveIotaNamesAddress(name: String!):
  Address` for forward resolution.
- The returned GraphQL `Address` object exposes the `address: IotaAddress!`
  field. Slice 2.3 therefore uses the query shape
  `resolveIotaNamesAddress(name: $name) { address }`.
- The `Address` object also exposes `iotaNamesDefaultName` and
  `iotaNamesRegistrations`, which may support later reverse/default-name
  checks, but those checks are not part of Slice 2.3.
- Current IOTA Names repository local setup uses `iota-localnet`, CLI
  `--graphql http://127.0.0.1:9125`, `iota name register first.iota`, and a
  feature-enabled IOTA binary for names testing.
- The exact metadata, expiry, reverse lookup, and profile-binding model is not
  proven by the local docs and remains a Phase 2 refresh item.
- Slice 2.1 keeps profile metadata outside direct Names assumptions. Names can
  bind the human-readable name to a target address first; richer profile
  metadata is modeled as local/test metadata until adapter slices prove storage
  and lookup behavior.
- On 2026-06-10, Slice 2.3 rechecked the GraphQL and repository docs above and
  implemented a dependency-injected Names GraphQL adapter. The adapter can use
  a real GraphQL endpoint, but automated tests use mock GraphQL responses only.
- Slice 2.3 binds the resolved IOTA Names target address to Agent Profile
  metadata from an injected profile source. It fails closed if the name is not
  found, the GraphQL response is malformed, no profile metadata is available,
  profile validation fails, the profile name differs from the resolved name, or
  the profile wallet address differs from the resolved IOTA Names address.

Implementation checks:

- Verify current name registration and resolution APIs before any live run.
- Verify reverse lookup/default-name support before enforcing reverse binding.
- Verify whether and how target address, expiry, NFT/object id, and metadata can
  be queried.
- Verify whether Agent Profile metadata must live outside the name record.

Manual localnet/testnet resolution path, not run in Slice 2.3:

1. Use a feature-enabled IOTA binary that supports IOTA Names.
2. Start localnet with GraphQL enabled, for example the repository-documented
   `iota-localnet start --force-regenesis --with-faucet --with-indexer --with-graphql`.
3. Configure the CLI with RPC and GraphQL endpoints, for example
   `iota client new-env --alias localnet --rpc http://127.0.0.1:9000 --graphql http://127.0.0.1:9125`
   and `iota client switch --env localnet`.
4. Request faucet gas with `iota client faucet`.
5. Initialize the IOTA Names packages with the upstream repository scripts.
6. Register a test name such as `iota name register first.iota`.
7. Query the GraphQL endpoint with:

   ```graphql
   query ResolveIotaNamesAddress($name: String!) {
     resolveIotaNamesAddress(name: $name) {
       address
     }
   }
   ```

8. Configure a local Agent Profile metadata source whose wallet address matches
   the returned address, then run the Agentic GasKit resolver against that
   endpoint.

Do not run the manual path without explicit operator intent, local credentials,
and a disposable localnet/testnet environment.

## MCP

Sources:

- https://github.com/modelcontextprotocol/modelcontextprotocol
- https://modelcontextprotocol.io/
- https://ts.sdk.modelcontextprotocol.io/
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports

Current planning assumptions:

- MCP has an official specification, schema, and documentation.
- Agentic GasKit should expose MCP tools for IOTA operations.
- MCP tools must not bypass the policy gateway for sponsored or value-bearing
  actions.
- Current npm package check found `@modelcontextprotocol/sdk@1.29.0`.
- Current transport docs include stdio transport where client launches the
  server as a subprocess and JSON-RPC messages are newline-delimited over
  stdin/stdout. Future HTTP transport choices must be refreshed during the MCP
  slice.
- On 2026-06-09, Slice 3.2 rechecked the MCP specification. The latest stable
  spec page is `2025-11-25`; tool definitions remain server-exposed,
  model-controlled capabilities identified by unique names and described by
  input schemas. MCP schema guidance still uses JSON Schema for protocol
  validation. A `2026-07-28` release candidate exists, but it is future-dated
  relative to this slice and should be treated as a follow-up compatibility
  review rather than the current implementation target.

Implementation checks:

- Verify current MCP SDK package and transport choices.
- Verify tool schema and error response conventions.
- Verify auth/permission guidance.
- Verify inspector or smoke-test tooling.

## x402

Sources:

- https://docs.x402.org/introduction
- https://www.x402.org/
- https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md
- https://github.com/x402-foundation/x402/blob/main/typescript/packages/core/src/types/payments.ts
- https://github.com/x402-foundation/x402/blob/main/typescript/packages/core/src/types/facilitator.ts

Current planning assumptions:

- x402 is an open HTTP 402-based payment standard for programmatic API/content
  payments.
- x402 flows include buyer request, `402 Payment Required`, payment payload,
  verification/settlement, and resource delivery.
- Agentic GasKit should support x402 rather than replace it.
- Current docs say servers can verify/settle independently or use facilitator
  `/verify` and `/settle` endpoints.
- Current facilitator docs describe the facilitator as an independent
  verification and settlement layer that helps servers confirm payments and
  submit on-chain transactions without direct chain infrastructure.
- On 2026-06-10, Slice 4.1 rechecked current x402 docs/specs. The documented HTTP
  flow still starts with `402 Payment Required`, then client payment payload,
  facilitator or local `/verify`, facilitator or local `/settle`, and resource
  delivery only after a valid payment path.
- Current v2 TypeScript types define `PaymentRequired` with `x402Version`,
  `resource`, and `accepts`; each payment requirement carries `scheme`,
  `network`, `asset`, `amount`, `payTo`, `maxTimeoutSeconds`, and `extra`.
- Current facilitator docs say the resource server advertises requirements in a
  Base64-encoded `PAYMENT-REQUIRED` header, the client sends a Base64-encoded
  `PAYMENT-SIGNATURE` header, `/verify` checks payment payload plus payment
  details, `/settle` submits the payment, and the server returns
  `PAYMENT-RESPONSE` as Base64-encoded settlement JSON.
- Current network docs use CAIP-2 network identifiers such as `eip155:<chainId>`
  and require clients/facilitators to explicitly support `(scheme, network)`
  pairs.
- Current idempotency extension docs define `payment-identifier`; clients can
  include a unique payment id in payment payload extensions, and servers can use
  it to deduplicate retries.
- Future implementation must model duplicate settlement/idempotency separately
  from IOTA receipt state, especially for chains/schemes that need settlement
  caches.

Implementation checks:

- Verify current protocol version.
- Verify facilitator `/verify` and `/settle` behavior.
- Verify supported payment schemes and networks.
- Verify receipt/idempotency support.
- Verify redaction requirements for payment metadata.

## AP2

Sources:

- https://ap2-protocol.org/ap2/specification/
- https://github.com/google-agentic-commerce/AP2/blob/main/docs/ap2/specification.md
- https://github.com/google-agentic-commerce/AP2/blob/main/code/sdk/schemas/ap2/checkout_mandate.json
- https://github.com/google-agentic-commerce/AP2/blob/main/code/sdk/schemas/ap2/payment_mandate.json
- https://github.com/google-agentic-commerce/AP2/blob/main/code/sdk/schemas/ap2/checkout_receipt.json
- https://github.com/google-agentic-commerce/AP2/blob/main/code/sdk/schemas/ap2/payment_receipt.json
- https://github.com/google-agentic-commerce/AP2/blob/main/code/sdk/schemas/ap2/types/amount.json
- https://github.com/google-agentic-commerce/AP2/blob/main/code/sdk/schemas/ap2/types/receipt_status.json

Current planning assumptions:

- AP2 v0.2 defines checkout mandates, payment mandates, receipts, dispute
  evidence, and role responsibilities.
- AP2 distinguishes agentic and non-agentic roles and treats trusted surfaces as
  non-agentic.
- Agentic GasKit manifests should be able to map to AP2-style mandates.
- Current AP2 v0.2 docs define two mandate types: Checkout Mandate and Payment
  Mandate.
- Current docs distinguish Human Present direct mode from Human Not Present
  autonomous mode. Autonomous mode requires agent public-key confirmation
  material and constrained open mandates.
- On 2026-06-10, Slice 4.2 rechecked the AP2 v0.2 specification and current
  JSON schemas. AP2 still
  defines Checkout Mandates and Payment Mandates as linked evidence for
  agent-performed payments, and it identifies mandate schema versions through
  exact `vct` strings. The closed checkout/payment mandates use
  `mandate.checkout.1` and `mandate.payment.1`; open mandates use
  `mandate.checkout.open.1` and `mandate.payment.open.1`.
- Current payment amount schema uses minor-unit integer `amount` plus a
  three-letter ISO-4217 `currency`.
- Current payment receipt schema requires `status`, `iss`, `iat`,
  `reference`, and `payment_id`; receipt status is `Success` or `Error`.
- Current AP2 docs require the Trusted Surface role to be non-agentic. They
  also state that deterministic validation and processing must be performed
  regardless of whether another role is agentic.
- Current AP2 dispute guidance links Checkout Mandate/Receipt and Payment
  Mandate/Receipt; verification recomputes checkout hashes and checks receipt
  references against the corresponding mandate hashes.
- AP2 dispute evidence combines checkout mandate/receipt and payment
  mandate/receipt. Agentic GasKit receipts must preserve those links rather
  than collapsing them into one payment boolean.
- Slice 4.2 implements a local compatibility bridge only. It maps closed AP2
  checkout/payment mandates to Agentic GasKit manifests, preserves mandate and
  receipt references for dispute evidence, redacts private mandate/payment
  material, and fails closed for unsupported AP2 `vct` strings. It does not
  operate AP2, payment credentials, real PSP/PISP rails, or production
  settlement.

Implementation checks:

- Verify current AP2 version and `vct` strings before any follow-up change.
- Verify mandate and receipt schemas before adding open-mandate support.
- Verify dispute evidence fields.
- Verify how AP2 sample x402 flows model human-present and autonomous
  scenarios.

## A2A

Sources:

- https://github.com/a2aproject/A2A
- https://github.com/a2aproject/A2A/blob/main/docs/specification.md
- https://a2a-protocol.org/latest/specification
- Current Google codelab examples, only as compatibility notes.

Current planning assumptions:

- A2A discovery centers on an Agent Card-style JSON metadata document.
- The Agent Profile should be mappable to A2A discovery fields after current
  schema verification.
- A2A is active and has recent releases; do not freeze Agent Card path or field
  names from old examples.
- Current A2A spec describes the Agent Card as JSON metadata for identity,
  capabilities, skills, service endpoint, and authentication requirements.
- Current A2A spec discovery uses
  `https://{server_domain}/.well-known/agent-card.json` and registers the
  `agent-card.json` well-known suffix.
- Some current examples still publish cards at `/.well-known/agent.json`; treat
  that as legacy/example compatibility, not the canonical implementation target.
- Current spec requires supported protocol/interface declaration and uses
  `application/a2a+json` for HTTP+JSON/REST binding.
- Slice 2.1 records MCP endpoint, A2A endpoint, Agent Card URL, capabilities,
  credential refs, and payment methods so Phase 4 can map Agent Profile data to
  A2A Agent Card fields without replacing A2A.
- On 2026-06-09, Slice 4.3 rechecked the latest A2A specification. The Agent
  Card required fields include `name`, `description`, `supportedInterfaces`,
  `version`, `capabilities`, `defaultInputModes`, `defaultOutputModes`, and
  `skills`.
- Current A2A Agent Card interface declarations use `supportedInterfaces` with
  `url`, `protocolBinding`, and `protocolVersion`; core protocol bindings
  include `JSONRPC`, `GRPC`, and `HTTP+JSON`.
- Current A2A authentication discovery uses `securitySchemes` plus
  `securityRequirements`, with security scheme variants shaped after OpenAPI
  security scheme objects.
- Current A2A Agent Card capabilities include `streaming`,
  `pushNotifications`, `extensions`, and `extendedAgentCard`. Agentic GasKit
  profile context should be carried as a public extension declaration rather
  than an ad hoc root field.
- The well-known registration states that public Agent Cards should not include
  sensitive credentials or internal implementation details. Agentic GasKit must
  not emit profile credential refs or revocation refs into the public card.

Implementation checks:

- Verify current official repository/spec URL.
- Verify the Agent Card path and required fields.
- Verify auth scheme representation.
- Verify task/message/artifact schema only if implementing more than discovery.
