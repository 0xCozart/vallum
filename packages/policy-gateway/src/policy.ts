import type {
  PolicyDecision,
  SponsorshipPolicy,
  SponsorshipRequestContext,
} from "@sacredlabs/agentrail-shared-types";

function reject(reasonCode: Exclude<PolicyDecision, { allowed: true }>["reasonCode"], message: string): PolicyDecision {
  return { allowed: false, reasonCode, message };
}

function hasConfiguredAllowlist(values: string[] | undefined): values is string[] {
  return Array.isArray(values) && values.length > 0;
}

export function evaluateSponsorshipPolicy(
  policy: SponsorshipPolicy,
  request: SponsorshipRequestContext,
): PolicyDecision {
  if (!request.authenticated) {
    return reject("AUTH_MISSING", "A valid app API key is required.");
  }

  if (request.appId !== policy.appId) {
    return reject("AUTH_INVALID", "The app credentials do not match this policy.");
  }

  if (policy.appStatus === "disabled") {
    return reject("APP_DISABLED", "This app is disabled and cannot sponsor transactions.");
  }

  if (
    typeof policy.dailyRequestLimit === "number" &&
    typeof request.appRequestsToday === "number" &&
    request.appRequestsToday >= policy.dailyRequestLimit
  ) {
    return reject("APP_DAILY_REQUEST_LIMIT_EXCEEDED", "The app daily request limit has been reached.");
  }

  if (
    typeof policy.dailyBudgetNanos === "number" &&
    typeof request.appGasReservedToday === "number" &&
    typeof request.gasBudget === "number" &&
    request.appGasReservedToday + request.gasBudget > policy.dailyBudgetNanos
  ) {
    return reject("APP_DAILY_BUDGET_EXCEEDED", "The app daily gas budget would be exceeded.");
  }

  if (
    typeof policy.maxGasBudgetPerTx === "number" &&
    typeof request.gasBudget === "number" &&
    request.gasBudget > policy.maxGasBudgetPerTx
  ) {
    return reject("GAS_BUDGET_TOO_HIGH", "The requested gas budget is higher than policy allows.");
  }

  if (request.walletAddress && policy.deniedWallets?.includes(request.walletAddress)) {
    return reject("WALLET_DENIED", "This wallet is denied by policy.");
  }

  if (
    typeof policy.maxRequestsPerWalletPerDay === "number" &&
    typeof request.walletRequestsToday === "number" &&
    request.walletRequestsToday >= policy.maxRequestsPerWalletPerDay
  ) {
    return reject("WALLET_DAILY_LIMIT_EXCEEDED", "This wallet reached its daily sponsorship limit.");
  }

  if (hasConfiguredAllowlist(policy.allowedPackages)) {
    if (!request.packageId) {
      return reject("PACKAGE_NOT_ALLOWED", "Package metadata is required when a package allowlist is configured.");
    }

    if (!policy.allowedPackages.includes(request.packageId)) {
      return reject("PACKAGE_NOT_ALLOWED", "The requested package is not allowlisted.");
    }
  }

  if (hasConfiguredAllowlist(policy.allowedFunctions)) {
    if (!request.functionName) {
      return reject("FUNCTION_NOT_ALLOWED", "Function metadata is required when a function allowlist is configured.");
    }

    if (!policy.allowedFunctions.includes(request.functionName)) {
      return reject("FUNCTION_NOT_ALLOWED", "The requested function is not allowlisted.");
    }
  }

  return { allowed: true };
}
