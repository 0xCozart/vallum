import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkA2APublicReadiness } from "./check-a2a-public-readiness.js";
import { checkPackagePublicationReadiness } from "./check-package-publication-readiness.js";
import {
  buildOperatorReportTemplate,
  writeOperatorReportTemplate,
} from "./write-operator-report-template.js";

test("operator report template builds package publication schema without marking it passed", async () => {
  const template = await buildOperatorReportTemplate({
    kind: "package-publication",
    now: new Date("2026-06-14T12:00:00.000Z"),
  });

  assert.equal(template.schemaVersion, 1);
  assert.equal(template.kind, "agentic-gaskit.package-publication-proof");
  assert.equal(template.result, "pending-operator-proof");
  assert.equal(template.registry, "npm");
  assert.ok(Array.isArray(template.packageNames));
  assert.ok((template.packageNames as string[]).includes("@iota-gaskit/sdk"));
  assert.deepEqual(template.checks, [
    "npm-pack-dry-run",
    "local-tarball-install",
    "npm-publish-dry-run",
    "registry-install",
    "provenance-review",
    "rollback-review",
  ]);
});

test("operator report template writes private local artifact and remains not-passed evidence", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "gaskit-report-template-"));
  const outFile = join(cwd, "package-report.json");

  await writeOperatorReportTemplate({
    cwd: process.cwd(),
    kind: "package-publication",
    now: new Date("2026-06-14T12:00:00.000Z"),
    outFile,
  });

  const mode = (await stat(outFile)).mode & 0o777;
  assert.equal(mode, 0o600);

  const report = await checkPackagePublicationReadiness({
    env: { PACKAGE_PUBLICATION_REPORT: outFile },
    now: new Date("2026-06-14T12:00:00.000Z"),
  });
  const reportCheck = report.checks.find((check) => check.id === "npm-registry-publication-report");
  assert.equal(reportCheck?.code, "PACKAGE_PUBLICATION_REPORT_NOT_PASSED");
});

test("operator report template builds A2A discovery report fields without unsafe report keys", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "gaskit-a2a-template-"));
  const outFile = join(cwd, "a2a-discovery-report.json");

  await writeOperatorReportTemplate({
    kind: "a2a-public-discovery",
    now: new Date("2026-06-14T12:00:00.000Z"),
    outFile,
    publicBaseUrl: "https://agent.example.com",
    publicAgentCardUrl: "https://agent.example.com/.well-known/agent-card.json",
    publicJwksUrl: "https://agent.example.com/.well-known/jwks.json",
    taskAuthDecision: "bearer",
  });

  const parsed = JSON.parse(await readFile(outFile, "utf8")) as Record<string, unknown>;
  assert.equal(parsed.kind, "a2a-public-discovery");
  assert.equal(parsed.result, "pending-operator-proof");
  assert.equal(parsed.publicBaseUrl, "https://agent.example.com");
  assert.equal(parsed.publicAgentCardUrl, "https://agent.example.com/.well-known/agent-card.json");
  assert.equal(parsed.publicJwksUrl, "https://agent.example.com/.well-known/jwks.json");
  assert.equal(parsed.taskAuthDecision, "bearer");

  const readiness = await checkA2APublicReadiness({
    env: {
      A2A_PUBLIC_BASE_URL: "https://agent.example.com",
      A2A_PUBLIC_AGENT_CARD_URL: "https://agent.example.com/.well-known/agent-card.json",
      A2A_PUBLIC_JWKS_URL: "https://agent.example.com/.well-known/jwks.json",
      A2A_PUBLIC_TASK_AUTH_DECISION: "bearer",
      A2A_PUBLIC_DISCOVERY_REPORT: outFile,
    },
    now: new Date("2026-06-14T12:00:00.000Z"),
  });
  const discovery = readiness.checks.find((check) => check.id === "public-discovery");
  assert.equal(discovery?.code, "A2A_PUBLIC_DISCOVERY_REPORT_NOT_PASSED");
});

test("operator report template builds production custody and marketplace choices", async () => {
  const custody = await buildOperatorReportTemplate({
    kind: "custody-production",
    custodyMode: "kms",
    now: new Date("2026-06-14T12:00:00.000Z"),
  });
  const marketplace = await buildOperatorReportTemplate({
    kind: "marketplace-production",
    environment: "production",
    now: new Date("2026-06-14T12:00:00.000Z"),
  });

  assert.equal(custody.kind, "agentic-gaskit.custody-production-proof");
  assert.equal(custody.custodyMode, "kms");
  assert.ok((custody.checks as string[]).includes("incident-response-review"));
  assert.equal(marketplace.kind, "agentic-gaskit.marketplace-production-proof");
  assert.equal(marketplace.environment, "production");
  assert.ok((marketplace.checks as string[]).includes("operations-incident-review"));
});
