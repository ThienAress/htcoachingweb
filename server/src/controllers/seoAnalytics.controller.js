import { safeLog } from "../utils/safeLogger.js";

const readHandler = (event, operation) => async (req, res) => {
  try {
    const data = await operation(req);
    if (data === null) {
      return res.status(404).json({
        success: false,
        code: "ANALYTICS_NOT_FOUND",
        message: "Không tìm thấy dữ liệu analytics",
      });
    }
    return res.status(200).json({ success: true, data });
  } catch (error) {
    safeLog.error(event, error);
    return res.status(500).json({
      success: false,
      code: "ANALYTICS_READ_FAILED",
      message: "Không thể tải dữ liệu analytics",
    });
  }
};

export const createSeoAnalyticsController = ({ readService, syncService }) => ({
  overview: readHandler("seo_analytics.overview_failed", (req) =>
    readService.getOverview(req.query),
  ),
  providers: readHandler("seo_analytics.providers_failed", () =>
    readService.getProviders(),
  ),
  blog: readHandler("seo_analytics.blog_list_failed", (req) =>
    readService.getBlogPerformance(req.query),
  ),
  keywords: readHandler("seo_analytics.keyword_list_failed", (req) =>
    readService.getKeywordPerformance(req.query),
  ),
  blogDetail: readHandler("seo_analytics.blog_detail_failed", (req) =>
    readService.getBlogDetail({ ...req.query, slug: req.params.slug }),
  ),
  sync: async (req, res) => {
    try {
      const data = await syncService.syncProvider(req.body.provider, {
        startDate: req.body.startDate,
        endDate: req.body.endDate,
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      if (error?.code === "SYNC_IN_PROGRESS") {
        return res.status(409).json({
          success: false,
          code: error.code,
          message: "Provider đang được đồng bộ",
        });
      }
      if (["UNKNOWN_PROVIDER", "INVALID_WINDOW"].includes(error?.code)) {
        return res.status(400).json({
          success: false,
          code: error.code,
          message: "Yêu cầu đồng bộ không hợp lệ",
        });
      }
      safeLog.warn("seo_analytics.manual_sync_failed", "Manual sync failed", {
        provider: req.body.provider,
        code: error?.code || "PROVIDER_ERROR",
      });
      return res.status(503).json({
        success: false,
        code: error?.code || "PROVIDER_ERROR",
        message: "Provider analytics tạm thời không khả dụng",
      });
    }
  },
});
