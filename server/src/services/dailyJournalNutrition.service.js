import mongoose from "mongoose";
import Recipe from "../models/Recipe.js";
import { journalError } from "./dailyJournalAccess.service.js";
import { findOwnedSavedMealPlan } from "./savedMealPlanAccess.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODES = new Set(["follow_plan", "recipe", "manual"]);
const STATUSES = new Set(["eaten", "changed", "skipped"]);
const round1 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 10) / 10;
const zeroTotals = () => ({ protein: 0, carb: 0, fat: 0, calories: 0 });
const sumTotals = (items) =>
  Object.fromEntries(
    Object.keys(zeroTotals()).map((key) => [
      key,
      round1(items.reduce((total, item) => total + Number(item?.[key] || 0), 0)),
    ]),
  );

const fail = (message) => {
  throw journalError(400, message, "INVALID_JOURNAL_NUTRITION");
};

const assertObject = (value, field) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(field + " phải là object");
  }
};

const assertKeys = (value, allowed, field) => {
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    fail(field + " chứa field không được phép");
  }
};

const text = (value, { field, min = 0, max }) => {
  if (typeof value !== "string") fail(field + " không hợp lệ");
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    fail(field + " không hợp lệ");
  }
  return normalized;
};

const normalizeEntry = (entry) => {
  assertObject(entry, "nutrition.entries item");
  const mode = entry.mode;
  if (!MODES.has(mode) || !STATUSES.has(entry.status)) {
    fail("Meal entry mode/status không hợp lệ");
  }
  const modeFields = {
    follow_plan: ["plannedMealKey", "adjustments"],
    recipe: ["recipeId"],
    manual: ["mealName", "description"],
  }[mode];
  assertKeys(
    entry,
    new Set(["entryId", "mode", "status", "note", ...modeFields]),
    "nutrition.entries item",
  );
  if (!UUID_PATTERN.test(String(entry.entryId || ""))) {
    fail("entryId không hợp lệ");
  }
  if (mode !== "follow_plan" && entry.status !== "eaten") {
    fail("Recipe/manual entry chỉ hỗ trợ trạng thái eaten");
  }
  const normalized = {
    entryId: entry.entryId,
    mode,
    status: entry.status,
    note:
      entry.note === undefined
        ? ""
        : text(entry.note, { field: "note", max: 240 }),
  };
  if (mode === "follow_plan") {
    normalized.plannedMealKey = text(entry.plannedMealKey, {
      field: "plannedMealKey",
      min: 1,
      max: 40,
    });
    if (entry.adjustments !== undefined) {
      if (
        !Array.isArray(entry.adjustments) ||
        entry.adjustments.length < 1 ||
        entry.adjustments.length > 8
      ) {
        fail("adjustments cần từ 1 đến 8 thực phẩm");
      }
      const foodIds = new Set();
      normalized.adjustments = entry.adjustments.map((adjustment) => {
        assertObject(adjustment, "adjustments item");
        assertKeys(
          adjustment,
          new Set(["foodId", "amountGrams"]),
          "adjustments item",
        );
        const foodId = String(adjustment.foodId || "");
        const amountGrams = Number(adjustment.amountGrams);
        if (!mongoose.isValidObjectId(foodId) || foodIds.has(foodId)) {
          fail("adjustments foodId không hợp lệ hoặc bị trùng");
        }
        if (
          !Number.isFinite(amountGrams) ||
          amountGrams < 1 ||
          amountGrams > 1000
        ) {
          fail("Khối lượng thực tế phải từ 1 đến 1000g");
        }
        foodIds.add(foodId);
        return { foodId, amountGrams: round1(amountGrams) };
      });
    }
  }
  if (mode === "recipe") {
    if (!mongoose.isValidObjectId(entry.recipeId)) {
      fail("recipeId không hợp lệ");
    }
    normalized.recipeId = String(entry.recipeId);
  }
  if (mode === "manual") {
    normalized.mealName =
      entry.mealName === undefined
        ? "Bữa ăn phát sinh"
        : text(entry.mealName, {
            field: "mealName",
            min: 1,
            max: 80,
          });
    normalized.description = text(entry.description, {
      field: "description",
      min: 1,
      max: 240,
    });
  }
  return normalized;
};

