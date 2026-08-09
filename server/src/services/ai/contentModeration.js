import User from "../../models/User.js";
import AiModerationState from "../../models/AiModerationState.js";

// Danh sách pattern cấm
const BLOCKED_URL_PATTERNS = [
  /https?:\/\/[^\s]*\.(xxx|porn|sex|adult|cam|xnxx|xvideos|pornhub|xhamster|redtube)/i,
  /https?:\/\/(bit\.ly|tinyurl|t\.co|goo\.gl|shorturl)\//i,
  /https?:\/\/[^\s]*(casino|gambling|bet365|slot|poker|18\+)/i,
];

const VULGAR_WORDS = [
  "đm", "đéo", "địt", "lồn", "cặc", "buồi", "đĩ", "cave", "mẹ mày",
  "fuck", "shit", "bitch", "dick", "pussy", "asshole", "nigger",
  "đụ", "dcm", "vcl", "vkl", "clgt", "cc",
];

/**
 * Kiểm tra user có bị khóa không (tạm thời)
 * @returns {{ blocked: boolean, remainingMinutes?: number }}
 */
export async function isUserLocked(userId) {
  const state = await AiModerationState.findOne({ userId })
    .select("lockedUntil")
    .lean();
  if (!state?.lockedUntil) return { blocked: false };

  const lockedUntil = new Date(state.lockedUntil).getTime();
  if (lockedUntil > Date.now()) {
    const remaining = Math.ceil((lockedUntil - Date.now()) / 60000);
    return { blocked: true, remainingMinutes: remaining };
  }

  await AiModerationState.updateOne(
    { userId, lockedUntil: { $lte: new Date() } },
    { $set: { lockedUntil: null } },
  );
  return { blocked: false };
}

/**
 * Kiểm tra nội dung tin nhắn
 * @returns {{ safe: boolean, warning?: boolean, message?: string }}
 */
export async function moderateContent(userId, text) {
  const lower = text.toLowerCase().trim();

  // Check blocked URLs
  const hasBlockedUrl = BLOCKED_URL_PATTERNS.some((p) => p.test(text));

  // Check vulgar words (word boundary hoặc exact match)
  const hasVulgar = VULGAR_WORDS.some((word) => {
    const regex = new RegExp(`(^|\\s|[^a-zàáảãạăắằẳẵặâấầẩẫậ])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s|[^a-zàáảãạăắằẳẵặâấầẩẫậ])`, "i");
    return regex.test(lower);
  });

  if (!hasBlockedUrl && !hasVulgar) {
    return { safe: true };
  }

  const state = await AiModerationState.findOneAndUpdate(
    { userId },
    { $inc: { warnings: 1 } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  if (state.warnings >= 3) {
    // Vi phạm lần 3 → Cấm vĩnh viễn (Lưu vào Database)
    await User.findByIdAndUpdate(userId, { isAiChatBanned: true });
    await AiModerationState.deleteOne({ userId });
    
    return {
      safe: false,
      message: "🚫 Bạn đã vi phạm quy tắc cộng đồng nhiều lần. Tài khoản của bạn đã bị cấm sử dụng Chat AI vĩnh viễn.",
    };
  }

  if (state.warnings === 2) {
    // Lần 2: Khóa 1 giờ
    state.lockedUntil = new Date(Date.now() + 60 * 60 * 1000);
    await state.save();
    return {
      safe: false,
      message: "🚫 Bạn đã vi phạm quy tắc cộng đồng lần thứ 2. Chat AI đã bị khóa trong 1 giờ.",
    };
  }

  // Lần 1: cảnh báo
  return {
    safe: false,
    warning: true,
    message: "⚠️ Vui lòng không gửi nội dung không phù hợp. Nếu vi phạm lần nữa, chat sẽ bị khóa 1 giờ.",
  };
}
