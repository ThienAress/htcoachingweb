import { spawnSync } from "node:child_process";
import path from "node:path";

const git = spawnSync("git", ["ls-files", "-z"], {
  cwd: process.cwd(),
  encoding: "utf8",
});
if (git.status !== 0) {
  process.stderr.write(
    JSON.stringify({
      success: false,
      error: "Unable to enumerate tracked repository files",
    }) + "\n",
  );
  process.exit(1);
}

const trackedFiles = git.stdout
  .split("\0")
  .filter(Boolean)
  .map((file) => file.replaceAll("\\", "/"));

const categories = {
  runtimeUploads: [],
  privateRuntimeData: [],
  environmentFiles: [],
  databaseExports: [],
  privateKeys: [],
};

for (const file of trackedFiles) {
  const lower = file.toLowerCase();
  const basename = path.posix.basename(lower);

  if (lower.startsWith("server/uploads/")) {
    categories.runtimeUploads.push(file);
  }
  if (
    lower.startsWith("server/.private/") ||
    lower.startsWith(".private/")
  ) {
    categories.privateRuntimeData.push(file);
  }
  if (
    (basename === ".env" || basename.startsWith(".env.")) &&
    !basename.endsWith(".example")
  ) {
    categories.environmentFiles.push(file);
  }
  if (/\.(bson|dump|archive|sqlite|sqlite3)$/.test(lower)) {
    categories.databaseExports.push(file);
  }
  if (/\.(pem|key|p12|pfx)$/.test(lower)) {
    categories.privateKeys.push(file);
  }
}

const counts = Object.fromEntries(
  Object.entries(categories).map(([name, files]) => [name, files.length]),
);
const totalViolations = Object.values(counts).reduce(
  (total, count) => total + count,
  0,
);

process.stdout.write(
  JSON.stringify(
    {
      success: totalViolations === 0,
      totalViolations,
      counts,
      note:
        totalViolations === 0
          ? "Repository data boundary passed"
          : "Tracked runtime/private data requires approved untracking and possible Git history cleanup",
    },
    null,
    2,
  ) + "\n",
);

if (totalViolations > 0) process.exitCode = 1;
