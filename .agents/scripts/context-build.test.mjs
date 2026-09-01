import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildContextManifest } from "./context-build.mjs";

const scriptPath = path.join(import.meta.dirname, "context-build.mjs");

function writeFixture(rootDir, relativePath, content) {
  const targetPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
}

function createFixture({ planId = "078" } = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "ht-context-build-"));
  const canonicalPlanId = planId.toUpperCase();
  const filePlanId = canonicalPlanId.toLowerCase();
  const planPath = `docs/plans/${filePlanId}-build-context.md`;
  const specPath = "docs/specs/context-build.md";
  const tracePath = `docs/plans/traceability/${filePlanId}.json`;
  writeFixture(
    rootDir,
    "docs/plans/README.md",
    `| ${canonicalPlanId} | Build context | P2 | L | 077 | IN PROGRESS | NONE | NOT APPLICABLE |\n`,
  );
  writeFixture(
    rootDir,
    planPath,
    `# Plan ${canonicalPlanId}: Build context\n\n### Step 1: Build manifest\n\nNo raw payload.\n`,
  );
  writeFixture(
    rootDir,
    specPath,
    "# Context spec\n\n### REQ-001 — Bounded manifest\n\n- `AC-001`: Stable metadata.\n",
  );
  writeFixture(rootDir, ".agents/scripts/example.test.mjs", "// evidence\n");
  writeFixture(
    rootDir,
    "docs/plans/plan-state.json",
    `${JSON.stringify({
      schemaVersion: 1,
      legacyCutoff: "076",
      plans: [
        {
          id: canonicalPlanId,
          title: "Build context",
          path: planPath,
          priority: "P2",
          complexity: "complex",
          lifecycle: "in_progress",
          verification: "none",
          rollout: "not_applicable",
          owner: "root",
          updatedAt: "2026-08-30",
        },
      ],
    }, null, 2)}\n`,
  );
  writeFixture(
    rootDir,
    tracePath,
    `${JSON.stringify({
      schemaVersion: 1,
      planId: canonicalPlanId,
      specPath,
      planPath,
      tasks: [{ id: "TASK-001", title: "Build", planStep: "Step 1" }],
      requirements: [
        {
          id: "REQ-001",
          acceptanceCriteria: [
            {
              id: "AC-001",
              mustHave: true,
              taskIds: ["TASK-001"],
              verifications: [
                { type: "test", path: ".agents/scripts/example.test.mjs" },
                { type: "command", command: "npm run agents:validate" },
              ],
            },
          ],
        },
      ],
    }, null, 2)}\n`,
  );
  const initResult = spawnSync("git", ["init", "--quiet"], { cwd: rootDir });
  assert.equal(initResult.status, 0);
  return { rootDir, planPath, specPath, tracePath, planId: canonicalPlanId };
}

test("buildContextManifest returns stable bounded metadata and trace maps", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));

  const first = buildContextManifest({ rootDir: fixture.rootDir, planId: "078" });
  const second = buildContextManifest({ rootDir: fixture.rootDir, planId: "078" });

  assert.deepEqual(first, second);
  assert.equal(first.plan.id, "078");
  assert.deepEqual(first.tasks, [{ id: "TASK-001", planStep: "Step 1" }]);
  assert.deepEqual(first.requirements, [
    {
      id: "REQ-001",
      acceptanceCriteria: [{ id: "AC-001", taskIds: ["TASK-001"] }],
    },
  ]);
  assert.deepEqual(first.verificationPaths, [".agents/scripts/example.test.mjs"]);
  assert.match(first.fingerprint, /^[0-9a-f]{64}$/);
  assert.match(first.repository.planDirectorySha256, /^[0-9a-f]{64}$/);
  assert.ok(first.readSet.every((entry) => !path.isAbsolute(entry.path)));
  assert.ok(first.readSet.every((entry) => /^[0-9a-f]{64}$/.test(entry.sha256)));
  assert.equal(JSON.stringify(first).includes("No raw payload"), false);
});

