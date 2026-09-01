import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  validateTraceabilityDirectory,
  validateTraceabilityManifest,
} from "./traceability-contract.mjs";

function createFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "ht-trace-"));
  const paths = {
    spec: "docs/specs/agent-harness.md",
    plan: "docs/plans/077-agent-harness.md",
    test: "scripts/harness.test.mjs",
  };
  for (const relativePath of Object.values(paths)) {
    const target = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const content = relativePath === paths.spec
      ? "# Spec\n\n## REQ-001\n\n- AC-001\n"
      : relativePath === paths.plan
        ? "# Plan 077\n\n### Step 1: Add deterministic gate\n"
        : "fixture\n";
    fs.writeFileSync(target, content, "utf8");
  }
  return { rootDir, paths };
}

function validManifest(paths) {
  return {
    schemaVersion: 1,
    planId: "077",
    specPath: paths.spec,
    planPath: paths.plan,
    tasks: [{ id: "TASK-001", title: "Add deterministic gate", planStep: "Step 1" }],
    requirements: [
      {
        id: "REQ-001",
        acceptanceCriteria: [
          {
            id: "AC-001",
            mustHave: true,
            taskIds: ["TASK-001"],
            verifications: [{ type: "test", path: paths.test }],
          },
        ],
      },
    ],
  };
}

test("validateTraceabilityManifest accepts covered must-have criteria", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const result = validateTraceabilityManifest(validManifest(paths), { rootDir });
  assert.equal(result.acceptanceCriteria, 1);
});

test("validateTraceabilityManifest validates supplied bound artifact snapshots", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const artifactSnapshots = {
    specPath: {
      path: paths.spec,
      bytes: fs.readFileSync(path.join(rootDir, paths.spec)),
    },
    planPath: {
      path: paths.plan,
      bytes: fs.readFileSync(path.join(rootDir, paths.plan)),
    },
  };
  fs.writeFileSync(
    path.join(rootDir, paths.spec),
    "# Changed spec\n\n## REQ-002\n\n- AC-002\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(rootDir, paths.plan),
    "# Changed plan\n\n### Step 2: Different work\n",
    "utf8",
  );

  const result = validateTraceabilityManifest(validManifest(paths), {
    rootDir,
    artifactSnapshots,
  });

  assert.equal(result.acceptanceCriteria, 1);
});

test("validateTraceabilityManifest requires the canonical lowercase suffixed filename", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const suffixedPlan = "docs/plans/077A-agent-harness.md";
  fs.writeFileSync(
    path.join(rootDir, suffixedPlan),
    "# Plan 077A\n\n### Step 1: Add deterministic gate\n",
    "utf8",
  );
  const manifest = validManifest({ ...paths, plan: suffixedPlan });
  manifest.planId = "077A";

  assert.equal(
    validateTraceabilityManifest(manifest, { rootDir, fileName: "077a.json" }).planId,
    "077A",
  );
  for (const fileName of ["077A.json", "077a.JSON", "077.json"]) {
    assert.throws(
      () => validateTraceabilityManifest(manifest, { rootDir, fileName }),
      /filename must match planId/i,
    );
  }
});

test("validateTraceabilityManifest rejects unknown fields at every object level", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const mutations = [
    (manifest) => { manifest.notes = "unsupported"; },
    (manifest) => { manifest.tasks[0].notes = "unsupported"; },
    (manifest) => { manifest.requirements[0].notes = "unsupported"; },
    (manifest) => { manifest.requirements[0].acceptanceCriteria[0].notes = "unsupported"; },
    (manifest) => { manifest.requirements[0].acceptanceCriteria[0].verifications[0].notes = "unsupported"; },
  ];

  for (const mutate of mutations) {
    const manifest = validManifest(paths);
    mutate(manifest);
    assert.throws(
      () => validateTraceabilityManifest(manifest, { rootDir }),
      /unsupported field/i,
    );
  }
});

test("validateTraceabilityManifest rejects Windows drive-relative paths", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const manifest = validManifest(paths);
  manifest.requirements[0].acceptanceCriteria[0].verifications[0].path =
    `D:${paths.test}`;

  assert.throws(
    () => validateTraceabilityManifest(manifest, { rootDir }),
    /repository-relative/i,
  );
});

test("validateTraceabilityManifest rejects an unknown task reference", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const manifest = validManifest(paths);
  manifest.requirements[0].acceptanceCriteria[0].taskIds = ["TASK-404"];
  assert.throws(
    () => validateTraceabilityManifest(manifest, { rootDir }),
    /unknown task/i,
  );
});

