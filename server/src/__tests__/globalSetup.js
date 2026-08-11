import { MongoMemoryReplSet } from "mongodb-memory-server";

import { replicaSetOptions } from "./mongoRuntime.js";

export default async function globalSetup() {
  const mongoServer = await MongoMemoryReplSet.create(replicaSetOptions);
  process.env.VITEST_SHARED_MONGO_URI = mongoServer.getUri();

  return async () => {
    delete process.env.VITEST_SHARED_MONGO_URI;
    await mongoServer.stop();
  };
}