test("buildContextManifest rejects a detached HEAD that names no commit object", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(fixture.rootDir, ".git", "HEAD"),
    `${"a".repeat(40)}\n`,
    "utf8",
  );

  assert.throws(
    () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
    /invalid Git metadata/i,
  );
});

test("buildContextManifest rejects a symbolic HEAD ref that names no commit object", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const symbolicHead = spawnSync("git", ["symbolic-ref", "HEAD"], {
    cwd: fixture.rootDir,
    encoding: "utf8",
  });
  assert.equal(symbolicHead.status, 0);
  const refPath = path.join(
    fixture.rootDir,
    ".git",
    ...symbolicHead.stdout.trim().split("/"),
  );
  fs.mkdirSync(path.dirname(refPath), { recursive: true });
  fs.writeFileSync(refPath, `${"b".repeat(40)}\n`, "utf8");

  assert.throws(
    () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
    /invalid Git metadata/i,
  );
});

test("context CLI ignores inherited Git repository override variables", (context) => {
  const fixture = createFixture();
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ht-context-external-git-"));
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  context.after(() => fs.rmSync(externalRoot, { recursive: true, force: true }));
  assert.equal(spawnSync("git", ["init", "--quiet"], { cwd: externalRoot }).status, 0);
  fs.writeFileSync(path.join(externalRoot, "external.txt"), "external\n", "utf8");
  assert.equal(spawnSync("git", ["add", "external.txt"], { cwd: externalRoot }).status, 0);
  assert.equal(
    spawnSync(
      "git",
      ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "external"],
      { cwd: externalRoot },
    ).status,
    0,
  );

  const result = spawnSync(process.execPath, [scriptPath, "--plan", "078"], {
    cwd: fixture.rootDir,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_DIR: path.join(externalRoot, ".git"),
      GIT_WORK_TREE: fixture.rootDir,
      GIT_INDEX_FILE: path.join(externalRoot, ".git", "index"),
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).repository.head, "unborn");
});

test("buildContextManifest orders Unicode read-set paths by code unit", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const zPath = "tests/z.test.mjs";
  const umlautPath = "tests/ä.test.mjs";
  writeFixture(fixture.rootDir, zPath, "// z\n");
  writeFixture(fixture.rootDir, umlautPath, "// umlaut\n");
  const traceFile = path.join(fixture.rootDir, fixture.tracePath);
  const trace = JSON.parse(fs.readFileSync(traceFile, "utf8"));
  trace.requirements[0].acceptanceCriteria[0].verifications.unshift(
    { type: "test", path: umlautPath },
    { type: "test", path: zPath },
  );
  fs.writeFileSync(traceFile, `${JSON.stringify(trace, null, 2)}\n`, "utf8");

  const manifest = buildContextManifest({ rootDir: fixture.rootDir, planId: "078" });
  const orderedPaths = manifest.readSet.map(({ path: itemPath }) => itemPath);

  assert.ok(orderedPaths.indexOf(zPath) < orderedPaths.indexOf(umlautPath));
});

test("buildContextManifest canonicalizes suffixed plan IDs and trace filenames", (context) => {
  const fixture = createFixture({ planId: "079A" });
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));

  const upper = buildContextManifest({ rootDir: fixture.rootDir, planId: "079A" });
  const lower = buildContextManifest({ rootDir: fixture.rootDir, planId: "079a" });

  assert.deepEqual(
    {
      same: lower,
      id: upper.plan.id,
      tracePath: upper.readSet.find(({ path: itemPath }) =>
        itemPath.includes("traceability"))?.path,
    },
    {
      same: upper,
      id: "079A",
      tracePath: "docs/plans/traceability/079a.json",
    },
  );
});

