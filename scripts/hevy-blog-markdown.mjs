import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  convertBlogExport,
  DEFAULT_INPUT_DIR,
} from "./hevy-blog-markdown-core.mjs";

const parseArgs = (args) => {
  const options = { inputDir: DEFAULT_INPUT_DIR };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--input-dir" || argument === "--output-dir") {
      const value = args[index + 1];
      if (!value) throw new Error(`${argument} requires a path`);
      options[argument === "--input-dir" ? "inputDir" : "outputDir"] =
        path.resolve(value);
      index += 1;
    } else if (argument === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/hevy-blog-markdown.mjs [--input-dir <path>] [--output-dir <path>]",
    );
    return;
  }
  const manifest = await convertBlogExport(options);
  console.log(JSON.stringify(manifest, null, 2));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Hevy Markdown conversion failed: ${error.message}`);
    process.exitCode = 1;
  });
}
