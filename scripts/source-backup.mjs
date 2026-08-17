import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  createSourceBackup,
  verifySourceBackup,
} from "./lib/source-backup.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const readValue = (argv, index, name) => {
  const argument = argv[index];
  if (argument.startsWith(`${name}=`)) return { value: argument.slice(name.length + 1), used: 1 };
  if (argument === name && argv[index + 1]) return { value: argv[index + 1], used: 2 };
  return null;
};

const parseArguments = (argv) => {
  const result = {};
  for (let index = 0; index < argv.length; ) {
    const target = readValue(argv, index, "--target-dir");
    const verify = readValue(argv, index, "--verify");
    if (target) {
      result.targetDirectory = target.value;
      index += target.used;
    } else if (verify) {
      result.packageDirectory = verify.value;
      index += verify.used;
    } else {
      throw new Error(`Unsupported argument: ${argv[index]}`);
    }
  }
  if (Boolean(result.targetDirectory) === Boolean(result.packageDirectory)) {
    throw new Error("Use exactly one of --target-dir or --verify");
  }
  return result;
};

export const main = async (argv = process.argv.slice(2)) => {
  const options = parseArguments(argv);
  const result = options.targetDirectory
    ? await createSourceBackup({ repoRoot, targetDirectory: options.targetDirectory })
    : await verifySourceBackup({ packageDirectory: options.packageDirectory });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    process.stderr.write(`Source backup failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
