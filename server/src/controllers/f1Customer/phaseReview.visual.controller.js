// Ảnh của giai đoạn 2 trở đi: HLV tải ảnh hiện tại (mặt trước, mặt bên) của khách rồi tạo ảnh dự đoán
// cho giai đoạn đó, giống giai đoạn 1 nhưng bắt đầu từ ảnh mới thay vì ảnh khảo sát ban đầu.
import F1Intake from "../../models/F1Intake.js";
import F1Assessment from "../../models/F1Assessment.js";
import F1Media from "../../models/F1Media.js";
import F1PhaseReview from "../../models/F1PhaseReview.js";
import F1ResultPrediction from "../../models/F1ResultPrediction.js";
import { F1Customer, assertCustomerAccess } from "./shared.js";
import { buildVisualStages } from "./resultPrediction.helpers.js";
import { buildStageImageGenerationPayload } from "./resultPredictionImage.helpers.js";
import { generateStageImagesWithAI } from "../../services/aiImageGenerator.service.js";
import {
  createF1MediaFromBuffer,
  createF1MediaFromReference,
  queueF1MediaDeletion,
} from "../../services/f1MediaLifecycle.service.js";
import { getPrivateImageReference } from "../../services/f1MediaStorage.service.js";

export const MAX_STAGE_IMAGE_ATTEMPTS = Math.max(
  Number(process.env.MAX_AI_IMAGE_ATTEMPTS_PER_STAGE || 3),
  1,
);
const RESERVATION_MS = Math.max(
  Number(process.env.F1_IMAGE_RESERVATION_MS || 5 * 60 * 1000),
  30_000,
);

const httpError = (status, message, code) => {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  if (code) error.code = code;
  return error;
};

const contentPath = (customerId, mediaId) =>
  mediaId ? `/api/f1-customers/${customerId}/media/${mediaId}/content` : "";

export const serializeVisual = (review) => {
  const visual = review.visual || {};
  const customerId = String(review.customerId);
  return {
    beforeFrontUrl: contentPath(customerId, visual.beforeFrontMediaId),
    beforeSideUrl: contentPath(customerId, visual.beforeSideMediaId),
    imageStatus: visual.imageStatus || "descriptor_only",
    frontUrl: contentPath(customerId, visual.frontMediaId),
    sideUrl: contentPath(customerId, visual.sideMediaId),
    attemptCount: Number(visual.attemptCount || 0),
    maxAttempts: MAX_STAGE_IMAGE_ATTEMPTS,
    lastError: visual.lastError || "",
  };
};

const getRequestContext = (req) => ({
  requestId: req.id || "",
  ipAddress: req.ip || "",
  userAgent: req.get("user-agent") || "",
});

// Giai đoạn N (N ≥ 2) có kế hoạch từ lần đánh giá cuối giai đoạn N-1.
const loadFollowUp = async (req) => {
  const stageOrder = Number(req.params.stageOrder);
  const customer = await F1Customer.findById(req.params.id);
  assertCustomerAccess(customer, req);
  const prediction = await F1ResultPrediction.findOne({ customerId: customer._id })
    .sort({ createdAt: -1 })
    .select("intakeId assessmentId customerId")
    .lean();
  if (!prediction) throw httpError(400, "Cần tạo dự đoán kết quả trước.");
  const review = await F1PhaseReview.findOne({
    customerId: customer._id,
    predictionId: prediction._id,
    stageOrder: stageOrder - 1,
  });
  if (!review?.nextPhasePlan?.phaseKey) {
    throw httpError(409, `Cần đánh giá xong giai đoạn ${stageOrder - 1} trước.`);
  }
  return { customer, prediction, review, stageOrder };
};

const assertMediaConsent = async (prediction, customerId) => {
  const intake = await F1Intake.findOne({ _id: prediction.intakeId, customerId })
    .select("consent bodyMetrics trainingProfileGoal")
    .lean();
  if (!intake?.consent?.allowMediaStorage || !intake.consent?.version) {
    throw httpError(
      403,
      "Khách hàng chưa đồng ý lưu trữ ảnh theo phiên bản đồng ý hiện tại",
      "F1_MEDIA_CONSENT_REQUIRED",
    );
  }
  return intake;
};

