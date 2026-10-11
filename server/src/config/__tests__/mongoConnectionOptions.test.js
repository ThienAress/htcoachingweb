import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveMongoConnectionOptions } from "../mongoConnectionOptions.js";

describe("MongoDB connection durability options", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("pins the complete production durability profile", () => {
    expect(resolveMongoConnectionOptions({ nodeEnv: "production" })).toEqual({
      autoIndex: false,
      readPreference: "primary",
      readConcern: { level: "majority" },
      writeConcern: { w: "majority", journal: true },
      retryReads: true,
      retryWrites: true,
    });
  });

  it("preserves the existing development and test behavior", () => {
    expect(resolveMongoConnectionOptions({ nodeEnv: "test" })).toEqual({
      autoIndex: true,
    });
  });

  it("uses the durable profile for an explicit production app target", () => {
    expect(
      resolveMongoConnectionOptions({
        nodeEnv: undefined,
        appEnv: "production",
        autoIndex: false,
      }),
    ).toMatchObject({
      readPreference: "primary",
      writeConcern: { w: "majority", journal: true },
    });
  });

  it("lets guarded live scripts request durability without implicit env state", () => {
    expect(
      resolveMongoConnectionOptions({
        nodeEnv: undefined,
        appEnv: undefined,
        durable: true,
        autoIndex: false,
      }),
    ).toMatchObject({
      autoIndex: false,
      readConcern: { level: "majority" },
      retryWrites: true,
    });
  });

  it("passes the resolved production profile to mongoose.connect", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    vi.doMock("mongoose", () => ({
      default: { connect, connection: { readyState: 1 } },
    }));
    vi.doMock("../../utils/safeLogger.js", () => ({
      safeLog: { info: vi.fn(), error: vi.fn() },
    }));
    const previousNodeEnv = process.env.NODE_ENV;
    const previousMongoUri = process.env.MONGO_URI;
    process.env.NODE_ENV = "production";
    process.env.MONGO_URI = "mongodb://database.example/htcoaching?tls=true";

    try {
      const { default: connectDB } = await import("../db.js");
      await connectDB();
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      process.env.MONGO_URI = previousMongoUri;
    }

    expect(connect).toHaveBeenCalledWith(
      "mongodb://database.example/htcoaching?tls=true",
      expect.objectContaining({
        autoIndex: false,
        readPreference: "primary",
        readConcern: { level: "majority" },
        writeConcern: { w: "majority", journal: true },
        retryReads: true,
        retryWrites: true,
      }),
    );
  });
});
