import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildConsumerPackageJson,
  buildConsumerSmokeSource,
  buildNpmInstallArgs,
  buildNpmPackArgs,
  type PackageTarball,
} from "./smoke-package-install.js";

test("package install smoke packs explicit public workspaces", () => {
  assert.deepEqual(
    buildNpmPackArgs({ dir: "packages/sdk", name: "@iota-gaskit/sdk" }, "/tmp/packs"),
    ["pack", "--json", "--pack-destination", "/tmp/packs", "-w", "@iota-gaskit/sdk"],
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
    { name: "@iota-gaskit/accounts", tarballPath: "/tmp/packs/iota-gaskit-accounts.tgz" },
    { name: "@iota-gaskit/sdk", tarballPath: "/tmp/packs/iota-gaskit-sdk.tgz" },
  ];

  const packageJson = JSON.parse(buildConsumerPackageJson(tarballs)) as {
    private?: boolean;
    dependencies?: Record<string, string>;
  };

  assert.equal(packageJson.private, true);
  assert.equal(packageJson.dependencies?.["@iota-gaskit/accounts"], "file:/tmp/packs/iota-gaskit-accounts.tgz");
  assert.equal(packageJson.dependencies?.["@iota-gaskit/sdk"], "file:/tmp/packs/iota-gaskit-sdk.tgz");
});

test("package install smoke imports package root entrypoints without secret material", () => {
  const source = buildConsumerSmokeSource([
    { dir: "packages/accounts", name: "@iota-gaskit/accounts" },
    { dir: "packages/sdk", name: "@iota-gaskit/sdk" },
  ]);

  assert.match(source, /await import\(packageName\)/);
  assert.match(source, /Package install smoke passed/);
  assert.doesNotMatch(source, /token|secret|privateKey|mnemonic|otp/i);
});
