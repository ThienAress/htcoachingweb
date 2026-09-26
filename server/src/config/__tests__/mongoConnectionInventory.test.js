import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.resolve(configDirectory, "../..");
const scanRoots = ["migrations", "scripts"];
const localOnlyExclusions = new Set([
  "scripts/localF1RetentionDryRun.js",
  "scripts/localFoodPriceImport.js",
  "scripts/localPhase8MigrationPreflight.js",
]);

const collectJavaScriptFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScriptFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".js") ? [absolute] : [];
  });

describe("direct MongoDB connection inventory", () => {
  it("routes every production-capable direct connect through explicit durability", () => {
    const violations = scanRoots.flatMap((root) =>
      collectJavaScriptFiles(path.join(sourceDirectory, root)).flatMap(
        (absolute) => {
          const source = readFileSync(absolute, "utf8");
          if (!/mongoose\.connect\s*\(/u.test(source)) return [];
          const relative = path
            .relative(sourceDirectory, absolute)
            .split(path.sep)
            .join("/");
          if (relative.includes("/__tests__/")) return [];
          if (localOnlyExclusions.has(relative)) return [];
          if (
            source.includes("resolveMongoConnectionOptions") &&
            source.includes("durable: true")
          ) {
            return [];
          }
          return [relative];
        },
      ),
    );

    expect(violations).toEqual([]);
  });
});
