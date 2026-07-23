import F1Intake from "../../models/F1Intake.js";
import F1Assessment from "../../models/F1Assessment.js";
import F1AiReport from "../../models/F1AiReport.js";
import { F1Customer, assertCustomerAccess } from "./shared.js";
import { buildAiReport } from "./aiReport.helpers.js";
import { createIdempotentF1Artifact } from "../../services/f1ArtifactIntegrity.service.js";

export const generateAiReport = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const [intake, assessment] = await Promise.all([
      F1Intake.findOne({
        customerId: customer._id,
        isLatest: true,
      }),
      F1Assessment.findOne({
        customerId: customer._id,
      }).sort({ createdAt: -1 }),
    ]);

    if (!intake || intake.isDraft) {
      return res.status(400).json({
        success: false,
        message: "Khách hàng chưa hoàn tất intake",
      });
    }

    if (!assessment) {
      return res.status(400).json({
        success: false,
        message: "Khách hàng chưa có đánh giá thể chất để sinh AI report",
      });
    }
    if (!intake.consent?.allowAiAnalysis || !intake.consent?.version) {
      return res.status(403).json({
        success: false,
        message: "Khách hàng chưa đồng ý cho AI phân tích dữ liệu",
      });
    }

    const reportPayload = await buildAiReport({
      customer,
      intake,
      assessment,
    });

    const engineVersion =
      reportPayload.engineVersion || "nasm-rule-engine-v3";
    const result = await createIdempotentF1Artifact({
      Model: F1AiReport,
      customerId: customer._id,
      sourceFields: {
        customerId: customer._id,
        intakeId: intake._id,
        assessmentId: assessment._id,
      },
      sourceDocuments: [intake, assessment],
      engineVersion,
      requestId: req.body.requestId,
      regenerate: Boolean(req.body.regenerate),
      payload: reportPayload,
      customerUpdate: (report) => ({
        status: "ai_report_generated",
        lastAiReportId: report._id,
      }),
      audit: {
        actorId: req.user.id,
        actorRole: req.user.role,
        action: "generate_f1_ai_report",
        targetType: "f1_ai_report",
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      },
    });

    return res.status(result.idempotentReplay ? 200 : 201).json({
      success: true,
      data: result.artifact,
      idempotentReplay: result.idempotentReplay,
      message: result.idempotentReplay
        ? "AI report đã tồn tại cho nguồn dữ liệu này"
        : "Sinh AI report thành công",
    });
  } catch (error) {
    return next(error);
  }
};

export const getLatestAiReport = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const report = await F1AiReport.findOne({
      customerId: customer._id,
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: report || null,
    });
  } catch (error) {
    return next(error);
  }
};

export const approveAiReport = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const report = await F1AiReport.findOne({
      _id: req.params.reportId,
      customerId: customer._id,
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy AI report",
      });
    }

    report.approvedByCoach = Boolean(req.body.approvedByCoach);
    report.coachNote = req.body.coachNote || "";
    await report.save();

    return res.json({
      success: true,
      data: report,
      message: "Cập nhật AI report thành công",
    });
  } catch (error) {
    return next(error);
  }
};
