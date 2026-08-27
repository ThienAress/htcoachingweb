import crypto from "node:crypto";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import Exercise, {
  deriveTechnicalDifficultyRating,
} from "../models/Exercise.js";
import {
  ExerciseInstructionsImportError,
  normalizeExerciseInstructionsImport,
} from "./exerciseInstructionsImport.validation.js";

export {
  ExerciseInstructionsImportError,
  normalizeExerciseInstructionsImport,
  parseExerciseInstructionsImportDocument,
} from "./exerciseInstructionsImport.validation.js";

const PREVIEW_TOKEN_AUDIENCE = "exercise-instructions-import";

const importFileDigest = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

export const createExerciseInstructionsPreviewToken = (buffer, userId) =>
  jwt.sign(
    {
      digest: importFileDigest(buffer),
      scope: "exercise-instructions:commit",
    },
    process.env.JWT_SECRET,
    {
      audience: PREVIEW_TOKEN_AUDIENCE,
      expiresIn: "10m",
      subject: String(userId),
    },
  );

export const verifyExerciseInstructionsPreviewToken = (
  token,
  buffer,
  userId,
) => {
  if (typeof token !== "string" || !token.trim()) {
    throw new ExerciseInstructionsImportError(
      "Cần xem trước file trước khi xác nhận cập nhật",
    );
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      audience: PREVIEW_TOKEN_AUDIENCE,
      subject: String(userId),
    });
    if (
      payload.scope !== "exercise-instructions:commit" ||
      payload.digest !== importFileDigest(buffer)
    ) {
      throw new Error("Preview token mismatch");
    }
  } catch {
    throw new ExerciseInstructionsImportError(
      "File đã thay đổi hoặc phiên xem trước đã hết hạn; vui lòng xem trước lại",
      409,
    );
  }
};

const findMissingNames = async (names, session) => {
  let query = Exercise.find({ name: { $in: names } }).select({ name: 1, _id: 0 });
  if (session) query = query.session(session);
  const matched = await query.lean();
  const matchedNames = new Set(matched.map((exercise) => exercise.name));
  return names.filter((name) => !matchedNames.has(name));
};

const buildPreview = (normalized, missingNames) => {
  const missingSet = new Set(missingNames);
  const matchedItems = normalized.exercises.length - missingNames.length;
  return {
    schemaVersion: normalized.schemaVersion,
    summary: {
      totalItems: normalized.exercises.length,
      matchedItems,
      missingItems: missingNames.length,
      canImport: missingNames.length === 0,
    },
    missingNames,
    previewItems: normalized.exercises.slice(0, 20).map((exercise) => ({
      name: exercise.name,
      status: missingSet.has(exercise.name) ? "missing" : "matched",
      stepCount: exercise.instructions.length,
      technicalDifficultyRating: deriveTechnicalDifficultyRating(
        exercise.technicalDifficulty,
      ),
    })),
  };
};

export const previewExerciseInstructionsImport = async (document) => {
  const normalized = normalizeExerciseInstructionsImport(document);
  const names = normalized.exercises.map((exercise) => exercise.name);
  const missingNames = await findMissingNames(names);
  return buildPreview(normalized, missingNames);
};

export const commitExerciseInstructionsImport = async (document) => {
  const normalized = normalizeExerciseInstructionsImport(document);
  const names = normalized.exercises.map((exercise) => exercise.name);
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const missingNames = await findMissingNames(names, session);
      if (missingNames.length > 0) {
        throw new ExerciseInstructionsImportError(
          "Không thể nhập vì có tên bài tập không khớp",
          409,
          { missingNames },
        );
      }

      result = await Exercise.bulkWrite(
        normalized.exercises.map((exercise) => ({
          updateOne: {
            filter: { name: exercise.name },
            update: {
              $set: {
                instructions: exercise.instructions,
                technicalDifficulty: exercise.technicalDifficulty,
              },
            },
          },
        })),
        { ordered: true, session },
      );

      if (result.matchedCount !== normalized.exercises.length) {
        throw new ExerciseInstructionsImportError(
          "Danh sách bài tập đã thay đổi trong lúc nhập, vui lòng xem trước lại",
          409,
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return {
    schemaVersion: normalized.schemaVersion,
    totalItems: normalized.exercises.length,
    updatedItems: result.matchedCount,
    modifiedItems: result.modifiedCount,
  };
};
