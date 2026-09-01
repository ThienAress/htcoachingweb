import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  collectWorkingTreeFingerprint,
  createWorktreeFingerprint,
  validateQaEvidence,
} from "./qa-evidence-contract.mjs";

const NOW = "2026-08-30T03:00:00.000Z";

const fingerprint = () => createWorktreeFingerprint({
  head: "a".repeat(40),
  entries: [{ path: "client/src/App.jsx", status: " M", digest: "b".repeat(64) }],
});

const command = (id, status = "PASS") => {
  const commands = {
    "release-build": "npm run build --prefix client",
    "compile-client": "cd client && npx vite build",
    "client-tests": "npm run test:unit:client",
    "server-tests": "npm run test:unit:server",
    e2e: "npm run test:e2e",
  };
  const item = {
    id,
    command: commands[id],
    status,
    exitCode: status === "PASS" ? 0 : 1,
  };
  if (id.endsWith("tests") || id === "e2e") {
    item.counts = { passed: status === "PASS" ? 4 : 3, failed: status === "PASS" ? 0 : 1, skipped: 0 };
  }
  return item;
};

const quickEvidence = () => ({
  schemaVersion: 1,
  kind: "qa-evidence",
  mode: "quick",
  createdAt: "2026-08-30T02:00:00.000Z",
  expiresAt: "2026-08-31T02:00:00.000Z",
  fingerprint: fingerprint(),
  commands: [command("compile-client"), command("client-tests"), command("server-tests")],
  result: "PASS",
  releaseEligible: false,
});

const fullEvidence = () => ({
  ...quickEvidence(),
  mode: "full",
  commands: [command("release-build"), command("client-tests"), command("server-tests"), command("e2e")],
  releaseEligible: true,
});

const validate = (evidence, currentFingerprint = fingerprint()) =>
  validateQaEvidence(evidence, { currentFingerprint, now: NOW });

test("accepts valid quick evidence without marking it release-eligible", () => {
  const result = validate(quickEvidence());
  assert.deepEqual(
    { result: result.result, releaseEligible: result.releaseEligible },
    { result: "PASS", releaseEligible: false },
  );
});

test("derives release eligibility without returning an authorization claim", () => {
  const result = validate(fullEvidence());

  assert.deepEqual(
    {
      releaseEligible: result.releaseEligible,
      hasLegacyReleaseValid: Object.hasOwn(result, "releaseValid"),
      hasReleaseAuthorization: Object.hasOwn(result, "releaseAuthorized"),
      hasAttestationTrust: Object.hasOwn(result, "attestationTrust"),
    },
    {
      releaseEligible: true,
      hasLegacyReleaseValid: false,
      hasReleaseAuthorization: false,
      hasAttestationTrust: false,
    },
  );
});

test("accepts full release evidence when E2E is skipped with reason and residual risk", () => {
  const evidence = fullEvidence();
  evidence.commands[3] = {
    id: "e2e",
    command: "npm run test:e2e",
    status: "SKIP",
    exitCode: null,
    reason: "Test environment is unavailable",
    residualRisk: "Browser workflow remains unverified",
  };
  evidence.result = "PASS_WITH_RISK";
  const result = validate(evidence);
  assert.deepEqual(
    { result: result.result, releaseEligible: result.releaseEligible },
    { result: "PASS_WITH_RISK", releaseEligible: true },
  );
});

test("does not transform an E2E skip into top-level PASS", () => {
  const evidence = fullEvidence();
  evidence.commands[3] = {
    id: "e2e",
    command: "npm run test:e2e",
    status: "SKIP",
    exitCode: null,
    reason: "Test environment is unavailable",
    residualRisk: "Browser workflow remains unverified",
  };

  assert.throws(() => validate(evidence), /result is inconsistent/i);
});