export const normalizeNutritionPatch = (nutrition) => {
  assertObject(nutrition, "nutrition");
  assertKeys(nutrition, new Set(["assignment", "entries"]), "nutrition");
  const fields = {};
  if (nutrition.assignment !== undefined) {
    if (nutrition.assignment === null) {
      fields["nutrition.assignment"] = null;
    } else {
      assertObject(nutrition.assignment, "nutrition.assignment");
      assertKeys(
        nutrition.assignment,
        new Set(["savedMealPlanId"]),
        "nutrition.assignment",
      );
      if (!mongoose.isValidObjectId(nutrition.assignment.savedMealPlanId)) {
        fail("savedMealPlanId không hợp lệ");
      }
      fields["nutrition.assignment"] = {
        savedMealPlanId: String(nutrition.assignment.savedMealPlanId),
      };
    }
  }
  if (nutrition.entries !== undefined) {
    if (!Array.isArray(nutrition.entries) || nutrition.entries.length > 10) {
      fail("nutrition.entries có tối đa 10 phần tử");
    }
    const entries = nutrition.entries.map(normalizeEntry);
    if (new Set(entries.map((entry) => entry.entryId)).size !== entries.length) {
      fail("entryId không được trùng trong một ngày");
    }
    fields["nutrition.entries"] = entries;
  }
  if (Object.keys(fields).length === 0) {
    fail("nutrition cần assignment hoặc entries");
  }
  return fields;
};

const ownedPlan = ({ ownerId, planId, session }) =>
  findOwnedSavedMealPlan({ ownerId, planId, session });

const assignmentSnapshot = (plan, assignedAt) => ({
  savedMealPlanId: plan._id,
  lineageKey: plan.lineageKey,
  version: plan.version,
  titleSnapshot: plan.title,
  assignedAt,
  totalsSnapshot: {
    protein: plan.totals.protein,
    carb: plan.totals.carb,
    fat: plan.totals.fat,
    calories: plan.totals.calories,
  },
});

const scaledNutrition = (food, actualAmountGrams) => {
  const ratio = actualAmountGrams / Number(food.amountGrams);
  return Object.fromEntries(
    Object.keys(zeroTotals()).map((key) => [
      key,
      round1(Number(food.nutrition?.[key] || 0) * ratio),
    ]),
  );
};

const actualMealSnapshot = ({ meal, entry, existing }) => {
  const requested = new Map(
    (entry.adjustments || []).map((item) => [String(item.foodId), item.amountGrams]),
  );
  const previous = new Map(
    (existing?.actualFoods || []).map((item) => [
      String(item.foodId),
      Number(item.actualAmountGrams),
    ]),
  );
  const mealFoodIds = new Set(meal.foods.map((food) => String(food.foodId)));
  if ([...requested.keys()].some((foodId) => !mealFoodIds.has(foodId))) {
    throw journalError(
      422,
      "Thực phẩm điều chỉnh không thuộc bữa ăn đã chọn",
      "MEAL_PLAN_FOOD_NOT_FOUND",
    );
  }
  const actualFoods = meal.foods.map((food) => {
    const foodId = String(food.foodId);
    const actualAmountGrams = round1(
      requested.get(foodId) ?? previous.get(foodId) ?? food.amountGrams,
    );
    return {
      foodId: food.foodId,
      labelSnapshot: food.label,
      plannedAmountGrams: food.amountGrams,
      actualAmountGrams,
      nutrition: scaledNutrition(food, actualAmountGrams),
    };
  });
  return { actualFoods, actualTotals: sumTotals(actualFoods.map((food) => food.nutrition)) };
};

const storedEntryCommand = (entry) => {
  const common = {
    entryId: entry.entryId,
    mode: entry.mode,
    status: entry.status,
    note: entry.note || "",
  };
  if (entry.mode === "follow_plan") {
    return {
      ...common,
      plannedMealKey: entry.plannedMealKey,
      ...((entry.actualFoods || []).length > 0
        ? {
            adjustments: entry.actualFoods.map((food) => ({
              foodId: String(food.foodId),
              amountGrams: Number(food.actualAmountGrams),
            })),
          }
        : {}),
    };
  }
  if (entry.mode === "recipe") {
    return { ...common, recipeId: String(entry.recipeId) };
  }
  return {
    ...common,
    mealName: entry.mealName || "Bữa ăn phát sinh",
    description: entry.description,
  };
};

export const buildNutritionSubmissionFields = ({ journal, now }) => {
  const entries = journal?.nutrition?.entries || [];
  if (!entries.some((entry) => entry.status === "eaten")) {
    throw journalError(
      422,
      "Hãy xác nhận ít nhất một bữa đã ăn trước khi gửi cho HLV",
      "NUTRITION_EATEN_MEAL_REQUIRED",
    );
  }
  return {
    "nutrition.entries": entries.map(storedEntryCommand),
    "nutrition.submittedAt": now,
  };
};

