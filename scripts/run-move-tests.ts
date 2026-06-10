import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const packages = [
  "contracts/escrow_v1",
  "contracts/receipt_v1",
  "contracts/pay_per_call_v1",
  "contracts/data_license_v1",
] as const;

const iotaBin = resolveIotaBin();

for (const packagePath of packages) {
  const result = spawnSync(iotaBin, ["move", "test", "-p", packagePath], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Failed to run IOTA Move tests for ${packagePath}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveIotaBin(): string {
  const candidates = [
    process.env.IOTA_BIN,
    join(process.cwd(), "tmp/tooling/iota-v1.24.0/iota"),
    "iota",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["--version"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    });

    if (!probe.error && probe.status === 0) {
      return candidate;
    }

    if (candidate.includes("/") && !existsSync(candidate)) {
      continue;
    }
  }

  console.error([
    "IOTA CLI is required for Move contract tests.",
    "Install IOTA CLI, set IOTA_BIN to the binary path, or place the v1.24.0 binary at tmp/tooling/iota-v1.24.0/iota.",
  ].join("\n"));
  process.exit(1);
}
