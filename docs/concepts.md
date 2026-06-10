# IOTA and GasKit Basics

This page is for readers who are new to IOTA, sponsored gas, or GasKit. You do not need to understand every blockchain detail before using the project. The useful mental model is simple:

GasKit helps an app pay IOTA network fees for its users, while giving the app
operator controls over who gets sponsored, how much they can spend, and what can
be executed. Agentic GasKit extends that model to agents by adding signer
references, manifests, receipts, and policy-scoped execution.

## The Problem in Plain English

Most Web3 apps ask users to do several things before the app feels useful:

1. Create or connect a wallet.
2. Buy or receive the network token.
3. Keep enough token available to pay transaction fees.
4. Understand why a small fee is needed before clicking a button.

That is a lot of setup for a user who only wants to claim a badge, mint an item, update a record, or use an app feature.

IOTA Gas Station solves the fee-payment part by letting a sponsor cover the transaction fee. GasKit adds the app-facing safety layer around that flow, so sponsorship can be authenticated, policy-controlled, budgeted, and observable.

## IOTA in Plain English

IOTA is a public network for applications that need shared records, digital assets, and smart contracts. A transaction changes something on the network: it may create an object, move an asset, call a smart contract, or update state.

The current IOTA developer stack is based on the Rebased protocol and MoveVM. For GasKit users, the important ideas are:

- A transaction changes network state.
- Gas is the network fee paid to execute that transaction.
- A wallet signs transactions so the network knows the user approved the action.
- Smart contracts are application rules that run on-chain.
- Move is the smart contract language used by the IOTA stack.
- Objects are on-chain items with identity and ownership.
- Coin objects are the IOTA objects used to pay gas.
- Testnet is for testing with no-value tokens; Mainnet is the live network.

You can use GasKit without becoming a Move developer, but these terms explain why the architecture is shaped the way it is.

## What Sponsored Gas Means

Sponsored gas means the user still approves the action, but someone else pays the network fee.

There are three roles:

- User: the person or wallet initiating the action.
- Sponsor: the app, company, operator, or service funding the gas.
- Gas Station: the service that provides sponsor-owned gas objects and signs the sponsorship side.

The user does not give the sponsor custody of their assets. The user still signs the transaction. The sponsor only decides whether it is willing to pay the fee for that transaction.

## Where GasKit Fits

The official IOTA Gas Station is the lower-level sponsored-transaction component. It manages sponsor gas coins, exposes reserve and execute APIs, and can be self-hosted by an app provider.

GasKit sits in front of that official service:

```text
User or dApp
  -> app backend
  -> GasKit SDK or Policy Gateway
  -> official IOTA Gas Station
  -> IOTA network
```

GasKit exists because most applications need more than a raw gas-sponsorship API. They need app keys, package allowlists, per-wallet limits, safe errors, usage events, local smoke tests, and integration examples.

## The Sponsored Transaction Flow

The normal GasKit flow looks like this:

1. The app builds the transaction the user wants to perform.
2. The backend asks GasKit whether this transaction should be sponsored.
3. GasKit checks app credentials, wallet limits, package/function policy, and gas budget.
4. If allowed, GasKit asks IOTA Gas Station to reserve sponsor gas.
5. The user signs the transaction.
6. GasKit executes through the Gas Station path with the reservation and user signature.
7. GasKit emits sanitized decision events so the operator can see what was allowed or rejected.

The important safety property is that the browser does not hold sponsor secrets. Browser code should call your backend, and the backend should call GasKit.

## Why We Built GasKit This Way

Gas sponsorship is useful only if the sponsor can control risk. A sponsor wallet is a funded operational asset. If a public endpoint can spend from it without policy, attackers can drain testnet quota, create mainnet costs, or abuse sponsorship for transactions the app never intended to support.

GasKit therefore separates the system into layers:

- SDK: gives app backends a typed way to call the gateway.
- Policy Gateway: makes the allow or reject decision before touching the Gas Station.
- Policy config: lets operators define what apps, packages, functions, wallets, and budgets are allowed.
- Usage events: explain what happened without logging secrets or raw transaction payloads.
- Docs and smoke tests: make the local proof path repeatable before any live sponsor wallet is used.

This shape is more cautious than calling IOTA Gas Station directly from a frontend, but it is the right default for a funded sponsor wallet.

## Terms You Will See

| Term | Plain-English meaning |
| --- | --- |
| dApp | An application that uses a blockchain or public ledger as part of its backend. |
| Wallet | The user's signing tool. It proves the user approved a transaction. |
| Agent wallet | A wallet created for an agent workflow. Agentic GasKit should expose it through a scoped signer reference, not raw seed material. |
| Signer reference | An opaque handle to a signing capability. It is not bearer authorization by itself. |
| Gas | The network fee required to execute a transaction. |
| Sponsor wallet | The wallet funded by the operator to pay sponsored gas. |
| Gas Station | The service that provides sponsor-owned gas and signs the sponsorship side. |
| GasKit | This toolkit: SDK, gateway, docs, tests, and operator patterns around sponsored gas. |
| Policy | Rules that decide whether a sponsorship request is allowed. |
| Package ID | The on-chain identifier for a deployed Move package. Allowlisting package IDs limits what code can be sponsored. |
| Function name | The Move function the app expects to call. Allowlisting functions narrows sponsorship further. |
| Reservation | A short-lived claim on sponsor gas for a specific request. |
| Execute | The step that sends the signed transaction through the sponsored path. |
| PTB | Programmable Transaction Block. A transaction shape that can combine multiple commands. |
| RPC | The network API endpoint used to talk to IOTA nodes. |
| KMS | Key Management Service. A safer production place to hold signing keys than app memory or plain files. |

## What GasKit Is Not

- It is not a replacement for the official IOTA Gas Station.
- It is not a wallet.
- It does not custody user assets.
- It does not expose raw agent wallet seeds as a normal API.
- It does not treat signer references as standalone authorization.
- It does not make network fees disappear; it moves fee payment to the sponsor.
- It does not make a raw public sponsor wallet safe by itself; operators still need policy, limits, monitoring, and secret hygiene.
- It is not yet a complete production managed service.

## Official Reading

- [IOTA Documentation](https://docs.iota.org/)
- [IOTA Network Overview](https://docs.iota.org/developer/network-overview)
- [Sponsored Transactions on IOTA](https://docs.iota.org/developer/iota-101/transactions/sponsored-transactions/about-sponsored-transactions)
- [IOTA Gas Station](https://docs.iota.org/operator/gas-station/)
- [IOTA Gas Station Architecture](https://docs.iota.org/operator/gas-station/architecture/)
- [IOTA Gas Station Product Page](https://www.iota.org/products/gas-station)
