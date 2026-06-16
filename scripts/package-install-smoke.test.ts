import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPaidMcpConsumerSmokeSource,
} from "./smoke-package-paid-mcp-consumer.js";
import {
  buildConsumerPackageJson,
  buildConsumerSmokeSource,
  buildNpmInstallArgs,
  buildNpmPackArgs,
  type PackageTarball,
} from "./smoke-package-install.js";

test("package install smoke packs explicit public workspaces", () => {
  assert.deepEqual(
    buildNpmPackArgs({ dir: "packages/sdk", name: "@sacredlabs/agentrail-sdk" }, "/tmp/packs"),
    ["pack", "--json", "--pack-destination", "/tmp/packs", "-w", "@sacredlabs/agentrail-sdk"],
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
    { name: "@sacredlabs/agentrail-accounts", tarballPath: "/tmp/packs/sacredlabs-agentrail-accounts.tgz" },
    { name: "@sacredlabs/agentrail-sdk", tarballPath: "/tmp/packs/sacredlabs-agentrail-sdk.tgz" },
  ];

  const packageJson = JSON.parse(buildConsumerPackageJson(tarballs)) as {
    private?: boolean;
    dependencies?: Record<string, string>;
  };

  assert.equal(packageJson.private, true);
  assert.equal(
    packageJson.dependencies?.["@sacredlabs/agentrail-accounts"],
    "file:/tmp/packs/sacredlabs-agentrail-accounts.tgz",
  );
  assert.equal(packageJson.dependencies?.["@sacredlabs/agentrail-sdk"], "file:/tmp/packs/sacredlabs-agentrail-sdk.tgz");
});

test("package install smoke imports package root entrypoints without secret material", () => {
  const source = buildConsumerSmokeSource([
    { dir: "packages/accounts", name: "@sacredlabs/agentrail-accounts" },
    { dir: "packages/sdk", name: "@sacredlabs/agentrail-sdk" },
  ]);

  assert.match(source, /await import\(packageName\)/);
  assert.match(source, /Package install smoke passed/);
  assert.doesNotMatch(source, /token|secret|privateKey|mnemonic|otp/i);
});

test("paid MCP consumer smoke uses package root entrypoints only", () => {
  const source = buildPaidMcpConsumerSmokeSource();

  assert.match(source, /from "@sacredlabs\/agentrail-manifest"/);
  assert.match(source, /from "@sacredlabs\/agentrail-policy-gateway"/);
  assert.match(source, /from "@sacredlabs\/agentrail-sdk"/);
  assert.doesNotMatch(source, /@sacredlabs\/agentrail-[^"]+\/(src|dist|contracts|server|schema|routes)/);
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
