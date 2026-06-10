import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
  buildNpmPublishDryRunArgs,
  collectPublishablePackages,
  runPackagePublishDryRun,
  type PublishablePackage,
} from "./package-publish-dry-run.js";

interface PackageJson {
  readonly name: string;
  readonly private?: boolean;
}

test("publish dry-run helper enumerates every public package and excludes private apps", async () => {
  const packages = await collectPublishablePackages();
  const packageNames = packages.map((packageInfo) => packageInfo.name);
  const expectedNames = await publicPackageNames();
  const appNames = await privateAppNames();

  assert.deepEqual(packageNames, expectedNames);
  for (const appName of appNames) {
    assert.ok(!packageNames.includes(appName), `${appName} must not be included in publish dry-run`);
  }
});

test("publish dry-run command uses explicit npm dry-run args for every public workspace", async () => {
  const packages: PublishablePackage[] = [
    { dir: "packages/accounts", name: "@iota-gaskit/accounts" },
    { dir: "packages/sdk", name: "@iota-gaskit/sdk" },
  ];

  assert.deepEqual(buildNpmPublishDryRunArgs(packages), [
    "publish",
    "--dry-run",
    "--tag",
    "next",
    "--access",
    "public",
    "-w",
    "@iota-gaskit/accounts",
    "-w",
    "@iota-gaskit/sdk",
  ]);
});

test("publish dry-run runner invokes npm publish without real publication flags", async () => {
  const calls: { command: string; args: readonly string[]; cwd: string }[] = [];
  const status = await runPackagePublishDryRun({
    cwd: process.cwd(),
    run(command, args, cwd) {
      calls.push({ command, args, cwd });
      return { status: 0, signal: null, output: [], pid: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    },
  });

  assert.equal(status, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.command, "npm");
  assert.equal(calls[0]?.cwd, process.cwd());
  assert.ok(calls[0]?.args.includes("--dry-run"));
  assert.ok(calls[0]?.args.includes("--tag"));
  assert.ok(calls[0]?.args.includes("next"));
  assert.ok(calls[0]?.args.includes("--access"));
  assert.ok(calls[0]?.args.includes("public"));
  assert.ok(!calls[0]?.args.includes("--otp"));
  assert.ok(!calls[0]?.args.includes("--provenance"));
});

async function publicPackageNames(): Promise<string[]> {
  const packageDirs = await workspacePackageDirs("packages");
  const names: string[] = [];

  for (const packageDir of packageDirs) {
    const packageJson = await readPackageJson(packageDir);
    if (!packageJson.private) names.push(packageJson.name);
  }

  return names.sort();
}

async function privateAppNames(): Promise<string[]> {
  const appDirs = await workspacePackageDirs("apps");
  const names: string[] = [];

  for (const appDir of appDirs) {
    const packageJson = await readPackageJson(appDir);
    if (packageJson.private) names.push(packageJson.name);
  }

  return names.sort();
}

async function workspacePackageDirs(workspaceDir: "apps" | "packages"): Promise<string[]> {
  const entries = await readdir(resolve(workspaceDir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(workspaceDir, entry.name))
    .sort();
}

async function readPackageJson(packageDir: string): Promise<PackageJson> {
  return JSON.parse(await readFile(`${packageDir}/package.json`, "utf8")) as PackageJson;
}
