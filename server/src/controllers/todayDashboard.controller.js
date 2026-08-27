import {
  getTodayDashboard,
  getTodayProgressPromptEligibility,
} from "../services/todayDashboard.service.js";
import { parseDateKey } from "../utils/dateKey.js";
import { safeLog } from "../utils/safeLogger.js";
import { isTodayPlatformEnabled } from "../config/todayPlatform.js";

export const getTodayDashboardPromptEligibility = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (!isTodayPlatformEnabled()) {
    return res.status(503).json({
      success: false,
      code: "TODAY_DASHBOARD_DISABLED",
      message: "Today Dashboard đang tạm dừng",
    });
  }

  try {
    const data = await getTodayProgressPromptEligibility(req.user);
    return res.json({ success: true, data });
  } catch (error) {
    safeLog.error("today_dashboard.prompt_eligibility_failed", error, {
      userId: req.user.id,
    });
    return res.status(500).json({
      success: false,
      code: "TODAY_PROMPT_ELIGIBILITY_FAILED",
      message: "Không thể kiểm tra kế hoạch hôm nay lúc này",
    });
  }
};

export const getTodayDashboardDay = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (!isTodayPlatformEnabled()) {
    return res.status(503).json({
      success: false,
      code: "TODAY_DASHBOARD_DISABLED",
      message: "Today Dashboard đang tạm dừng",
    });
  }

  try {
    parseDateKey(req.params.dateKey);
    const data = await getTodayDashboard({
      userId: req.user.id,
      dateKey: req.params.dateKey,
    });
    return res.json({ success: true, data });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      safeLog.error("today_dashboard.request_failed", error, {
        userId: req.user.id,
      });
    }
    return res.status(status).json({
      success: false,
      code: error.code || "TODAY_DASHBOARD_FAILED",
      message:
        status < 500 ? error.message : "Không thể tải Today Dashboard lúc này",
    });
  }
};
