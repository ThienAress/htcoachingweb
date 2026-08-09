import { protect } from "./auth.middleware.js";

// Không có token thì đi tiếp như guest. Token hỏng/hết hạn vẫn trả 401 để
// frontend giữ nguyên cơ chế refresh, không âm thầm hạ quyền thành guest.
export const optionalAiAuth = (req, res, next) => {
  if (!req.cookies?.accessToken) return next();
  return protect(req, res, next);
};
