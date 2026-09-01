import mongoose from "mongoose";
import {
  sanitizeF1IntakeDraftData,
} from "../../constants/f1IntakeDraft.js";
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

    const step = Number(req.body.step);
    const incoming = req.body.data || {};
    const sanitizedDraft = sanitizeF1IntakeDraftData({ step, data: incoming });
    if (!sanitizedDraft) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu draft không đúng với bước intake hiện tại",
      });
    }
    const { root: draftRoot, value: draftValue } = sanitizedDraft;

    // Transaction: intake update + customer status phải đồng bộ
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const draft = await getOrCreateDraftIntake(customer, req.user.id, {
        session,
      });
      const patch = {
        [draftRoot]: draftValue,
        updatedBy: req.user.id,
        draftStep: step,
        isDraft: true,
      };

      if (draftRoot === "bodyMetrics") {
        patch.bodyMetrics = buildBiometrics({
          ...(draft.bodyMetrics?.toObject?.() || draft.bodyMetrics || {}),
          ...draftValue,
        });
      }

      const updated = await F1Intake.findByIdAndUpdate(
        draft._id,
        { $set: patch },
        { returnDocument: "after", runValidators: true, session },
      );

      await F1Customer.findByIdAndUpdate(
        customer._id,
        { $set: { status: "intake_in_progress", lastIntakeId: updated._id } },
        { session },
      );

      await session.commitTransaction();

      return res.json({
        success: true,
        data: updated,
        message: "Đã lưu draft intake",
      });
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }
  } catch (error) {
    return next(error);
  }
};

export const submitIntake = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    // Transaction: intake submit + customer update phải đồng bộ
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      let intake = await getOrCreateDraftIntake(customer, req.user.id, {
        session,
      });
      const media = await F1Media.find({
        customerId: customer._id,
        intakeId: intake._id,
        status: "ready",
      }).session(session);

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
        consent: {
          ...(req.body.consent || intake.consent),
          version: String(
            process.env.F1_CONSENT_VERSION || "2026-07",
          ).slice(0, 40),
          collectedAt: new Date(),
          collectedBy: req.user.id,
        },
        postureMediaSummary,
      };

      if (!payload.consent.allowDataStorage) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Cần đồng ý lưu dữ liệu sức khỏe để hoàn tất intake",
        });
      }

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
        { returnDocument: "after", runValidators: true, session },
      );

      await F1Customer.findByIdAndUpdate(
        customer._id,
        {
          $set: {
            status: "intake_completed",
            readinessStatus: flags.readinessStatus,
            lastIntakeId: intake._id,
            consentVersion: payload.consent.version,
          },
        },
        { session },
      );

      await session.commitTransaction();

      return res.json({
        success: true,
        data: intake,
        message: "Hoàn tất intake thành công",
      });
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }
  } catch (error) {
    return next(error);
  }
};
