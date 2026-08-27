import crypto from "node:crypto";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import Recipe from "../models/Recipe.js";
import {
  normalizeRecipeNutritionImport,
  RecipeNutritionImportError,
  recipeImportIdentity,
} from "./recipeNutritionImport.validation.js";

export {
  normalizeRecipeNutritionImport,
  parseRecipeNutritionImportDocument,
  RecipeNutritionImportError,
} from "./recipeNutritionImport.validation.js";

const PREVIEW_TOKEN_AUDIENCE = "recipe-nutrition-import";

const importFileDigest = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

export const createRecipeNutritionPreviewToken = (buffer, userId) =>
  jwt.sign(
    { digest: importFileDigest(buffer), scope: "recipe-nutrition:commit" },
    process.env.JWT_SECRET,
    {
      audience: PREVIEW_TOKEN_AUDIENCE,
      expiresIn: "10m",
      subject: String(userId),
    },
  );

export const verifyRecipeNutritionPreviewToken = (token, buffer, userId) => {
  if (typeof token !== "string" || !token.trim()) {
    throw new RecipeNutritionImportError(
      "Cần xem trước file trước khi xác nhận cập nhật",
    );
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      audience: PREVIEW_TOKEN_AUDIENCE,
      subject: String(userId),
    });
    if (
      payload.scope !== "recipe-nutrition:commit" ||
      payload.digest !== importFileDigest(buffer)
    ) {
      throw new Error("Preview token mismatch");
    }
  } catch {
    throw new RecipeNutritionImportError(
      "File đã thay đổi hoặc phiên xem trước đã hết hạn; vui lòng xem trước lại",
      409,
    );
  }
};

const issueMessage = {
  missing_name: "Không tìm thấy tên công thức",
  ingredients_mismatch: "Tên có tồn tại nhưng danh sách nguyên liệu không khớp",
  ambiguous_match: "Có nhiều công thức cùng khớp tên và nguyên liệu",
};

const findMatches = async (recipes, session) => {
  const names = [...new Set(recipes.map((recipe) => recipe.name))];
  let query = Recipe.find({ name: { $in: names } }).select({
    _id: 1,
    name: 1,
    ingredients: 1,
  });
  if (session) query = query.session(session);
  const candidates = await query.lean();
  const candidatesByName = new Map();
  for (const candidate of candidates) {
    const list = candidatesByName.get(candidate.name) || [];
    list.push(candidate);
    candidatesByName.set(candidate.name, list);
  }

  return recipes.map((recipe, itemIndex) => {
    const namedCandidates = candidatesByName.get(recipe.name) || [];
    let code;
    let exactCandidates = [];
    if (namedCandidates.length === 0) {
      code = "missing_name";
    } else {
      const identity = recipeImportIdentity(recipe.name, recipe.ingredients);
      exactCandidates = namedCandidates.filter(
        (candidate) =>
          recipeImportIdentity(candidate.name, candidate.ingredients || []) ===
          identity,
      );
      if (exactCandidates.length === 0) code = "ingredients_mismatch";
      if (exactCandidates.length > 1) code = "ambiguous_match";
    }

    return {
      itemIndex,
      recipe,
      ...(code
        ? {
            issue: {
              itemIndex,
              name: recipe.name,
              code,
              message: issueMessage[code],
            },
          }
        : { recipeId: exactCandidates[0]._id }),
    };
  });
};

const buildPreview = (normalized, matches) => {
  const issues = matches.flatMap((match) =>
    match.issue ? [match.issue] : [],
  );
  return {
    schemaVersion: normalized.schemaVersion,
    summary: {
      totalItems: normalized.recipes.length,
      matchedItems: normalized.recipes.length - issues.length,
      issueItems: issues.length,
      canImport: issues.length === 0,
    },
    issues,
    previewItems: matches.slice(0, 20).map(({ recipe, issue }) => ({
      name: recipe.name,
      status: issue ? "issue" : "matched",
      issueCode: issue?.code,
      ingredientCount: recipe.ingredients.length,
      additionalCount: recipe.nutrition.additional.length,
    })),
  };
};

export const previewRecipeNutritionImport = async (document) => {
  const normalized = normalizeRecipeNutritionImport(document);
  const matches = await findMatches(normalized.recipes);
  return buildPreview(normalized, matches);
};

export const commitRecipeNutritionImport = async (document) => {
  const normalized = normalizeRecipeNutritionImport(document);
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const matches = await findMatches(normalized.recipes, session);
      const issues = matches.flatMap((match) =>
        match.issue ? [match.issue] : [],
      );
      if (issues.length > 0) {
        throw new RecipeNutritionImportError(
          "Không thể nhập vì có công thức không còn khớp",
          409,
          { issues },
        );
      }

      result = await Recipe.bulkWrite(
        matches.map(({ recipeId, recipe }) => ({
          updateOne: {
            filter: { _id: recipeId },
            update: { $set: { nutrition: recipe.nutrition } },
          },
        })),
        { ordered: true, session },
      );
      if (result.matchedCount !== normalized.recipes.length) {
        throw new RecipeNutritionImportError(
          "Danh sách công thức đã thay đổi trong lúc nhập, vui lòng xem trước lại",
          409,
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return {
    schemaVersion: normalized.schemaVersion,
    totalItems: normalized.recipes.length,
    updatedItems: result.matchedCount,
    modifiedItems: result.modifiedCount,
  };
};
