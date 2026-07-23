import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const roots = [
  path.join(serverRoot, "server.js"),
  ...["config", "controllers", "middlewares", "routes", "services", "utils"].map(
    (directory) => path.join(serverRoot, "src", directory),
  ),
];
const ignored = new Set([
  path.normalize("src/services/ai/aiLogger.js"),
  path.normalize("src/utils/safeLogger.js"),
]);
const consolePattern = /\bconsole\s*\.\s*(log|error|warn|info|debug)\s*\(/g;

const collect = (entry) => {
  if (!fs.existsSync(entry)) return [];
  const stat = fs.statSync(entry);
  if (stat.isFile()) return [entry];
  return fs.readdirSync(entry, { withFileTypes: true }).flatMap((item) => {
    const absolute = path.join(entry, item.name);
    if (item.isDirectory()) {
      if (
        item.name === "__tests__" ||
        item.name === "migrations" ||
        item.name === "scripts"
      ) {
        return [];
      }
      return collect(absolute);
    }
    return item.name.endsWith(".js") ? [absolute] : [];
  });
};

const violations = [];
for (const file of roots.flatMap(collect)) {
  const relative = path.normalize(path.relative(serverRoot, file));
  if (ignored.has(relative)) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    consolePattern.lastIndex = 0;
    if (consolePattern.test(line)) {
      violations.push(relative + ":" + (index + 1));
    }
  });
}

if (violations.length > 0) {
  process.stderr.write(
    "Unsafe runtime console logging found:\n" +
      violations.map((item) => "- " + item).join("\n") +
      "\n",
  );
  process.exitCode = 1;
} else {
  process.stdout.write("Runtime logging policy passed.\n");
}