export const canonicalizeNutritionFields = async ({
  clientId,
  journal,
  setFields,
  session,
  now,
}) => {
  if (
    !("nutrition.assignment" in setFields) &&
    !("nutrition.entries" in setFields)
  ) {
    return setFields;
  }
  const result = { ...setFields };
  let assignedPlan = null;
  const requestedAssignment = setFields["nutrition.assignment"];
  if (requestedAssignment) {
    assignedPlan = await ownedPlan({
      ownerId: clientId,
      planId: requestedAssignment.savedMealPlanId,
      session,
    });
    if (!assignedPlan.isLatest || assignedPlan.status !== "active") {
      throw journalError(
        409,
        "Saved Meal Plan không còn khả dụng để gắn vào ngày",
        "SAVED_MEAL_PLAN_NOT_ASSIGNABLE",
      );
    }
    const current = journal?.nutrition?.assignment;
    const samePlan =
      String(current?.savedMealPlanId || "") === String(assignedPlan._id);
    result["nutrition.assignment"] = assignmentSnapshot(
      assignedPlan,
      samePlan ? current.assignedAt : now,
    );
  }

  const entries = setFields["nutrition.entries"];
  if (!entries) return result;
  const followEntries = entries.filter(
    (entry) => entry.mode === "follow_plan",
  );
  if (followEntries.length > 0 && !assignedPlan) {
    const assignment =
      requestedAssignment === null
        ? null
        : journal?.nutrition?.assignment;
    if (!assignment?.savedMealPlanId) {
      throw journalError(
        422,
        "Cần gắn Saved Meal Plan trước khi log theo kế hoạch",
        "MEAL_PLAN_ASSIGNMENT_REQUIRED",
      );
    }
    assignedPlan = await ownedPlan({
      ownerId: clientId,
      planId: assignment.savedMealPlanId,
      session,
    });
  }

  const recipeIds = entries
    .filter((entry) => entry.mode === "recipe")
    .map((entry) => entry.recipeId);
  let recipeQuery = Recipe.find({
    _id: { $in: recipeIds },
    isPublished: true,
  })
    .select("name slug")
    .lean();
  if (session) recipeQuery = recipeQuery.session(session);
  const recipes = recipeIds.length > 0 ? await recipeQuery : [];
  const recipeById = new Map(
    recipes.map((recipe) => [String(recipe._id), recipe]),
  );
  if (recipeById.size !== new Set(recipeIds).size) {
    throw journalError(
      422,
      "Recipe không tồn tại hoặc chưa được xuất bản",
      "RECIPE_NOT_AVAILABLE",
    );
  }

  const existingById = new Map(
    (journal?.nutrition?.entries || []).map((entry) => [
      entry.entryId,
      entry,
    ]),
  );
  result["nutrition.entries"] = entries.map((entry) => {
    const existing = existingById.get(entry.entryId);
    const base = {
      entryId: entry.entryId,
      mode: entry.mode,
      status: entry.status,
      note: entry.note,
      plannedMealKey: "",
      savedMealPlanId: null,
      version: null,
      recipeId: null,
      recipeSlugSnapshot: "",
      mealName: "",
      description: "",
      actualFoods: [],
      actualTotals: null,
      editCount: Number(existing?.editCount || 0),
      recordedAt: existing?.recordedAt || now,
    };
    if (entry.mode === "follow_plan") {
      const meal = assignedPlan.meals.find(
        (item) => item.key === entry.plannedMealKey,
      );
      if (!meal) {
        throw journalError(
          422,
          "Meal key không thuộc Saved Meal Plan đã gắn",
          "MEAL_PLAN_MEAL_NOT_FOUND",
        );
      }
      return {
        ...base,
        plannedMealKey: meal.key,
        savedMealPlanId: assignedPlan._id,
        version: assignedPlan.version,
        labelSnapshot: meal.name,
        ...actualMealSnapshot({ meal, entry, existing }),
      };
    }
    if (entry.mode === "recipe") {
      const recipe = recipeById.get(entry.recipeId);
      return {
        ...base,
        recipeId: recipe._id,
        recipeSlugSnapshot: recipe.slug,
        labelSnapshot: recipe.name,
      };
    }
    const previousMealName = existing?.mealName || "Bữa ăn phát sinh";
    const contentChanged = Boolean(
      existing &&
        (previousMealName !== entry.mealName ||
          String(existing.description || "") !== entry.description),
    );
    if (contentChanged && Number(existing.editCount || 0) >= 1) {
      throw journalError(
        409,
        "Bữa ăn phát sinh này chỉ được cập nhật một lần",
        "MEAL_ENTRY_UPDATE_LIMIT_REACHED",
      );
    }
    return {
      ...base,
      mealName: entry.mealName,
      description: entry.description,
      labelSnapshot: entry.description,
      editCount: contentChanged ? 1 : Number(existing?.editCount || 0),
    };
  });
  return result;
};