test("rejects a stale working-tree fingerprint", () => {
  const current = createWorktreeFingerprint({
    head: "a".repeat(40),
    entries: [{ path: "client/src/App.jsx", status: " M", digest: "c".repeat(64) }],
  });
  assert.throws(() => validate(quickEvidence(), current), /stale fingerprint/i);
});

test("rejects expired evidence", () => {
  const evidence = quickEvidence();
  evidence.expiresAt = "2026-08-30T02:30:00.000Z";
  assert.throws(() => validate(evidence), /expired/i);
});

test("rejects unknown fields at nested levels", () => {
  const evidence = quickEvidence();
  evidence.commands[0].output = "looks harmless";
  assert.throws(() => validate(evidence), /unsupported field/i);
});

test("rejects duplicate command IDs", () => {
  const evidence = quickEvidence();
  evidence.commands[2].id = "client-tests";
  evidence.commands[2].command = "npm run test:unit:client";
  assert.throws(() => validate(evidence), /duplicate command id/i);
});

test("rejects PASS paired with a non-zero exit code", () => {
  const evidence = quickEvidence();
  evidence.commands[0].exitCode = 1;
  assert.throws(() => validate(evidence), /status.*exit/i);
});

test("rejects PASS test commands that executed zero tests", () => {
  const evidence = fullEvidence();
  for (const item of evidence.commands.filter(({ id }) => id.endsWith("tests") || id === "e2e")) {
    item.counts = { passed: 0, failed: 0, skipped: 0 };
  }

  assert.throws(() => validate(evidence), /pass test counts/i);
});

test("rejects FAIL paired with a zero exit code", () => {
  const evidence = quickEvidence();
  evidence.commands[0] = command("compile-client", "FAIL");
  evidence.commands[0].exitCode = 0;
  evidence.result = "FAIL";
  assert.throws(() => validate(evidence), /status.*exit/i);
});

test("rejects E2E SKIP without both reason and residual risk", () => {
  const evidence = fullEvidence();
  evidence.commands[3] = {
    id: "e2e",
    command: "npm run test:e2e",
    status: "SKIP",
    exitCode: null,
    reason: "Test environment is unavailable",
  };
  evidence.releaseEligible = false;
  assert.throws(() => validate(evidence), /residual risk/i);
});

test("rejects quick evidence falsely marked release-eligible", () => {
  const evidence = quickEvidence();
  evidence.releaseEligible = true;
  assert.throws(() => validate(evidence), /release eligibility/i);
});

test("rejects the legacy releaseValid authorization-like field", () => {
  const evidence = fullEvidence();
  delete evidence.releaseEligible;
  evidence.releaseValid = true;

  assert.throws(() => validate(evidence), /unsupported field/i);
});

test("rejects full release evidence missing a required command", () => {
  const evidence = fullEvidence();
  evidence.commands = evidence.commands.filter(({ id }) => id !== "server-tests");
  evidence.releaseEligible = false;
  assert.throws(() => validate(evidence), /required command/i);
});

test("rejects sensitive values without echoing the value", () => {
  const evidence = fullEvidence();
  const sensitive = ["sk", "live", "12345678901234567890"].join("_");
  evidence.commands[3].reason = sensitive;
  assert.throws(
    () => validate(evidence),
    (error) => /sensitive metadata/i.test(error.message) && !error.message.includes(sensitive),
  );
});

test("rejects hyphenated API keys and hex tokens outside fingerprint fields", () => {
  const sensitiveValues = [
    ["sk", "12345678901234567890"].join("-"),
    ["sk", "proj", "12345678901234567890"].join("-"),
    ["sk", "proj", "12345678901234567890"].join("－"),
    ["sk", "proj", "12345678901234567890"].join("\u00ad-"),
    ["AKIA", "A".repeat(16)].join(""),
    `${["AKIA", "A".repeat(8)].join("")}\u061c${"A".repeat(8)}`,
    ["AIza", "A".repeat(35)].join(""),
    ["re", "A".repeat(24)].join("_"),
    ["rk", "test", "A".repeat(20)].join("_"),
    ["GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop"].join("="),
    "abcd efgh ijkl mnop",
    "d".repeat(64),
  ];
  for (const sensitive of sensitiveValues) {
    const evidence = fullEvidence();
    evidence.commands[3] = {
      id: "e2e",
      command: "npm run test:e2e",
      status: "SKIP",
      exitCode: null,
      reason: "Test environment is unavailable",
      residualRisk: sensitive,
    };
    evidence.result = "PASS_WITH_RISK";

    assert.throws(() => validate(evidence), /sensitive metadata/i);
  }
});

