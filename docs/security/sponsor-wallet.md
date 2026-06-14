# Sponsor Wallet Safety

The sponsor wallet pays gas for users. Treat it as a hot operational wallet with strict spending limits.

Rules:

- Use a fresh wallet for demos and production deployments.
- Do not reuse a wallet whose key appeared in a repo, chat, log, screenshot, or shared document.
- Keep demo/testnet and mainnet wallets separate.
- Start with low balances and explicit caps.
- Prefer KMS or an external signer for production.
- Document rotation steps before mainnet operation.

If a testnet faucet attempt fails, keep the sanitized report as triage context
for the funding request or live-proof status. Do not treat a failed faucet
report as reserve_gas compatibility evidence, and do not advance to upstream
diagnostics until `npm run sponsor:check-funding -- --report <ignored-path>`
shows enough sponsor balance and coin shape for the requested reserve budget.
