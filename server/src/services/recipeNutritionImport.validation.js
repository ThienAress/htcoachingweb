import {
  CORE_RECIPE_NUTRITION_FIELDS,
  MAX_ADDITIONAL_RECIPE_NUTRIENTS,
} from "../constants/recipeNutrition.js";
import { normalizeManualRecipeNutrition } from "./recipeNutrition.service.js";

const IMPORT_SCHEMA_VERSION = 1;
const MAX_IMPORT_ITEMS = 2000;

export class RecipeNutritionImportError extends Error {
  constructor(message, status = 400, details = undefined) {
    super(message);
    this.name = "RecipeNutritionImportError";
    this.status = status;
    this.details = details;
  }
}

const fail = (message, details) => {
  throw new RecipeNutritionImportError(message, 400, details);
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const assertExactFields = (value, allowedFields, requiredFields, path) => {
  if (!isPlainObject(value)) fail(`${path} phải là object`);

  const keys = Object.keys(value);
  const unknownFields = keys.filter((key) => !allowedFields.includes(key));
  const missingFields = requiredFields.filter(
    (key) => !Object.hasOwn(value, key),
  );
  if (unknownFields.length > 0 || missingFields.length > 0) {
    fail(`${path} không đúng cấu trúc`, {
      path,
      unknownFields,
      missingFields,
    });
  }
};

const normalizeRequiredString = (value, path, maxLength) => {
  if (typeof value !== "string") fail(`${path} phải là chuỗi`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    fail(`${path} phải từ 1 đến ${maxLength} ký tự`);
  }
  return normalized;
};

const normalizeIngredient = (ingredient, itemIndex, ingredientIndex) => {
  const path = `recipes[${itemIndex}].ingredients[${ingredientIndex}]`;
  assertExactFields(
    ingredient,
    ["name", "measure"],
    ["name", "measure"],
    path,
  );
  if (typeof ingredient.measure !== "string") {
    fail(`${path}.measure phải là chuỗi`);
  }
  const measure = ingredient.measure.trim();
  if (measure.length > 100) fail(`${path}.measure tối đa 100 ký tự`);
  return {
    name: normalizeRequiredString(ingredient.name, `${path}.name`, 200),
    measure,
  };
};

const normalizeNutrition = (value, itemIndex) => {
  const path = `recipes[${itemIndex}].nutrition`;
  const fields = [...CORE_RECIPE_NUTRITION_FIELDS, "additional"];
  assertExactFields(value, fields, fields, path);
  if (!Array.isArray(value.additional)) {
    fail(`${path}.additional phải là mảng`);
  }
  if (value.additional.length > MAX_ADDITIONAL_RECIPE_NUTRIENTS) {
    fail(
      `${path}.additional tối đa ${MAX_ADDITIONAL_RECIPE_NUTRIENTS} thành phần`,
    );
  }
  value.additional.forEach((item, nutrientIndex) => {
    assertExactFields(
      item,
      ["label", "unit", "value"],
      ["label", "unit", "value"],
      `${path}.additional[${nutrientIndex}]`,
    );
  });

  try {
    return normalizeManualRecipeNutrition(value);
  } catch (error) {
    fail(`${path} không hợp lệ: ${error.message}`);
  }
};

export const recipeImportIdentity = (name, ingredients) =>
  JSON.stringify([name, ingredients.map(({ name: itemName, measure }) => [
    itemName,
    measure,
  ])]);

export const parseRecipeNutritionImportDocument = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    fail("Vui lòng chọn file JSON cần nhập");
  }
  try {
    return JSON.parse(buffer.toString("utf8").replace(/^\uFEFF/, ""));
  } catch {
    fail("File không phải JSON hợp lệ");
  }
};

export const normalizeRecipeNutritionImport = (document) => {
  assertExactFields(
    document,
    ["schemaVersion", "recipes"],
    ["schemaVersion", "recipes"],
    "root",
  );
  if (document.schemaVersion !== IMPORT_SCHEMA_VERSION) {
    fail(`schemaVersion phải bằng ${IMPORT_SCHEMA_VERSION}`);
  }
  if (
    !Array.isArray(document.recipes) ||
    document.recipes.length < 1 ||
    document.recipes.length > MAX_IMPORT_ITEMS
  ) {
    fail(`recipes phải có từ 1 đến ${MAX_IMPORT_ITEMS} công thức`);
  }

  const identities = new Set();
  const duplicates = [];
  const recipes = document.recipes.map((item, itemIndex) => {
    const path = `recipes[${itemIndex}]`;
    assertExactFields(
      item,
      ["name", "ingredients", "nutrition"],
      ["name", "ingredients", "nutrition"],
      path,
    );
    const name = normalizeRequiredString(item.name, `${path}.name`, 200);
    if (
      !Array.isArray(item.ingredients) ||
      item.ingredients.length < 1 ||
      item.ingredients.length > 100
    ) {
      fail(`${path}.ingredients phải có từ 1 đến 100 nguyên liệu`);
    }
    const ingredients = item.ingredients.map((ingredient, ingredientIndex) =>
      normalizeIngredient(ingredient, itemIndex, ingredientIndex),
    );
    const identity = recipeImportIdentity(name, ingredients);
    if (identities.has(identity)) duplicates.push(name);
    identities.add(identity);
    return {
      name,
      ingredients,
      nutrition: normalizeNutrition(item.nutrition, itemIndex),
    };
  });

  if (duplicates.length > 0) {
    fail("File có công thức trùng tên và nguyên liệu", {
      duplicateRecipes: [...new Set(duplicates)],
    });
  }

  return { schemaVersion: IMPORT_SCHEMA_VERSION, recipes };
};
