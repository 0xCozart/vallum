import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMcpStdioConsumerSmokeSource,
} from "./smoke-package-mcp-stdio-consumer.js";
import {
  buildPaidMcpConsumerSmokeSource,
} from "./smoke-package-paid-mcp-consumer.js";
import {
  buildNpmRegistryInstallArgs,
  buildRegistryConsumerPackageJson,
  buildRegistryPaidMcpConsumerSmokeSource,
} from "./smoke-npm-registry-paid-mcp-consumer.js";
import {
  buildConsumerPackageJson,
  buildConsumerSmokeSource,
  buildNpmInstallArgs,
  buildNpmPackArgs,
  type PackageTarball,
} from "./smoke-package-install.js";
import {
  buildRegistryMcpStdioConsumerPackageJson,
  buildRegistryMcpStdioConsumerSmokeSource,
} from "./smoke-npm-registry-mcp-stdio-consumer.js";

test("package install smoke packs explicit public workspaces", () => {
  assert.deepEqual(
    buildNpmPackArgs({ dir: "packages/sdk", name: "@vallum/sdk" }, "/tmp/packs"),
    ["pack", "--json", "--pack-destination", "/tmp/packs", "-w", "@vallum/sdk"],
  );
});

test("package install smoke installs local tarballs without lifecycle scripts or audit", () => {
  assert.deepEqual(buildNpmInstallArgs(), [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--fund=false",
    "--package-lock=false",
  ]);
});

test("package install smoke consumer package pins dependencies to local tarballs", () => {
  const tarballs: PackageTarball[] = [
    { name: "@vallum/accounts", tarballPath: "/tmp/packs/vallum-accounts.tgz" },
    { name: "@vallum/sdk", tarballPath: "/tmp/packs/vallum-sdk.tgz" },
  ];

  const packageJson = JSON.parse(buildConsumerPackageJson(tarballs)) as {
    private?: boolean;
    dependencies?: Record<string, string>;
  };

  assert.equal(packageJson.private, true);
  assert.equal(
    packageJson.dependencies?.["@vallum/accounts"],
    "file:/tmp/packs/vallum-accounts.tgz",
  );
  assert.equal(packageJson.dependencies?.["@vallum/sdk"], "file:/tmp/packs/vallum-sdk.tgz");
});

test("package install smoke imports package root entrypoints without secret material", () => {
  const source = buildConsumerSmokeSource([
    { dir: "packages/accounts", name: "@vallum/accounts" },
    { dir: "packages/sdk", name: "@vallum/sdk" },
  ]);

  assert.match(source, /await import\(packageName\)/);
  assert.match(source, /Package install smoke passed/);
  assert.doesNotMatch(source, /token|secret|privateKey|mnemonic|otp/i);
});