test("rejects PII and absolute local paths", () => {
  const pii = ["coach", "example.test"].join("@");
  const phone = ["09", "123", "45678"].join("");
  const absolutePath = ["C:", "Users", "coach"].join("\\");
  const fileUrl = ["file:", "", "", "home", "coach"].join("/");
  const countryPhone = "+84 (0) 912 345 678";
  const parenthesizedPhone = "(+84) 912 345 678";
  const labeledWindowsPath = ["path:C:", "Users", "private-owner"].join("\\");
  const labeledUnixPath = ["label:", "home", "private-owner"].join("/");
  const labeledTempPath = ["trace:", "tmp", "private-owner"].join("/");
  for (const unsafe of [
    pii,
    phone,
    countryPhone,
    parenthesizedPhone,
    absolutePath,
    fileUrl,
    labeledWindowsPath,
    labeledUnixPath,
    labeledTempPath,
  ]) {
    const evidence = fullEvidence();
    evidence.commands[3].reason = unsafe;
    assert.throws(() => validate(evidence), /sensitive metadata/i);
  }
});

test("rejects every canonical privacy form inside free-text metadata", () => {
  const unsafeValues = [
    "0912 (345) 678",
    "０９１２３４５６７８",
    "file://synthetic-host/Users/synthetic-user/project",
    "/mnt/c/Users/synthetic-user/project",
    String.raw`\\synthetic-host\share\Users\synthetic-user\project`,
    "/private/var/folders/synthetic-cache/session",
  ];

  for (const unsafe of unsafeValues) {
    const evidence = fullEvidence();
    evidence.commands[3] = {
      id: "e2e",
      command: "npm run test:e2e",
      status: "SKIP",
      exitCode: null,
      reason: unsafe,
      residualRisk: "Manual browser coverage remains pending",
    };
    evidence.result = "PASS_WITH_RISK";
    assert.throws(() => validate(evidence), /sensitive metadata/i);
  }
});

test("worktree fingerprint is deterministic, sorted and does not mutate input", () => {
  const entries = [
    { path: "server/server.js", status: "M ", digest: "c".repeat(64) },
    { path: "client/src/App.jsx", status: " M", digest: "b".repeat(64) },
  ];
  const before = structuredClone(entries);
  const first = createWorktreeFingerprint({ head: "a".repeat(40), entries });
  const second = createWorktreeFingerprint({ head: "a".repeat(40), entries: [...entries].reverse() });
  assert.deepEqual({ same: first.digest === second.digest, unchanged: entries }, { same: true, unchanged: before });
});

test("worktree fingerprint rejects traversal and duplicate paths", () => {
  const base = { head: "a".repeat(40), entries: [{ path: "../outside", status: "??", digest: "b".repeat(64) }] };
  assert.throws(() => createWorktreeFingerprint(base), /repository-relative path/i);
  base.entries = [
    { path: "client/a.js", status: " M", digest: "b".repeat(64) },
    { path: "client/a.js", status: "M ", digest: "c".repeat(64) },
  ];
  assert.throws(() => createWorktreeFingerprint(base), /duplicate path/i);
});

