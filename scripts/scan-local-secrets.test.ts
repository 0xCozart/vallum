import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { scanLocalSecrets } from "./scan-local-secrets.js";

test("local ignored-secret scan reports finding classes without raw values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-local-secret-scan-"));
  try {
    const iotaPrivateKeyFixture = `iota${"privkey1"}${"q".repeat(36)}`;
    await writeFile(join(cwd, ".env"), `GAS_STATION_KEYPAIR=${iotaPrivateKeyFixture}\n`, { mode: 0o600 });
    const gasConfig = join(cwd, "deploy/gas-station/config.local.yaml");
    await mkdir(dirname(gasConfig), { recursive: true });
    await writeFile(
      gasConfig,
      [
        "signer-config:",
        "  local:",
        "    keypair: \"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\"",
        "access-controller:",
        "  access-policy: \"disabled\"",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );

    const findings = await scanLocalSecrets({ cwd });
    const serialized = JSON.stringify(findings);

    assert.equal(findings.some((finding) => finding.path === ".env" && finding.findingClass === "iota-private-key"), true);
    assert.equal(
      findings.some(
        (finding) =>
          finding.path === "deploy/gas-station/config.local.yaml" &&
          finding.findingClass === "disabled-gas-station-access-policy",
      ),
      true,
    );
    assert.equal(serialized.includes("iotaprivkey1"), false);
    assert.equal(serialized.includes("AAAAAAAA"), false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("local ignored-secret scan ignores tracked example env files", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-local-secret-scan-"));
  try {
    await writeFile(join(cwd, ".env.example"), "GAS_STATION_KEYPAIR=replace-me\n");

    const findings = await scanLocalSecrets({ cwd });

    assert.deepEqual(findings, []);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
