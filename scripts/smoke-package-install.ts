import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { collectPublishablePackages, type PublishablePackage } from "./package-publish-dry-run.js";

type Runner = (command: string, args: readonly string[], cwd: string) => SpawnSyncReturns<string>;

export interface PackageTarball {
  readonly name: string;
  readonly tarballPath: string;
}

export interface PackageInstallSmokeOptions {
  readonly cwd?: string;
  readonly run?: Runner;
}

export function buildNpmPackArgs(packageInfo: PublishablePackage, packDir: string): string[] {
  return ["pack", "--json", "--pack-destination", packDir, "-w", packageInfo.name];
}

export function buildNpmInstallArgs(): string[] {
  return ["install", "--ignore-scripts", "--no-audit", "--fund=false", "--package-lock=false"];
}

export function buildConsumerPackageJson(tarballs: readonly PackageTarball[]): string {
  const dependencies = Object.fromEntries(
    tarballs.map((tarball) => [tarball.name, `file:${tarball.tarballPath}`]),
  );

  return `${JSON.stringify({ type: "module", private: true, dependencies }, null, 2)}\n`;
}

export function buildConsumerSmokeSource(packages: readonly PublishablePackage[]): string {
  const packageNames = packages.map((packageInfo) => packageInfo.name);
  return [
    "const packages = " + JSON.stringify(packageNames) + ";",
    "for (const packageName of packages) {",
    "  await import(packageName);",
    '  console.log(`ok: import ${packageName}`);',
    "}",
    'console.log(`Package install smoke passed packages=${packages.length}`);',
    "",
  ].join("\n");
}

export async function runPackageInstallSmoke(options: PackageInstallSmokeOptions = {}): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const run =
    options.run ??
    ((command: string, args: readonly string[], runCwd: string) =>
      spawnSync(command, args, { cwd: runCwd, encoding: "utf8", stdio: "pipe" }));

  const packages = await collectPublishablePackages(cwd);
  if (packages.length === 0) {
    console.error("Package install smoke failed: no public packages found.");
    return 1;
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "vallum-package-install-"));
  const packDir = join(tempRoot, "packs");
  const consumerDir = join(tempRoot, "consumer");

  try {
    await mkdir(packDir);
    await mkdir(consumerDir);

    const tarballs: PackageTarball[] = [];
    for (const packageInfo of packages) {
      const result = run("npm", buildNpmPackArgs(packageInfo, packDir), cwd);
      if (result.status !== 0) {
        writeFailure("pack", packageInfo.name, result);
        return result.status ?? 1;
      }

      const tarballPath = await findPackedTarball(packDir, packageInfo);
      tarballs.push({ name: packageInfo.name, tarballPath });
    }

    await writeFile(join(consumerDir, "package.json"), buildConsumerPackageJson(tarballs), "utf8");
    await writeFile(join(consumerDir, "index.mjs"), buildConsumerSmokeSource(packages), "utf8");

    const install = run("npm", buildNpmInstallArgs(), consumerDir);
    if (install.status !== 0) {
      writeFailure("install", "consumer", install);
      return install.status ?? 1;
    }

    const smoke = run("node", ["index.mjs"], consumerDir);
    if (smoke.status !== 0) {
      writeFailure("import", "consumer", smoke);
      return smoke.status ?? 1;
    }

    process.stdout.write(smoke.stdout);
    console.log("Package install smoke used local tarballs only");
    return 0;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function findPackedTarball(packDir: string, packageInfo: PublishablePackage): Promise<string> {
  const expectedPrefix = packageInfo.name.replace(/^@/, "").replace("/", "-");
  const entries = await readdir(packDir);
  const matches = entries.filter((entry) => entry.startsWith(expectedPrefix) && entry.endsWith(".tgz"));

  if (matches.length !== 1) {
    throw new Error(`Expected one tarball for ${packageInfo.name}, found ${matches.length}.`);
  }

  return resolve(packDir, matches[0] ?? "");
}

function writeFailure(step: string, label: string, result: SpawnSyncReturns<string>): void {
  console.error(`Package install smoke failed during ${step}: ${label}`);
  if (result.error) console.error(result.error.message);
  if (result.stderr) console.error(redactLocalPaths(result.stderr));
  if (result.stdout) console.error(redactLocalPaths(result.stdout));
}

function redactLocalPaths(output: string): string {
  return output
    .split("\n")
    .map((line) => line.replaceAll(process.cwd(), "<repo>"))
    .map((line) => line.replaceAll(tmpdir(), "<tmp>"))
    .join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await runPackageInstallSmoke();
}
