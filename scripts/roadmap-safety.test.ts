import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const packageJson = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const executionSlices = await readFile(resolve(repoRoot, "docs/agentic-gaskit/execution-slices.md"), "utf8");
const deviceGate = await readFile(resolve(repoRoot, "docs/agentic-gaskit/device-access-safety-gate.md"), "utf8");
const fullGoal = await readFile(resolve(repoRoot, "docs/agentic-gaskit/full-roadmap-execution-goal.md"), "utf8");
const marketplaceReadiness = await readFile(resolve(repoRoot, "docs/marketplace-readiness.md"), "utf8");

test("device access lease remains explicitly safety gated", () => {
  assert.match(executionSlices, /## Slice 3\.7: Device Access Lease Safety Gate/);
  assert.match(deviceGate, /Physical device operation remains blocked/);
  assert.match(deviceGate, /virtual or simulated workflow/);
  assert.match(deviceGate, /no `contracts\/device_access_lease_v1` implementation is claimed/);
  assert.match(fullGoal, /Device access lease is explicitly deferred with a hardening rationale/);
  assert.match(marketplaceReadiness, /Device access safety gate/);
});

test("device access gate does not expose a working product path", () => {
  assert.equal(
    existsSync(resolve(repoRoot, "contracts/device_access_lease_v1")),
    false,
    "device access must remain unimplemented until a later approved virtual-device slice replaces this gate",
  );
  assert.doesNotMatch(packageJson.scripts?.["verify:local"] ?? "", /device[-:]access|device_access/);
  assert.doesNotMatch(packageJson.scripts?.["build"] ?? "", /device[-:]access|device_access/);
  assert.doesNotMatch(packageJson.scripts?.["pack:check"] ?? "", /device[-:]access|device_access/);
});