test("worktree fingerprint rejects cross-platform ambiguous path aliases", () => {
  const unsafePaths = [
    "D:client/src/App.jsx",
    "client:src/App.jsx",
    "client/src/",
    "client/src/App.jsx.",
    "client/src/App.jsx ",
    "client/src/App.jsx\nspoof",
    "client/src/App.jsx\0spoof",
    "client/src/\u202eApp.jsx",
    "client/src/\u061cApp.jsx",
    "client/src/soft\u00adhyphen.jsx",
    "client/src/join\u034fer.jsx",
    "client/src/variant\ufe0f.jsx",
    "client/src/filler\u115f.jsx",
    "client/src/selector\u{e0100}.jsx",
    "client/src/cafe\u0301.js",
    "client/src/CON",
    "client/src/con.txt",
    "client/src/NUL.md",
    "client/src/AUX",
    "client/src/COM1.js",
    "client/src/LPT9.log",
    "client/src/a?b.js",
  ];
  for (const unsafePath of unsafePaths) {
    assert.throws(
      () => createWorktreeFingerprint({
        head: "a".repeat(40),
        entries: [{ path: unsafePath, status: "??", digest: "b".repeat(64) }],
      }),
      /repository-relative path/i,
    );
  }
});

test("collector rejects an oversized entry set before hashing any candidate", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-entry-bound-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runGit = (args, options = {}) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8", ...options });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "baseline\n", "utf8");
  runGit(["add", "tracked.txt"]);
  runGit(["commit", "--quiet", "-m", "fixture"]);
  const blob = runGit(["hash-object", "-w", "--stdin"], { input: "fixture\n" }).trim();
  const indexInfo = Array.from(
    { length: 5_001 },
    (_, index) => `100644 ${blob}\tbulk/${String(index).padStart(4, "0")}.txt\n`,
  ).join("");
  runGit(["update-index", "--index-info"], { input: indexInfo });
  const originalLstat = fs.lstatSync;
  fs.lstatSync = (target, ...args) => {
    if (String(target).includes(`${path.sep}bulk${path.sep}`)) {
      throw new Error("Fingerprint hashing started before the entry bound");
    }
    return originalLstat(target, ...args);
  };
  context.after(() => { fs.lstatSync = originalLstat; });

  assert.throws(
    () => collectWorkingTreeFingerprint(root),
    /fingerprint entries are invalid/i,
  );
  fs.lstatSync = originalLstat;
});

test("collector validates every candidate path before hashing the first file", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-path-preflight-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "baseline\n", "utf8");
  runGit(["add", "tracked.txt"]);
  runGit(["commit", "--quiet", "-m", "fixture"]);
  fs.writeFileSync(path.join(root, "a-safe.txt"), "safe\n", "utf8");
  fs.writeFileSync(path.join(root, "z-cafe\u0301.txt"), "unsafe\n", "utf8");
  const originalLstat = fs.lstatSync;
  fs.lstatSync = (target, ...args) => {
    if (path.basename(String(target)) === "a-safe.txt") {
      throw new Error("Fingerprint hashing started before path preflight");
    }
    return originalLstat(target, ...args);
  };
  context.after(() => { fs.lstatSync = originalLstat; });

  assert.throws(
    () => collectWorkingTreeFingerprint(root),
    /repository-relative path/i,
  );
  fs.lstatSync = originalLstat;
});

test("collector rejects an aggregate fingerprint payload above the byte budget", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-byte-bound-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "baseline\n", "utf8");
  runGit(["add", "tracked.txt"]);
  runGit(["commit", "--quiet", "-m", "fixture"]);
  for (let index = 0; index < 5; index += 1) {
    fs.writeFileSync(path.join(root, `payload-${index}.bin`), "", "utf8");
    fs.truncateSync(path.join(root, `payload-${index}.bin`), 32 * 1024 * 1024);
  }

  assert.throws(
    () => collectWorkingTreeFingerprint(root),
    /aggregate fingerprint payload is too large/i,
  );
});