test("validateTraceabilityManifest rejects uncovered must-have criteria", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const manifest = validManifest(paths);
  manifest.requirements[0].acceptanceCriteria[0].verifications = [];
  assert.throws(
    () => validateTraceabilityManifest(manifest, { rootDir }),
    /must-have.*verification/i,
  );
});

test("validateTraceabilityManifest rejects missing test paths", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const manifest = validManifest(paths);
  manifest.requirements[0].acceptanceCriteria[0].verifications[0].path =
    "scripts/missing.test.mjs";
  assert.throws(
    () => validateTraceabilityManifest(manifest, { rootDir }),
    /verification path does not exist/i,
  );
});

test("validateTraceabilityManifest rejects a non-test file as test evidence", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(rootDir, "package.json"), "{}\n", "utf8");
  const manifest = validManifest(paths);
  manifest.requirements[0].acceptanceCriteria[0].verifications[0].path =
    "package.json";

  assert.throws(
    () => validateTraceabilityManifest(manifest, { rootDir }),
    /test evidence.*test or spec filename/i,
  );
});

test("validateTraceabilityManifest rejects a directory as test evidence", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const directoryPath = path.join(rootDir, "scripts", "fake.test.mjs");
  fs.mkdirSync(directoryPath, { recursive: true });
  const manifest = validManifest(paths);
  manifest.requirements[0].acceptanceCriteria[0].verifications[0].path =
    "scripts/fake.test.mjs";

  assert.throws(
    () => validateTraceabilityManifest(manifest, { rootDir }),
    /test evidence.*regular file/i,
  );
});

test("validateTraceabilityManifest rejects acceptance criteria missing from the spec", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const manifest = validManifest(paths);
  manifest.requirements[0].acceptanceCriteria[0].id = "AC-002";
  assert.throws(
    () => validateTraceabilityManifest(manifest, { rootDir }),
    /acceptance criterion AC-002 is not declared under REQ-001 in spec/i,
  );
});

test("validateTraceabilityManifest rejects spec criteria missing from the manifest", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.appendFileSync(path.join(rootDir, paths.spec), "- AC-002\n", "utf8");
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /spec acceptance criterion AC-002 is missing from traceability manifest/i,
  );
});

test("validateTraceabilityManifest rejects a plan step that does not exist", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const manifest = validManifest(paths);
  manifest.tasks[0].planStep = "Step 2";
  assert.throws(
    () => validateTraceabilityManifest(manifest, { rootDir }),
    /plan step Step 2 is not declared in plan/i,
  );
});

test("validateTraceabilityManifest rejects lexical traversal across artifact directories", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const manifest = validManifest(paths);
  manifest.specPath = "docs/specs/../plans/077-agent-harness.md";
  assert.throws(
    () => validateTraceabilityManifest(manifest, { rootDir }),
    /specPath.*(?:repository-relative|stay under docs\/specs)/i,
  );
});

test("validateTraceabilityManifest rejects cross-platform absolute paths", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const manifest = validManifest(paths);
  manifest.requirements[0].acceptanceCriteria[0].verifications[0].path =
    String.raw`C:\private\result.test.mjs`;
  assert.throws(
    () => validateTraceabilityManifest(manifest, { rootDir }),
    /repository-relative/i,
  );
});

test("validateTraceabilityManifest keeps acceptance criteria under their declared requirement", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(rootDir, paths.spec),
    "# Spec\n\n## REQ-001\n\n- AC-001\n\n## REQ-002\n\n- AC-002\n",
    "utf8",
  );
  const manifest = validManifest(paths);
  const firstCriterion = manifest.requirements[0].acceptanceCriteria[0];
  firstCriterion.id = "AC-002";
  manifest.requirements.push({
    id: "REQ-002",
    acceptanceCriteria: [{ ...structuredClone(firstCriterion), id: "AC-001" }],
  });

  assert.throws(
    () => validateTraceabilityManifest(manifest, { rootDir }),
    /acceptance criterion AC-002 is not declared under REQ-001/i,
  );
});

test("validateTraceabilityManifest rejects an acceptance id owned by multiple requirements", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(rootDir, paths.spec),
    "# Spec\n\n## REQ-001\n\n- AC-001\n\n## REQ-002\n\n- AC-001\n- AC-002\n",
    "utf8",
  );
  const manifest = validManifest(paths);
  manifest.requirements.push({
    id: "REQ-002",
    acceptanceCriteria: [
      {
        id: "AC-002",
        mustHave: true,
        taskIds: ["TASK-001"],
        verifications: [{ type: "test", path: paths.test }],
      },
    ],
  });

  assert.throws(
    () => validateTraceabilityManifest(manifest, { rootDir }),
    /acceptance criterion AC-001.*multiple requirements/i,
  );
});

