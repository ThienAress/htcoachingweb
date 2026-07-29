import crypto from "node:crypto";
import { commentError } from "./coachingCommentAccess.service.js";

const HTML_PATTERN = /<\/?[a-z][^>]*>/i;
const URL_PATTERN = /(?:https?:\/\/|www\.|data:|blob:)/i;

export const normalizeCommentBody = (value) => {
  if (typeof value !== "string") {
    throw commentError(400, "Nội dung phải là text", "INVALID_COMMENT_BODY");
  }
  const body = value.trim();
  if (body.length < 1 || body.length > 2000) {
    throw commentError(
      400,
      "Nội dung cần từ 1 đến 2000 ký tự",
      "INVALID_COMMENT_BODY",
    );
  }
  if (HTML_PATTERN.test(body) || URL_PATTERN.test(body)) {
    throw commentError(
      400,
      "Bình luận chỉ hỗ trợ text, không hỗ trợ HTML hoặc URL",
      "COMMENT_TEXT_ONLY",
    );
  }
  return body;
};

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }
  return value;
};

export const commentFingerprint = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");

export const hashCommentBody = (body) =>
  crypto.createHash("sha256").update(String(body || "")).digest("hex");
