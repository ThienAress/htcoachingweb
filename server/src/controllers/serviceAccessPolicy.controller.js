import { getAdminServiceAccessPolicyMatrix } from "../services/serviceAccessPolicy.service.js";
import { buildCommunityFeatureReport } from "../services/communityFeatureReport.service.js";
import { generateCommunityFeatureReportPdf } from "../services/communityFeatureReportPdf.service.js";
import {
  getAiUsageSummary,
  parseAiUsageReportDays,
} from "../services/aiUsageReport.service.js";
import { safeLog } from "../utils/safeLogger.js";

const sendReportError = (res, error) => {
  const status = error.statusCode || 500;
  if (status >= 500) {
    safeLog.error("community_feature_report.read_failed", error);
  }
  return res.status(status).json({
    success: false,
    code: error.code || "COMMUNITY_FEATURE_REPORT_FAILED",
    message:
      status >= 500 ? "Không thể tạo báo cáo cải tiến" : error.message,
  });
};

export const getServiceAccessPolicies = (_req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: getAdminServiceAccessPolicyMatrix(),
    });
  } catch (error) {
    safeLog.error("service_access_policy.read_failed", error);
    return res.status(500).json({
      success: false,
      code: "SERVICE_ACCESS_POLICY_READ_FAILED",
      message: "Không thể tải quyền và hạn mức dịch vụ",
    });
  }
};

export const getAiUsageReport = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const days = parseAiUsageReportDays(req.query.days);
  if (days === null) {
    return res.status(400).json({
      success: false,
      code: "AI_USAGE_REPORT_INVALID_DAYS",
      message: "Số ngày thống kê không hợp lệ",
    });
  }
  try {
    return res.status(200).json({
      success: true,
      data: await getAiUsageSummary({ days }),
    });
  } catch (error) {
    safeLog.error("ai_usage_report.read_failed", error);
    return res.status(500).json({
      success: false,
      code: "AI_USAGE_REPORT_FAILED",
      message: "Không thể tải báo cáo chi phí AI",
    });
  }
};

export const getCommunityFeatureReport = (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    return res.status(200).json({
      success: true,
      data: buildCommunityFeatureReport(req.query),
    });
  } catch (error) {
    return sendReportError(res, error);
  }
};

export const downloadCommunityFeatureReportPdf = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const report = buildCommunityFeatureReport(req.query);
    const pdfBytes = await generateCommunityFeatureReportPdf(report);
    const from = report.filters.from || "khong-co-du-lieu";
    const to = report.filters.to || "khong-co-du-lieu";
    const filename = `bao-cao-cai-tien-${from}-den-${to}.pdf`;
    const buffer = Buffer.from(pdfBytes);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.setHeader("Content-Length", buffer.length);
    return res.status(200).send(buffer);
  } catch (error) {
    return sendReportError(res, error);
  }
};
