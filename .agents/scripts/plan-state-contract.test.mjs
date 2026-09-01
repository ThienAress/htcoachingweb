import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  validatePlanStateFile,
  validatePlanStateManifest,
  validatePlanTraceCoverage,
} from "./plan-state-contract.mjs";

function createFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "ht-plan-state-"));
  const planPath = "docs/plans/077-harden-agent-harness.md";
  fs.mkdirSync(path.join(rootDir, "docs", "plans"), { recursive: true });
  fs.writeFileSync(path.join(rootDir, planPath), "# Plan 077\n", "utf8");
  fs.writeFileSync(
    path.join(rootDir, "docs", "plans", "README.md"),
    "| 077 | Harden agent harness | P1 | L | — | IN PROGRESS |\n",
    "utf8",
  );
  return { rootDir, planPath };
}

function validManifest(planPath) {
  return {
    schemaVersion: 1,
    legacyCutoff: "076",
    plans: [
      {
        id: "077",
        title: "Harden agent harness",
        path: planPath,
        priority: "P1",
        complexity: "complex",
        lifecycle: "in_progress",
        verification: "none",
        rollout: "not_applicable",
        owner: "root",
        updatedAt: "2026-08-30",
      },
    ],
  };
}

test("validatePlanStateManifest accepts a valid post-cutoff plan", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const result = validatePlanStateManifest(validManifest(planPath), { rootDir });
  assert.equal(result.plans.length, 1);
});

test("validatePlanStateManifest validates supplied bound plan-index bytes", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const indexPath = path.join(rootDir, "docs", "plans", "README.md");
  const plansIndexSnapshot = {
    path: "docs/plans/README.md",
    bytes: fs.readFileSync(indexPath),
  };
  fs.writeFileSync(indexPath, "# Changed index without the plan row\n", "utf8");

  const result = validatePlanStateManifest(validManifest(planPath), {
    rootDir,
    plansIndexSnapshot,
  });

  assert.equal(result.plans.length, 1);
});

test("validatePlanStateManifest rejects invalid lifecycle enum", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const manifest = validManifest(planPath);
  manifest.plans[0].lifecycle = "almost-done";
  assert.throws(
    () => validatePlanStateManifest(manifest, { rootDir }),
    /lifecycle/i,
  );
});

test("validatePlanStateManifest rejects duplicate ids", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const manifest = validManifest(planPath);
  manifest.plans.push(structuredClone(manifest.plans[0]));
  assert.throws(
    () => validatePlanStateManifest(manifest, { rootDir }),
    /duplicate plan id/i,
  );
});

test("validatePlanStateManifest rejects path and id mismatch", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const manifest = validManifest(planPath);
  manifest.plans[0].id = "078";
  assert.throws(
    () => validatePlanStateManifest(manifest, { rootDir }),
    /must start with plan id/i,
  );
});

test("validatePlanStateManifest rejects invalid complexity", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const manifest = validManifest(planPath);
  manifest.plans[0].complexity = "large";
  assert.throws(
    () => validatePlanStateManifest(manifest, { rootDir }),
    /complexity/i,
  );
});

test("validatePlanStateManifest rejects unknown fields at every object level", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const mutations = [
    (manifest) => { manifest.notes = "unsupported"; },
    (manifest) => { manifest.plans[0].notes = "unsupported"; },
  ];

  for (const mutate of mutations) {
    const manifest = validManifest(planPath);
    mutate(manifest);
    assert.throws(
      () => validatePlanStateManifest(manifest, { rootDir }),
      /unsupported field/i,
    );
  }
});

test("validatePlanStateManifest rejects impossible dates and drive-relative paths", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const impossibleDate = validManifest(planPath);
  impossibleDate.plans[0].updatedAt = "2026-99-99";
  assert.throws(
    () => validatePlanStateManifest(impossibleDate, { rootDir }),
    /updatedAt/i,
  );

  const driveRelative = validManifest(planPath);
  driveRelative.plans[0].path = `D:${planPath}`;
  assert.throws(
    () => validatePlanStateManifest(driveRelative, { rootDir }),
    /repository-relative/i,
  );
});

