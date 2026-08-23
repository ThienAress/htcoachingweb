import crypto from "node:crypto";
import mongodb from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  assertProductionSourceReadOnly,
  listSourceAccountGraph,
  preflightTargetAccount,
  syncAccountGraphToTarget,
} from "../singleAccountSync.runtime.js";

const { MongoClient, ObjectId } = mongodb;
const accountEmail = "owner.account@example.test";
const accountEmailDigest = crypto
  .createHash("sha256")
  .update(accountEmail)
  .digest("hex");
const accountOptions = { accountEmail, accountEmailDigest };

describe("single-account sync runtime", () => {
  let client;
  let sourceDb;
  let targetDb;
  const userId = new ObjectId();
  const otherUserId = new ObjectId();
  const orderId = new ObjectId();

  beforeAll(async () => {
    client = new MongoClient(process.env.VITEST_SHARED_MONGO_URI);
    await client.connect();
    sourceDb = client.db("single_account_sync_source");
    targetDb = client.db("single_account_sync_target");
    await Promise.all([sourceDb.dropDatabase(), targetDb.dropDatabase()]);

    await sourceDb.collection("users").insertMany([
      {
        _id: userId,
        email: accountEmail,
        name: "Production Test",
        password: "production-hash-must-not-copy",
        refreshToken: "production-refresh-must-not-copy",
      },
      { _id: otherUserId, email: "other@example.com", name: "Other" },
    ]);
    await sourceDb.collection("orders").insertMany([
      { _id: orderId, userId, status: "approved" },
      { _id: new ObjectId(), userId: otherUserId, status: "approved" },
    ]);
    await sourceDb.collection("checkins").insertMany([
      { _id: new ObjectId(), orderId, muscle: "Back" },
      { _id: new ObjectId(), orderId: new ObjectId(), muscle: "Other" },
    ]);
    await sourceDb.collection("dailyjournals").insertMany([
      { _id: new ObjectId(), clientId: userId, dateKey: "2026-08-22" },
      { _id: new ObjectId(), clientId: otherUserId, dateKey: "2026-08-22" },
    ]);
    await targetDb.collection("users").insertOne({
      _id: userId,
      email: accountEmail,
      name: "Local Test",
      password: "local-login-hash",
      refreshToken: "local-refresh",
    });
  });

  afterAll(async () => {
    await Promise.all([sourceDb.dropDatabase(), targetDb.dropDatabase()]);
    await client.close();
  });

  it("verifies the authenticated source has only read@gym-app", async () => {
    const readonlySourceDb = {
      command: async () => ({
        authInfo: {
          authenticatedUserRoles: [{ role: "read", db: "gym-app" }],
          authenticatedUserPrivileges: [
            {
              resource: { db: "gym-app", collection: "" },
              actions: ["find", "listCollections", "listIndexes"],
            },
          ],
        },
      }),
    };

    await expect(
      assertProductionSourceReadOnly(readonlySourceDb),
    ).resolves.toEqual({ verified: true });
  });

  it.each([
    [
      "a write role",
      [{ role: "readWrite", db: "gym-app" }],
      ["find", "insert"],
      "ACCOUNT_SYNC_SOURCE_READ_ONLY_ROLE_REQUIRED",
    ],
    [
      "a direct write privilege",
      [{ role: "read", db: "gym-app" }],
      ["find", "update"],
      "ACCOUNT_SYNC_SOURCE_WRITE_PRIVILEGE_REJECTED",
    ],
  ])("rejects a production source with %s", async (_label, roles, actions, code) => {
    const unsafeSourceDb = {
      command: async () => ({
        authInfo: {
          authenticatedUserRoles: roles,
          authenticatedUserPrivileges: [
            { resource: { db: "gym-app", collection: "" }, actions },
          ],
        },
      }),
    };

    await expect(
      assertProductionSourceReadOnly(unsafeSourceDb),
    ).rejects.toMatchObject({ code });
  });

  it("reads only the pinned account graph and strips source auth", async () => {
    const { graph } = await listSourceAccountGraph(sourceDb, accountOptions);

    expect(graph.users).toEqual([
      expect.objectContaining({ _id: userId, email: accountEmail }),
    ]);
    expect(graph.users[0]).not.toHaveProperty("password");
    expect(graph.users[0]).not.toHaveProperty("refreshToken");
    expect(graph.orders).toHaveLength(1);
    expect(graph.checkins).toHaveLength(1);
    expect(graph.dailyjournals).toHaveLength(1);
  });

  it("dry-runs with zero writes, then applies idempotently and preserves target auth", async () => {
    const { accountUser, graph } = await listSourceAccountGraph(
      sourceDb,
      accountOptions,
    );
    await preflightTargetAccount(
      targetDb,
      accountUser,
      accountOptions,
    );

    await expect(
      syncAccountGraphToTarget({ targetDb, graph }),
    ).resolves.toEqual({ written: 0 });
    expect(await targetDb.collection("orders").countDocuments()).toBe(0);

    await targetDb.collection("users").updateOne(
      { _id: userId },
      { $set: { refreshToken: "newer-local-refresh" } },
    );

    const expectedWrites = Object.values(graph).reduce(
      (sum, documents) => sum + documents.length,
      0,
    );
    await expect(
      syncAccountGraphToTarget({
        targetDb,
        targetClient: client,
        graph,
        apply: true,
      }),
    ).resolves.toEqual({ written: expectedWrites });

    const targetUser = await targetDb.collection("users").findOne({ _id: userId });
    expect(targetUser.name).toBe("Production Test");
    expect(targetUser.password).toBe("local-login-hash");
    expect(targetUser.refreshToken).toBe("newer-local-refresh");
    expect(await targetDb.collection("orders").countDocuments()).toBe(1);

    await expect(
      syncAccountGraphToTarget({
        targetDb,
        targetClient: client,
        graph,
        apply: true,
      }),
    ).resolves.toEqual({ written: expectedWrites });
    expect(await targetDb.collection("orders").countDocuments()).toBe(1);
  });

  it("rejects when the production user id belongs to another target identity", async () => {
    const conflictDb = client.db("single_account_sync_conflict_target");
    await conflictDb.dropDatabase();
    await conflictDb.collection("users").insertOne({
      _id: userId,
      email: "different@example.com",
    });

    await expect(
      preflightTargetAccount(conflictDb, {
        _id: userId,
        email: accountEmail,
      }, accountOptions),
    ).rejects.toMatchObject({ code: "ACCOUNT_SYNC_TARGET_USER_ID_CONFLICT" });
    await conflictDb.dropDatabase();
  });

  it("reports only safe collection and index metadata for a target unique conflict", async () => {
    const targetDbWithConflict = {
      collection: () => ({
        replaceOne: async () => {
          throw Object.assign(new Error("duplicate key with sensitive values"), {
            code: 11000,
            keyPattern: { clientId: 1, dateKey: 1 },
          });
        },
      }),
    };
    const targetClient = {
      startSession: () => ({
        withTransaction: async (operation) => operation(),
        endSession: async () => {},
      }),
    };

    await expect(
      syncAccountGraphToTarget({
        targetDb: targetDbWithConflict,
        targetClient,
        graph: { dailyjournals: [{ _id: "journal-source" }] },
        apply: true,
      }),
    ).rejects.toMatchObject({
      code: "ACCOUNT_SYNC_TARGET_UNIQUE_CONFLICT",
      collection: "dailyjournals",
      indexFields: ["clientId", "dateKey"],
    });
  });

  it("rolls back the whole graph when a later target write fails", async () => {
    const rollbackDb = client.db("single_account_sync_rollback_target");
    await rollbackDb.dropDatabase();
    await rollbackDb
      .collection("dailyjournals")
      .createIndex({ clientId: 1, dateKey: 1 }, { unique: true });
    await rollbackDb.collection("dailyjournals").insertOne({
      _id: new ObjectId(),
      clientId: userId,
      dateKey: "2026-08-23",
    });

    await expect(
      syncAccountGraphToTarget({
        targetDb: rollbackDb,
        targetClient: client,
        graph: {
          orders: [{ _id: new ObjectId(), userId, status: "approved" }],
          dailyjournals: [
            {
              _id: new ObjectId(),
              clientId: userId,
              dateKey: "2026-08-23",
            },
          ],
        },
        apply: true,
      }),
    ).rejects.toMatchObject({
      code: "ACCOUNT_SYNC_TARGET_UNIQUE_CONFLICT",
      collection: "dailyjournals",
    });
    expect(await rollbackDb.collection("orders").countDocuments()).toBe(0);
    expect(await rollbackDb.collection("dailyjournals").countDocuments()).toBe(1);
    await rollbackDb.dropDatabase();
  });
});
