import { protect } from "./auth.middleware.js";

// Chỉ đi tiếp như guest khi cả access và refresh cookie đều vắng mặt.
// Phiên còn refresh cookie phải nhận 401 để frontend refresh trước khi chat.
export const optionalAiAuth = (req, res, next) => {
  if (!req.cookies?.accessToken && !req.cookies?.refreshToken) return next();
  return protect(req, res, next);
};
