import { isTodayPlatformEnabled } from "../config/todayPlatform.js";

export const createRequireTodayPlatform = (env = process.env) =>
  (_req, res, next) => {
    if (isTodayPlatformEnabled(env)) {
      return next();
    }

    res.setHeader("Cache-Control", "private, no-store");
    return res.status(503).json({
      success: false,
      code: "TODAY_PLATFORM_DISABLED",
      message: "Tính năng theo dõi hằng ngày đang tạm dừng",
    });
  };

export const requireTodayPlatform = createRequireTodayPlatform();
