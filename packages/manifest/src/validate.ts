import { AGENT_TRANSACTION_MANIFEST_VERSION, type AgentTransactionManifest } from "./schema.js";

export type ManifestValidationErrorCode =
  | "MANIFEST_NOT_OBJECT"
  | "UNSUPPORTED_VERSION"
  | "REQUIRED_FIELD_MISSING"
  | "FIELD_INVALID"
  | "MANIFEST_EXPIRED"
  | "MANIFEST_TOO_LARGE"
  | "SECRET_FIELD_NOT_ALLOWED";

export interface ManifestValidationError {
  readonly code: ManifestValidationErrorCode;
  readonly path: string;
  readonly message: string;
}

export type ManifestValidationResult =
  | {
      readonly ok: true;
      readonly manifest: AgentTransactionManifest;
    }
  | {
      readonly ok: false;
      readonly errors: readonly ManifestValidationError[];
    };

export interface ManifestValidationOptions {
  readonly now?: Date;
  readonly maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 16 * 1024;

export function validateAgentTransactionManifest(
  value: unknown,
  options: ManifestValidationOptions = {},
): ManifestValidationResult {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (byteLength(value) > maxBytes) {
    return fail("MANIFEST_TOO_LARGE", "$", `Manifest exceeds ${maxBytes} bytes.`);
  }
  if (!isRecord(value)) {
    return fail("MANIFEST_NOT_OBJECT", "$", "Manifest must be a JSON object.");
  }
  if (value.version !== AGENT_TRANSACTION_MANIFEST_VERSION) {
    return fail("UNSUPPORTED_VERSION", "$.version", "Manifest version is unsupported.");
  }

  const manifest = value as unknown as AgentTransactionManifest;
  const errors: ManifestValidationError[] = [];

  rejectSecretFields(errors, value);
  requireParty(errors, manifest.agent, "$.agent");
  requireParty(errors, manifest.owner, "$.owner");
  requireParty(errors, manifest.counterparty, "$.counterparty");
  requireNonEmptyString(errors, manifest.intent, "$.intent");
  requirePositiveNumber(errors, manifest.spend?.maxGasBudget, "$.spend.maxGasBudget");
  requireNonEmptyString(errors, manifest.action?.packageId, "$.action.packageId");
  requireNonEmptyString(errors, manifest.action?.functionName, "$.action.functionName");
  requireOptionalNonEmptyString(errors, manifest.action?.templateId, "$.action.templateId");
  requireOptionalNonEmptyString(errors, manifest.action?.templateVersion, "$.action.templateVersion");
  requireNonEmptyString(errors, manifest.idempotencyKey, "$.idempotencyKey");
  requireNonEmptyString(errors, manifest.expiresAt, "$.expiresAt");
  requireArrayOfStrings(errors, manifest.scope, "$.scope");

  if (typeof manifest.expiresAt === "string" && manifest.expiresAt.trim() !== "") {
    const expiresAt = Date.parse(manifest.expiresAt);
    if (Number.isNaN(expiresAt)) {
      push(errors, "FIELD_INVALID", "$.expiresAt", "Expiry must be an ISO timestamp.");
    } else if (expiresAt <= (options.now ?? new Date()).getTime()) {
      push(errors, "MANIFEST_EXPIRED", "$.expiresAt", "Manifest is expired.");
    }
  }

  if (typeof manifest.simulation?.required !== "boolean") {
    push(errors, "REQUIRED_FIELD_MISSING", "$.simulation.required", "Simulation requirement is required.");
  }
  if (typeof manifest.receipt?.required !== "boolean") {
    push(errors, "REQUIRED_FIELD_MISSING", "$.receipt.required", "Receipt requirement is required.");
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, manifest };
}

function rejectSecretFields(errors: ManifestValidationError[], value: Record<string, unknown>, path = "$"): void {
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (isSecretField(key)) {
      push(errors, "SECRET_FIELD_NOT_ALLOWED", childPath, "Manifest must not contain secret or raw signing material.");
    }
    if (isRecord(child)) {
      rejectSecretFields(errors, child, childPath);
    }
  }
}

function requireParty(errors: ManifestValidationError[], value: unknown, path: string): void {
  if (!isRecord(value)) {
    push(errors, "REQUIRED_FIELD_MISSING", path, "Party object is required.");
    return;
  }
  requireNonEmptyString(errors, value.id, `${path}.id`);
}

function requireNonEmptyString(errors: ManifestValidationError[], value: unknown, path: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    push(errors, "REQUIRED_FIELD_MISSING", path, "Required string field is missing.");
  }
}

function requireOptionalNonEmptyString(errors: ManifestValidationError[], value: unknown, path: string): void {
  if (value !== undefined && (typeof value !== "string" || value.trim() === "")) {
    push(errors, "FIELD_INVALID", path, "Optional string field must be non-empty when present.");
  }
}

function requirePositiveNumber(errors: ManifestValidationError[], value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    push(errors, "REQUIRED_FIELD_MISSING", path, "Required positive number field is missing.");
  }
}

function requireArrayOfStrings(errors: ManifestValidationError[], value: unknown, path: string): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    push(errors, "FIELD_INVALID", path, "Field must be an array of non-empty strings.");
  }
}

function fail(code: ManifestValidationErrorCode, path: string, message: string): ManifestValidationResult {
  return { ok: false, errors: [{ code, path, message }] };
}

function push(
  errors: ManifestValidationError[],
  code: ManifestValidationErrorCode,
  path: string,
  message: string,
): void {
  errors.push({ code, path, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function byteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? "null", "utf8");
}

function isSecretField(key: string): boolean {
  return /^(seed|mnemonic|privateKey|private_key|rawKeypair|raw_keypair|rawTransactionBytes|raw_transaction_bytes|userSignature|user_signature|sponsorKey|sponsor_key|appApiKey|app_api_key|bearerToken|bearer_token|paymentCredential|payment_credential)$/i.test(key);
}
