import { parseChatRequest } from "../utils/aiChat.js";

export const prepareAiChatRequest = (req, res, next) => {
  const parsed = parseChatRequest(req.body);
  if (parsed.error) {
    return res.status(400).json({ success: false, message: parsed.error });
  }
  if (!req.user?.id && parsed.value.image) {
    return res.status(403).json({
      success: false,
      code: "AI_GUEST_IMAGE_UNAVAILABLE",
      message: "Đăng nhập để gửi hình ảnh cho HT Assistant.",
    });
  }
  req.aiChatRequest = parsed;
  return next();
};
