import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

interface PackageJson {
  readonly name: string;
  readonly version: string;
  readonly private?: boolean;
  readonly type?: string;
  readonly main?: string;
  readonly types?: string;
  readonly exports?: Record<string, unknown>;
  readonly license?: string;
  readonly files?: string[];
  readonly workspaces?: string[];
  readonly sideEffects?: boolean;
  readonly scripts?: Record<string, string>;
  readonly engines?: Record<string, string>;
  readonly publishConfig?: { access?: string; tag?: string };
  readonly bin?: Record<string, string>;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

const publicPackages = await publicPackageDirs();
const repoPrereleaseVersion = "0.0.0-prerelease";
const mcpServerVersion = "0.0.1-mcp.0";
const mcpServerPackageName = "@vallum/mcp-server";

test("workspace root is private and keeps publishable packages out of root publication", async () => {
  const root = JSON.parse(await readFile("package.json", "utf8")) as PackageJson;

  assert.equal(root.name, "vallum");
  assert.equal(root.private, true);
  assert.equal(root.version, repoPrereleaseVersion);
  assert.equal(root.license, "Apache-2.0");
  assert.equal(root.type, "module");
  assert.deepEqual(root.workspaces, ["packages/*", "apps/*"]);
});

test("public package metadata pins safe prerelease publish settings", async () => {
  for (const packageDir of publicPackages) {
    const packageJson = await readPackageJson(packageDir);

    assert.match(
      packageJson.name,
      /^@vallum\/[a-z0-9-]+$/,
      `${packageJson.name} must stay in the Vallum namespace`,
    );
    assert.equal(packageJson.version, expectedPackageVersion(packageJson.name), `${packageJson.name} must use the reviewed prerelease version`);
    assert.equal(packageJson.private, undefined, `${packageJson.name} must not be private if pack:check publishes it`);
    assert.equal(packageJson.type, "module", `${packageJson.name} must publish ESM`);
    assert.equal(packageJson.main, "dist/index.js", `${packageJson.name} must publish built JS entrypoint`);
    assert.equal(packageJson.types, "dist/index.d.ts", `${packageJson.name} must publish built type entrypoint`);
    assert.deepEqual(packageJson.exports, expectedExports(packageJson.name), `${packageJson.name} must expose only reviewed built entrypoints`);
    assert.equal(packageJson.license, "Apache-2.0", `${packageJson.name} must preserve Apache-2.0`);
    assert.equal(packageJson.publishConfig?.access, "public", `${packageJson.name} must publish publicly when released`);
    assert.equal(packageJson.publishConfig?.tag, "next", `${packageJson.name} prerelease versions need a non-latest tag`);
    assert.deepEqual(
      packageJson.files,
      ["dist/**/*.js", "dist/**/*.d.ts", "LICENSE", "README.md"],
      `${packageJson.name} should publish runtime/type files and docs without stale source maps`,
    );
    assert.equal(packageJson.sideEffects, false, `${packageJson.name} must be tree-shaking safe unless explicitly reviewed`);
    assert.equal(packageJson.scripts?.build, "tsc -p tsconfig.build.json", `${packageJson.name} must build from tsconfig`);
    assert.equal(packageJson.engines?.node, ">=20", `${packageJson.name} must match the repo Node support floor`);

    if (packageJson.name === mcpServerPackageName) {
      assert.deepEqual(
        packageJson.bin,
        { "vallum-mcp": "dist/cli.js" },
        "MCP package must publish the reviewed stdio CLI bin",
      );
    } else {
      assert.equal(packageJson.bin, undefined, `${packageJson.name} must not add a package bin without review`);
    }

    for (const [dependencyName, dependencyVersion] of internalDependencies(packageJson)) {
      assert.equal(
        dependencyVersion,
        repoPrereleaseVersion,
        `${packageJson.name} must pin internal dependency ${dependencyName} to the repo prerelease version`,
      );
    }
  }
});

test("publish dry-run helper is the only package publication command wired at root", async () => {
  const root = JSON.parse(await readFile("package.json", "utf8")) as PackageJson;
  const publishDryRun = root.scripts?.["publish:dry-run"] ?? "";

  assert.equal(publishDryRun, "npm run build && tsx scripts/package-publish-dry-run.ts");
  assert.doesNotMatch(root.scripts?.["verify:local"] ?? "", /publish:dry-run/);

  for (const [scriptName, scriptValue] of Object.entries(root.scripts ?? {})) {
    if (scriptName === "publish:dry-run") continue;
    assert.doesNotMatch(scriptValue, /npm publish(?! --dry-run)/, `${scriptName} must not run real npm publish`);
  }
});

test("public package readmes match package names", async () => {
  for (const packageDir of publicPackages) {
    const packageJson = await readPackageJson(packageDir);

    const readme = await readFile(`${packageDir}/README.md`, "utf8");
    assert.match(readme, new RegExp(`# ${packageJson.name.replace("@", "\\@")}`));
  }
});

test("existing install readmes keep prerelease npm install guidance explicit", async () => {
  for (const packageDir of ["packages/shared-types", "packages/policy-gateway", "packages/sdk"]) {
    const packageJson = await readPackageJson(packageDir);
    const readme = await readFile(`${packageDir}/README.md`, "utf8");

    assert.match(readme, /npm prerelease/);
    assert.match(readme, /npm install/);
    assert.match(readme, new RegExp(`npm install ${packageJson.name.replace("/", "\\/")}`));
  }
});

test("private app workspaces are not publishable package surfaces", async () => {
  for (const appDir of await workspacePackageDirs("apps")) {
    const packageJson = await readPackageJson(appDir);

    assert.equal(packageJson.private, true, `${packageJson.name} must remain private`);
    assert.equal(packageJson.publishConfig, undefined, `${packageJson.name} must not carry public publish config`);
  }
});

async function publicPackageDirs(): Promise<string[]> {
  const packageDirs = await workspacePackageDirs("packages");
  const publicDirs: string[] = [];
  for (const packageDir of packageDirs) {
    const packageJson = await readPackageJson(packageDir);
    if (!packageJson.private) publicDirs.push(packageDir);
  }
  return publicDirs.sort();
}

async function workspacePackageDirs(workspaceDir: "apps" | "packages"): Promise<string[]> {
  const entries = await readdir(workspaceDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(workspaceDir, entry.name))
    .sort();
}

async function readPackageJson(packageDir: string): Promise<PackageJson> {
  return JSON.parse(await readFile(`${packageDir}/package.json`, "utf8")) as PackageJson;
}

function internalDependencies(packageJson: PackageJson): [string, string][] {
  return Object.entries({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }).filter(([name]) => name.startsWith("@vallum/"));
}

function expectedPackageVersion(packageName: string): string {
  return packageName === mcpServerPackageName ? mcpServerVersion : repoPrereleaseVersion;
}

function expectedExports(packageName: string): Record<string, unknown> {
  const rootExport = { types: "./dist/index.d.ts", import: "./dist/index.js" };
  if (packageName !== mcpServerPackageName) {
    return { ".": rootExport };
  }

  return {
    ".": rootExport,
    "./config": { types: "./dist/config.d.ts", import: "./dist/config.js" },
    "./stdio": { types: "./dist/stdio.d.ts", import: "./dist/stdio.js" },
  };
}
