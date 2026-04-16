import F1Intake from "../../models/F1Intake.js";
import { F1Customer, assertCustomerAccess } from "./shared.js";
import { buildAssessmentStarterSuggestions } from "./assessmentSuggestions.helpers.js";

export const getAssessmentStarterSuggestions = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const intake = await F1Intake.findOne({
      customerId: customer._id,
      isLatest: true,
    }).sort({ createdAt: -1 });

    const effectiveIntake =
      intake && !intake.isDraft
        ? intake
        : {
            healthScreening: {},
            lifestyleNutrition: {},
            bodyMetrics: {},
            trainingProfileGoal: {},
            systemFlags: {},
          };

    const suggestions = await buildAssessmentStarterSuggestions({
      intake: effectiveIntake,
      customer,
    });

    if (!intake || intake.isDraft) {
      suggestions.warnings = [
        ...(suggestions.warnings || []),
        "Chưa có intake hoàn chỉnh, hệ thống đang dùng gợi ý mặc định ban đầu.",
      ];
    }

    return res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    return next(error);
  }
};
