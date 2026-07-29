import mongoose from "mongoose";
import Recipe from "../models/Recipe.js";
import { journalError } from "./dailyJournalAccess.service.js";
import { findOwnedSavedMealPlan } from "./savedMealPlanAccess.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODES = new Set(["follow_plan", "recipe", "manual"]);
const STATUSES = new Set(["eaten", "changed", "skipped"]);

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
    follow_plan: ["plannedMealKey"],
    recipe: ["recipeId"],
    manual: ["description"],
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
  }
  if (mode === "recipe") {
    if (!mongoose.isValidObjectId(entry.recipeId)) {
      fail("recipeId không hợp lệ");
    }
    normalized.recipeId = String(entry.recipeId);
  }
  if (mode === "manual") {
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
});

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
      description: "",
      recordedAt: existingById.get(entry.entryId)?.recordedAt || now,
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
    return {
      ...base,
      description: entry.description,
      labelSnapshot: entry.description,
    };
  });
  return result;
};
