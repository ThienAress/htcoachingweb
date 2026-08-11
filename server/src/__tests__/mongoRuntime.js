const replicaSetOptions = {
  replSet: {
    count: 1,
    storageEngine: "wiredTiger",
  },
};

export function testMongoDatabaseName(
  workerId =
    process.env.VITEST_POOL_ID || process.env.VITEST_WORKER_ID || process.pid,
) {
  const safeWorkerId = String(workerId)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `vitest_worker_${safeWorkerId || "main"}`;
}

export async function createMongoTestRuntime({
  sharedUri,
  createReplSet,
} = {}) {
  if (sharedUri) {
    return { uri: sharedUri, server: null, ownsServer: false };
  }
  if (typeof createReplSet !== "function") {
    throw new Error("createReplSet is required when no shared Mongo URI exists");
  }

  const server = await createReplSet(replicaSetOptions);
  return { uri: server.getUri(), server, ownsServer: true };
}

export async function stopMongoTestRuntime(runtime) {
  if (runtime?.ownsServer && runtime.server) await runtime.server.stop();
}

export { replicaSetOptions };
