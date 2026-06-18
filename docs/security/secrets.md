# Secrets Handling

Never commit `.env`, private keys, tokens, or service credentials.

Use examples with placeholders only:

```env
GAS_STATION_KEYPAIR=replace-with-local-secret
GAS_STATION_AUTH=replace-with-random-token
JWT_SECRET=replace-with-random-secret
```

Before pushing public changes, run the tracked/unignored repository scan:

```bash
npm run secrets:scan
```

That command intentionally skips ignored local operator files such as `.env`
and `deploy/gas-station/config.local.yaml`. To inspect expected ignored local
secret paths without printing values, run the opt-in workstation preflight:

```bash
npm run secrets:scan:local
```

`secrets:scan:local` reports path category and finding class only. It is not
part of `verify:fast` or `verify:local` because local credentials are expected
on operator machines, but a finding means the workspace is not safe to share,
copy, screenshot, or use as production evidence.

Before attempting a real sponsored testnet transaction, run:

```bash
npm run readiness:testnet
```

The readiness preflight prints variable names and pass/fail messages, not secret values. If it fails, fix the local `.env`; do not paste real secrets into issues, PRs, chats, screenshots, or logs.
