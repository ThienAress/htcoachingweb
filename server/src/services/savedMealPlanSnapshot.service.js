import crypto from "node:crypto";
import mongoose from "mongoose";
import Food from "../models/Food.js";
import { savedMealPlanError } from "./savedMealPlanAccess.service.js";

const MEAL_TYPES = new Set([
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "other",
]);
const round1 = (value) => Math.round((value + Number.EPSILON) * 10) / 10;
const nutrition = ({ protein, carb, fat }) => {
  const result = {
    protein: round1(protein),
    carb: round1(carb),
    fat: round1(fat),
  };
  return {
    ...result,
    calories: round1(
      result.protein * 4 + result.carb * 4 + result.fat * 9,
    ),
  };
};
const sumNutrition = (items) =>
  nutrition(
    items.reduce(
      (total, item) => ({
        protein: total.protein + Number(item.protein || 0),
        carb: total.carb + Number(item.carb || 0),
        fat: total.fat + Number(item.fat || 0),
      }),
      { protein: 0, carb: 0, fat: 0 },
    ),
  );

const text = (value, { field, min = 1, max }) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length < min || normalized.length > max) {
    throw savedMealPlanError(
      400,
      field + " không hợp lệ",
      "INVALID_SAVED_MEAL_PLAN",
    );
  }
  return normalized;
};

const optionalNumber = (value, { field, min, max }) => {
  if (value === undefined || value === null || value === "") return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw savedMealPlanError(
      400,
      field + " không hợp lệ",
      "INVALID_SAVED_MEAL_PLAN",
    );
  }
  return value;
};

const normalizeTarget = (target) => {
  if (target === undefined || target === null) return null;
  if (typeof target !== "object" || Array.isArray(target)) {
    throw savedMealPlanError(
      400,
      "target không hợp lệ",
      "INVALID_SAVED_MEAL_PLAN",
    );
  }
  return {
    label: text(target.label || "", {
      field: "target.label",
      min: 0,
      max: 80,
    }),
    protein: optionalNumber(target.protein, {
      field: "target.protein",
      min: 0,
      max: 1000,
    }),
    carb: optionalNumber(target.carb, {
      field: "target.carb",
      min: 0,
      max: 2000,
    }),
    fat: optionalNumber(target.fat, {
      field: "target.fat",
      min: 0,
      max: 1000,
    }),
    calories: optionalNumber(target.calories, {
      field: "target.calories",
      min: 0,
      max: 20000,
    }),
  };
};

export const normalizeSavedMealPlanInput = (input) => {
  const meals = input?.meals;
  if (!Array.isArray(meals) || meals.length < 1 || meals.length > 6) {
    throw savedMealPlanError(
      400,
      "Meal plan cần từ 1 đến 6 bữa",
      "INVALID_SAVED_MEAL_PLAN",
    );
  }
  let foodCount = 0;
  const mealKeys = new Set();
  const normalizedMeals = meals.map((meal, mealIndex) => {
    const key = text(meal?.key, {
      field: "meals[" + mealIndex + "].key",
      max: 40,
    });
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(key) || mealKeys.has(key)) {
      throw savedMealPlanError(
        400,
        "Meal key không hợp lệ hoặc bị trùng",
        "INVALID_SAVED_MEAL_PLAN",
      );
    }
    mealKeys.add(key);
    if (!MEAL_TYPES.has(meal?.type)) {
      throw savedMealPlanError(
        400,
        "Meal type không hợp lệ",
        "INVALID_SAVED_MEAL_PLAN",
      );
    }
    if (
      !Array.isArray(meal.foods) ||
      meal.foods.length < 1 ||
      meal.foods.length > 8
    ) {
      throw savedMealPlanError(
        400,
        "Mỗi bữa cần từ 1 đến 8 thực phẩm",
        "INVALID_SAVED_MEAL_PLAN",
      );
    }
    foodCount += meal.foods.length;
    const foodIds = new Set();
    const foods = meal.foods.map((food) => {
      const foodId = String(food?.foodId || "");
      if (!mongoose.isValidObjectId(foodId) || foodIds.has(foodId)) {
        throw savedMealPlanError(
          400,
          "Food ID không hợp lệ hoặc bị trùng trong bữa",
          "INVALID_SAVED_MEAL_PLAN",
        );
      }
      foodIds.add(foodId);
      const amountGrams = Number(food.amountGrams);
      if (
        !Number.isFinite(amountGrams) ||
        amountGrams < 1 ||
        amountGrams > 1000
      ) {
        throw savedMealPlanError(
          400,
          "Khối lượng thực phẩm phải từ 1 đến 1000g",
          "INVALID_SAVED_MEAL_PLAN",
        );
      }
      return { foodId, amountGrams: round1(amountGrams) };
    });
    return {
      key,
      name: text(meal.name, {
        field: "meals[" + mealIndex + "].name",
        max: 80,
      }),
      type: meal.type,
      foods,
    };
  });
  if (foodCount > 30) {
    throw savedMealPlanError(
      400,
      "Meal plan có tối đa 30 thực phẩm",
      "INVALID_SAVED_MEAL_PLAN",
    );
  }
  return {
    title: text(input?.title, { field: "title", max: 100 }),
    target: normalizeTarget(input?.target),
    meals: normalizedMeals,
  };
};

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
};

export const savedMealPlanFingerprint = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");

export const buildCanonicalSavedMealPlan = async ({
  normalized,
  session = null,
}) => {
  const ids = [
    ...new Set(
      normalized.meals.flatMap((meal) =>
        meal.foods.map((food) => food.foodId),
      ),
    ),
  ];
  let query = Food.find({ _id: { $in: ids } })
    .select("label protein carb fat")
    .lean();
  if (session) query = query.session(session);
  const foods = await query;
  const foodById = new Map(
    foods.map((food) => [String(food._id), food]),
  );
  if (foodById.size !== ids.length) {
    throw savedMealPlanError(
      422,
      "Có thực phẩm không còn tồn tại",
      "MEAL_PLAN_FOOD_NOT_FOUND",
    );
  }

  const meals = normalized.meals.map((meal) => {
    const snapshots = meal.foods.map(({ foodId, amountGrams }) => {
      const food = foodById.get(foodId);
      const contribution = nutrition({
        protein: (Number(food.protein) * amountGrams) / 100,
        carb: (Number(food.carb) * amountGrams) / 100,
        fat: (Number(food.fat) * amountGrams) / 100,
      });
      return {
        foodId: food._id,
        label: food.label,
        amountGrams,
        nutrition: contribution,
      };
    });
    return {
      key: meal.key,
      name: meal.name,
      type: meal.type,
      foods: snapshots,
      totals: sumNutrition(
        snapshots.map((food) => food.nutrition),
      ),
    };
  });
  return {
    title: normalized.title,
    target: normalized.target,
    meals,
    totals: sumNutrition(meals.map((meal) => meal.totals)),
  };
};
