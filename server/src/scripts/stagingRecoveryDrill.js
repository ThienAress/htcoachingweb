import "../config/env.js";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { BSON } from "mongodb";

import { assertStagingOperation } from "../config/stagingOperationSafety.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const hash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

let emergencyRestore = null;

const snapshotManagedFixtures = async (db) => {
  const collectionNames = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((collection) => collection.name)
    .sort();
  const snapshot = [];

  for (const collectionName of collectionNames) {
    const documents = await db
      .collection(collectionName)
      .find({ "_stagingFixture.managed": true })
      .sort({ _id: 1 })
      .toArray();
    for (const document of documents) {
      const bson = BSON.serialize(document);
      snapshot.push({
        collectionName,
        id: document._id,
        bson,
        digest: hash(bson),
      });
    }
  }
  return snapshot;
};

const snapshotDigest = (snapshot) => {
  const manifest = snapshot
    .map((entry) => `${entry.collectionName}:${entry.id}:${entry.digest}`)
    .join("\n");
  return hash(manifest);
};

const main = async () => {
  assertStagingOperation({ confirmationVariable: "CONFIRM_STAGING_RECOVERY_DRILL" });
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const db = mongoose.connection.db;
  assert(
    db?.databaseName === "htcoaching_staging",
    "Recovery drill is not connected to the staging database",
  );

  const before = await snapshotManagedFixtures(db);
  assert(before.length > 0, "No managed staging fixtures are available to snapshot");
  const beforeDigest = snapshotDigest(before);
  const target = before.find(
    (entry) => entry.collectionName === "exercises",
  );
  assert(target, "Synthetic exercise fixture is missing from the snapshot");

  const collection = db.collection(target.collectionName);
  const deleted = await collection.deleteOne({
    _id: target.id,
    "_stagingFixture.managed": true,
  });
  assert(deleted.deletedCount === 1, "Recovery drill could not delete its fixture");
  emergencyRestore = { collection, target, completed: false };
  assert(
    (await collection.countDocuments({ _id: target.id })) === 0,
    "Recovery drill deletion verification failed",
  );

  const restoredDocument = BSON.deserialize(target.bson);
  await collection.insertOne(restoredDocument);
  emergencyRestore.completed = true;
  const restored = await collection.findOne({ _id: target.id });
  assert(restored, "Recovery drill did not restore its fixture");
  assert(
    hash(BSON.serialize(restored)) === target.digest,
    "Restored fixture differs from the BSON snapshot",
  );

  const after = await snapshotManagedFixtures(db);
  const afterDigest = snapshotDigest(after);
  assert(after.length === before.length, "Managed fixture count changed after restore");
  assert(afterDigest === beforeDigest, "Managed fixture snapshot changed after restore");

  console.log(
    JSON.stringify(
      {
        operation: "staging-recovery-drill",
        database: db.databaseName,
        snapshotDocuments: before.length,
        snapshotCollections: new Set(
          before.map((entry) => entry.collectionName),
        ).size,
        snapshotDigestMatched: afterDigest === beforeDigest,
        deletionVerified: true,
        restoreVerified: true,
        stateRestored: true,
      },
      null,
      2,
    ),
  );
};

try {
  await main();
} finally {
  if (
    emergencyRestore &&
    !emergencyRestore.completed &&
    mongoose.connection.readyState === 1
  ) {
    const { collection, target } = emergencyRestore;
    const exists = await collection.countDocuments({ _id: target.id });
    if (!exists) await collection.insertOne(BSON.deserialize(target.bson));
  }
  await mongoose.disconnect();
}