test("collector does not recurse through ignored env-like directories", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-env-directory-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  fs.writeFileSync(
    path.join(root, ".gitignore"),
    ".env.*\nclient/.env.*\nserver/.env.*\n",
    "utf8",
  );
  fs.mkdirSync(path.join(root, "client"), { recursive: true });
  fs.mkdirSync(path.join(root, "server"), { recursive: true });
  runGit(["add", ".gitignore"]);
  runGit(["commit", "--quiet", "-m", "fixture"]);
  for (const directory of [".env.archive", "client/.env.cache", "server/.env.backup"]) {
    const absolute = path.join(root, ...directory.split("/"));
    fs.mkdirSync(absolute, { recursive: true });
    fs.writeFileSync(path.join(absolute, "nested.txt"), "not-a-QA-env-file\n", "utf8");
  }

  const result = collectWorkingTreeFingerprint(root);

  assert.deepEqual({ state: result.state, files: result.files }, { state: "clean", files: [] });
});

test("collector binds the working-tree executable bit on POSIX", (context) => {
  if (process.platform === "win32") {
    context.skip("Windows does not expose the Git executable bit through chmod");
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-filemode-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0);
  };
  const target = path.join(root, "tracked.sh");
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  runGit(["config", "core.filemode", "true"]);
  fs.writeFileSync(target, "first\n", "utf8");
  fs.chmodSync(target, 0o655);
  runGit(["add", "tracked.sh"]);
  runGit(["commit", "--quiet", "-m", "fixture"]);
  fs.writeFileSync(target, "second\n", "utf8");

  const regular = collectWorkingTreeFingerprint(root);
  fs.chmodSync(target, 0o755);
  const executable = collectWorkingTreeFingerprint(root);

  assert.deepEqual(
    {
      sameStatus: regular.files.map(({ status }) => status)
        .join() === executable.files.map(({ status }) => status).join(),
      digestChanged: regular.digest !== executable.digest,
    },
    { sameStatus: true, digestChanged: true },
  );
});

test("collector rejects a same-metadata content swap during fingerprinting", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-race-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0);
  };
  const target = path.join(root, "tracked.txt");
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  fs.writeFileSync(target, "base-000\n", "utf8");
  runGit(["add", "tracked.txt"]);
  runGit(["commit", "--quiet", "-m", "fixture"]);
  fs.writeFileSync(target, "old--111\n", "utf8");
  const fixedTime = new Date(1_700_000_000_000);
  fs.utimesSync(target, fixedTime, fixedTime);
  const originalRead = fs.readSync;
  let swapped = false;
  fs.readSync = (...args) => {
    const bytes = originalRead(...args);
    if (!swapped && bytes > 0) {
      swapped = true;
      const mode = fs.statSync(target).mode;
      fs.writeFileSync(target, "new--222\n", "utf8");
      fs.chmodSync(target, mode);
      fs.utimesSync(target, fixedTime, fixedTime);
    }
    return bytes;
  };
  context.after(() => { fs.readSync = originalRead; });

  assert.throws(
    () => collectWorkingTreeFingerprint(root),
    /changed while fingerprinting/i,
  );
  fs.readSync = originalRead;
  assert.equal(swapped, true);
  assert.equal(fs.readFileSync(target, "utf8"), "new--222\n");
});

test("collector rejects a literal backslash filename on POSIX", (context) => {
  if (process.platform === "win32") {
    context.skip("Windows does not allow a literal backslash in a filename");
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-backslash-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0);
  };
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "baseline\n", "utf8");
  runGit(["add", "tracked.txt"]);
  runGit(["commit", "--quiet", "-m", "fixture"]);
  fs.writeFileSync(path.join(root, "literal\\name.txt"), "fixture\n", "utf8");

  assert.throws(
    () => collectWorkingTreeFingerprint(root),
    /repository-relative path/i,
  );
});