test("validateTraceabilityManifest stops the last requirement at the next parent heading", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(rootDir, paths.spec),
    [
      "# Spec",
      "",
      "### REQ-001",
      "- AC-001",
      "- AC-003",
      "",
      "### REQ-002",
      "- AC-002",
      "",
      "## Success Criteria",
      "AC-001 through AC-003 are required.",
      "",
    ].join("\n"),
    "utf8",
  );
  const manifest = validManifest(paths);
  const verification = manifest.requirements[0].acceptanceCriteria[0].verifications;
  manifest.requirements[0].acceptanceCriteria = [{
    id: "AC-003",
    mustHave: true,
    taskIds: ["TASK-001"],
    verifications: structuredClone(verification),
  }];
  manifest.requirements.push({
    id: "REQ-002",
    acceptanceCriteria: [
      {
        id: "AC-001",
        mustHave: true,
        taskIds: ["TASK-001"],
        verifications: structuredClone(verification),
      },
      {
        id: "AC-002",
        mustHave: true,
        taskIds: ["TASK-001"],
        verifications: structuredClone(verification),
      },
    ],
  });

  assert.throws(
    () => validateTraceabilityManifest(manifest, { rootDir }),
    /acceptance criterion AC-001 is not declared under REQ-002/i,
  );
});

test("validateTraceabilityManifest does not let the manifest downgrade required criteria", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const manifest = validManifest(paths);
  const criterion = manifest.requirements[0].acceptanceCriteria[0];
  criterion.mustHave = false;
  criterion.taskIds = [];
  criterion.verifications = [];

  assert.throws(
    () => validateTraceabilityManifest(manifest, { rootDir }),
    /AC-001 must be marked mustHave/i,
  );
});

test("validateTraceabilityManifest ignores fenced and commented contract examples", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.appendFileSync(
    path.join(rootDir, paths.spec),
    [
      "",
      "```md",
      "## REQ-002",
      "- AC-002",
      "```",
      "<!-- ## REQ-003 - AC-003 -->",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.appendFileSync(
    path.join(rootDir, paths.plan),
    "\n```md\n### Step 2: Example only\n```\n",
    "utf8",
  );

  assert.equal(
    validateTraceabilityManifest(validManifest(paths), { rootDir }).acceptanceCriteria,
    1,
  );
});

test("validateTraceabilityManifest rejects requirements and steps declared only in fences", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(rootDir, paths.spec),
    "# Spec\n\n```md\n## REQ-001\n- AC-001\n```\n",
    "utf8",
  );
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /spec must declare requirement headings/i,
  );

  fs.writeFileSync(
    path.join(rootDir, paths.spec),
    "# Spec\n\n## REQ-001\n- AC-001\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(rootDir, paths.plan),
    "# Plan 077\n\n```md\n### Step 1: Example only\n```\n",
    "utf8",
  );
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /plan step Step 1 is not declared in plan/i,
  );
});

test("validateTraceabilityManifest ignores requirements and steps after unclosed HTML comments", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(rootDir, paths.spec),
    "# Spec\n\n<!-- hidden through EOF\n## REQ-001\n- AC-001\n",
    "utf8",
  );
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /spec must declare requirement headings/i,
  );

  fs.writeFileSync(
    path.join(rootDir, paths.spec),
    "# Spec\n\n## REQ-001\n- AC-001\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(rootDir, paths.plan),
    "# Plan 077\n\n<!-- hidden through EOF\n### Step 1: Example only\n",
    "utf8",
  );
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /plan step Step 1 is not declared in plan/i,
  );
});

test("validateTraceabilityManifest rejects headings split across Markdown line endings", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(rootDir, paths.spec),
    "# Spec\n\n##\nREQ-001\n- AC-001\n",
    "utf8",
  );
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /spec must declare requirement headings/i,
  );

  fs.writeFileSync(
    path.join(rootDir, paths.spec),
    "# Spec\n\n## REQ-001\n- AC-001\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(rootDir, paths.plan),
    "# Plan 077\n\n###\nStep 1: Not a heading\n",
    "utf8",
  );
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /plan step Step 1 is not declared in plan/i,
  );
});

