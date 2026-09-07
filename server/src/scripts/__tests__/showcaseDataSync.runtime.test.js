import mongodb from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  assertProductionSourceReadOnly,
  assertStagingTargetWriteScope,
  ensureTargetShowcaseIndexes,
  listSourceShowcaseGraph,
  preflightTargetShowcase,
  showcaseGraphCounts,
  showcaseGraphFingerprint,
  syncShowcaseGraphToTarget,
} from "../showcaseDataSync.runtime.js";

const { MongoClient, ObjectId } = mongodb;

describe("showcase data sync runtime", () => {
  let client;
  let sourceDb;
  let targetDb;
  const trainerId = new ObjectId();
  const otherTrainerId = new ObjectId();
  const directStoryId = new ObjectId();
  const legacyNullStoryId = new ObjectId();
  const legacyMissingStoryId = new ObjectId();

  beforeAll(async () => {
    client = new MongoClient(process.env.VITEST_SHARED_MONGO_URI);
    await client.connect();
    sourceDb = client.db("showcase_sync_source");
    targetDb = client.db("showcase_sync_target");
    await Promise.all([sourceDb.dropDatabase(), targetDb.dropDatabase()]);

    await sourceDb.collection("trainers").insertMany([
      {
        _id: trainerId,
        slug: "hoang-thien",
        name: "Production trainer",
        status: "published",
        isHeadCoach: true,
        images: ["https://cdn.example/trainer.webp"],
        internalNotes: "must-not-copy",
      },
      {
        _id: otherTrainerId,
        slug: "other-trainer",
        name: "Other trainer",
        status: "published",
        isHeadCoach: false,
      },
      {
        _id: new ObjectId(),
        slug: "hoang-thien",
        name: "Draft duplicate ignored by the public selector",
        status: "draft",
      },
    ]);
    await sourceDb.collection("customerstories").insertMany([
      {
        _id: directStoryId,
        slug: "direct-story",
        trainerId,
        orderId: new ObjectId(),
        name: "Direct public customer",
        status: "published",
      },
      {
        _id: legacyNullStoryId,
        slug: "legacy-null-story",
        trainerId: null,
        orderId: new ObjectId(),
        name: "Legacy public customer",
        status: "published",
      },
      {
        _id: legacyMissingStoryId,
        slug: "legacy-missing-story",
        orderId: new ObjectId(),
        name: "Legacy missing trainer",
        status: "published",
      },
      {
        _id: new ObjectId(),
        slug: "draft-story",
        trainerId,
        name: "Draft customer",
        status: "draft",
      },
      {
        _id: new ObjectId(),
        slug: "other-story",
        trainerId: otherTrainerId,
        name: "Other customer",
        status: "published",
      },
    ]);
  });

  afterAll(async () => {
    await Promise.all([sourceDb.dropDatabase(), targetDb.dropDatabase()]);
    await client.close();
  });

  it("reuses the exact read@gym-app runtime privilege guard", async () => {
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
    [{ role: "stagingAccountSyncReadWrite", db: "admin" }],
    [{ role: "readWrite", db: "htcoaching_staging" }],
  ])("accepts the one approved staging target role %#", async (role) => {
    const scopedTargetDb = {
      command: async () => ({
        authInfo: {
          authenticatedUserRoles: [role],
          authenticatedUserPrivileges: [
            {
              resource: { db: "htcoaching_staging", collection: "" },
              actions: [
                "find",
                "insert",
                "update",
                "createIndex",
                "listIndexes",
              ],
            },
          ],
        },
      }),
    };

    await expect(assertStagingTargetWriteScope(scopedTargetDb)).resolves.toEqual({
      verified: true,
    });
  });

  it.each([
    [
      "an extra role",
      [
        { role: "stagingAccountSyncReadWrite", db: "admin" },
        { role: "read", db: "other" },
      ],
      [
        {
          resource: { db: "htcoaching_staging", collection: "" },
          actions: ["find", "insert", "update", "createIndex", "listIndexes"],
        },
      ],
      "SHOWCASE_SYNC_STAGING_TARGET_ROLE_REQUIRED",
    ],
    [
      "a cross-database privilege",
      [{ role: "stagingAccountSyncReadWrite", db: "admin" }],
      [
        {
          resource: { db: "htcoaching_staging", collection: "" },
          actions: ["find", "insert", "update", "createIndex", "listIndexes"],
        },
        { resource: { db: "admin", collection: "" }, actions: ["find"] },
      ],
      "SHOWCASE_SYNC_STAGING_TARGET_PRIVILEGE_SCOPE_REJECTED",
    ],
    [
      "a cluster privilege",
      [{ role: "readWrite", db: "htcoaching_staging" }],
      [
        {
          resource: { db: "htcoaching_staging", collection: "" },
          actions: ["find", "insert", "update", "createIndex", "listIndexes"],
        },
        { resource: { cluster: true }, actions: ["serverStatus"] },
      ],
      "SHOWCASE_SYNC_STAGING_TARGET_PRIVILEGE_SCOPE_REJECTED",
    ],
  ])("rejects staging target scope with %s", async (_label, roles, privileges, code) => {
    const unsafeTargetDb = {
      command: async () => ({
        authInfo: {
          authenticatedUserRoles: roles,
          authenticatedUserPrivileges: privileges,
        },
      }),
    };

    await expect(assertStagingTargetWriteScope(unsafeTargetDb)).rejects.toMatchObject({
      code,
    });
  });

  it("rejects a staging role missing a required sync capability", async () => {
    const insufficientTargetDb = {
      command: async () => ({
        authInfo: {
          authenticatedUserRoles: [
            { role: "stagingAccountSyncReadWrite", db: "admin" },
          ],
          authenticatedUserPrivileges: [
            {
              resource: { db: "htcoaching_staging", collection: "" },
              actions: ["find", "insert", "update"],
            },
          ],
        },
      }),
    };

    await expect(
      assertStagingTargetWriteScope(insufficientTargetDb),
    ).rejects.toMatchObject({
      code: "SHOWCASE_SYNC_STAGING_TARGET_CAPABILITY_REQUIRED",
    });
  });

  it("reads one exact published trainer and the head-coach public stories", async () => {
    const { trainer, graph } = await listSourceShowcaseGraph(sourceDb);

    expect({
      trainerId: trainer._id,
      trainerCount: graph.trainers.length,
      storyIds: graph.customerstories
        .map((story) => String(story._id))
        .sort(),
      orderIds: graph.customerstories.map((story) => story.orderId),
      internalNotes: graph.trainers[0].internalNotes,
    }).toEqual({
      trainerId,
      trainerCount: 1,
      storyIds: [directStoryId, legacyNullStoryId, legacyMissingStoryId]
        .map(String)
        .sort(),
      orderIds: [null, null, null],
      internalNotes: undefined,
    });
  });

  it("does not attach legacy stories to a non-head coach", async () => {
    const isolatedDb = client.db("showcase_sync_non_head_source");
    await isolatedDb.dropDatabase();
    const isolatedTrainerId = new ObjectId();
    await isolatedDb.collection("trainers").insertOne({
      _id: isolatedTrainerId,
      slug: "hoang-thien",
      name: "Non-head trainer",
      status: "published",
      isHeadCoach: false,
    });
    await isolatedDb.collection("customerstories").insertMany([
      {
        _id: new ObjectId(),
        slug: "owned-story",
        trainerId: isolatedTrainerId,
        name: "Owned",
        status: "published",
      },
      {
        _id: new ObjectId(),
        slug: "legacy-story",
        trainerId: null,
        name: "Legacy",
        status: "published",
      },
    ]);

    const { graph } = await listSourceShowcaseGraph(isolatedDb);

    expect(graph.customerstories.map((story) => story.slug)).toEqual([
      "owned-story",
    ]);
    await isolatedDb.dropDatabase();
  });

  it.each([
    ["missing", []],
    [
      "ambiguous",
      [
        {
          _id: new ObjectId(),
          slug: "hoang-thien",
          status: "published",
        },
        {
          _id: new ObjectId(),
          slug: "hoang-thien",
          status: "published",
        },
      ],
    ],
  ])("rejects a %s exact source trainer", async (_label, trainers) => {
    const isolatedDb = client.db(`showcase_sync_${_label}_source`);
    await isolatedDb.dropDatabase();
    if (trainers.length) {
      await isolatedDb.collection("trainers").insertMany(trainers);
    }

    await expect(listSourceShowcaseGraph(isolatedDb)).rejects.toMatchObject({
      code: "SHOWCASE_SYNC_EXACT_SOURCE_TRAINER_REQUIRED",
    });
    await isolatedDb.dropDatabase();
  });

  it("rejects trainer and customer-story slug collisions before mutation", async () => {
    const { graph } = await listSourceShowcaseGraph(sourceDb);
    const trainerConflictDb = client.db("showcase_sync_trainer_conflict_target");
    await trainerConflictDb.dropDatabase();
    await trainerConflictDb.collection("trainers").insertOne({
      _id: new ObjectId(),
      slug: "hoang-thien",
    });

    await expect(
      preflightTargetShowcase(trainerConflictDb, graph),
    ).rejects.toMatchObject({
      code: "SHOWCASE_SYNC_TARGET_SLUG_CONFLICT",
      collection: "trainers",
    });

    const storyConflictDb = client.db("showcase_sync_story_conflict_target");
    await storyConflictDb.dropDatabase();
    await storyConflictDb.collection("customerstories").insertOne({
      _id: new ObjectId(),
      slug: "direct-story",
    });

    await expect(
      preflightTargetShowcase(storyConflictDb, graph),
    ).rejects.toMatchObject({
      code: "SHOWCASE_SYNC_TARGET_SLUG_CONFLICT",
      collection: "customerstories",
    });
    await Promise.all([
      trainerConflictDb.dropDatabase(),
      storyConflictDb.dropDatabase(),
    ]);
  });

  it("plans missing unique slug indexes in dry-run without creating collections", async () => {
    const indexDb = client.db("showcase_sync_index_dry_run_target");
    await indexDb.dropDatabase();

    await expect(
      ensureTargetShowcaseIndexes({ targetDb: indexDb }),
    ).resolves.toMatchObject({
      verified: false,
      created: 0,
      planned: [
        { collection: "trainers", name: "slug_1" },
        { collection: "customerstories", name: "slug_1" },
      ],
    });
    expect(await indexDb.listCollections().toArray()).toEqual([]);
    await indexDb.dropDatabase();
  });

  it("creates and verifies unique slug indexes on apply idempotently", async () => {
    const indexDb = client.db("showcase_sync_index_apply_target");
    await indexDb.dropDatabase();

    await expect(
      ensureTargetShowcaseIndexes({ targetDb: indexDb, apply: true }),
    ).resolves.toMatchObject({ verified: true, created: 2 });
    await expect(
      ensureTargetShowcaseIndexes({ targetDb: indexDb, apply: true }),
    ).resolves.toMatchObject({ verified: true, created: 0, planned: [] });

    const [trainerIndexes, storyIndexes] = await Promise.all([
      indexDb.collection("trainers").listIndexes().toArray(),
      indexDb.collection("customerstories").listIndexes().toArray(),
    ]);
    expect(
      [trainerIndexes, storyIndexes].every((indexes) =>
        indexes.some(
          (index) => index.unique === true && index.key?.slug === 1,
        ),
      ),
    ).toBe(true);
    await indexDb.dropDatabase();
  });

  it("does not accept sparse or partial unique slug indexes as global guards", async () => {
    const indexDb = client.db("showcase_sync_non_global_index_target");
    await indexDb.dropDatabase();
    await indexDb
      .collection("trainers")
      .createIndex({ slug: 1 }, { unique: true, sparse: true, name: "slug_sparse" });
    await indexDb.collection("customerstories").createIndex(
      { slug: 1 },
      {
        unique: true,
        partialFilterExpression: { status: "published" },
        name: "slug_published_only",
      },
    );

    await expect(
      ensureTargetShowcaseIndexes({ targetDb: indexDb }),
    ).resolves.toMatchObject({
      verified: false,
      created: 0,
      planned: [
        { collection: "trainers", name: "slug_1" },
        { collection: "customerstories", name: "slug_1" },
      ],
    });
    await indexDb.dropDatabase();
  });

  it("reports duplicate target slugs with stable metadata before index creation", async () => {
    const duplicateDb = client.db("showcase_sync_index_duplicate_target");
    await duplicateDb.dropDatabase();
    await duplicateDb.collection("trainers").insertMany([
      { _id: new ObjectId(), slug: "duplicate-slug", name: "Sensitive A" },
      { _id: new ObjectId(), slug: "duplicate-slug", name: "Sensitive B" },
    ]);

    let error;
    try {
      await ensureTargetShowcaseIndexes({ targetDb: duplicateDb, apply: true });
    } catch (caught) {
      error = caught;
    }
    expect({
      code: error?.code,
      collection: error?.collection,
      indexFields: error?.indexFields,
      leaked: error?.message.includes("Sensitive"),
    }).toEqual({
      code: "SHOWCASE_SYNC_TARGET_INDEX_CREATE_FAILED",
      collection: "trainers",
      indexFields: ["slug"],
      leaked: false,
    });
    await duplicateDb.dropDatabase();
  });

  it("dry-runs with zero writes, then applies idempotently with exact BSON ids", async () => {
    const { graph } = await listSourceShowcaseGraph(sourceDb);
    await preflightTargetShowcase(targetDb, graph);

    await expect(
      syncShowcaseGraphToTarget({ targetDb, graph }),
    ).resolves.toEqual({ written: 0 });
    expect(await targetDb.collection("trainers").countDocuments()).toBe(0);

    const expectedWrites =
      graph.trainers.length + graph.customerstories.length;
    await ensureTargetShowcaseIndexes({ targetDb, apply: true });
    await expect(
      syncShowcaseGraphToTarget({
        targetDb,
        targetClient: client,
        graph,
        apply: true,
      }),
    ).resolves.toEqual({ written: expectedWrites });
    expect(
      await targetDb.collection("trainers").findOne({ _id: trainerId }),
    ).toEqual(graph.trainers[0]);
    expect(
      await targetDb
        .collection("customerstories")
        .findOne({ _id: directStoryId }),
    ).toEqual(graph.customerstories.find(({ _id }) => _id.equals(directStoryId)));

    await expect(
      syncShowcaseGraphToTarget({
        targetDb,
        targetClient: client,
        graph,
        apply: true,
      }),
    ).resolves.toEqual({ written: expectedWrites });
    expect(await targetDb.collection("customerstories").countDocuments()).toBe(3);
  });

  it("produces stable safe counts and fingerprints regardless of source order", async () => {
    const { graph } = await listSourceShowcaseGraph(sourceDb);
    const reversed = {
      customerstories: [...graph.customerstories].reverse(),
      trainers: [...graph.trainers],
    };

    expect({
      counts: showcaseGraphCounts(graph),
      sameFingerprint:
        showcaseGraphFingerprint(graph) === showcaseGraphFingerprint(reversed),
    }).toEqual({
      counts: { trainers: 1, customerstories: 3 },
      sameFingerprint: true,
    });
  });

  it("rechecks slug conflicts inside the transaction before any write", async () => {
    const { graph } = await listSourceShowcaseGraph(sourceDb);
    const rollbackDb = client.db("showcase_sync_rollback_target");
    await rollbackDb.dropDatabase();
    await rollbackDb
      .collection("customerstories")
      .createIndex({ slug: 1 }, { unique: true });
    await rollbackDb.collection("customerstories").insertOne({
      _id: new ObjectId(),
      slug: "direct-story",
    });

    await expect(
      syncShowcaseGraphToTarget({
        targetDb: rollbackDb,
        targetClient: client,
        graph,
        apply: true,
      }),
    ).rejects.toMatchObject({
      code: "SHOWCASE_SYNC_TARGET_SLUG_CONFLICT",
      collection: "customerstories",
    });
    expect(await rollbackDb.collection("trainers").countDocuments()).toBe(0);
    expect(await rollbackDb.collection("customerstories").countDocuments()).toBe(1);
    await rollbackDb.dropDatabase();
  });

  it("rolls back a trainer write when the later story write fails", async () => {
    const { graph } = await listSourceShowcaseGraph(sourceDb);
    const rollbackDb = client.db("showcase_sync_late_failure_target");
    await rollbackDb.dropDatabase();
    const wrappedDb = {
      collection: (name) => {
        const collection = rollbackDb.collection(name);
        if (name !== "customerstories") return collection;
        return new Proxy(collection, {
          get(targetCollection, property) {
            if (property === "replaceOne") {
              return async () => {
                throw new Error("sensitive simulated write failure");
              };
            }
            const value = Reflect.get(targetCollection, property, targetCollection);
            return typeof value === "function"
              ? value.bind(targetCollection)
              : value;
          },
        });
      },
    };

    let error;
    try {
      await syncShowcaseGraphToTarget({
        targetDb: wrappedDb,
        targetClient: client,
        graph,
        apply: true,
      });
    } catch (caught) {
      error = caught;
    }

    expect({
      code: error?.code,
      collection: error?.collection,
      leaked: error?.message.includes("sensitive"),
      trainerCount: await rollbackDb.collection("trainers").countDocuments(),
      storyCount: await rollbackDb.collection("customerstories").countDocuments(),
    }).toEqual({
      code: "SHOWCASE_SYNC_TARGET_WRITE_FAILED",
      collection: "customerstories",
      leaked: false,
      trainerCount: 0,
      storyCount: 0,
    });
    await rollbackDb.dropDatabase();
  });
});
