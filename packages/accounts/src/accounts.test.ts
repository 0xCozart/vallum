import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCustodyProductionReviewSnapshot,
  createInMemoryWalletAccountStore,
  redactAccountValue,
  type CustodyProductionReviewCheckId,
  type CustodyProductionReviewStatus,
} from "./index.js";

const SECRET_PATTERNS = [
  /seed/i,
  /mnemonic/i,
  /private[_-]?key/i,
  /raw[_-]?keypair/i,
  /raw[_-]?transaction/i,
  /signature/i,
  /bearer/i,
  /api[_-]?key/i,
];

function assertNoSecretMaterial(value: unknown): void {
  const text = JSON.stringify(value);
  for (const pattern of SECRET_PATTERNS) {
    assert.equal(pattern.test(text), false, `returned value included secret-like field matching ${pattern}`);
  }
}

test("creates an in-memory wallet account with a scoped signer reference and no secret material", async () => {
  const store = createInMemoryWalletAccountStore();

  const account = await store.createWallet({
    ownerId: "owner:alice",
    agentId: "agent:quote-bot",
    requestedScopes: ["contract:quote", "budget:daily:1000000"],
    profileId: "profile:quote-bot",
  });

  assert.match(account.walletId, /^wallet_/);
  assert.match(account.address, /^0x[a-f0-9]{64}$/);
  assert.match(account.signerRef.value, /^signer_ref_/);
  assert.equal(account.signerRef.ownerId, "owner:alice");
  assert.equal(account.signerRef.agentId, "agent:quote-bot");
  assert.deepEqual(account.allowedScopes, ["contract:quote", "budget:daily:1000000"]);
  assert.equal(account.status, "active");
  assert.equal(account.profileId, "profile:quote-bot");
  assertNoSecretMaterial(account);
});

test("does not authorize signing from signer reference possession alone", async () => {
  const store = createInMemoryWalletAccountStore();
  const account = await store.createWallet({
    ownerId: "owner:alice",
    agentId: "agent:quote-bot",
    requestedScopes: ["contract:quote"],
  });

  assert.deepEqual(await store.authorizeSigning({ signerRef: account.signerRef.value }), {
    authorized: false,
    reasonCode: "OWNER_CONTEXT_REQUIRED",
    message: "Owner context is required before using a signer reference.",
  });

  assert.deepEqual(await store.authorizeSigning({
    signerRef: account.signerRef.value,
    ownerId: "owner:alice",
  }), {
    authorized: false,
    reasonCode: "AGENT_CONTEXT_REQUIRED",
    message: "Agent context is required before using a signer reference.",
  });

  assert.deepEqual(await store.authorizeSigning({
    signerRef: account.signerRef.value,
    ownerId: "owner:alice",
    agentId: "agent:quote-bot",
    scope: "contract:quote",
  }), {
    authorized: true,
    walletId: account.walletId,
    signerRef: account.signerRef,
  });
});

test("requires owner and agent context and enforces local creation limits", async () => {
  const store = createInMemoryWalletAccountStore({ maxWalletsPerOwnerAgent: 1 });

  await assert.rejects(
    () => store.createWallet({ ownerId: " ", agentId: "agent:quote-bot" }),
    /ownerId is required/,
  );
  await assert.rejects(
    () => store.createWallet({ ownerId: "owner:alice", agentId: " " }),
    /agentId is required/,
  );

  await store.createWallet({ ownerId: "owner:alice", agentId: "agent:quote-bot" });
  await assert.rejects(
    () => store.createWallet({ ownerId: "owner:alice", agentId: "agent:quote-bot" }),
    /wallet creation limit exceeded/,
  );
});

test("denies signing for disallowed scopes and inactive wallet states", async () => {
  const store = createInMemoryWalletAccountStore();
  const account = await store.createWallet({
    ownerId: "owner:alice",
    agentId: "agent:quote-bot",
    requestedScopes: ["contract:quote"],
  });

  assert.deepEqual(await store.authorizeSigning({
    signerRef: account.signerRef.value,
    ownerId: "owner:alice",
    agentId: "agent:quote-bot",
    scope: "contract:trade",
  }), {
    authorized: false,
    reasonCode: "SCOPE_NOT_ALLOWED",
    message: "Requested signing scope is not allowed for this wallet.",
  });

  for (const status of ["disabled", "revoked"] as const) {
    await store.setWalletStatus(account.walletId, status);
    assert.deepEqual(await store.authorizeSigning({
      signerRef: account.signerRef.value,
      ownerId: "owner:alice",
      agentId: "agent:quote-bot",
      scope: "contract:quote",
    }), {
      authorized: false,
      reasonCode: "WALLET_NOT_ACTIVE",
      message: "Wallet account is not active.",
    });
  }
});

