import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildInstallSummary,
  defaultInstallModePrompt,
  planVallumInstall,
  VALLUM_GITIGNORE_BLOCK,
  writeVallumInstallerScaffold,
} from "./vallum-installer.js";

test("installer prompt defaults to safe local auto-scaffold", () => {
  const prompt = defaultInstallModePrompt();

  assert.match(prompt, /Safe local auto-scaffold/);
  assert.match(prompt, /Guided operator config/);
  assert.match(prompt, /Existing gateway\/client only/);
  assert.match(prompt, /Default: Safe local auto-scaffold/);
});

test("auto-scaffold plan installs sdk only and blocks live commands", () => {
  const plan = planVallumInstall({
    mode: "auto-scaffold",
    integrations: ["backend"],
    packageManager: "npm",
  });

  assert.deepEqual(plan.packages, ["@vallum/sdk"]);
  assert.equal(plan.requiresHumanSecretEntry, false);
  assert.equal(plan.liveCommandsAllowed, false);
  assert.equal(plan.nextApprovalGate, "guided-operator");
  assert.ok(plan.files.some((file) => file.path === ".env.vallum.example" && file.tracked));
  assert.ok(plan.files.some((file) => file.path === ".vallum/reports/install-summary.json" && !file.tracked));
  assert.ok(plan.verificationCommands.includes("npm exec tsc --noEmit"));
  assert.ok(plan.blockedCommands.some((command) => command.includes("execute:testnet-demo")));
  assert.doesNotMatch(JSON.stringify(plan), /private-key|bearer-token|secret-value/i);
});

test("guided operator plan keeps live commands approval-gated", () => {
  const plan = planVallumInstall({
    mode: "guided-operator",
    integrations: ["backend", "mcp"],
    packageManager: "pnpm",
  });

  assert.deepEqual(plan.packages, ["@vallum/sdk", "@vallum/mcp-server"]);
  assert.equal(plan.requiresHumanSecretEntry, true);
  assert.equal(plan.liveCommandsAllowed, false);
  assert.equal(plan.nextApprovalGate, "explicit-operator-approval");
  assert.ok(plan.humanSteps.some((step) => step.includes(".env.vallum.local")));
  assert.ok(plan.blockedCommands.some((command) => command.includes("sponsor:request-faucet-funds")));
});

test("scaffold writes gitignore before local state and is idempotent", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-installer-"));
  await writeFile(join(cwd, ".gitignore"), "node_modules/\n");

  const first = await writeVallumInstallerScaffold({
    cwd,
    mode: "auto-scaffold",
    integrations: ["backend", "mcp"],
    dryRun: false,
    now: new Date("2026-06-18T16:00:00.000Z"),
  });
  const second = await writeVallumInstallerScaffold({
    cwd,
    mode: "auto-scaffold",
    integrations: ["backend", "mcp"],
    dryRun: false,
    now: new Date("2026-06-18T16:00:00.000Z"),
  });

  const gitignore = await readFile(join(cwd, ".gitignore"), "utf8");
  assert.equal(countOccurrences(gitignore, VALLUM_GITIGNORE_BLOCK.trim()), 1);
  assert.equal(first.operations[0]?.path, ".gitignore");
  assert.equal(first.operations[0]?.kind, "updated");
  assert.ok(first.operations.some((operation) => operation.path === ".env.vallum.example" && operation.kind === "created"));
  assert.ok(first.operations.some((operation) => operation.path === ".vallum/reports/install-summary.json" && operation.kind === "created"));
  assert.ok(second.operations.some((operation) => operation.path === ".gitignore" && operation.kind === "unchanged"));

  const summaryPath = join(cwd, ".vallum/reports/install-summary.json");
  const summary = JSON.parse(await readFile(summaryPath, "utf8")) as ReturnType<typeof buildInstallSummary>;
  const mode = (await stat(summaryPath)).mode & 0o777;
  assert.equal(mode, 0o600);
  assert.equal(summary.mode, "auto-scaffold");
  assert.equal(summary.liveProof.proven, false);
});

test("dry-run does not write files or claim scaffold proof", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "vallum-installer-dry-run-"));
  const result = await writeVallumInstallerScaffold({
    cwd,
    mode: "auto-scaffold",
    integrations: ["backend"],
    dryRun: true,
    now: new Date("2026-06-18T16:00:00.000Z"),
  });

  assert.equal(result.summary.localProof.scaffolded, false);
  assert.ok(result.operations.every((operation) => operation.kind === "dry-run"));
  await assert.rejects(readFile(join(cwd, ".gitignore"), "utf8"), /ENOENT/);
  await assert.rejects(readFile(join(cwd, ".vallum/reports/install-summary.json"), "utf8"), /ENOENT/);
});

test("install summary redacts unsafe operator values", () => {
  const summary = buildInstallSummary({
    plan: planVallumInstall({ mode: "guided-operator", integrations: ["backend"], packageManager: "npm" }),
    now: new Date("2026-06-18T16:00:00.000Z"),
    notes: [
      "operator configured api_key=fixture-redacted-sentinel-value",
      "operator configured private_key=fixture-private-key-sentinel",
      "Bearer abc.def.ghi was available locally",
      "ready for shape validation",
    ],
  });
  const raw = JSON.stringify(summary);

  assert.doesNotMatch(raw, /fixture-redacted-sentinel-value|fixture-private-key-sentinel|abc\.def\.ghi|Bearer/i);
  assert.match(raw, /\[REDACTED\]/);
  assert.match(raw, /ready for shape validation/);
});

function countOccurrences(value: string, needle: string): number {
  let count = 0;
  let index = value.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = value.indexOf(needle, index + needle.length);
  }
  return count;
}
