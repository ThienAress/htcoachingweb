import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import {
  appendFile,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  assertExternalTarget,
  createSourceBackup,
  verifySourceBackup,
} from "./lib/source-backup.mjs";

const execFile = promisify(execFileCallback);
const runGit = (cwd, args) => execFile("git", args, { cwd, windowsHide: true });

const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ht-source-fixture-"));
  const repo = path.join(root, "repository");
  const target = path.join(root, "backups");
  await mkdir(repo);
  await runGit(repo, ["init", "--initial-branch=main"]);
  await runGit(repo, ["config", "user.name", "Backup Test"]);
  await runGit(repo, ["config", "user.email", "backup-test@example.invalid"]);
  await writeFile(path.join(repo, ".gitignore"), "ignored.txt\n", "utf8");
  await writeFile(path.join(repo, "tracked.txt"), "committed\n", "utf8");
  await runGit(repo, ["add", "."]);
  await runGit(repo, ["commit", "-m", "fixture"]);
  await runGit(repo, ["branch", "staging"]);
  await appendFile(path.join(repo, "tracked.txt"), "working tree\n", "utf8");
  await writeFile(path.join(repo, "binary.bin"), Buffer.from([0, 1, 2, 255]));
  await writeFile(path.join(repo, "ignored.txt"), "secret-adjacent\n", "utf8");
  return { root, repo, target };
};

test("source backup restores refs and a dirty non-ignored working tree", async () => {
  const current = await fixture();
  try {
    const result = await createSourceBackup({
      repoRoot: current.repo,
      targetDirectory: current.target,
      now: new Date("2026-08-17T08:00:00.000Z"),
    });
    assert.equal(result.verified, true);
    assert.equal(result.dirty, true);
    assert.equal(result.untrackedFileCount, 1);
    assert.equal(result.branch, "main");

    const packageDirectory = path.join(current.target, result.directoryName);
    const verified = await verifySourceBackup({ packageDirectory });
    assert.equal(verified.head, result.head);
    const manifest = JSON.parse(
      await readFile(path.join(packageDirectory, "source-backup-manifest.json"), "utf8"),
    );
    assert.deepEqual(manifest.untrackedPaths, ["binary.bin"]);
    assert.equal(manifest.files.some(({ path: file }) => file === "ignored.txt"), false);
    assert.equal(manifest.refs.some(({ ref }) => ref === "refs/heads/staging"), true);
  } finally {
    await rm(current.root, { recursive: true, force: true });
  }
});

test("source backup rejects targets inside the repository", async () => {
  const current = await fixture();
  try {
    assert.throws(
      () => assertExternalTarget(current.repo, path.join(current.repo, "backup")),
      /outside the repository/,
    );
    await assert.rejects(
      createSourceBackup({
        repoRoot: current.repo,
        targetDirectory: path.join(current.repo, "backup"),
      }),
      /outside the repository/,
    );
  } finally {
    await rm(current.root, { recursive: true, force: true });
  }
});

test("source backup verification fails closed after corruption", async () => {
  const current = await fixture();
  try {
    const result = await createSourceBackup({
      repoRoot: current.repo,
      targetDirectory: current.target,
      now: new Date("2026-08-17T09:00:00.000Z"),
    });
    const packageDirectory = path.join(current.target, result.directoryName);
    await appendFile(path.join(packageDirectory, "working-tree.patch"), "corrupt");
    await assert.rejects(
      verifySourceBackup({ packageDirectory }),
      /patch checksum mismatch/,
    );
  } finally {
    await rm(current.root, { recursive: true, force: true });
  }
});

test("recovery workflow is scheduled, secret-free and never auto-closes incidents", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/recovery-readiness.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /verify:backup-release/);
  assert.match(workflow, /verify:disaster-recovery/);
  assert.match(workflow, /issues:\s*write/);
  assert.match(workflow, /issues\.create/);
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./);
  assert.doesNotMatch(workflow, /issues\.update\([\s\S]*state:\s*["']closed/);
});
