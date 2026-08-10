import mongoose from "mongoose";

import Food from "../models/Food.js";
import FoodPriceObservation from "../models/FoodPriceObservation.js";

if (process.env.MEAL_PLAN_COVERAGE_AUDIT_ALLOW_LIVE !== "true") {
  throw new Error(
    "Read-only audit disabled. Set MEAL_PLAN_COVERAGE_AUDIT_ALLOW_LIVE=true explicitly.",
  );
}
if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");

await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });

try {
  const now = new Date();
  const freshAfter = new Date(now.getTime() - 90 * 86_400_000);
  const [foodSummary] = await Food.collection.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        allergenReviewed: {
          $sum: {
            $cond: [{ $eq: ["$allergenProfile.reviewStatus", "reviewed"] }, 1, 0],
          },
        },
        allergenUnreviewed: {
          $sum: {
            $cond: [
              { $eq: ["$allergenProfile.reviewStatus", "reviewed"] },
              0,
              1,
            ],
          },
        },
      },
    },
  ]).toArray();
  const priceCoverage = await FoodPriceObservation.collection.aggregate([
    {
      $match: {
        region: "ho_chi_minh",
        observedAt: { $gte: freshAfter, $lte: now },
      },
    },
    {
      $group: {
        _id: "$foodId",
        sources: { $addToSet: "$sourceKey" },
        observationCount: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        foodsWithAnyFreshPrice: { $sum: 1 },
        foodsWithSufficientPrice: {
          $sum: { $cond: [{ $gte: [{ $size: "$sources" }, 2] }, 1, 0] },
        },
        freshObservations: { $sum: "$observationCount" },
      },
    },
  ]).toArray();

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: "read-only",
        region: "ho_chi_minh",
        freshnessDays: 90,
        totalFoods: foodSummary?.total || 0,
        allergenReviewed: foodSummary?.allergenReviewed || 0,
        allergenUnreviewed: foodSummary?.allergenUnreviewed || 0,
        foodsWithAnyFreshPrice: priceCoverage?.foodsWithAnyFreshPrice || 0,
        foodsWithSufficientPrice:
          priceCoverage?.foodsWithSufficientPrice || 0,
        freshObservations: priceCoverage?.freshObservations || 0,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await mongoose.disconnect();
}
