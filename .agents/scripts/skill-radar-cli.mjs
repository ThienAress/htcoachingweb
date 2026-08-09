#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scanWatchlist } from "./skill-radar.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_WATCHLIST = path.join(ROOT, ".agents", "upstream-skills", "watchlist.json");
const DEFAULT_SNAPSHOT = path.join(ROOT, ".agents", "upstream-skills", "snapshot.json");
const readJson = (filePath, fallback = null) => {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
};
const parseArgs = (args) => {
  const parsed = { watchlist: DEFAULT_WATCHLIST, snapshot: DEFAULT_SNAPSHOT, output: DEFAULT_SNAPSHOT, dryRun: false };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--dry-run") parsed.dryRun = true;
    else if (value === "--watchlist") parsed.watchlist = path.resolve(args[++index]);
    else if (value === "--snapshot") parsed.snapshot = path.resolve(args[++index]);
    else if (value === "--output") parsed.output = path.resolve(args[++index]);
    else throw new Error(`Unknown argument: ${value}`);
  }
  return parsed;
};

const args = parseArgs(process.argv.slice(2));
try {
  const result = await scanWatchlist({
    watchlist: readJson(args.watchlist),
    previousSnapshot: readJson(args.snapshot, { schemaVersion: 1, items: [] }),
  });
  if (args.dryRun) console.log(JSON.stringify(result, null, 2));
  else {
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(`Skill Radar scanned ${result.items.length} entries with ${result.failures} failure(s).`);
  }
} catch (error) {
  const message = (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 240);
  console.error(`Skill Radar failed: ${message}`);
  process.exitCode = 1;
}
