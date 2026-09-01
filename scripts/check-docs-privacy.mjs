import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  collectScanTargets,
  formatFinding,
  scanDocuments,
} from "./lib/docs-privacy.mjs";

export const main = async (
  argv = process.argv.slice(2),
  { repositoryRoot = path.resolve(import.meta.dirname, "..") } = {},
) => {
  try {
    const targets = await collectScanTargets({ inputs: argv, repositoryRoot });
    const findings = await scanDocuments(targets);

    if (findings.length > 0) {
      process.stdout.write(`${findings.map(formatFinding).join("\n")}\n`);
      return 1;
    }

    return 0;
  } catch {
    process.stderr.write("docs-privacy:0:scan-error\n");
    return 2;
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  process.exitCode = await main();
}
