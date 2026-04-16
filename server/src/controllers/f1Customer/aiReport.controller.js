import F1Intake from "../../models/F1Intake.js";
import F1Assessment from "../../models/F1Assessment.js";
import F1AiReport from "../../models/F1AiReport.js";
import { F1Customer, assertCustomerAccess } from "./shared.js";
import { buildAiReport } from "./aiReport.helpers.js";

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

    const reportPayload = buildAiReport({
      customer,
      intake,
      assessment,
    });

    const report = await F1AiReport.create({
      customerId: customer._id,
      intakeId: intake._id,
      assessmentId: assessment._id,
      ...reportPayload,
    });

    customer.status = "ai_report_generated";
    customer.lastAiReportId = report._id;
    await customer.save();

    return res.status(201).json({
      success: true,
      data: report,
      message: "Sinh AI report thành công",
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
