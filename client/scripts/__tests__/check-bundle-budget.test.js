import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptPath = fileURLToPath(
  new URL("../check-bundle-budget.js", import.meta.url),
);
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("check-bundle-budget", () => {
  test("ignores an unrelated output hash containing f1", () => {
    const projectDirectory = mkdtempSync(
      path.join(tmpdir(), "htcoaching-bundle-budget-"),
    );
    temporaryDirectories.push(projectDirectory);
    const manifestDirectory = path.join(projectDirectory, "dist", ".vite");
    const assetsDirectory = path.join(projectDirectory, "dist", "assets");
    mkdirSync(manifestDirectory, { recursive: true });
    mkdirSync(assetsDirectory, { recursive: true });

    writeFileSync(
      path.join(manifestDirectory, "manifest.json"),
      JSON.stringify({
        "src/components/F1/ActualWorkflow.jsx": {
          file: "assets/actual-workflow.js",
        },
        "src/pages/UnrelatedPage.jsx": {
          file: "assets/unrelated-F1hash.js",
        },
        "src/pages/trainer/TrainingSchedule.jsx": {
          file: "assets/training-schedule.js",
        },
      }),
    );
    writeFileSync(path.join(assetsDirectory, "actual-workflow.js"), "x");
    writeFileSync(
      path.join(assetsDirectory, "unrelated-F1hash.js"),
      "x".repeat(245 * 1024),
    );
    writeFileSync(path.join(assetsDirectory, "training-schedule.js"), "x");

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: projectDirectory,
      encoding: "utf8",
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
  });
});