export const uploadStagePhoto = async (req, res, next) => {
  try {
    const { customer, prediction, review, stageOrder } = await loadFollowUp(req);
    if (!req.file?.buffer) throw httpError(400, "Vui lòng tải file ảnh lên");
    await assertMediaConsent(prediction, customer._id);

    const side = req.body.side === "side" ? "side" : "front";
    const { media } = await createF1MediaFromBuffer({
      customerId: customer._id,
      intakeId: prediction.intakeId,
      predictionId: prediction._id,
      stageOrder,
      phaseKey: review.nextPhasePlan.phaseKey,
      type: side === "side" ? "stage_side" : "stage_front",
      buffer: req.file.buffer,
      actorId: req.user.id,
      actorRole: req.user.role,
      requestContext: getRequestContext(req),
    });

    const field = side === "side" ? "beforeSideMediaId" : "beforeFrontMediaId";
    const oldId = review.visual?.[field];
    review.set(`visual.${field}`, media._id);
    await review.save();
    if (oldId && String(oldId) !== String(media._id)) {
      const old = await F1Media.findById(oldId);
      await queueF1MediaDeletion({
        media: old,
        actorId: req.user.id,
        actorRole: req.user.role,
        requestContext: getRequestContext(req),
      }).catch(() => undefined);
    }

    return res.json({
      success: true,
      data: serializeVisual(review),
      message: "Đã tải ảnh lên",
    });
  } catch (error) {
    return next(error);
  }
};