test("buildContextManifest rejects sensitive declared artifact paths", (context) => {
  const unsafeNames = [
    "synthetic.owner＠privacy.invalid",
    "024 1234 5678",
    "abcd efgh ijkl mnop",
    ["AKIA", "A".repeat(16)].join(""),
  ];

  for (const unsafeName of unsafeNames) {
    const fixture = createFixture();
    context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
    const unsafeSpecPath = `docs/specs/${unsafeName}.md`;
    writeFixture(
      fixture.rootDir,
      unsafeSpecPath,
      fs.readFileSync(path.join(fixture.rootDir, fixture.specPath), "utf8"),
    );
    const traceFile = path.join(fixture.rootDir, fixture.tracePath);
    const trace = JSON.parse(fs.readFileSync(traceFile, "utf8"));
    trace.specPath = unsafeSpecPath;
    fs.writeFileSync(traceFile, JSON.stringify(trace), "utf8");

    assert.throws(
      () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
      /invalid context artifacts/i,
    );
  }
});

test("buildContextManifest rejects invalid plan IDs without reflecting input", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const privateInput = "../private-owner/078";

  assert.throws(
    () => buildContextManifest({ rootDir: fixture.rootDir, planId: privateInput }),
    (error) => !error.message.includes(privateInput) && /plan id/i.test(error.message),
  );
});

test("buildContextManifest fails closed when a declared artifact is missing", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  fs.unlinkSync(path.join(fixture.rootDir, fixture.specPath));

  assert.throws(
    () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
    /artifact is missing/i,
  );
});

test("buildContextManifest rejects trace paths that escape the repository", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const traceFile = path.join(fixture.rootDir, fixture.tracePath);
  const trace = JSON.parse(fs.readFileSync(traceFile, "utf8"));
  trace.specPath = "../../private-owner/spec.md";
  fs.writeFileSync(traceFile, JSON.stringify(trace), "utf8");

  assert.throws(
    () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
    (error) => !error.message.includes("private-owner") && /invalid context artifacts/i.test(error.message),
  );
});

test("buildContextManifest rejects non-canonical backslash artifact paths", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const traceFile = path.join(fixture.rootDir, fixture.tracePath);
  const trace = JSON.parse(fs.readFileSync(traceFile, "utf8"));
  trace.specPath = fixture.specPath.replaceAll("/", "\\");
  fs.writeFileSync(traceFile, JSON.stringify(trace), "utf8");

  assert.throws(
    () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
    /invalid context artifacts/i,
  );
});

test("buildContextManifest rejects Windows drive-relative artifact aliases", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const traceFile = path.join(fixture.rootDir, fixture.tracePath);
  const trace = JSON.parse(fs.readFileSync(traceFile, "utf8"));
  trace.specPath = `D:${fixture.specPath}`;
  fs.writeFileSync(traceFile, JSON.stringify(trace), "utf8");

  assert.throws(
    () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
    /repository-relative|invalid context artifacts/i,
  );
});

test("buildContextManifest rejects backslashes in verification paths", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const traceFile = path.join(fixture.rootDir, fixture.tracePath);
  const trace = JSON.parse(fs.readFileSync(traceFile, "utf8"));
  trace.requirements[0].acceptanceCriteria[0].verifications[0].path =
    ".agents\\scripts\\example.test.mjs";
  fs.writeFileSync(traceFile, JSON.stringify(trace), "utf8");

  assert.throws(
    () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
    /invalid context artifacts/i,
  );
});

test("buildContextManifest requires a real Git worktree", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  fs.rmSync(path.join(fixture.rootDir, ".git"), { recursive: true, force: true });

  assert.throws(
    () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
    /git metadata/i,
  );
});

test("buildContextManifest enforces an upper bound on task metadata", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const traceFile = path.join(fixture.rootDir, fixture.tracePath);
  const trace = JSON.parse(fs.readFileSync(traceFile, "utf8"));
  trace.tasks = Array.from({ length: 129 }, (_, index) => ({
    id: `TASK-${String(index + 1).padStart(3, "0")}`,
    title: "Bounded task",
    planStep: "Step 1",
  }));
  fs.writeFileSync(traceFile, JSON.stringify(trace), "utf8");

  assert.throws(
    () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
    /context limit/i,
  );
});

