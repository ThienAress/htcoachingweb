import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateTechnologyRadar } from "./technology-radar-contract.mjs";

const radar = validateTechnologyRadar(
  JSON.parse(
    readFileSync(
      new URL("../upstream-technologies/watchlist.json", import.meta.url),
      "utf8",
    ),
  ),
);

const entry = (id) => radar.entries.find((candidate) => candidate.id === id);

test("AI technology radar keeps all tracked sources non-installing", () => {
  assert.equal(radar.entries.length, 4);
  assert.ok(radar.entries.every(({ autoInstall }) => autoInstall === false));
});

test("AI technology radar tracks TencentDB Agent Memory as assess/adapt", () => {
  const memory = radar.entries.find(
    ({ id }) => id === "tencentcloud/tencentdb-agent-memory",
  );

  assert.ok(memory);
  assert.equal(memory.ring, "assess");
  assert.equal(memory.decision, "adapt");
  assert.equal(memory.autoInstall, false);
  assert.match(memory.decisionReason, /explicit memory/i);
});

test("Playwright MCP stays an isolated local/mock assessment", () => {
  const playwright = entry("microsoft/playwright-mcp");

  assert.ok(playwright);
  assert.equal(playwright.ring, "assess");
  assert.equal(playwright.decision, "adapt");
  assert.equal(playwright.license, "Apache-2.0");
  assert.match(playwright.decisionReason, /isolated local\/mock/i);
  assert.match(playwright.decisionReason, /pin the evaluated version/i);
  assert.match(playwright.decisionReason, /never connect it to production/i);
  assert.match(playwright.decisionReason, /unsafe code execution/i);
});

test("Commerce Agents remains a non-maintained safety blueprint", () => {
  const commerce = entry("anthropics/commerce-agents");

  assert.ok(commerce);
  assert.equal(commerce.ring, "assess");
  assert.equal(commerce.decision, "adapt");
  assert.equal(commerce.license, "Apache-2.0");
  assert.match(commerce.decisionReason, /staged mutation approval/i);
  assert.match(commerce.decisionReason, /provenance/i);
  assert.match(commerce.decisionReason, /do not import the Python\/Claude runtime/i);
  assert.match(commerce.decisionReason, /payment mutations/i);
  assert.match(commerce.decisionReason, /non-maintained repository/i);
});

test("System Design 101 is reference-only and evidence-gated", () => {
  const systemDesign = entry("bytebytegohq/system-design-101");

  assert.ok(systemDesign);
  assert.equal(systemDesign.sourceRepo, "ByteByteGoHq/system-design-101");
  assert.equal(systemDesign.ring, "assess");
  assert.equal(systemDesign.decision, "adapt");
  assert.equal(systemDesign.license, "CC-BY-NC-ND-4.0");
  assert.match(systemDesign.decisionReason, /do not copy assets/i);
  assert.match(systemDesign.decisionReason, /benchmarks/i);
  assert.match(systemDesign.decisionReason, /SLO evidence/i);
});
