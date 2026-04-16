import F1Intake from "../../models/F1Intake.js";
import { F1Customer, assertCustomerAccess } from "./shared.js";

const REVIEW_DECISIONS = {
  keep_hold: {
    readinessStatus: "hold",
    testPermission: "hold_test",
    recommendedStartPhase: "pending_review",
    medicalReviewFlag: true,
    message: "Đã giữ trạng thái HOLD TEST cho khách hàng",
  },
  approve_modified_test: {
    readinessStatus: "caution",
    testPermission: "modified_test",
    recommendedStartPhase: "phase_1",
    medicalReviewFlag: true,
    message: "Đã duyệt Modified Test cho khách hàng",
  },
  approve_full_test: {
    readinessStatus: "ready",
    testPermission: "full_test",
    recommendedStartPhase: "phase_1",
    medicalReviewFlag: false,
    message: "Đã duyệt Full Test cho khách hàng",
  },
};

export const reviewTestPermission = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const intake = await F1Intake.findOne({
      customerId: customer._id,
      isLatest: true,
    });

    if (!intake || intake.isDraft) {
      return res.status(400).json({
        success: false,
        message: "Khách hàng chưa có intake hoàn chỉnh để PT review",
      });
    }

    const decision = req.body?.decision;
    const reviewNote = (req.body?.reviewNote || "").trim();

    const config = REVIEW_DECISIONS[decision];
    if (!config) {
      return res.status(400).json({
        success: false,
        message: "Quyết định review không hợp lệ",
      });
    }

    intake.systemFlags = {
      ...(intake.systemFlags?.toObject?.() || intake.systemFlags || {}),
      painFlag: intake.systemFlags?.painFlag || "none",
      medicalReviewFlag: config.medicalReviewFlag,
      testPermission: config.testPermission,
      recommendedStartPhase: config.recommendedStartPhase,
      holdReasons: intake.systemFlags?.holdReasons || [],
      cautionReasons: intake.systemFlags?.cautionReasons || [],
      reviewDecision: decision,
      reviewNote,
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
    };

    intake.updatedBy = req.user.id;
    await intake.save();

    customer.readinessStatus = config.readinessStatus;
    customer.lastIntakeId = intake._id;
    await customer.save();

    return res.json({
      success: true,
      message: config.message,
      data: {
        customer,
        intake,
      },
    });
  } catch (error) {
    return next(error);
  }
};
