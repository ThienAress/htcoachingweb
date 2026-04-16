import mongoose from "mongoose";
import F1Customer from "../../models/F1Customer.js";
import F1Intake from "../../models/F1Intake.js";
import F1Media from "../../models/F1Media.js";
import F1Assessment from "../../models/F1Assessment.js";
import F1AiReport from "../../models/F1AiReport.js";
import F1OutcomeForecast from "../../models/F1OutcomeForecast.js";
import F1ResultPrediction from "../../models/F1ResultPrediction.js";

export const F1_STATUSES = new Set([
  "new",
  "intake_in_progress",
  "intake_completed",
  "assessment_completed",
  "ai_report_generated",
  "program_started",
  "archived",
]);

export const safeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const assertCustomerAccess = (customer, req) => {
  if (!customer) {
    const error = new Error("Không tìm thấy khách hàng F1");
    error.status = 404;
    throw error;
  }

  if (
    req.user?.role === "trainer" &&
    customer.assignedTrainerId &&
    customer.assignedTrainerId.toString() !== req.user.id.toString()
  ) {
    const error = new Error("Bạn không có quyền truy cập khách hàng F1 này");
    error.status = 403;
    throw error;
  }
};

export const generateF1Code = async () => {
  const total = await F1Customer.countDocuments();
  return `F1-${String(total + 1).padStart(4, "0")}`;
};

export const buildLifecycleSummary = async (customerId) => {
  const [mediaCount, assessmentCount, aiReportCount] = await Promise.all([
    F1Media.countDocuments({ customerId }),
    F1Assessment.countDocuments({ customerId }),
    F1AiReport.countDocuments({ customerId }),
  ]);

  return {
    mediaCount,
    assessmentCount,
    aiReportCount,
  };
};

export const deleteCustomerCascade = async (customerId, session) => {
  await Promise.all([
    F1Intake.deleteMany({ customerId }).session(session),
    F1Media.deleteMany({ customerId }).session(session),
    F1Assessment.deleteMany({ customerId }).session(session),
    F1AiReport.deleteMany({ customerId }).session(session),
    F1OutcomeForecast.deleteMany({ customerId }).session(session),
    F1ResultPrediction.deleteMany({ customerId }).session(session),
  ]);
};

export { mongoose, F1Customer };
