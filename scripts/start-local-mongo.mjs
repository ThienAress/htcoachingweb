import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MongoMemoryReplSet } from "../server/node_modules/mongodb-memory-server/index.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const localData = path.join(repoRoot, ".local-data");
const dbPath = path.join(localData, "mongodb");
const downloadDir = path.join(localData, "mongodb-binaries");
const readyPath = path.join(localData, "local-mongo-runtime.json");

await fs.mkdir(dbPath, { recursive: true });
await fs.mkdir(downloadDir, { recursive: true });

const mongo = await MongoMemoryReplSet.create({
  binary: { version: "8.2.6", downloadDir },
  instanceOpts: [
    {
      ip: "127.0.0.1",
      port: 27017,
      dbPath,
      storageEngine: "wiredTiger",
    },
  ],
  replSet: {
    count: 1,
    dbName: "htcoaching_local",
    ip: "127.0.0.1",
    name: "rs0",
    storageEngine: "wiredTiger",
  },
});

await fs.writeFile(
  readyPath,
  `${JSON.stringify({
    status: "ready",
    host: "127.0.0.1",
    port: 27017,
    database: "htcoaching_local",
    version: "8.2.6",
  })}\n`,
  "utf8",
);

console.log(
  JSON.stringify({
    status: "ready",
    host: "127.0.0.1",
    port: 27017,
    version: "8.2.6",
  }),
);

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await mongo.stop({ doCleanup: false, force: true });
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
setInterval(() => {}, 24 * 60 * 60 * 1000);
