import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUTPUT_FILE = fileURLToPath(
  new URL("../src/generated/systemDependencyManifests.json", import.meta.url),
);

const sources = [
  {
    scopeKey: "workspace",
    scopeLabel: "Workspace",
    file: "package.json",
    url: new URL("../../package.json", import.meta.url),
  },
  {
    scopeKey: "frontend",
    scopeLabel: "Frontend",
    file: "client/package.json",
    url: new URL("../package.json", import.meta.url),
  },
  {
    scopeKey: "backend",
    scopeLabel: "Backend",
    file: "server/package.json",
    url: new URL("../../server/package.json", import.meta.url),
  },
];

const manifests = await Promise.all(
  sources.map(async ({ url, ...source }) => {
    const manifest = JSON.parse(await readFile(url, "utf8"));
    return {
      ...source,
      packageName: manifest.name || "—",
      packageVersion: manifest.version || "—",
      nodeVersion: manifest.engines?.node || "—",
      dependencies: manifest.dependencies || {},
      devDependencies: manifest.devDependencies || {},
    };
  }),
);

await mkdir(dirname(OUTPUT_FILE), { recursive: true });
await writeFile(OUTPUT_FILE, `${JSON.stringify(manifests, null, 2)}\n`, "utf8");
console.log(`Generated ${OUTPUT_FILE}`);
