import User from "../../models/User.js";

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

// In-memory store: userId → { warnings, lockedUntil }
const userModerationState = new Map();

// Cleanup hết hạn mỗi 30 phút
setInterval(() => {
  const now = Date.now();
  for (const [userId, state] of userModerationState) {
    if (state.lockedUntil && state.lockedUntil < now) {
      userModerationState.delete(userId);
    }
  }
}, 30 * 60 * 1000);

/**
 * Kiểm tra user có bị khóa không (tạm thời)
 * @returns {{ blocked: boolean, remainingMinutes?: number }}
 */
export function isUserLocked(userId) {
  const state = userModerationState.get(userId);
  if (!state?.lockedUntil) return { blocked: false };

  const now = Date.now();
  if (state.lockedUntil > now) {
    const remaining = Math.ceil((state.lockedUntil - now) / 60000);
    return { blocked: true, remainingMinutes: remaining };
  }

  // Hết hạn → xóa khóa tạm, nhưng GIỮ LẠI warnings để cộng dồn
  state.lockedUntil = null;
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

  // Vi phạm → check state
  let state = userModerationState.get(userId);
  if (!state) {
    state = { warnings: 0, lockedUntil: null };
    userModerationState.set(userId, state);
  }

  state.warnings++;

  if (state.warnings >= 3) {
    // Vi phạm lần 3 → Cấm vĩnh viễn (Lưu vào Database)
    await User.findByIdAndUpdate(userId, { isAiChatBanned: true });
    // Dọn dẹp bộ nhớ tạm
    userModerationState.delete(userId);
    
    return {
      safe: false,
      message: "🚫 Bạn đã vi phạm quy tắc cộng đồng nhiều lần. Tài khoản của bạn đã bị cấm sử dụng Chat AI vĩnh viễn.",
    };
  }

  if (state.warnings === 2) {
    // Lần 2: Khóa 1 giờ
    state.lockedUntil = Date.now() + 60 * 60 * 1000;
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
