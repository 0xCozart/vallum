import assert from "node:assert/strict";
import { test } from "node:test";
import type { SponsorshipPolicy } from "@agentrail/shared-types";
import { evaluateSponsorshipPolicy } from "./policy.js";

const basePolicy: SponsorshipPolicy = {
  appId: "demo-dapp",
  appStatus: "active",
  dailyBudgetNanos: 10_000,
  dailyRequestLimit: 10,
  allowedPackages: ["0xpackage"],
  allowedFunctions: ["mint_badge"],
  deniedWallets: ["0xbadwallet"],
  maxRequestsPerWalletPerDay: 2,
  maxGasBudgetPerTx: 1_000,
};

test("missing auth rejects with AUTH_MISSING", () => {
  const decision = evaluateSponsorshipPolicy(basePolicy, {
    appId: "demo-dapp",
    authenticated: false,
  });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reasonCode, "AUTH_MISSING");
});

test("app ID mismatch rejects with AUTH_INVALID", () => {
  const decision = evaluateSponsorshipPolicy(basePolicy, {
    appId: "other-dapp",
    authenticated: true,
  });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reasonCode, "AUTH_INVALID");
});

test("disabled app rejects with APP_DISABLED", () => {
  const decision = evaluateSponsorshipPolicy(
    { ...basePolicy, appStatus: "disabled" },
    { appId: "demo-dapp", authenticated: true },
  );

  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reasonCode, "APP_DISABLED");
});

test("app daily request limit rejects with APP_DAILY_REQUEST_LIMIT_EXCEEDED", () => {
  const decision = evaluateSponsorshipPolicy(basePolicy, {
    appId: "demo-dapp",
    authenticated: true,
    appRequestsToday: 10,
  });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reasonCode, "APP_DAILY_REQUEST_LIMIT_EXCEEDED");
});

test("gas budget above per transaction maximum rejects with GAS_BUDGET_TOO_HIGH", () => {
  const decision = evaluateSponsorshipPolicy(basePolicy, {
    appId: "demo-dapp",
    authenticated: true,
    gasBudget: 1_001,
  });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reasonCode, "GAS_BUDGET_TOO_HIGH");
});

test("non allowlisted package rejects with PACKAGE_NOT_ALLOWED", () => {
  const decision = evaluateSponsorshipPolicy(basePolicy, {
    appId: "demo-dapp",
    authenticated: true,
    packageId: "0xotherpackage",
  });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reasonCode, "PACKAGE_NOT_ALLOWED");
});

test("missing package metadata fails closed when a package allowlist is configured", () => {
  const decision = evaluateSponsorshipPolicy(basePolicy, {
    appId: "demo-dapp",
    authenticated: true,
    functionName: "mint_badge",
  });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reasonCode, "PACKAGE_NOT_ALLOWED");
});

test("missing function metadata fails closed when a function allowlist is configured", () => {
  const decision = evaluateSponsorshipPolicy(basePolicy, {
    appId: "demo-dapp",
    authenticated: true,
    packageId: "0xpackage",
  });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reasonCode, "FUNCTION_NOT_ALLOWED");
});

test("non allowlisted function rejects with FUNCTION_NOT_ALLOWED", () => {
  const decision = evaluateSponsorshipPolicy(basePolicy, {
    appId: "demo-dapp",
    authenticated: true,
    packageId: "0xpackage",
    functionName: "burn_badge",
  });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reasonCode, "FUNCTION_NOT_ALLOWED");
});

test("denied wallet rejects with WALLET_DENIED", () => {
  const decision = evaluateSponsorshipPolicy(basePolicy, {
    appId: "demo-dapp",
    authenticated: true,
    walletAddress: "0xbadwallet",
  });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reasonCode, "WALLET_DENIED");
});

test("valid request is allowed", () => {
  const decision = evaluateSponsorshipPolicy(basePolicy, {
    appId: "demo-dapp",
    authenticated: true,
    walletAddress: "0xgoodwallet",
    packageId: "0xpackage",
    functionName: "mint_badge",
    gasBudget: 500,
    appRequestsToday: 0,
    walletRequestsToday: 0,
    appGasReservedToday: 0,
  });

  assert.equal(decision.allowed, true);
});
