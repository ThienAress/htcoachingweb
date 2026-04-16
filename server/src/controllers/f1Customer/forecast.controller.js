import F1Intake from "../../models/F1Intake.js";
import F1Assessment from "../../models/F1Assessment.js";
import F1AiReport from "../../models/F1AiReport.js";
import F1OutcomeForecast from "../../models/F1OutcomeForecast.js";
import { F1Customer, assertCustomerAccess } from "./shared.js";
import { buildOutcomeForecast } from "./forecast.helpers.js";

export const generateOutcomeForecast = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const [intake, assessment, aiReport] = await Promise.all([
      F1Intake.findOne({ customerId: customer._id, isLatest: true }),
      F1Assessment.findOne({ customerId: customer._id }).sort({
        createdAt: -1,
      }),
      F1AiReport.findOne({ customerId: customer._id }).sort({ createdAt: -1 }),
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
        message: "Khách hàng chưa có đánh giá thể chất",
      });
    }

    if (!aiReport) {
      return res.status(400).json({
        success: false,
        message: "Khách hàng chưa có AI report để dự đoán kết quả",
      });
    }

    if (aiReport?.inputSummary?.readinessStatus === "hold") {
      return res.status(400).json({
        success: false,
        message:
          "Khách hàng đang ở trạng thái hold, chưa nên generate forecast",
      });
    }

    const forecastPayload = buildOutcomeForecast({
      intake,
      assessment,
      aiReport,
    });

    const forecast = await F1OutcomeForecast.create({
      customerId: customer._id,
      intakeId: intake._id,
      assessmentId: assessment._id,
      aiReportId: aiReport._id,
      ...forecastPayload,
    });

    return res.status(201).json({
      success: true,
      data: forecast,
      message: "Generate dự đoán kết quả thành công",
    });
  } catch (error) {
    return next(error);
  }
};

export const getLatestOutcomeForecast = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const forecast = await F1OutcomeForecast.findOne({
      customerId: customer._id,
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: forecast || null,
    });
  } catch (error) {
    return next(error);
  }
};
