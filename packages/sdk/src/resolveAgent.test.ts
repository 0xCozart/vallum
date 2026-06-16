import assert from "node:assert/strict";
import { test } from "node:test";
import { createLocalAgentResolver, validAgentProfileFixture } from "@vallum/registry";

import { resolveAgent } from "./index.js";

test("SDK resolveAgent returns a local resolved profile without gateway calls", async () => {
  const profile = validAgentProfileFixture();
  const resolver = createLocalAgentResolver({
    profiles: [profile],
    now: () => new Date("2026-06-10T12:00:00.000Z"),
  });

  const result = await resolveAgent("researcher.demo.iota", { resolver });

  assert.deepEqual(result, {
    ok: true,
    profile,
  });
});
