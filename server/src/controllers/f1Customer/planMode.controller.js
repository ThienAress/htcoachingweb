import AuditLog from "../../models/AuditLog.js";
import F1PhaseReview from "../../models/F1PhaseReview.js";
import F1ResultPrediction from "../../models/F1ResultPrediction.js";
import { F1Customer, assertCustomerAccess } from "./shared.js";
import { PLAN_MODES, describePlanMode, planModeError } from "./planMode.helpers.js";

// HLV đổi cách dựng giai đoạn: chỉ một lần, áp dụng từ giai đoạn kế tiếp, không đụng các giai đoạn đã tạo.
export const switchPlanMode = async (req, res, next) => {
  try {
    const target = req.body.mode;
    if (!PLAN_MODES.includes(target)) {
      throw planModeError("Cách dựng giai đoạn không hợp lệ", "F1_PLAN_MODE_INVALID", 400);
    }
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);
    const prediction = await F1ResultPrediction.findOne({ customerId: customer._id })
      .sort({ createdAt: -1 })
      .select("planSource")
      .lean();
    if (!prediction) {
      throw planModeError("Cần tạo dự đoán kết quả trước.", "F1_PREDICTION_REQUIRED", 400);
    }

    const state = describePlanMode({ customer, prediction });
    if (state.locked) {
      throw planModeError(
        "Khách hàng này đã thay đổi cách dự đoán một lần, không thể thay đổi nữa.",
        "F1_PLAN_MODE_LOCKED",
      );
    }
    if (target === state.current) {
      throw planModeError("Cách dựng này đang được dùng.", "F1_PLAN_MODE_UNCHANGED");
    }

    const reviews = await F1PhaseReview.find({ customerId: customer._id, predictionId: prediction._id })
      .select("stageOrder profileConfirmedAt")
      .lean();
    if (reviews.some((review) => !review.profileConfirmedAt)) {
      throw planModeError(
        "Hãy hoàn tất cập nhật mục tiêu của giai đoạn đang dở trước khi thay đổi.",
        "F1_PLAN_MODE_STAGE_PENDING",
      );
    }

    // Điều kiện planModeLockedAt: null làm hai yêu cầu song song chỉ có một yêu cầu thành công.
    const switchedAtStage = reviews.length + 2;
    const result = await F1Customer.updateOne(
      { _id: customer._id, planModeLockedAt: null },
      { $set: { planModeSwitchTo: target, planModeSwitchedAtStage: switchedAtStage, planModeLockedAt: new Date() } },
    );
    if (!result.modifiedCount) {
      throw planModeError(
        "Khách hàng này đã thay đổi cách dự đoán một lần, không thể thay đổi nữa.",
        "F1_PLAN_MODE_LOCKED",
      );
    }
    await AuditLog.create({
      actorId: req.user.id,
      actorRole: req.user.role === "admin" ? "admin" : "trainer",
      action: "switch_f1_plan_mode",
      targetType: "f1_customer",
      targetId: customer._id,
      metadata: { from: state.current, to: target, switchedAtStage, requestId: req.id || "" },
      ipAddress: req.ip || "",
      userAgent: req.get("user-agent") || "",
    });

    return res.json({
      success: true,
      data: { initial: state.initial, current: target, locked: true, switchedAtStage },
      message: `Đã thay đổi cách dự đoán, áp dụng từ giai đoạn ${switchedAtStage}.`,
    });
  } catch (error) {
    return next(error);
  }
};