test("validatePlanTraceCoverage requires traceability for moderate and complex plans", () => {
  const state = validManifest("docs/plans/077-harden-agent-harness.md");
  assert.throws(
    () => validatePlanTraceCoverage(state, { planIds: [] }),
    /plan 077.*traceability/i,
  );
  assert.doesNotThrow(() => validatePlanTraceCoverage(state, { planIds: ["077"] }));
});

test("validatePlanTraceCoverage allows simple plans without a trace manifest", () => {
  const state = validManifest("docs/plans/077-harden-agent-harness.md");
  state.plans[0].complexity = "simple";
  assert.doesNotThrow(() => validatePlanTraceCoverage(state, { planIds: [] }));
});

test("validatePlanStateManifest rejects entries hidden behind the legacy cutoff", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const manifest = validManifest(planPath);
  manifest.legacyCutoff = "077";
  assert.throws(
    () => validatePlanStateManifest(manifest, { rootDir }),
    /legacyCutoff must remain 076/i,
  );
});

test("validatePlanStateManifest requires the human plan index row", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(rootDir, "docs", "plans", "README.md"), "# Plans\n", "utf8");
  assert.throws(
    () => validatePlanStateManifest(validManifest(planPath), { rootDir }),
    /plan 077 is missing from docs\/plans\/README\.md/i,
  );
});

test("validatePlanStateManifest ignores plan index rows inside fences and comments", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(rootDir, "docs", "plans", "README.md"),
    [
      "# Plans",
      "",
      "```md",
      "| 077 | Example only | P1 | L | — | DONE |",
      "```",
      "<!-- | 077 | Comment only | P1 | L | — | DONE | -->",
      "",
    ].join("\n"),
    "utf8",
  );

  assert.throws(
    () => validatePlanStateManifest(validManifest(planPath), { rootDir }),
    /plan 077 is missing from docs\/plans\/README\.md/i,
  );
});

test("validatePlanStateManifest ignores plan index rows after an unclosed HTML comment", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(rootDir, "docs", "plans", "README.md"),
    [
      "# Plans",
      "",
      "<!-- hidden through EOF",
      "| 077 | Comment only | P1 | L | — | DONE |",
      "",
    ].join("\n"),
    "utf8",
  );

  assert.throws(
    () => validatePlanStateManifest(validManifest(planPath), { rootDir }),
    /plan 077 is missing from docs\/plans\/README\.md/i,
  );
});

test("validatePlanStateManifest rejects a plan id split across table-row line endings", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(rootDir, "docs", "plans", "README.md"),
    "# Plans\n\n|\n077\n| Not a row |\n",
    "utf8",
  );

  assert.throws(
    () => validatePlanStateManifest(validManifest(planPath), { rootDir }),
    /plan 077 is missing from docs\/plans\/README\.md/i,
  );
});

test("validatePlanStateManifest ignores rows hidden by CommonMark fences and raw HTML", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const indexPath = path.join(rootDir, "docs", "plans", "README.md");
  const manifest = validManifest(planPath);

  fs.writeFileSync(
    indexPath,
    "# Plans\n\n```md\n\t```\n| 077 | Hidden | P1 | L | — | DONE |\n```\n",
    "utf8",
  );
  assert.throws(
    () => validatePlanStateManifest(manifest, { rootDir }),
    /plan 077 is missing from docs\/plans\/README\.md/i,
  );

  fs.writeFileSync(
    indexPath,
    "# Plans\n\n<pre>\n| 077 | Hidden | P1 | L | — | DONE |\n</pre>\n",
    "utf8",
  );
  assert.throws(
    () => validatePlanStateManifest(manifest, { rootDir }),
    /raw HTML is not allowed/i,
  );

  fs.writeFileSync(
    indexPath,
    "# Plans\r\r```md\r| 077 | Hidden | P1 | L | — | DONE |\r```\r",
    "utf8",
  );
  assert.throws(
    () => validatePlanStateManifest(manifest, { rootDir }),
    /plan 077 is missing from docs\/plans\/README\.md/i,
  );
});