test("collector accepts a canonical filename that starts with two dots", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-dot-prefix-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0);
  };
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "baseline\n", "utf8");
  runGit(["add", "tracked.txt"]);
  runGit(["commit", "--quiet", "-m", "fixture"]);
  fs.writeFileSync(path.join(root, "..candidate.txt"), "fixture\n", "utf8");

  const fingerprintResult = collectWorkingTreeFingerprint(root);

  assert.deepEqual(
    fingerprintResult.files.map(({ path: filePath, status }) => ({ filePath, status })),
    [{ filePath: "..candidate.txt", status: "??" }],
  );
});

test("collector binds the target of a tracked dangling symlink", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-dangling-symlink-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  const target = path.join(root, "tracked-link");
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  runGit(["config", "core.symlinks", "true"]);
  try {
    fs.symlinkSync("missing-baseline", target, "file");
  } catch (error) {
    if (process.platform === "win32" && ["EACCES", "EPERM"].includes(error?.code)) {
      context.skip("Windows symlink creation is unavailable");
      return;
    }
    throw error;
  }
  runGit(["add", "tracked-link"]);
  runGit(["commit", "--quiet", "-m", "fixture"]);

  fs.unlinkSync(target);
  fs.symlinkSync("missing-one", target, "file");
  const first = collectWorkingTreeFingerprint(root);
  fs.unlinkSync(target);
  fs.symlinkSync("missing-two", target, "file");
  const second = collectWorkingTreeFingerprint(root);

  assert.deepEqual(
    {
      sameStatus: first.files.map(({ status }) => status).join()
        === second.files.map(({ status }) => status).join(),
      digestChanged: first.digest !== second.digest,
    },
    { sameStatus: true, digestChanged: true },
  );
});

test("collector fingerprints working content and staged index state", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-fingerprint-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0);
  };
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "first\n", "utf8");
  runGit(["add", "tracked.txt"]);
  runGit(["commit", "--quiet", "-m", "fixture"]);

  const clean = collectWorkingTreeFingerprint(root);
  fs.writeFileSync(path.join(root, "tracked.txt"), "second\n", "utf8");
  const working = collectWorkingTreeFingerprint(root);
  runGit(["add", "tracked.txt"]);
  const staged = collectWorkingTreeFingerprint(root);

  assert.deepEqual(
    {
      clean: { state: clean.state, files: clean.files },
      workingState: working.state,
      stagedState: staged.state,
      distinct: new Set([clean.digest, working.digest, staged.digest]).size,
    },
    {
      clean: { state: "clean", files: [] },
      workingState: "dirty",
      stagedState: "dirty",
      distinct: 3,
    },
  );
});

test("collector fingerprints ignored environment inputs used by QA commands", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-ignored-env-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  fs.writeFileSync(path.join(root, ".gitignore"), ".env\nclient/.env.*\n", "utf8");
  fs.mkdirSync(path.join(root, "client"), { recursive: true });
  runGit(["add", ".gitignore"]);
  runGit(["commit", "--quiet", "-m", "fixture"]);
  fs.writeFileSync(path.join(root, ".env"), "QA_FLAG=one\n", "utf8");
  fs.writeFileSync(path.join(root, "client", ".env.local"), "QA_CLIENT_FLAG=one\n", "utf8");

  const first = collectWorkingTreeFingerprint(root);
  fs.writeFileSync(path.join(root, ".env"), "QA_FLAG=two\n", "utf8");
  const second = collectWorkingTreeFingerprint(root);

  assert.deepEqual(
    {
      files: first.files.map(({ path: itemPath, status }) => ({ path: itemPath, status })),
      digestChanged: first.digest !== second.digest,
    },
    {
      files: [
        { path: ".env", status: "!!" },
        { path: "client/.env.local", status: "!!" },
      ],
      digestChanged: true,
    },
  );
});

