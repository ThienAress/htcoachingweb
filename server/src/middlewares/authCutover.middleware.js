import {
  getPublicReleaseSha,
  isAuthCutoverMaintenanceEnabled,
} from "../config/authCutover.js";
import { incrementMetric } from "../observability/metrics.js";

const RETRY_AFTER_SECONDS = 60;

export const requireAuthCutoverOpen = (_req, res, next) => {
  if (!isAuthCutoverMaintenanceEnabled()) return next();

  incrementMetric("auth.cutover_blocked");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Retry-After", String(RETRY_AFTER_SECONDS));

  const releaseSha = getPublicReleaseSha();
  if (releaseSha) res.setHeader("X-HT-Release-SHA", releaseSha);

  return res.status(503).json({
    success: false,
    code: "AUTH_CUTOVER_MAINTENANCE",
    message: "Đăng nhập đang được bảo trì ngắn. Vui lòng thử lại sau.",
  });
};
