import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const SOURCE_EXTENSION = /\.(?:css|js|jsx|ts|tsx)$/i;
const IGNORED_DIRECTORIES = new Set([
  "__mocks__",
  "__tests__",
  "coverage",
  "dist",
  "node_modules",
]);
const IGNORED_SOURCE_FILE = /\.(?:spec|test)\.(?:js|jsx|ts|tsx)$/i;

export const toPosixPath = (value) => value.split(sep).join("/");

export const lineAt = (source, index) => source.slice(0, index).split("\n").length;

export const compactSnippet = (value) => value.replace(/\s+/g, " ").trim().slice(0, 180);

const walk = async (directory, files) => {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
  for (const entry of entries) {
    if (entry.name.startsWith(".") || IGNORED_DIRECTORIES.has(entry.name)) continue;
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(entryPath, files);
    else if (
      entry.isFile() &&
      SOURCE_EXTENSION.test(entry.name) &&
      !IGNORED_SOURCE_FILE.test(entry.name)
    ) files.push(entryPath);
  }
};

export const readUiSources = async ({ repoRoot, target }) => {
  const targetPath = resolve(repoRoot, target);
  const targetStat = await stat(targetPath);
  if (!targetStat.isDirectory()) throw new Error(`UI audit target must be a directory: ${target}`);
  const files = [];
  await walk(targetPath, files);
  return Promise.all(
    files.map(async (filePath) => ({
      file: toPosixPath(relative(repoRoot, filePath)),
      source: await readFile(filePath, "utf8"),
    })),
  );
};