test("denies recovery export with audit metadata and no secret material", async () => {
  const store = createInMemoryWalletAccountStore({ now: () => new Date("2026-06-10T12:00:00.000Z") });
  const account = await store.createWallet({ ownerId: "owner:alice", agentId: "agent:quote-bot" });

  const result = await store.requestRecoveryExport({
    walletId: account.walletId,
    actorId: "agent:quote-bot",
    reason: "agent requested backup",
  });

  assert.deepEqual(result, {
    allowed: false,
    reasonCode: "RECOVERY_EXPORT_UNSUPPORTED",
    message: "Recovery export is unsupported for autonomous agent runtime flows.",
    audit: {
      walletId: account.walletId,
      actorId: "agent:quote-bot",
      reason: "agent requested backup",
      requestedAt: "2026-06-10T12:00:00.000Z",
      destinationType: "none",
    },
  });
  assertNoSecretMaterial(result);
});

test("custody production review snapshot keeps missing operator checks pending and redacts notes", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const snapshot = createCustodyProductionReviewSnapshot({
    environment: "local",
    custodyMode: "local-in-memory",
    generatedAt: now,
    checks: [
      {
        id: "signer-reference-contract-review",
        status: "passed",
        observedAt: now,
        note: "Signer refs are scoped handles; signer_ref_fixture_123 is not enough.",
      },
      {
        id: "no-agent-secret-exposure-review",
        status: "passed",
        observedAt: now,
        note: "No privateKey=abc123, credential=provider_secret, or Bearer abc.def.ghi was returned.",
      },
    ],
  });
  const serialized = JSON.stringify(snapshot);

  assert.equal(snapshot.kind, "vallum.custody-production-review-snapshot");
  assert.equal(snapshot.result, "pending-operator-proof");
  assert.equal(snapshot.passedCheckIds.includes("signer-reference-contract-review"), true);
  assert.equal(snapshot.pendingCheckIds.includes("kms-external-signer-review"), true);
  assert.equal(snapshot.blockedCheckIds.length, 0);
  assert.ok(snapshot.blockerCodes.includes("CUSTODY_KMS_EXTERNAL_SIGNER_REVIEW_PENDING"));
  assert.doesNotMatch(serialized, /signer_ref_fixture|privateKey|provider_secret|Bearer abc/i);
});

test("custody production review snapshot distinguishes blocked and fully passed reviews", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const blocked = createCustodyProductionReviewSnapshot({
    environment: "testnet",
    custodyMode: "kms",
    generatedAt: now,
    checks: [
      ...allCustodyProductionChecks("passed"),
      { id: "recovery-export-review", status: "blocked", observedAt: now },
    ],
  });
  const passed = createCustodyProductionReviewSnapshot({
    environment: "production",
    custodyMode: "external-signer",
    generatedAt: now,
    checks: allCustodyProductionChecks("passed"),
  });

  assert.equal(blocked.result, "blocked");
  assert.equal(blocked.blockedCheckIds.includes("recovery-export-review"), true);
  assert.ok(blocked.blockerCodes.includes("CUSTODY_RECOVERY_EXPORT_REVIEW_BLOCKED"));
  assert.equal(passed.result, "passed");
  assert.equal(passed.pendingCheckIds.length, 0);
  assert.equal(passed.blockedCheckIds.length, 0);
});

test("redacts signer references and secret-looking fixture values", () => {
  const redacted = redactAccountValue({
    signerRef: {
      value: "signer_ref_owner_agent_123456",
      scopes: ["contract:quote"],
    },
    message: "privateKey=abc123 bearer token seed phrase signer_ref_inline_123",
    nested: {
      mnemonic: "word word word",
      api_key: "example-api-key",
    },
  });

  assert.deepEqual(redacted, {
    signerRef: {
      value: "[REDACTED]",
      scopes: ["contract:quote"],
    },
    message: "[REDACTED] [REDACTED] token [REDACTED] phrase signer_ref_[REDACTED]",
    nested: {
      mnemonic: "[REDACTED]",
      api_key: "[REDACTED]",
    },
  });
});

function allCustodyProductionChecks(status: CustodyProductionReviewStatus) {
  const ids = [
    "signer-reference-contract-review",
    "no-agent-secret-exposure-review",
    "kms-external-signer-review",
    "cryptographic-module-validation-review",
    "operator-access-review",
    "key-lifecycle-review",
    "recovery-export-review",
    "backup-restore-review",
    "rotation-revocation-review",
    "audit-logging-review",
    "legal-security-review",
    "incident-response-review",
    "redaction-review",
  ] as const satisfies readonly CustodyProductionReviewCheckId[];
  return ids.map((id) => ({ id, status, observedAt: new Date("2026-06-10T12:00:00.000Z") }));
}
