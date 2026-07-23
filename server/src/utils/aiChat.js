import crypto from "crypto";
import mongoose from "mongoose";

export const MAX_CHAT_MESSAGE_LENGTH = 8000;
export const MAX_CHAT_IMAGE_BYTES = 300 * 1024;
export const MAX_STORED_CHAT_MESSAGES = 40;
export const MAX_RECENT_REQUEST_IDS = 50;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_DATA_PATTERN =
  /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/]+={0,2})$/i;
const PAGE_TYPES = new Set([
  "general",
  "recipe",
  "exercises",
  "blog",
  "trainer_profile",
  "customer_story",
]);

const boundedString = (value, maxLength) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const sanitizeMetrics = (metrics) => {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    return null;
  }

  const result = {};
  const numericBounds = {
    heightCm: [100, 250],
    weightKg: [20, 350],
    age: [13, 100],
  };

  for (const [key, [min, max]] of Object.entries(numericBounds)) {
    const value = Number(metrics[key]);
    if (Number.isFinite(value) && value >= min && value <= max) {
      result[key] = value;
    }
  }

  if (["male", "female"].includes(metrics.gender)) {
    result.gender = metrics.gender;
  }

  return Object.keys(result).length > 0 ? result : null;
};

const validateImage = (image) => {
  if (image === undefined || image === null || image === "") return null;
  if (typeof image !== "string") {
    throw new Error("Hình ảnh không hợp lệ");
  }

  const match = image.match(IMAGE_DATA_PATTERN);
  if (!match) {
    throw new Error("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP dạng base64");
  }

  const padding = match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((match[2].length * 3) / 4) - padding;
  if (decodedBytes > MAX_CHAT_IMAGE_BYTES) {
    throw new Error("Ảnh chat không được vượt quá 300 KB");
  }

  return image;
};

export function parseChatRequest(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Dữ liệu chat không hợp lệ" };
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return { error: "Tin nhắn không được để trống" };
  if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
    return { error: `Tin nhắn không được vượt quá ${MAX_CHAT_MESSAGE_LENGTH} ký tự` };
  }

  if (body.conversationId && !mongoose.isValidObjectId(body.conversationId)) {
    return { error: "Mã cuộc trò chuyện không hợp lệ" };
  }

  if (body.requestId && !UUID_V4_PATTERN.test(body.requestId)) {
    return { error: "Mã yêu cầu chat không hợp lệ" };
  }

  const rawContext =
    body.context && typeof body.context === "object" && !Array.isArray(body.context)
      ? body.context
      : {};

  let image;
  try {
    image = validateImage(rawContext.image);
  } catch (error) {
    return { error: error.message };
  }

  const context = {};
  for (const [key, maxLength] of [
    ["page", 300],
    ["pageTitle", 200],
    ["lastPage", 300],
  ]) {
    const value = boundedString(rawContext[key], maxLength);
    if (value) context[key] = value;
  }
  if (rawContext.pageType !== undefined) {
    context.pageType = PAGE_TYPES.has(rawContext.pageType)
      ? rawContext.pageType
      : "general";
  }
  const userMetrics = sanitizeMetrics(rawContext.userMetrics);
  if (userMetrics) context.userMetrics = userMetrics;

  return {
    value: {
      message,
      conversationId: body.conversationId || null,
      requestId: body.requestId || crypto.randomUUID(),
      context,
      image,
    },
  };
}

export function buildChatSummary(message, timestamp = new Date()) {
  return {
    lastMessagePreview: message.slice(0, 120),
    lastMessageAt: timestamp,
  };
}