test("validatePlanStateManifest keeps a real row after a fenced unclosed-comment example", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(rootDir, "docs", "plans", "README.md"),
    [
      "# Plans",
      "",
      "```md",
      "<!-- unclosed example comment",
      "```",
      "",
      "| 077 | Real row | P1 | L | — | DONE |",
      "",
    ].join("\n"),
    "utf8",
  );

  assert.equal(
    validatePlanStateManifest(validManifest(planPath), { rootDir }).plans.length,
    1,
  );
});

test("validatePlanStateManifest rejects ambiguous Markdown line constructs", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const indexPath = path.join(rootDir, "docs", "plans", "README.md");

  fs.writeFileSync(
    indexPath,
    "# Plans\n\n`code begins\n| 077 | Hidden | P1 | L | — | DONE |\n`\n",
    "utf8",
  );
  assert.throws(
    () => validatePlanStateManifest(validManifest(planPath), { rootDir }),
    /multiline inline code is not allowed/i,
  );

  fs.writeFileSync(
    indexPath,
    "# Plans\u2028| 077 | Hidden | P1 | L | — | DONE |\n",
    "utf8",
  );
  assert.throws(
    () => validatePlanStateManifest(validManifest(planPath), { rootDir }),
    /Unicode line separators are not allowed/i,
  );
});

test("validatePlanStateManifest requires the plan path to be a Markdown file", (context) => {
  const { rootDir } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const directoryPath = "docs/plans/077-directory.md";
  fs.mkdirSync(path.join(rootDir, directoryPath));
  const manifest = validManifest(directoryPath);

  assert.throws(
    () => validatePlanStateManifest(manifest, { rootDir }),
    /plan.*regular markdown file/i,
  );
});

test("validatePlanStateManifest rejects multiple plan files with the same canonical id", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(rootDir, "docs", "plans", "077-second-plan.md"),
    "# Plan 077 duplicate\n",
    "utf8",
  );

  assert.throws(
    () => validatePlanStateManifest(validManifest(planPath), { rootDir }),
    /multiple plan files.*077/i,
  );
});

test("validatePlanStateManifest rejects registered and unregistered nested plan files", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const nestedRegistered = "docs/plans/nested/077-harden-agent-harness.md";
  fs.mkdirSync(path.join(rootDir, "docs", "plans", "nested"));
  fs.renameSync(path.join(rootDir, planPath), path.join(rootDir, nestedRegistered));

  assert.throws(
    () => validatePlanStateManifest(validManifest(nestedRegistered), { rootDir }),
    /directly under docs\/plans|plan files must be regular files directly/i,
  );

  fs.renameSync(path.join(rootDir, nestedRegistered), path.join(rootDir, planPath));
  fs.writeFileSync(
    path.join(rootDir, "docs", "plans", "nested", "079-hidden-plan.md"),
    "# Hidden plan 079\n",
    "utf8",
  );
  assert.throws(
    () => validatePlanStateManifest(validManifest(planPath), { rootDir }),
    /plan files must be regular files directly/i,
  );
});

test("validatePlanStateManifest rejects plan-pattern directories", (context) => {
  const { rootDir, planPath } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(rootDir, "docs", "plans", "079-directory.md"));

  assert.throws(
    () => validatePlanStateManifest(validManifest(planPath), { rootDir }),
    /plan files must be regular files directly/i,
  );
});

test("validatePlanStateFile rejects a canonical manifest symlink", (context) => {
  const { rootDir, planPath } = createFixture();
  const externalDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ht-plan-state-external-"));
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  context.after(() => fs.rmSync(externalDirectory, { recursive: true, force: true }));
  const manifestPath = path.join(rootDir, "docs", "plans", "plan-state.json");
  const externalManifest = path.join(externalDirectory, "plan-state.json");
  fs.writeFileSync(externalManifest, `${JSON.stringify(validManifest(planPath))}\n`, "utf8");
  try {
    fs.symlinkSync(externalManifest, manifestPath, "file");
  } catch (error) {
    if (error?.code === "EPERM") {
      context.skip("File symlink creation requires Windows Developer Mode");
      return;
    }
    throw error;
  }

  assert.throws(
    () => validatePlanStateFile({ rootDir, manifestPath }),
    /regular file|escapes the repository/i,
  );
});