test("paid MCP consumer smoke uses package root entrypoints only", () => {
  const source = buildPaidMcpConsumerSmokeSource();

  assert.match(source, /from "@vallum\/manifest"/);
  assert.match(source, /from "@vallum\/policy-gateway"/);
  assert.match(source, /from "@vallum\/sdk"/);
  assert.doesNotMatch(source, /@vallum\/[^"]+\/(src|dist|contracts|server|schema|routes)/);
  assert.doesNotMatch(source, /\.\.\/|\.\/packages\/|\/src\//);
});

test("paid MCP consumer smoke proves approval denial failed payment and redaction boundaries", () => {
  const source = buildPaidMcpConsumerSmokeSource();

  assert.match(source, /mode=package-consumer/);
  assert.match(source, /install=local-tarballs/);
  assert.match(source, /boundary\.route=SDK->mock-policy-gateway/);
  assert.match(source, /approval\.status=completed/);
  assert.match(source, /denial\.reason=GAS_BUDGET_TOO_HIGH/);
  assert.match(source, /failedPayment\.reason=mock-payment-failed/);
  assert.match(source, /redaction\.apiKey=redacted/);
  assert.match(source, /redaction\.signerReference=redacted/);
  assert.match(source, /assert\.doesNotMatch\(output,/);
});

test("MCP stdio consumer smoke uses package bin without repo internals", () => {
  const source = buildMcpStdioConsumerSmokeSource();

  assert.match(source, /node_modules.*\.bin.*vallum-mcp/s);
  assert.match(source, /mcp\.request\("tools\/list"/);
  assert.match(source, /mcp\.request\("tools\/call"/);
  assert.match(source, /boundary\.route=MCP-stdio->SDK->mock-policy-gateway/);
  assert.doesNotMatch(source, /@vallum\/mcp-server\/(src|dist)/);
  assert.doesNotMatch(source, /\.\.\/|\.\/packages\/|\/src\//);
});

test("MCP stdio consumer smoke proves approval denial invalid input and redaction", () => {
  const source = buildMcpStdioConsumerSmokeSource();

  assert.match(source, /approval\.approved=true/);
  assert.match(source, /denial\.reason=GAS_BUDGET_TOO_HIGH/);
  assert.match(source, /invalid\.reason=INVALID_TOOL_INPUT/);
  assert.match(source, /redaction\.apiKey=redacted/);
  assert.match(source, /assert\.doesNotMatch\(mcp\.stderr\(\),/);
});

test("npm registry MCP stdio consumer smoke pins the MCP package version separately", () => {
  const currentVersion = "0.1.1";
  const packageJson = JSON.parse(buildRegistryMcpStdioConsumerPackageJson({
    mcpVersion: currentVersion,
    supportPackages: [
      { name: "@vallum/manifest", version: currentVersion },
      { name: "@vallum/policy-gateway", version: currentVersion },
    ],
  })) as {
    private?: boolean;
    dependencies?: Record<string, string>;
  };

  assert.equal(packageJson.private, true);
  assert.equal(packageJson.dependencies?.["@vallum/mcp-server"], currentVersion);
  assert.equal(packageJson.dependencies?.["@vallum/manifest"], currentVersion);
  assert.equal(packageJson.dependencies?.["@vallum/policy-gateway"], currentVersion);
});

test("npm registry MCP stdio consumer smoke uses package bin and registry marker", () => {
  const source = buildRegistryMcpStdioConsumerSmokeSource();

  assert.match(source, /node_modules.*\.bin.*vallum-mcp/s);
  assert.match(source, /install=npm-registry/);
  assert.doesNotMatch(source, /install=local-tarballs/);
  assert.match(source, /boundary\.route=MCP-stdio->SDK->mock-policy-gateway/);
  assert.match(source, /redaction\.apiKey=redacted/);
});

test("npm registry consumer smoke pins target registry package versions", () => {
  const currentVersion = "0.1.1";
  const packageJson = JSON.parse(buildRegistryConsumerPackageJson([
    { dir: "packages/accounts", name: "@vallum/accounts", version: currentVersion },
    { dir: "packages/mcp-server", name: "@vallum/mcp-server", version: currentVersion },
    { dir: "packages/sdk", name: "@vallum/sdk", version: currentVersion },
  ], currentVersion)) as {
    private?: boolean;
    dependencies?: Record<string, string>;
  };

  assert.equal(packageJson.private, true);
  assert.equal(packageJson.dependencies?.["@vallum/accounts"], currentVersion);
  assert.equal(packageJson.dependencies?.["@vallum/mcp-server"], currentVersion);
  assert.equal(packageJson.dependencies?.["@vallum/sdk"], currentVersion);
});

test("npm registry consumer smoke installs from registry without lifecycle scripts", () => {
  assert.deepEqual(buildNpmRegistryInstallArgs(), [
    "install",
    "--ignore-scripts",
    "--audit=false",
    "--fund=false",
    "--package-lock=false",
    "--registry=https://registry.npmjs.org/",
  ]);
});

test("npm registry consumer smoke uses the paid MCP source with registry marker", () => {
  const source = buildRegistryPaidMcpConsumerSmokeSource();

  assert.match(source, /install=npm-registry/);
  assert.doesNotMatch(source, /install=local-tarballs/);
  assert.match(source, /boundary\.route=SDK->mock-policy-gateway/);
  assert.match(source, /redaction\.apiKey=redacted/);
});
