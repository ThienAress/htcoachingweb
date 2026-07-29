import { getTodayDashboard } from "../services/todayDashboard.service.js";
import { parseDateKey } from "../utils/dateKey.js";
import { safeLog } from "../utils/safeLogger.js";

export const getTodayDashboardDay = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (String(process.env.TODAY_DASHBOARD_ENABLED).toLowerCase() === "false") {
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