export const generateStageVisual = async (req, res, next) => {
  const requestId = req.body.requestId;
  const created = [];
  let reviewId = null;
  let reserved = false;
  try {
    const { customer, prediction, review, stageOrder } = await loadFollowUp(req);
    reviewId = review._id;
    const intake = await assertMediaConsent(prediction, customer._id);
    const visual = review.visual || {};

    if (
      visual.imageStatus === "generated" &&
      !req.body.forceRegenerate
    ) {
      return res.json({
        success: true,
        data: serializeVisual(review),
        idempotentReplay: true,
        message: "Giai đoạn này đã có ảnh dự đoán",
      });
    }
    if (!visual.beforeFrontMediaId || !visual.beforeSideMediaId) {
      throw httpError(400, "Cần tải ảnh mặt trước và mặt bên trước khi tạo ảnh dự đoán.", "F1_BEFORE_MEDIA_REQUIRED");
    }

    const claim = await F1PhaseReview.findOneAndUpdate(
      {
        _id: review._id,
        "visual.attemptCount": { $lt: MAX_STAGE_IMAGE_ATTEMPTS },
        $or: [
          { "visual.reservedUntil": null },
          { "visual.reservedUntil": { $lt: new Date() } },
          { "visual.reservedUntil": { $exists: false } },
        ],
      },
      {
        $inc: { "visual.attemptCount": 1 },
        $set: {
          "visual.imageStatus": "generating",
          "visual.reservationId": requestId,
          "visual.reservedUntil": new Date(Date.now() + RESERVATION_MS),
          "visual.lastError": "",
        },
      },
      { returnDocument: "after" },
    );
    if (!claim) {
      const exhausted = Number(visual.attemptCount || 0) >= MAX_STAGE_IMAGE_ATTEMPTS;
      throw httpError(
        exhausted ? 400 : 409,
        exhausted
          ? `Giai đoạn này đã đạt giới hạn ${MAX_STAGE_IMAGE_ATTEMPTS} lần tạo ảnh`
          : "Một yêu cầu khác đang tạo ảnh cho giai đoạn này",
        exhausted ? "F1_IMAGE_ATTEMPTS_EXHAUSTED" : "F1_IMAGE_GENERATION_IN_PROGRESS",
      );
    }
    reserved = true;

    const [frontMedia, sideMedia, assessment] = await Promise.all([
      F1Media.findOne({ _id: visual.beforeFrontMediaId, customerId: customer._id, status: "ready" }),
      F1Media.findOne({ _id: visual.beforeSideMediaId, customerId: customer._id, status: "ready" }),
      F1Assessment.findOne({ _id: prediction.assessmentId, customerId: customer._id })
        .select("overallPhysicalLevel")
        .lean(),
    ]);
    if (!frontMedia || !sideMedia) {
      throw httpError(400, "Ảnh đã tải lên không còn khả dụng, hãy tải lại.", "F1_BEFORE_MEDIA_REQUIRED");
    }
    const [frontRef, sideRef] = await Promise.all([
      getPrivateImageReference(frontMedia),
      getPrivateImageReference(sideMedia),
    ]);

    const phaseKey = review.nextPhasePlan.phaseKey;
    const [stage] = buildVisualStages({ personalizedPath: [phaseKey], intake, assessment });
    const baseline = review.nextOutcome?.baseline || {};
    const payload = buildStageImageGenerationPayload({
      customer,
      phaseKey,
      forceRegenerate: req.body.forceRegenerate,
      prediction: {
        beforeImages: { frontUrl: frontRef, sideUrl: sideRef },
        visualStages: [{ ...stage, label: `Hình ảnh kỳ vọng sau giai đoạn ${stageOrder}` }],
        sourceSummary: {
          primaryGoal: intake?.trainingProfileGoal?.primaryGoal || "",
          overallPhysicalLevel: baseline.overallPhysicalLevel || assessment?.overallPhysicalLevel || "",
          currentWeightKg: review.actual?.weightKg ?? null,
          bodyFatPercent: review.actual?.bodyFatPercent ?? null,
        },
      },
    });
    const ai = await generateStageImagesWithAI({
      beforeImages: payload.beforeImages,
      prompts: payload.prompts,
      context: payload.context,
      phaseKey,
    });

    const mediaBase = {
      customerId: customer._id,
      intakeId: prediction.intakeId,
      predictionId: prediction._id,
      stageOrder,
      phaseKey,
      actorId: req.user.id,
      actorRole: req.user.role,
      requestContext: getRequestContext(req),
    };
    const front = (await createF1MediaFromReference({ ...mediaBase, type: "prediction_front", reference: ai.frontUrl })).media;
    created.push(front);
    const side = (await createF1MediaFromReference({ ...mediaBase, type: "prediction_side", reference: ai.sideUrl })).media;
    created.push(side);

    const oldIds = [visual.frontMediaId, visual.sideMediaId].filter(Boolean);
    const updated = await F1PhaseReview.findOneAndUpdate(
      { _id: review._id, "visual.reservationId": requestId },
      {
        $set: {
          "visual.imageStatus": "generated",
          "visual.frontMediaId": front._id,
          "visual.sideMediaId": side._id,
          "visual.provider": ai.provider || "",
          "visual.model": ai.model || "",
          "visual.generatedAt": new Date(),
          "visual.reservedUntil": null,
          "visual.lastError": "",
        },
      },
      { returnDocument: "after" },
    );
    if (!updated) {
      throw httpError(409, "Lượt tạo ảnh không còn hợp lệ", "F1_IMAGE_RESERVATION_LOST");
    }
    if (oldIds.length) {
      const olds = await F1Media.find({ _id: { $in: oldIds } });
      await Promise.all(
        olds.map((media) =>
          queueF1MediaDeletion({
            media,
            actorId: req.user.id,
            actorRole: req.user.role,
            requestContext: getRequestContext(req),
          }).catch(() => undefined),
        ),
      );
    }
    return res.json({
      success: true,
      data: serializeVisual(updated),
      message: "Đã tạo ảnh dự đoán cho giai đoạn",
    });
  } catch (error) {
    // Lỗi từ nhà cung cấp ảnh không tính vào số lượt.
    const providerFault = String(error.code || "").startsWith("AI_IMAGE_PROVIDER");
    if (reserved && reviewId) {
      await F1PhaseReview.updateOne(
        { _id: reviewId, "visual.reservationId": requestId },
        {
          ...(providerFault ? { $inc: { "visual.attemptCount": -1 } } : {}),
          $set: {
            "visual.imageStatus": "failed",
            "visual.reservedUntil": null,
            "visual.lastError": String(error.code || "F1_IMAGE_GENERATION_FAILED").slice(0, 100),
          },
        },
      ).catch(() => undefined);
    }
    await Promise.all(
      created.map((media) =>
        queueF1MediaDeletion({
          media,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          requestContext: getRequestContext(req),
        }).catch(() => undefined),
      ),
    );
    return next(error);
  }
};
