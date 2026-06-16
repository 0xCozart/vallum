import { isIP } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  type A2AAgentCard,
  type A2AAgentCardSignature,
} from "./a2aCard.js";
import {
  A2A_JWKS_WELL_KNOWN_PATH,
  type A2APublicJwksResponse,
} from "./a2aJwks.js";

export interface A2APublicDiscoveryBundleOptions {
  readonly agentCard: A2AAgentCard;
  readonly jwks: A2APublicJwksResponse;
  readonly publicBaseUrl: string;
  readonly publicJwksUrl: string;
  readonly cacheControl?: string;
}

export interface A2APublicDiscoveryBundleFile {
  readonly path: typeof A2A_AGENT_CARD_WELL_KNOWN_PATH | typeof A2A_JWKS_WELL_KNOWN_PATH;
  readonly headers: Record<string, string>;
  readonly json: string;
}

export interface A2APublicDiscoveryBundle {
  readonly publicBaseUrl: string;
  readonly publicJwksUrl: string;
  readonly files: readonly [A2APublicDiscoveryBundleFile, A2APublicDiscoveryBundleFile];
}

export interface WriteA2APublicDiscoveryBundleOptions {
  readonly bundle: A2APublicDiscoveryBundle;
  readonly outDir: string;
  readonly manifestFileName?: string;
}

export interface WrittenA2APublicDiscoveryBundleFile {
  readonly path: string;
  readonly sourcePath: typeof A2A_AGENT_CARD_WELL_KNOWN_PATH | typeof A2A_JWKS_WELL_KNOWN_PATH;
  readonly headers: Record<string, string>;
}

export interface WrittenA2APublicDiscoveryBundle {
  readonly outDir: string;
  readonly publicBaseUrl: string;
  readonly publicJwksUrl: string;
  readonly files: readonly WrittenA2APublicDiscoveryBundleFile[];
  readonly manifestPath: string;
}

export interface ValidateA2APublicDiscoveryBundleArtifactsOptions {
  readonly outDir: string;
  readonly expectedPublicBaseUrl?: string;
  readonly expectedPublicJwksUrl?: string;
  readonly manifestFileName?: string;
}

export interface ValidatedA2APublicDiscoveryBundleArtifacts {
  readonly outDir: string;
  readonly publicBaseUrl: string;
  readonly publicJwksUrl: string;
  readonly files: readonly WrittenA2APublicDiscoveryBundleFile[];
  readonly manifestPath: string;
}

interface A2AStaticDiscoveryBundleManifest {
  readonly schemaVersion?: unknown;
  readonly kind?: unknown;
  readonly publicBaseUrl?: unknown;
  readonly publicJwksUrl?: unknown;
  readonly files?: unknown;
}

export function createA2APublicDiscoveryBundle(
  options: A2APublicDiscoveryBundleOptions,
): A2APublicDiscoveryBundle {
  const publicBaseUrl = publicHttpsUrl(options.publicBaseUrl, "A2A public base URL");
  const publicJwksUrl = publicHttpsUrl(options.publicJwksUrl, "A2A public JWKS URL");
  const agentCard = sanitizeAgentCard(options.agentCard, publicBaseUrl, publicJwksUrl);
  const jwks = sanitizeJwks(options.jwks);
  const signingKeyIds = signatureKeyIds(agentCard.signatures);
  const jwksKeyIds = new Set(jwks.body.keys.map((key) => key.kid).filter((kid): kid is string => typeof kid === "string"));

  for (const keyId of signingKeyIds) {
    if (!jwksKeyIds.has(keyId)) {
      throw new Error("A2A public discovery bundle signing key is missing from JWKS.");
    }
  }

  const cacheControl = options.cacheControl ?? "no-store";
  return {
    publicBaseUrl,
    publicJwksUrl,
    files: [
      {
        path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
        headers: {
          "content-type": "application/a2a+json; charset=utf-8",
          "cache-control": cacheControl,
        },
        json: `${JSON.stringify(agentCard, null, 2)}\n`,
      },
      {
        path: A2A_JWKS_WELL_KNOWN_PATH,
        headers: {
          "content-type": "application/jwk-set+json; charset=utf-8",
          "cache-control": cacheControl,
        },
        json: jwks.json.endsWith("\n") ? jwks.json : `${jwks.json}\n`,
      },
    ],
  };
}