for (const hiddenFlag of ["--assume-unchanged", "--skip-worktree"]) {
  test(`collector rejects Git ${hiddenFlag.slice(2)} index flags`, (context) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-hidden-index-"));
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const runGit = (args) => {
      const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
      assert.equal(result.status, 0);
    };
    const target = path.join(root, "tracked.txt");
    runGit(["init", "--quiet"]);
    runGit(["config", "user.email", "fixture@example.com"]);
    runGit(["config", "user.name", "Fixture"]);
    fs.writeFileSync(target, "baseline\n", "utf8");
    runGit(["add", "tracked.txt"]);
    runGit(["commit", "--quiet", "-m", "fixture"]);
    runGit(["update-index", hiddenFlag, "tracked.txt"]);
    fs.writeFileSync(target, "hidden working change\n", "utf8");

    assert.throws(
      () => collectWorkingTreeFingerprint(root),
      /hidden Git index flags/i,
    );
  });
}

test("CLI reports schema eligibility without authorizing a self-attested release", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-cli-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0);
  };
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "fixture\n", "utf8");
  runGit(["add", "tracked.txt"]);
  runGit(["commit", "--quiet", "-m", "fixture"]);

  const evidencePath = ".local-data/qa-evidence/fixture.json";
  const evidence = fullEvidence();
  const createdAt = new Date(Date.now() - 60_000);
  evidence.createdAt = createdAt.toISOString();
  evidence.expiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000).toISOString();
  evidence.fingerprint = collectWorkingTreeFingerprint(root);
  fs.mkdirSync(path.dirname(path.join(root, evidencePath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, evidencePath),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );

  const scriptPath = fileURLToPath(new URL("./qa-evidence-contract.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [scriptPath, "--evidence", evidencePath], {
    cwd: root,
    encoding: "utf8",
  });

  assert.deepEqual(
    { status: result.status, stderr: result.stderr, output: JSON.parse(result.stdout) },
    {
      status: 0,
      stderr: "",
      output: {
        schemaValid: true,
        mode: "full",
        result: "PASS",
        releaseEligible: true,
        attestationTrust: "SELF_ATTESTED",
        releaseAuthorized: false,
      },
    },
  );
});

test("CLI rejects evidence replaced after its initial read", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-cli-evidence-race-"));
  const preloadRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-cli-preload-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  context.after(() => fs.rmSync(preloadRoot, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "fixture\n", "utf8");
  runGit(["add", "tracked.txt"]);
  runGit(["commit", "--quiet", "-m", "fixture"]);

  const evidencePath = ".local-data/qa-evidence/fixture.json";
  const absoluteEvidencePath = path.join(root, ...evidencePath.split("/"));
  const evidence = fullEvidence();
  const createdAt = new Date(Date.now() - 60_000);
  evidence.createdAt = createdAt.toISOString();
  evidence.expiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000).toISOString();
  evidence.fingerprint = collectWorkingTreeFingerprint(root);
  fs.mkdirSync(path.dirname(absoluteEvidencePath), { recursive: true });
  fs.writeFileSync(absoluteEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  const markerPath = path.join(preloadRoot, "mutated.txt");
  const preloadPath = path.join(preloadRoot, "mutate-after-read.mjs");
  fs.writeFileSync(preloadPath, `
import childProcess from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

const originalExecFileSync = childProcess.execFileSync;
let mutated = false;
childProcess.execFileSync = function patchedExecFileSync(command, args, options) {
  const result = originalExecFileSync.call(this, command, args, options);
  const operation = Array.isArray(args) ? args.slice(-2).join(" ") : "";
  if (!mutated && command === "git" && operation === "rev-parse HEAD") {
    mutated = true;
    fs.writeFileSync(process.env.QA_MUTATION_TARGET, "{}\\n", "utf8");
    fs.writeFileSync(process.env.QA_MUTATION_MARKER, "mutated\\n", "utf8");
  }
  return result;
};
syncBuiltinESMExports();
`, "utf8");
  const scriptPath = fileURLToPath(new URL("./qa-evidence-contract.mjs", import.meta.url));

  const result = spawnSync(
    process.execPath,
    ["--import", pathToFileURL(preloadPath).href, scriptPath, "--evidence", evidencePath],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        QA_MUTATION_TARGET: absoluteEvidencePath,
        QA_MUTATION_MARKER: markerPath,
      },
    },
  );

  assert.deepEqual(
    {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      mutationRan: fs.existsSync(markerPath),
      finalEvidence: fs.readFileSync(absoluteEvidencePath, "utf8"),
    },
    {
      status: 1,
      stdout: "",
      stderr: "QA evidence validation failed\n",
      mutationRan: true,
      finalEvidence: "{}\n",
    },
  );
});

