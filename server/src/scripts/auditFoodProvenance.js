import mongoose from "mongoose";

import Food from "../models/Food.js";

if (process.env.FOOD_PROVENANCE_AUDIT_ALLOW_LIVE !== "true") {
  throw new Error(
    "Read-only audit disabled. Set FOOD_PROVENANCE_AUDIT_ALLOW_LIVE=true explicitly.",
  );
}
if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");

await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });

try {
  const [summary] = await Food.collection.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        legacyUnknown: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: [{ $type: "$source" }, "missing"] },
                  { $eq: ["$source.type", "legacy_unknown"] },
                ],
              },
              1,
              0,
            ],
          },
        },
        knownSource: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: [{ $type: "$source" }, "missing"] },
                  { $ne: ["$source.type", "legacy_unknown"] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]).toArray();
  const bySource = await Food.collection.aggregate([
    {
      $group: {
        _id: { $ifNull: ["$source.type", "legacy_unknown"] },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).toArray();

  process.stdout.write(`${JSON.stringify({
    mode: "read-only",
    total: summary?.total || 0,
    legacyUnknown: summary?.legacyUnknown || 0,
    knownSource: summary?.knownSource || 0,
    bySource: Object.fromEntries(
      bySource.map((entry) => [entry._id, entry.count]),
    ),
  }, null, 2)}\n`);
} finally {
  await mongoose.disconnect();
}