export async function writeA2APublicDiscoveryBundle(
  options: WriteA2APublicDiscoveryBundleOptions,
): Promise<WrittenA2APublicDiscoveryBundle> {
  const outDir = options.outDir.trim();
  if (outDir === "") throw new Error("A2A public discovery bundle output directory is required.");

  const expectedPaths = new Set<string>([A2A_AGENT_CARD_WELL_KNOWN_PATH, A2A_JWKS_WELL_KNOWN_PATH]);
  const seenPaths = new Set<string>();
  const writtenFiles: WrittenA2APublicDiscoveryBundleFile[] = [];

  for (const file of options.bundle.files) {
    if (!expectedPaths.has(file.path) || seenPaths.has(file.path)) {
      throw new Error("A2A public discovery bundle contains an unexpected static file path.");
    }
    seenPaths.add(file.path);
    const absolutePath = join(outDir, file.path.slice(1));
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.json, { encoding: "utf8", mode: 0o644 });
    writtenFiles.push({
      path: absolutePath,
      sourcePath: file.path,
      headers: { ...file.headers },
    });
  }

  if (seenPaths.size !== expectedPaths.size) {
    throw new Error("A2A public discovery bundle is missing required static files.");
  }

  const manifestPath = join(outDir, options.manifestFileName ?? "a2a-discovery-bundle-manifest.json");
  await writeFile(
    manifestPath,
    `${JSON.stringify({
      schemaVersion: 1,
      kind: "vallum.a2a-static-discovery-bundle",
      publicBaseUrl: options.bundle.publicBaseUrl,
      publicJwksUrl: options.bundle.publicJwksUrl,
      files: writtenFiles.map((file) => ({
        path: file.sourcePath,
        headers: file.headers,
      })),
    }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o644 },
  );

  return {
    outDir,
    publicBaseUrl: options.bundle.publicBaseUrl,
    publicJwksUrl: options.bundle.publicJwksUrl,
    files: writtenFiles,
    manifestPath,
  };
}

export async function validateA2APublicDiscoveryBundleArtifacts(
  options: ValidateA2APublicDiscoveryBundleArtifactsOptions,
): Promise<ValidatedA2APublicDiscoveryBundleArtifacts> {
  const outDir = options.outDir.trim();
  if (outDir === "") throw new Error("A2A public discovery bundle output directory is required.");

  const manifestPath = join(outDir, options.manifestFileName ?? "a2a-discovery-bundle-manifest.json");
  const manifest = parseManifest(await readFile(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.kind !== "vallum.a2a-static-discovery-bundle") {
    throw new Error("A2A public discovery bundle manifest is invalid.");
  }
  if (typeof manifest.publicBaseUrl !== "string" || typeof manifest.publicJwksUrl !== "string") {
    throw new Error("A2A public discovery bundle manifest is missing public URLs.");
  }
  if (options.expectedPublicBaseUrl && publicHttpsUrl(options.expectedPublicBaseUrl, "A2A expected public base URL") !== manifest.publicBaseUrl) {
    throw new Error("A2A public discovery bundle public base URL does not match the expected value.");
  }
  if (options.expectedPublicJwksUrl && publicHttpsUrl(options.expectedPublicJwksUrl, "A2A expected public JWKS URL") !== manifest.publicJwksUrl) {
    throw new Error("A2A public discovery bundle public JWKS URL does not match the expected value.");
  }

  const manifestFiles = parseManifestFiles(manifest.files);
  const agentCardJson = await readFile(join(outDir, A2A_AGENT_CARD_WELL_KNOWN_PATH.slice(1)), "utf8");
  const jwksJson = await readFile(join(outDir, A2A_JWKS_WELL_KNOWN_PATH.slice(1)), "utf8");
  const agentCard = JSON.parse(agentCardJson) as A2AAgentCard;
  const jwksBody = JSON.parse(jwksJson) as A2APublicJwksResponse["body"];
  const jwksHeaders = manifestFiles.find((file) => file.sourcePath === A2A_JWKS_WELL_KNOWN_PATH)?.headers ?? {};

  const bundle = createA2APublicDiscoveryBundle({
    agentCard,
    jwks: {
      path: A2A_JWKS_WELL_KNOWN_PATH,
      status: 200,
      headers: jwksHeaders,
      body: jwksBody,
      json: jwksJson,
    },
    publicBaseUrl: manifest.publicBaseUrl,
    publicJwksUrl: manifest.publicJwksUrl,
    cacheControl: sharedCacheControl(manifestFiles),
  });

  for (const file of bundle.files) {
    const manifestFile = manifestFiles.find((candidate) => candidate.sourcePath === file.path);
    if (!manifestFile) {
      throw new Error("A2A public discovery bundle manifest is missing required static file metadata.");
    }
    assertContentType(file.path, manifestFile.headers);
  }

  return {
    outDir,
    publicBaseUrl: bundle.publicBaseUrl,
    publicJwksUrl: bundle.publicJwksUrl,
    files: manifestFiles.map((file) => ({
      path: join(outDir, file.sourcePath.slice(1)),
      sourcePath: file.sourcePath,
      headers: file.headers,
    })),
    manifestPath,
  };
}

function sanitizeAgentCard(
  card: A2AAgentCard,
  publicBaseUrl: string,
  publicJwksUrl: string,
): A2AAgentCard {
  if (containsSecretLikeField(card)) {
    throw new Error("A2A public discovery bundle must not contain private Agent Card fields.");
  }
  if (!card.signatures || card.signatures.length === 0) {
    throw new Error("A2A public discovery bundle requires a signed Agent Card.");
  }
  if (!card.supportedInterfaces.some((entry) => entry.url === publicBaseUrl && entry.protocolBinding === "HTTP+JSON")) {
    throw new Error("A2A public discovery bundle Agent Card does not match the public base URL.");
  }
  for (const signature of card.signatures) {
    const protectedHeader = protectedHeaderJson(signature);
    if (protectedHeader.jku !== publicJwksUrl) {
      throw new Error("A2A public discovery bundle Agent Card signature JWKS URL does not match.");
    }
  }
  return JSON.parse(JSON.stringify(card)) as A2AAgentCard;
}

function parseManifest(json: string): A2AStaticDiscoveryBundleManifest {
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("A2A public discovery bundle manifest is invalid.");
  }
  if (containsSecretLikeField(parsed)) {
    throw new Error("A2A public discovery bundle manifest must not contain private fields.");
  }
  return parsed as A2AStaticDiscoveryBundleManifest;
}

function parseManifestFiles(value: unknown): readonly WrittenA2APublicDiscoveryBundleFile[] {
  if (!Array.isArray(value)) {
    throw new Error("A2A public discovery bundle manifest files are invalid.");
  }
  const expectedPaths = new Set<string>([A2A_AGENT_CARD_WELL_KNOWN_PATH, A2A_JWKS_WELL_KNOWN_PATH]);
  const seenPaths = new Set<string>();
  const files: WrittenA2APublicDiscoveryBundleFile[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("A2A public discovery bundle manifest file entry is invalid.");
    }
    const path = (entry as { path?: unknown }).path;
    const headers = (entry as { headers?: unknown }).headers;
    if (typeof path !== "string" || !expectedPaths.has(path) || seenPaths.has(path)) {
      throw new Error("A2A public discovery bundle manifest contains an unexpected static file path.");
    }
    if (!headers || typeof headers !== "object" || Array.isArray(headers) || containsSecretLikeField(headers)) {
      throw new Error("A2A public discovery bundle manifest headers are invalid.");
    }
    if (!Object.entries(headers).every(([key, nested]) => typeof key === "string" && typeof nested === "string")) {
      throw new Error("A2A public discovery bundle manifest headers are invalid.");
    }
    seenPaths.add(path);
    files.push({
      path,
      sourcePath: path as typeof A2A_AGENT_CARD_WELL_KNOWN_PATH | typeof A2A_JWKS_WELL_KNOWN_PATH,
      headers: { ...(headers as Record<string, string>) },
    });
  }
  if (seenPaths.size !== expectedPaths.size) {
    throw new Error("A2A public discovery bundle manifest is missing required static file metadata.");
  }
  return files;
}

function assertContentType(path: A2APublicDiscoveryBundleFile["path"], headers: Record<string, string>): void {
  const contentType = headers["content-type"];
  if (path === A2A_AGENT_CARD_WELL_KNOWN_PATH && typeof contentType === "string" && contentType.includes("application/a2a+json")) return;
  if (path === A2A_JWKS_WELL_KNOWN_PATH && typeof contentType === "string" && contentType.includes("application/jwk-set+json")) return;
  throw new Error("A2A public discovery bundle manifest has invalid content-type metadata.");
}

function sharedCacheControl(files: readonly WrittenA2APublicDiscoveryBundleFile[]): string | undefined {
  const values = files.map((file) => file.headers["cache-control"]).filter((value): value is string => typeof value === "string" && value.trim() !== "");
  if (values.length === 0) return undefined;
  const [first] = values;
  return values.every((value) => value === first) ? first : undefined;
}

function sanitizeJwks(jwks: A2APublicJwksResponse): A2APublicJwksResponse {
  if (jwks.path !== A2A_JWKS_WELL_KNOWN_PATH) {
    throw new Error("A2A public discovery bundle JWKS path must be canonical.");
  }
  if (jwks.status !== 200 || !Array.isArray(jwks.body.keys) || jwks.body.keys.length === 0) {
    throw new Error("A2A public discovery bundle JWKS is invalid.");
  }
  if (containsSecretLikeField(jwks.body)) {
    throw new Error("A2A public discovery bundle JWKS must not contain private key material.");
  }
  return jwks;
}

function signatureKeyIds(signatures: readonly A2AAgentCardSignature[] | undefined): readonly string[] {
  if (!signatures || signatures.length === 0) {
    throw new Error("A2A public discovery bundle requires a signed Agent Card.");
  }
  return signatures.map((signature) => {
    const kid = protectedHeaderJson(signature).kid;
    if (typeof kid !== "string" || kid.trim() === "") {
      throw new Error("A2A public discovery bundle signature key id is invalid.");
    }
    return kid;
  });
}

function protectedHeaderJson(signature: A2AAgentCardSignature): Record<string, unknown> {
  try {
    const parsed = JSON.parse(Buffer.from(signature.protected, "base64url").toString("utf8")) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // handled below
  }
  throw new Error("A2A public discovery bundle signature is malformed.");
}

function publicHttpsUrl(value: string, label: string): string {
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:"
      && url.hostname
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
      && !isUnsafePublicHost(url.hostname)
    ) return url.toString();
  } catch {
    // handled below
  }
  throw new Error(`${label} must be public HTTPS without credentials, query strings, or fragments.`);
}

function containsSecretLikeField(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    for (const [key, nested] of Object.entries(current)) {
      const normalized = key.toLowerCase();
      if (
        normalized.includes("private")
        || normalized.includes("secret")
        || normalized.includes("token")
        || normalized.includes("credential")
        || normalized.includes("signer")
        || normalized.includes("mnemonic")
        || normalized.includes("seed")
        || normalized === "d"
        || normalized === "p"
        || normalized === "q"
        || normalized === "dp"
        || normalized === "dq"
        || normalized === "qi"
        || normalized === "oth"
      ) {
        return true;
      }
      if (nested && typeof nested === "object") stack.push(nested);
    }
  }
  return false;
}

function isUnsafePublicHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local")) return true;

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    const [first = 0, second = 0] = normalized.split(".").map((octet) => Number.parseInt(octet, 10));
    return first === 0
      || first === 10
      || first === 127
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 198 && (second === 18 || second === 19))
      || first >= 224;
  }
  if (ipVersion === 6) {
    return normalized === "::"
      || normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || normalized.startsWith("fe80:");
  }
  return false;
}