test("buildContextManifest validates the bound spec bytes instead of a transient validator reread", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const traceFile = path.join(fixture.rootDir, fixture.tracePath);
  const trace = JSON.parse(fs.readFileSync(traceFile, "utf8"));
  trace.requirements[0].acceptanceCriteria[0].id = "AC-002";
  fs.writeFileSync(traceFile, `${JSON.stringify(trace, null, 2)}\n`, "utf8");
  const specFile = path.resolve(fixture.rootDir, fixture.specPath);
  const originalReadFileSync = fs.readFileSync;
  let specReads = 0;
  fs.readFileSync = function patchedReadFileSync(file, ...args) {
    if (typeof file !== "number" && path.resolve(file) === specFile) {
      specReads += 1;
      if (specReads === 2) {
        const transient = "# Context spec\n\n### REQ-001 — Transient\n\n- `AC-002`: Swap.\n";
        return typeof args[0] === "string" ? transient : Buffer.from(transient);
      }
    }
    return originalReadFileSync.call(fs, file, ...args);
  };

  try {
    assert.throws(
      () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
      /invalid context artifacts/i,
    );
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
});

test("buildContextManifest validates bound plan-index bytes instead of a transient reread", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const indexFile = path.resolve(fixture.rootDir, "docs/plans/README.md");
  const transientIndex = fs.readFileSync(indexFile, "utf8");
  fs.writeFileSync(indexFile, "# Plans without the registered row\n", "utf8");
  const originalReadFileSync = fs.readFileSync;
  fs.readFileSync = function patchedReadFileSync(file, ...args) {
    if (typeof file !== "number" && path.resolve(file) === indexFile) {
      return typeof args[0] === "string" ? transientIndex : Buffer.from(transientIndex);
    }
    return originalReadFileSync.call(fs, file, ...args);
  };

  try {
    assert.throws(
      () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
      /invalid context plan state/i,
    );
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
});

test("buildContextManifest revalidates the post-cutoff plan directory inventory", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const plansDirectory = path.resolve(fixture.rootDir, "docs/plans");
  const hiddenName = "079-unregistered-plan.md";
  writeFixture(fixture.rootDir, `docs/plans/${hiddenName}`, "# Unregistered plan\n");
  const originalReaddirSync = fs.readdirSync;
  let planDirectoryReads = 0;
  fs.readdirSync = function patchedReaddirSync(directory, ...args) {
    const entries = originalReaddirSync.call(fs, directory, ...args);
    if (path.resolve(directory) === plansDirectory) {
      planDirectoryReads += 1;
      if (planDirectoryReads === 1) {
        return entries.filter((entry) =>
          (typeof entry === "string" ? entry : entry.name) !== hiddenName);
      }
    }
    return entries;
  };

  try {
    assert.throws(
      () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
      /changed during collection|invalid context plan state/i,
    );
  } finally {
    fs.readdirSync = originalReaddirSync;
  }
});

test("buildContextManifest revalidates metadata for every registered plan path", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const otherPlanPath = "docs/plans/079-other-plan.md";
  const otherPlanFile = path.resolve(fixture.rootDir, otherPlanPath);
  writeFixture(fixture.rootDir, otherPlanPath, "# Plan 079\n");
  fs.appendFileSync(
    path.join(fixture.rootDir, "docs/plans/README.md"),
    "| 079 | Other plan | P2 | L | 078 | IN PROGRESS |\n",
    "utf8",
  );
  const stateFile = path.join(fixture.rootDir, "docs/plans/plan-state.json");
  const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  state.plans.push({
    ...structuredClone(state.plans[0]),
    id: "079",
    title: "Other plan",
    path: otherPlanPath,
  });
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  const originalLstatSync = fs.lstatSync;
  let otherPlanObservations = 0;
  fs.lstatSync = function patchedLstatSync(file, ...args) {
    if (path.resolve(file) === otherPlanFile) {
      otherPlanObservations += 1;
      if (otherPlanObservations === 1) {
        const stats = originalLstatSync.call(fs, file, ...args);
        fs.unlinkSync(otherPlanFile);
        fs.mkdirSync(otherPlanFile);
        return stats;
      }
    }
    return originalLstatSync.call(fs, file, ...args);
  };

  try {
    assert.throws(
      () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
      /changed during collection|invalid context plan state/i,
    );
  } finally {
    fs.lstatSync = originalLstatSync;
  }
});