test("CLI cannot exclude an arbitrary tracked JSON path from the fingerprint", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-cli-product-path-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0);
  };
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  const evidencePath = "runtime.json";
  fs.writeFileSync(path.join(root, evidencePath), '{"feature":false}\n', "utf8");
  runGit(["add", evidencePath]);
  runGit(["commit", "--quiet", "-m", "fixture"]);
  const evidence = fullEvidence();
  const createdAt = new Date(Date.now() - 60_000);
  evidence.createdAt = createdAt.toISOString();
  evidence.expiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000).toISOString();
  evidence.fingerprint = collectWorkingTreeFingerprint(root);
  fs.writeFileSync(path.join(root, evidencePath), `${JSON.stringify(evidence)}\n`, "utf8");
  const scriptPath = fileURLToPath(new URL("./qa-evidence-contract.mjs", import.meta.url));

  const result = spawnSync(process.execPath, [scriptPath, "--evidence", evidencePath], {
    cwd: root,
    encoding: "utf8",
  });

  assert.deepEqual(
    { status: result.status, stdout: result.stdout, stderr: result.stderr },
    { status: 1, stdout: "", stderr: "QA evidence validation failed\n" },
  );
});

test("CLI rejects a QA evidence path removed from the index but still present in HEAD", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-qa-cli-head-path-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0);
  };
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "fixture@example.com"]);
  runGit(["config", "user.name", "Fixture"]);
  const evidencePath = ".local-data/qa-evidence/runtime.json";
  fs.mkdirSync(path.dirname(path.join(root, evidencePath)), { recursive: true });
  fs.writeFileSync(path.join(root, evidencePath), '{"tracked":true}\n', "utf8");
  runGit(["add", "-f", evidencePath]);
  runGit(["commit", "--quiet", "-m", "fixture"]);
  runGit(["rm", "--cached", "--quiet", evidencePath]);
  const evidence = fullEvidence();
  const createdAt = new Date(Date.now() - 60_000);
  evidence.createdAt = createdAt.toISOString();
  evidence.expiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000).toISOString();
  evidence.fingerprint = collectWorkingTreeFingerprint(root, { excludePaths: [evidencePath] });
  fs.writeFileSync(path.join(root, evidencePath), `${JSON.stringify(evidence)}\n`, "utf8");
  const scriptPath = fileURLToPath(new URL("./qa-evidence-contract.mjs", import.meta.url));

  const result = spawnSync(process.execPath, [scriptPath, "--evidence", evidencePath], {
    cwd: root,
    encoding: "utf8",
  });

  assert.deepEqual(
    { status: result.status, stdout: result.stdout, stderr: result.stderr },
    { status: 1, stdout: "", stderr: "QA evidence validation failed\n" },
  );
});

test("CLI rejects an unbounded evidence path without leaking it", () => {
  const unsafe = ["..", "outside.json"].join("/");
  const scriptPath = fileURLToPath(new URL("./qa-evidence-contract.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [scriptPath, "--evidence", unsafe], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.deepEqual(
    { status: result.status, stdout: result.stdout, stderr: result.stderr, leaked: result.stderr.includes(unsafe) },
    { status: 1, stdout: "", stderr: "QA evidence validation failed\n", leaked: false },
  );
});
