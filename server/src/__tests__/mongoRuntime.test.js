import { describe, expect, it, vi } from "vitest";

import {
  createMongoTestRuntime,
  stopMongoTestRuntime,
  testMongoDatabaseName,
} from "./mongoRuntime.js";

describe("shared Mongo test runtime", () => {
  it("reuses the global URI without creating or owning another replica set", async () => {
    const createReplSet = vi.fn();

    const runtime = await createMongoTestRuntime({
      sharedUri: "mongodb://127.0.0.1:27017/shared-test",
      createReplSet,
    });

    expect(runtime).toEqual({
      uri: "mongodb://127.0.0.1:27017/shared-test",
      server: null,
      ownsServer: false,
    });
    expect(createReplSet).not.toHaveBeenCalled();
  });

  it("keeps fallback creation for focused runs outside Vitest global setup", async () => {
    const server = { getUri: () => "mongodb://fallback", stop: vi.fn() };
    const createReplSet = vi.fn().mockResolvedValue(server);

    const runtime = await createMongoTestRuntime({ createReplSet });

    expect(runtime).toEqual({
      uri: "mongodb://fallback",
      server,
      ownsServer: true,
    });
    expect(createReplSet).toHaveBeenCalledOnce();
  });

  it("stops only a locally owned replica set", async () => {
    const sharedStop = vi.fn();
    const ownedStop = vi.fn();

    await stopMongoTestRuntime({ server: { stop: sharedStop }, ownsServer: false });
    await stopMongoTestRuntime({ server: { stop: ownedStop }, ownsServer: true });

    expect(sharedStop).not.toHaveBeenCalled();
    expect(ownedStop).toHaveBeenCalledOnce();
  });

  it("isolates each Vitest worker in a bounded database name", () => {
    expect(testMongoDatabaseName("1")).toBe("vitest_worker_1");
    expect(testMongoDatabaseName("2")).toBe("vitest_worker_2");
    expect(testMongoDatabaseName("../../unsafe worker")).toBe(
      "vitest_worker_unsafe_worker",
    );
    expect(testMongoDatabaseName("../../unsafe worker")).not.toBe(
      testMongoDatabaseName("2"),
    );
  });
});