test("buildContextManifest rejects a verification that grows past the per-file cap during read", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const targetFile = path.resolve(fixture.rootDir, ".agents/scripts/example.test.mjs");
  const originalBytes = fs.readFileSync(targetFile);
  const originalLstatSync = fs.lstatSync;
  let targetCalls = 0;
  let boundedStats;
  fs.lstatSync = function patchedLstatSync(file, ...args) {
    if (path.resolve(file) === targetFile) {
      targetCalls += 1;
      if (targetCalls === 2) {
        boundedStats = originalLstatSync.call(fs, file, ...args);
        fs.writeFileSync(targetFile, Buffer.alloc(2_000_001, 0x78));
        return boundedStats;
      }
      if (targetCalls === 3 && boundedStats) {
        fs.writeFileSync(targetFile, originalBytes);
        return boundedStats;
      }
    }
    return originalLstatSync.call(fs, file, ...args);
  };

  try {
    assert.throws(
      () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
      /size limit/i,
    );
  } finally {
    fs.lstatSync = originalLstatSync;
    fs.writeFileSync(targetFile, originalBytes);
  }
});

test("buildContextManifest revalidates an earlier read-set entry before returning", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const targetFile = path.resolve(fixture.rootDir, ".agents/scripts/example.test.mjs");
  const originalLstatSync = fs.lstatSync;
  let targetCalls = 0;
  fs.lstatSync = function patchedLstatSync(file, ...args) {
    const stats = originalLstatSync.call(fs, file, ...args);
    if (path.resolve(file) === targetFile) {
      targetCalls += 1;
      if (targetCalls === 3) {
        fs.writeFileSync(targetFile, "// changed after its read-set observation\n", "utf8");
      }
    }
    return stats;
  };

  try {
    assert.throws(
      () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
      /changed during collection/i,
    );
  } finally {
    fs.lstatSync = originalLstatSync;
  }
});

test("buildContextManifest enforces an aggregate read-set byte cap", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const traceFile = path.join(fixture.rootDir, fixture.tracePath);
  const trace = JSON.parse(fs.readFileSync(traceFile, "utf8"));
  const verificationPaths = Array.from(
    { length: 9 },
    (_, index) => `tests/aggregate-${index + 1}.test.mjs`,
  );
  for (const verificationPath of verificationPaths) {
    writeFixture(fixture.rootDir, verificationPath, Buffer.alloc(1_900_000, 0x78));
  }
  trace.requirements[0].acceptanceCriteria[0].verifications = verificationPaths.map(
    (verificationPath) => ({ type: "test", path: verificationPath }),
  );
  fs.writeFileSync(traceFile, `${JSON.stringify(trace, null, 2)}\n`, "utf8");

  assert.throws(
    () => buildContextManifest({ rootDir: fixture.rootDir, planId: "078" }),
    /aggregate|context limit/i,
  );
});

test("context CLI emits repository-relative JSON without local root disclosure", (context) => {
  const fixture = createFixture();
  context.after(() => fs.rmSync(fixture.rootDir, { recursive: true, force: true }));
  const result = spawnSync(
    process.execPath,
    [scriptPath, "--plan", "078"],
    { cwd: fixture.rootDir, encoding: "utf8" },
  );

  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.plan.id, "078");
  assert.equal(result.stdout.includes(fixture.rootDir), false);
  assert.equal(result.stderr, "");
});
