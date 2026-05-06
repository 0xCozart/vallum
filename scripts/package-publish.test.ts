import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const publicPackages = [
  "packages/shared-types",
  "packages/policy-gateway",
  "packages/sdk",
] as const;

test("public package metadata pins safe prerelease publish settings", async () => {
  for (const packageDir of publicPackages) {
    const packageJson = JSON.parse(await readFile(`${packageDir}/package.json`, "utf8")) as {
      name: string;
      files?: string[];
      publishConfig?: { access?: string; tag?: string };
    };

    assert.equal(packageJson.publishConfig?.access, "public", `${packageJson.name} must publish publicly when released`);
    assert.equal(packageJson.publishConfig?.tag, "next", `${packageJson.name} prerelease versions need a non-latest tag`);
    assert.deepEqual(
      packageJson.files,
      ["dist/**/*.js", "dist/**/*.d.ts", "LICENSE", "README.md"],
      `${packageJson.name} should publish runtime/type files and docs without stale source maps`,
    );

    const readme = await readFile(`${packageDir}/README.md`, "utf8");
    assert.match(readme, new RegExp(`# ${packageJson.name.replace("@", "\\@")}`));
    assert.match(readme, /not claimed as published to npm yet/);
    assert.match(readme, /After M3 publication/);
    assert.match(readme, /npm install/);
  }
});
