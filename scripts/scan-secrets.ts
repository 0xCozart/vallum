import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);

const textFileExtensions = new Set([
  ".cjs",
  ".css",
  ".env",
  ".example",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const allowlistedFiles = new Set([
  ".env.example",
  "docs/security/secrets.md",
  "scripts/scan-secrets.ts",
]);

const secretPatterns: Array<{ name: string; pattern: RegExp }> = [
  { name: "private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "IOTA private key", pattern: /iotaprivkey1[0-9a-z]{20,}/gi },
  { name: "Stripe secret key", pattern: /sk_(?:live|test)_[0-9A-Za-z]{16,}/g },
  { name: "Stripe webhook secret", pattern: /whsec_[0-9A-Za-z]{16,}/g },
  { name: "Resend API key", pattern: /re_[0-9A-Za-z]{16,}/g },
  { name: "GitHub token", pattern: /gh[pousr]_[0-9A-Za-z]{24,}/g },
  { name: "Postgres URL", pattern: /postgres(?:ql)?:\/\/[^\s'"<>]+/gi },
  {
    name: "literal secret assignment",
    pattern: /(?:api[_-]?key|secret|password|passwd|token|bearer)\s*[:=]\s*["'][^"'\s]{12,}["']/gi,
  },
];

function isTextCandidate(path: string): boolean {
  if (path.includes("/dist/") || path.startsWith("dist/")) return false;
  if (path.includes("node_modules/") || path.startsWith("node_modules/")) return false;
  if (path.endsWith("package-lock.json")) return true;

  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1) return ["LICENSE", "NOTICE", "CODE_OF_CONDUCT", "SECURITY", "CONTRIBUTING"].includes(path);
  return textFileExtensions.has(path.slice(lastDot));
}

function lineNumberFor(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

const trackedFiles = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: repoRoot })
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .filter(isTextCandidate);

const findings: string[] = [];

function lineAt(content: string, index: number): string {
  const before = content.lastIndexOf("\n", index - 1) + 1;
  const after = content.indexOf("\n", index);
  return content.slice(before, after === -1 ? undefined : after);
}

function isAllowedFixtureSecret(name: string, content: string, index: number): boolean {
  if (name !== "literal secret assignment") return false;
  const line = lineAt(content, index);
  return /(?:browser-supplied|demo|dummy|example|fake|fixture|insecure|jwt-secret|local|mock|operator-token|placeholder|redacted-sentinel|replac|secret-app-key|secret-bearer-token|secret-token|test)/i.test(line);
}

for (const file of trackedFiles) {
  const absolutePath = resolve(repoRoot, file);
  if (!existsSync(absolutePath)) continue;

  const content = readFileSync(absolutePath, "utf8");

  if (allowlistedFiles.has(file)) continue;

  for (const { name, pattern } of secretPatterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      if (!isAllowedFixtureSecret(name, content, match.index)) {
        findings.push(`${file}:${lineNumberFor(content, match.index)} ${name}`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error("Potential secrets detected in tracked/staged/untracked text files:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log(`Secret scan passed: checked ${trackedFiles.length} tracked/staged/untracked text files, findings 0.`);
