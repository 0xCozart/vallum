import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface LocalSecretFinding {
  readonly path: string;
  readonly category: "env-file" | "gas-station-config" | "local-report";
  readonly findingClass: string;
}

export interface ScanLocalSecretsOptions {
  readonly cwd?: string;
}

const repoRoot = resolve(new URL("..", import.meta.url).pathname);

const localSecretPatterns: Array<{ findingClass: string; pattern: RegExp }> = [
  { findingClass: "private-key-block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { findingClass: "iota-private-key", pattern: /iotaprivkey1[0-9a-z]{20,}/gi },
  { findingClass: "base64-local-signer-material", pattern: /keypair:\s*["']?[A-Za-z0-9+/]{40,}={0,2}["']?/gi },
  { findingClass: "disabled-gas-station-access-policy", pattern: /access-policy:\s*["']?disabled["']?/gi },
  {
    findingClass: "literal-secret-assignment",
    pattern: /(?:api[_-]?key|secret|password|passwd|token|bearer|keypair)\s*[:=]\s*["'][^"'\s]{12,}["']/gi,
  },
  {
    findingClass: "unquoted-secret-assignment",
    pattern: /(?:api[_-]?key|secret|password|passwd|token|bearer|keypair)\s*[:=]\s*[^\s"']{20,}/gi,
  },
];

export async function scanLocalSecrets(options: ScanLocalSecretsOptions = {}): Promise<LocalSecretFinding[]> {
  const cwd = options.cwd ?? repoRoot;
  const candidates = await localSecretCandidates(cwd);
  const findings: LocalSecretFinding[] = [];

  for (const candidate of candidates) {
    const absolutePath = resolve(cwd, candidate.path);
    if (!existsSync(absolutePath)) continue;
    const content = await readFile(absolutePath, "utf8");
    for (const { findingClass, pattern } of localSecretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        findings.push({ path: candidate.path, category: candidate.category, findingClass });
      }
    }
  }

  return findings;
}

async function localSecretCandidates(cwd: string): Promise<Array<{ path: string; category: LocalSecretFinding["category"] }>> {
  const rootEntries = await readdir(cwd).catch(() => []);
  const envFiles = rootEntries
    .filter((entry) => entry === ".env" || (entry.startsWith(".env.") && entry !== ".env.example"))
    .map((path) => ({ path, category: "env-file" as const }));
  return [
    ...envFiles,
    { path: "deploy/gas-station/config.local.yaml", category: "gas-station-config" },
    { path: "tmp/vallum/operator-live-gates.json", category: "local-report" },
    { path: "tmp/vallum/custody-production-report-template.json", category: "local-report" },
  ];
}

function formatFindings(findings: readonly LocalSecretFinding[]): string {
  if (findings.length === 0) {
    return "Local ignored-secret preflight passed: findings 0.";
  }
  return [
    "Local ignored-secret preflight found operator-risk files:",
    ...findings.map((finding) => `- path=${finding.path} category=${finding.category} findingClass=${finding.findingClass}`),
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = await scanLocalSecrets();
  console.log(formatFindings(findings));
  process.exitCode = findings.length === 0 ? 0 : 1;
}
