import mongoose from "mongoose";

import {
  AI_MEMORY_CONSENT_VERSION,
  AI_MEMORY_KINDS,
  AI_MEMORY_TTL_MS,
  AI_MEMORY_VALUES,
} from "../constants/aiMemory.js";
import AiMemory from "../models/AiMemory.js";
import AiMemoryPreference from "../models/AiMemoryPreference.js";

const memoryError = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode });

const serializeEntry = (entry) => ({
  kind: entry.kind,
  value: entry.value,
  version: entry.version,
  lastConfirmedAt: entry.lastConfirmedAt,
  expiresAt: entry.expiresAt,
});

const activeMemoryFilter = (userId, timestamp = new Date()) => ({
  userId,
  status: "active",
  expiresAt: { $gt: timestamp },
});

const normalizeMemory = (kind, value) => {
  const normalizedKind = String(kind || "");
  const normalizedValue = String(value || "");
  if (
    !AI_MEMORY_KINDS.includes(normalizedKind) ||
    !AI_MEMORY_VALUES[normalizedKind].includes(normalizedValue)
  ) {
    throw memoryError("AI_MEMORY_INVALID", "Giá trị trí nhớ AI không hợp lệ");
  }
  return { kind: normalizedKind, value: normalizedValue };
};

export const getAiMemoryState = async (userId) => {
  const [preference, entries] = await Promise.all([
    AiMemoryPreference.findOne({ userId }).lean(),
    AiMemory.find(activeMemoryFilter(userId))
      .select("kind value version lastConfirmedAt expiresAt")
      .sort({ kind: 1 })
      .limit(AI_MEMORY_KINDS.length)
      .lean(),
  ]);
  return {
    enabled: preference?.enabled === true,
    entries: entries.map(serializeEntry),
  };
};

export const setAiMemoryConsent = async (
  userId,
  enabled,
  { now = () => new Date() } = {},
) => {
  const timestamp = now();
  const preference = await AiMemoryPreference.findOneAndUpdate(
    { userId },
    {
      $set: enabled
        ? {
            enabled: true,
            consentVersion: AI_MEMORY_CONSENT_VERSION,
            consentedAt: timestamp,
            disabledAt: null,
          }
        : { enabled: false, disabledAt: timestamp },
      $setOnInsert: { userId },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();
  return { enabled: preference.enabled === true };
};

export const upsertAiMemory = async (
  userId,
  kind,
  value,
  { now = () => new Date() } = {},
) => {
  const normalized = normalizeMemory(kind, value);
  const preference = await AiMemoryPreference.findOne({
    userId,
    enabled: true,
    consentVersion: AI_MEMORY_CONSENT_VERSION,
  }).lean();
  if (!preference) {
    throw memoryError(
      "AI_MEMORY_DISABLED",
      "Hãy bật Trí nhớ AI trước khi lưu",
      409,
    );
  }

  const timestamp = now();
  const expiresAt = new Date(timestamp.getTime() + AI_MEMORY_TTL_MS);
  const session = await mongoose.startSession();
  let saved;
  try {
    await session.withTransaction(async () => {
      const active = await AiMemory.findOne({
        userId,
        kind: normalized.kind,
        status: "active",
      }).session(session);
      if (active?.value === normalized.value) {
        active.lastConfirmedAt = timestamp;
        active.expiresAt = expiresAt;
        saved = await active.save({ session });
        return;
      }
      if (active) {
        active.status = "superseded";
        active.supersededAt = timestamp;
        await active.save({ session });
      }
      [saved] = await AiMemory.create(
        [
          {
            userId,
            ...normalized,
            version: (active?.version || 0) + 1,
            source: "explicit_user",
            consentVersion: AI_MEMORY_CONSENT_VERSION,
            supersedesMemoryId: active?._id || null,
            lastConfirmedAt: timestamp,
            expiresAt,
          },
        ],
        { session },
      );
    });
  } catch (error) {
    if (error?.code === 11000 || error?.errorLabels?.includes("TransientTransactionError")) {
      throw memoryError(
        "AI_MEMORY_CONFLICT",
        "Trí nhớ vừa được cập nhật ở nơi khác. Vui lòng tải lại.",
        409,
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return serializeEntry(saved);
};

export const deleteAiMemoryKind = async (userId, kind) => {
  if (!AI_MEMORY_KINDS.includes(kind)) {
    throw memoryError("AI_MEMORY_INVALID", "Loại trí nhớ AI không hợp lệ");
  }
  const result = await AiMemory.deleteMany({ userId, kind });
  return { deletedCount: result.deletedCount };
};

export const deleteAllAiMemory = async (userId) => {
  const session = await mongoose.startSession();
  let deletedCount = 0;
  try {
    await session.withTransaction(async () => {
      const result = await AiMemory.deleteMany({ userId }).session(session);
      deletedCount = result.deletedCount;
      await AiMemoryPreference.deleteOne({ userId }).session(session);
    });
  } finally {
    await session.endSession();
  }
  return { deletedCount };
};

export const deleteAiMemoryForUser = async (userId, { session } = {}) => {
  const memories = AiMemory.deleteMany({ userId });
  const preference = AiMemoryPreference.deleteOne({ userId });
  if (session) {
    memories.session(session);
    preference.session(session);
  }
  await memories;
  await preference;
};

export const getAiMemoryContext = async (userId) => {
  const preference = await AiMemoryPreference.findOne({
    userId,
    enabled: true,
    consentVersion: AI_MEMORY_CONSENT_VERSION,
  })
    .select("_id")
    .lean();
  if (!preference) return [];
  return AiMemory.find(activeMemoryFilter(userId))
    .select("kind value -_id")
    .sort({ kind: 1 })
    .limit(AI_MEMORY_KINDS.length)
    .lean();
};

export const exportAiMemory = getAiMemoryState;