test("validateTraceabilityManifest ignores contracts hidden by CommonMark fences and raw HTML", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const specPath = path.join(rootDir, paths.spec);
  const planPath = path.join(rootDir, paths.plan);

  fs.writeFileSync(
    specPath,
    "# Spec\n\n```md\n\t```\n## REQ-001\n- AC-001\n```\n",
    "utf8",
  );
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /spec must declare requirement headings/i,
  );

  fs.writeFileSync(
    specPath,
    "# Spec\n\n<pre>\n## REQ-001\n- AC-001\n</pre>\n",
    "utf8",
  );
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /raw HTML is not allowed/i,
  );

  fs.writeFileSync(
    specPath,
    "# Spec\r\r```md\r## REQ-001\r- AC-001\r```\r",
    "utf8",
  );
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /spec must declare requirement headings/i,
  );

  fs.writeFileSync(specPath, "# Spec\n\n## REQ-001\n- AC-001\n", "utf8");
  fs.writeFileSync(
    planPath,
    "# Plan 077\n\n<script>\n### Step 1: Hidden\n</script>\n",
    "utf8",
  );
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /raw HTML is not allowed/i,
  );

  fs.writeFileSync(
    planPath,
    "# Plan 077\r\r```md\r### Step 1: Hidden\r```\r",
    "utf8",
  );
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /plan step Step 1 is not declared in plan/i,
  );
});

test("validateTraceabilityManifest keeps real requirements after fenced comment examples", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(rootDir, paths.spec),
    [
      "# Spec",
      "",
      "## REQ-001",
      "- AC-001",
      "",
      "```md",
      "<!-- unclosed example comment",
      "```",
      "",
      "## REQ-002",
      "- AC-002",
      "",
    ].join("\n"),
    "utf8",
  );

  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /spec requirement REQ-002 is missing from traceability manifest/i,
  );
});

test("validateTraceabilityManifest keeps requirements after an invalid backtick fence opener", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(rootDir, paths.spec),
    [
      "# Spec",
      "",
      "## REQ-001",
      "- AC-001",
      "",
      "```md`invalid",
      "## REQ-002",
      "- AC-002",
      "```",
      "",
    ].join("\n"),
    "utf8",
  );

  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /multiline inline code is not allowed/i,
  );
});

test("validateTraceabilityManifest preserves visible requirements after literal comment markers", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  for (const literal of ["`<!--`", "\\<!--"]) {
    fs.writeFileSync(
      path.join(rootDir, paths.spec),
      [
        "# Spec",
        "",
        "## REQ-001",
        "- AC-001",
        literal,
        "## REQ-002",
        "- AC-002",
        "",
      ].join("\n"),
      "utf8",
    );
    assert.throws(
      () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
      /spec requirement REQ-002 is missing from traceability manifest/i,
    );
  }
});

test("validateTraceabilityManifest fails closed on multiline code spans and Unicode line separators", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const specPath = path.join(rootDir, paths.spec);
  const planPath = path.join(rootDir, paths.plan);

  fs.writeFileSync(
    specPath,
    "# Spec\n\n`code begins\n## REQ-001\n- AC-001\n`\n",
    "utf8",
  );
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /multiline inline code is not allowed/i,
  );

  fs.writeFileSync(specPath, "# Spec\u2028## REQ-001\u2028- AC-001\n", "utf8");
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /Unicode line separators are not allowed/i,
  );

  fs.writeFileSync(specPath, "# Spec\n\n## REQ-001\n- AC-001\n", "utf8");
  fs.writeFileSync(planPath, "# Plan 077\u2029### Step 1: Hidden\n", "utf8");
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /Unicode line separators are not allowed/i,
  );
});

test("validateTraceabilityManifest recognizes CommonMark-indented contract headings", (context) => {
  const { rootDir, paths } = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(rootDir, paths.spec),
    [
      "# Spec",
      "",
      "## REQ-001",
      "- AC-001",
      "",
      "  ## REQ-002",
      "  - AC-002",
      "",
    ].join("\n"),
    "utf8",
  );
  assert.throws(
    () => validateTraceabilityManifest(validManifest(paths), { rootDir }),
    /spec requirement REQ-002 is missing from traceability manifest/i,
  );

  fs.writeFileSync(
    path.join(rootDir, paths.spec),
    "# Spec\n\n## REQ-001\n- AC-001\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(rootDir, paths.plan),
    "# Plan 077\n\n   ### Step 1: Valid indented heading\n",
    "utf8",
  );
  assert.equal(
    validateTraceabilityManifest(validManifest(paths), { rootDir }).acceptanceCriteria,
    1,
  );
});

test("validateTraceabilityDirectory rejects a junction outside the repository", (context) => {
  const { rootDir } = createFixture();
  const externalDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ht-trace-external-"));
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  context.after(() => fs.rmSync(externalDirectory, { recursive: true, force: true }));
  const directory = path.join(rootDir, "docs", "plans", "traceability");
  try {
    fs.symlinkSync(externalDirectory, directory, "junction");
  } catch (error) {
    if (error?.code === "EPERM") {
      context.skip("Directory junction creation is unavailable");
      return;
    }
    throw error;
  }

  assert.throws(
    () => validateTraceabilityDirectory({ rootDir, directory }),
    /repository directory/i,
  );
});
