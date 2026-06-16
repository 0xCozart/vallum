import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

interface PackageJson {
  readonly name: string;
  readonly version?: string;
  readonly private?: boolean;
}

export interface PublishablePackage {
  readonly dir: string;
  readonly name: string;
  readonly version?: string;
}

export interface PublishDryRunOptions {
  readonly cwd?: string;
  readonly run?: (command: string, args: readonly string[], cwd: string) => SpawnSyncReturns<Buffer>;
}

export async function collectPublishablePackages(cwd = process.cwd()): Promise<PublishablePackage[]> {
  const entries = await readdir(join(cwd, "packages"), { withFileTypes: true });
  const packages: PublishablePackage[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dir = join("packages", entry.name);
    const packageJson = JSON.parse(await readFile(join(cwd, dir, "package.json"), "utf8")) as PackageJson;
    if (packageJson.private) continue;

    packages.push({ dir, name: packageJson.name, version: packageJson.version });
  }

  return packages.sort((left, right) => left.name.localeCompare(right.name));
}

export function buildNpmPublishDryRunArgs(packages: readonly PublishablePackage[]): string[] {
  const args = ["publish", "--dry-run", "--tag", "next", "--access", "public"];

  for (const packageInfo of packages) {
    args.push("-w", packageInfo.name);
  }

  return args;
}

export async function runPackagePublishDryRun(options: PublishDryRunOptions = {}): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const packages = await collectPublishablePackages(cwd);

  if (packages.length === 0) {
    console.error("Package publish dry-run failed: no public packages found.");
    return 1;
  }

  console.log("Vallum package publish dry-run");
  console.log(`packages=${packages.map((packageInfo) => packageInfo.name).join(",")}`);
  console.log("mode=dry-run");
  console.log("realPublish=false");

  const args = buildNpmPublishDryRunArgs(packages);
  const run =
    options.run ??
    ((command: string, commandArgs: readonly string[], runCwd: string) =>
      spawnSync(command, commandArgs, { cwd: runCwd, stdio: "inherit" }));

  const result = run("npm", args, cwd);
  if (result.error) {
    console.error(`Package publish dry-run failed: ${result.error.message}`);
    return 1;
  }

  return result.status ?? 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await runPackagePublishDryRun();
}
