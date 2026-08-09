import rateLimit from "express-rate-limit";

// AI Chat rate limit — per user (dùng userId thay vì IP)
// Route này luôn đi qua protect middleware → req.user.id luôn có
export const aiChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 30, // 30 messages/giờ cho user thường
  keyGenerator: (req) => req.user?.id?.toString() ?? "anonymous",
  message: {
    success: false,
    message: "Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau 1 giờ.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
