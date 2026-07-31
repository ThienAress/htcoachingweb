import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_OUTPUT_DIR,
  runCrawler,
} from "./hevy-blog-crawler-core.mjs";

const parseArgs = (args) => {
  const options = { outputDir: DEFAULT_OUTPUT_DIR };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--output-dir") {
      const value = args[index + 1];
      if (!value) throw new Error("--output-dir requires a path");
      options.outputDir = path.resolve(value);
      index += 1;
    } else if (args[index] === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${args[index]}`);
    }
  }
  return options;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/hevy-blog-crawler.mjs [--output-dir <path>]",
    );
    return;
  }
  console.log(`Crawling Hevy blog into ${options.outputDir}...`);
  const manifest = await runCrawler(options);
  console.log(JSON.stringify(manifest, null, 2));
  if (manifest.status !== "complete") process.exitCode = 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Hevy blog crawl failed: ${error.message}`);
    process.exitCode = 1;
  });
}
