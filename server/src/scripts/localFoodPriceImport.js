import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import Food from "../models/Food.js";
import FoodPriceObservation from "../models/FoodPriceObservation.js";
import { getFoodMarketPriceMap } from "../services/foodPrice.service.js";
import {
  LOCAL_FOOD_PRICE_OBSERVATIONS,
  LOCAL_PRICE_DATABASE,
  LOCAL_PRICE_MONGO_URI,
  classifyExistingObservation,
  makeLocalFoodPriceImportError,
  validateLocalPriceTarget,
  validatePriceManifest,
} from "./localFoodPriceImport.contract.js";

export {
  LOCAL_FOOD_PRICE_OBSERVATIONS,
  LOCAL_PRICE_DATABASE,
  LOCAL_PRICE_MONGO_URI,
  classifyExistingObservation,
  validateLocalPriceTarget,
  validatePriceManifest,
};

const observationIdentity = ({ foodId, sourceKey, observedAt }) =>
  `${String(foodId)}|${sourceKey}|${new Date(observedAt).toISOString()}`;

const buildPlan = async () => {
  const labels = [
    ...new Set(LOCAL_FOOD_PRICE_OBSERVATIONS.map(({ foodLabel }) => foodLabel)),
  ];
  const foods = await Food.find({ label: { $in: labels } })
    .select("_id label")
    .lean();
  const foodsByLabel = new Map(foods.map((food) => [food.label, food]));
  const missingLabels = labels.filter((label) => !foodsByLabel.has(label));
  if (foods.length !== labels.length || missingLabels.length > 0) {
    throw makeLocalFoodPriceImportError(
      "LOCAL_FOOD_PRICE_LABEL_DRIFT",
      `Local Food labels missing: ${missingLabels.join(", ")}`,
    );
  }

  const expected = LOCAL_FOOD_PRICE_OBSERVATIONS.map((observation) => ({
    ...observation,
    foodId: foodsByLabel.get(observation.foodLabel)._id,
  }));
  const existing = await FoodPriceObservation.find({
    foodId: { $in: foods.map(({ _id }) => _id) },
    observedAt: {
      $in: [
        ...new Set(expected.map(({ observedAt }) => observedAt)),
      ].map((value) => new Date(value)),
    },
  }).lean();
  const existingByIdentity = new Map(
    existing.map((observation) => [
      observationIdentity(observation),
      observation,
    ]),
  );

  return expected.map((observation) => ({
    observation,
    action: classifyExistingObservation(
      existingByIdentity.get(observationIdentity(observation)),
      observation,
    ),
  }));
};

const summarizePlan = (plan) => ({
  insert: plan.filter(({ action }) => action === "insert").length,
  skip: plan.filter(({ action }) => action === "skip").length,
});

const applyPlan = async (plan) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const { action, observation } of plan) {
        if (action !== "insert") continue;
        const { foodLabel: _foodLabel, ...payload } = observation;
        await FoodPriceObservation.updateOne(
          {
            foodId: payload.foodId,
            sourceKey: payload.sourceKey,
            observedAt: new Date(payload.observedAt),
          },
          {
            $setOnInsert: {
              ...payload,
              observedAt: new Date(payload.observedAt),
              region: "ho_chi_minh",
              currency: "VND",
            },
          },
          { upsert: true, runValidators: true, session },
        );
      }
    });
  } finally {
    await session.endSession();
  }
};

const verifyAppliedPlan = async (plan) => {
  const foodIds = [...new Set(plan.map(({ observation }) => observation.foodId))];
  const marketPrices = await getFoodMarketPriceMap(foodIds);
  const sufficient = foodIds.filter(
    (foodId) => marketPrices.get(String(foodId))?.coverageStatus === "sufficient",
  );
  const observations = await FoodPriceObservation.countDocuments({
    $or: plan.map(({ observation }) => ({
      foodId: observation.foodId,
      sourceKey: observation.sourceKey,
      observedAt: new Date(observation.observedAt),
    })),
  });
  if (observations !== plan.length || sufficient.length !== foodIds.length) {
    throw makeLocalFoodPriceImportError("LOCAL_FOOD_PRICE_VERIFY_FAILED");
  }
  return {
    observations,
    foodsWithSufficientCoverage: sufficient.length,
  };
};

export const runLocalFoodPriceImport = async ({
  argv = process.argv.slice(2),
} = {}) => {
  const apply = argv.includes("--apply");
  const target = validateLocalPriceTarget(LOCAL_PRICE_MONGO_URI);
  if (!target.valid) {
    throw makeLocalFoodPriceImportError(
      "LOCAL_FOOD_PRICE_TARGET_REJECTED",
      target.errors.join(", "),
    );
  }
  validatePriceManifest();

  await mongoose.connect(LOCAL_PRICE_MONGO_URI, { autoIndex: false });
  try {
    if (mongoose.connection.name !== LOCAL_PRICE_DATABASE) {
      throw makeLocalFoodPriceImportError(
        "LOCAL_FOOD_PRICE_CONNECTED_DATABASE_MISMATCH",
      );
    }
    const plan = await buildPlan();
    const actions = summarizePlan(plan);
    if (apply) await applyPlan(plan);
    return {
      mode: apply ? "apply" : "dry-run",
      database: LOCAL_PRICE_DATABASE,
      manifest: validatePriceManifest(),
      actions,
      verified: apply ? await verifyAppliedPlan(plan) : null,
    };
  } finally {
    await mongoose.disconnect();
  }
};

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runLocalFoodPriceImport()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(
        JSON.stringify({
          success: false,
          code: error.code || "LOCAL_FOOD_PRICE_IMPORT_FAILED",
          message: error.message,
        }),
      );
      process.exitCode = 1;
    });
}
