import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateTechnologyRadar } from "./technology-radar-contract.mjs";

test("AI technology radar tracks TencentDB Agent Memory as assess/adapt", () => {
  const radar = validateTechnologyRadar(
    JSON.parse(
      readFileSync(
        new URL("../upstream-technologies/watchlist.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const memory = radar.entries.find(
    ({ id }) => id === "tencentcloud/tencentdb-agent-memory",
  );

  assert.ok(memory);
  assert.equal(memory.ring, "assess");
  assert.equal(memory.decision, "adapt");
  assert.equal(memory.autoInstall, false);
  assert.match(memory.decisionReason, /explicit memory/i);
});
