import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const DEFAULT_MAX_COST = 2;
export const MAX_ALLOWED_COST = 5;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SAFE_CLI_VALUE = /^[A-Za-z0-9._/-]+$/;

const assertSafeCliValue = (value, flag) => {
  if (!SAFE_CLI_VALUE.test(value)) {
    throw new Error(`${flag} contains unsupported characters`);
  }
  return value;
};

const requireValue = (argv, index, flag) => {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
};

const normalizeMaxCost = (raw) => {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("--max-cost must be a positive number");
  }
  if (value > MAX_ALLOWED_COST) {
    throw new Error(
      `--max-cost exceeds the policy ceiling of ${MAX_ALLOWED_COST} USD`,
    );
  }
  return value;
};

const resolvePathTarget = (repoRoot, rawPath) => {
  if (isAbsolute(rawPath)) {
    throw new Error("--path must be repository-relative");
  }
  const candidate = resolve(repoRoot, rawPath);
  if (!existsSync(candidate)) throw new Error(`--path does not exist: ${rawPath}`);

  const root = realpathSync(repoRoot);
  const target = realpathSync(candidate);
  const fromRoot = relative(root, target);
  if (!fromRoot || fromRoot.startsWith(`..${sep}`) || fromRoot === "..") {
    throw new Error("--path must resolve inside the repository");
  }
  if (!statSync(target).isDirectory()) {
    throw new Error("--path must target a directory");
  }
  const normalized = fromRoot.split(sep).join("/");
  assertSafeCliValue(normalized, "--path");
  return normalized;
};

export const buildCodexSecurityInvocation = (
  argv,
  { repoRoot = REPO_ROOT } = {},
) => {
  const options = {
    mode: "working-tree",
    modeExplicit: false,
    modeValue: null,
    execute: false,
    explicitDryRun: false,
    ackFullScan: false,
    maxCost: DEFAULT_MAX_COST,
  };

  const setMode = (mode, value = null) => {
    if (options.modeExplicit && options.mode !== mode) {
      throw new Error("Choose exactly one scan scope/mode");
    }
    options.mode = mode;
    options.modeValue = value;
    options.modeExplicit = true;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--working-tree") setMode("working-tree");
    else if (argument === "--diff") {
      const value = assertSafeCliValue(requireValue(argv, index, argument), argument);
      setMode("diff", value);
      index += 1;
    } else if (argument === "--path") {
      const value = requireValue(argv, index, argument);
      setMode("path", value);
      index += 1;
    } else if (argument === "--full") setMode("full");
    else if (argument === "--deep") setMode("deep");
    else if (argument === "--execute") options.execute = true;
    else if (argument === "--dry-run") options.explicitDryRun = true;
    else if (argument === "--ack-full-scan") options.ackFullScan = true;
    else if (argument === "--max-cost") {
      const value = requireValue(argv, index, argument);
      options.maxCost = normalizeMaxCost(value);
      index += 1;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  if (options.execute && options.explicitDryRun) {
    throw new Error("--execute and --dry-run cannot be combined");
  }
  if (["full", "deep"].includes(options.mode) && !options.ackFullScan) {
    throw new Error(`${options.mode} scan requires --ack-full-scan`);
  }
  if (options.ackFullScan && !["full", "deep"].includes(options.mode)) {
    throw new Error("--ack-full-scan is only valid with --full or --deep");
  }

  const dryRun = !options.execute;
  const target =
    options.mode === "path"
      ? resolvePathTarget(repoRoot, options.modeValue)
      : ".";
  const args = ["@openai/codex-security", "scan", target];

  if (options.mode === "working-tree") {
    args.push("--working-tree", "--base", "HEAD");
  } else if (options.mode === "diff") {
    args.push("--diff", options.modeValue, "--head", "HEAD");
  } else if (options.mode === "deep") {
    args.push("--mode", "deep");
  }

  args.push("--max-cost", String(options.maxCost));
  if (dryRun) args.push("--dry-run");

  return {
    command: "npx",
    args,
    cwd: resolve(repoRoot),
    summary: {
      mode: options.mode,
      target,
      maxCostUsd: options.maxCost,
      dryRun,
    },
  };
};

const main = () => {
  const invocation = buildCodexSecurityInvocation(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(invocation.summary, null, 2)}\n`);
  if (!invocation.summary.dryRun) {
    process.stderr.write(
      "Codex Security execution enabled; usage/cost may be incurred.\n",
    );
  }

  const result = spawnSync(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
};

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
