import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import {
  evaluateBackupReadiness,
  exitCodeForMode,
} from "./lib/backup-readiness.mjs";

const DEFAULT_MANIFEST = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../docs/operations/production/backup-readiness.json",
);

const parseArguments = (argv) => {
  let mode = "audit";
  let manifestPath = DEFAULT_MANIFEST;
  for (const argument of argv) {
    if (argument.startsWith("--mode=")) mode = argument.slice("--mode=".length);
    else if (argument.startsWith("--manifest=")) {
      manifestPath = path.resolve(argument.slice("--manifest=".length));
    } else throw new Error(`Unsupported argument: ${argument}`);
  }
  return { mode, manifestPath };
};

export const main = async (argv = process.argv.slice(2)) => {
  const { mode, manifestPath } = parseArguments(argv);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const result = evaluateBackupReadiness(manifest);
  process.stdout.write(`${JSON.stringify({ mode, ...result }, null, 2)}\n`);
  return exitCodeForMode(mode, result);
};

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(`Backup readiness check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
