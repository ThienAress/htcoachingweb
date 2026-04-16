import F1Intake from "../../models/F1Intake.js";
import F1Media from "../../models/F1Media.js";
import { F1Customer, assertCustomerAccess } from "./shared.js";
import {
  buildBiometrics,
  buildSystemFlags,
  getOrCreateDraftIntake,
  summarizeMedia,
} from "./intake.helpers.js";

export const getLatestIntake = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const intake = await F1Intake.findOne({
      customerId: customer._id,
      isLatest: true,
    });

    return res.json({
      success: true,
      data: intake,
    });
  } catch (error) {
    return next(error);
  }
};

export const saveIntakeDraft = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const step = Number(req.body.step || 1);
    const incoming = req.body.data || {};
    const draft = await getOrCreateDraftIntake(customer, req.user.id);

    const patch = {
      ...incoming,
      updatedBy: req.user.id,
      draftStep: Math.min(Math.max(step, 1), 6),
      isDraft: true,
    };

    if (incoming.bodyMetrics) {
      patch.bodyMetrics = buildBiometrics({
        ...(draft.bodyMetrics?.toObject?.() || draft.bodyMetrics || {}),
        ...incoming.bodyMetrics,
      });
    }

    const updated = await F1Intake.findByIdAndUpdate(
      draft._id,
      { $set: patch },
      { new: true },
    );

    customer.status = "intake_in_progress";
    customer.lastIntakeId = updated._id;
    await customer.save();

    return res.json({
      success: true,
      data: updated,
      message: "Đã lưu draft intake",
    });
  } catch (error) {
    return next(error);
  }
};

export const submitIntake = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    let intake = await getOrCreateDraftIntake(customer, req.user.id);

    const media = await F1Media.find({
      customerId: customer._id,
      intakeId: intake._id,
    });

    const postureMediaSummary = summarizeMedia(media);
    const bodyMetrics = buildBiometrics(
      req.body.bodyMetrics || intake.bodyMetrics || {},
    );

    const payload = {
      customerInfo: req.body.customerInfo || intake.customerInfo,
      healthScreening: req.body.healthScreening || intake.healthScreening,
      lifestyleNutrition:
        req.body.lifestyleNutrition || intake.lifestyleNutrition,
      bodyMetrics,
      trainingProfileGoal:
        req.body.trainingProfileGoal || intake.trainingProfileGoal,
      consent: req.body.consent || intake.consent,
      postureMediaSummary,
    };

    const flags = buildSystemFlags(payload);

    intake = await F1Intake.findByIdAndUpdate(
      intake._id,
      {
        $set: {
          ...payload,
          systemFlags: {
            painFlag: flags.painFlag,
            medicalReviewFlag: flags.medicalReviewFlag,
            testPermission: flags.testPermission,
            recommendedStartPhase: flags.recommendedStartPhase,
            holdReasons: flags.holdReasons,
            cautionReasons: flags.cautionReasons,
          },
          draftStep: 6,
          isDraft: false,
          submittedAt: new Date(),
          updatedBy: req.user.id,
        },
      },
      { new: true },
    );

    customer.status = "intake_completed";
    customer.readinessStatus = flags.readinessStatus;
    customer.lastIntakeId = intake._id;
    await customer.save();

    return res.json({
      success: true,
      data: intake,
      message: "Hoàn tất intake thành công",
    });
  } catch (error) {
    return next(error);
  }
};
