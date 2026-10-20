import F1Intake from "../../models/F1Intake.js";
import F1Media from "../../models/F1Media.js";
import F1Assessment from "../../models/F1Assessment.js";
import F1AiReport from "../../models/F1AiReport.js";
import F1ResultPrediction from "../../models/F1ResultPrediction.js";
import { F1Customer, assertCustomerAccess } from "./shared.js";
import {
  buildFramework,
  determinePhaseCeiling,
  buildPersonalizedPath,
  buildPhaseRoadmap,
  buildOutcomeTable,
  buildVisualStages,
} from "./resultPrediction.helpers.js";
import { buildStageImageGenerationPayload } from "./resultPredictionImage.helpers.js";
import { buildTrainerStageOne, normalizeCustomStage } from "./stageDesign.helpers.js";
import { PLAN_MODE_LABELS, describePlanMode, planModeError } from "./planMode.helpers.js";
import { generateStageImagesWithAI } from "../../services/aiImageGenerator.service.js";
import { createIdempotentF1Artifact } from "../../services/f1ArtifactIntegrity.service.js";
import {
  createF1MediaFromReference,
  queueF1MediaDeletion,
} from "../../services/f1MediaLifecycle.service.js";
import { getPrivateImageReference } from "../../services/f1MediaStorage.service.js";

const MAX_AI_IMAGE_ATTEMPTS_PER_STAGE = Math.max(
  Number(process.env.MAX_AI_IMAGE_ATTEMPTS_PER_STAGE || 3),
  1,
);
const IMAGE_RESERVATION_MS = Math.max(
  Number(process.env.F1_IMAGE_RESERVATION_MS || 5 * 60 * 1000),
  30_000,
);

const mediaContentPath = (customerId, mediaId) =>
  mediaId
    ? `/api/f1-customers/${customerId}/media/${mediaId}/content`
    : "";

const serializePrediction = (prediction) => {
  if (!prediction) return null;
  const value = prediction.toObject ? prediction.toObject() : prediction;
  const customerId = String(value.customerId);
  return {
    ...value,
    beforeImages: {
      ...value.beforeImages,
      frontUrl: mediaContentPath(
        customerId,
        value.beforeImages?.frontMediaId,
      ),
      sideUrl: mediaContentPath(customerId, value.beforeImages?.sideMediaId),
    },
    visualStages: (value.visualStages || []).map((stage) => ({
      ...stage,
      images: {
        ...stage.images,
        frontUrl: mediaContentPath(customerId, stage.images?.frontMediaId),
        sideUrl: mediaContentPath(customerId, stage.images?.sideMediaId),
      },
    })),
  };
};

// Kèm cách dựng giai đoạn hiện tại để giao diện biết nên mở bước nào khi thêm giai đoạn.
const withPlanMode = (serialized, customer) =>
  serialized ? { ...serialized, planModeState: describePlanMode({ customer, prediction: serialized }) } : serialized;

const getRequestContext = (req) => ({
  requestId: req.id || "",
  ipAddress: req.ip || "",
  userAgent: req.get("user-agent") || "",
});

export const generateResultPrediction = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);
    const [intake, assessment, aiReport, frontMedia, sideMedia] =
      await Promise.all([
        F1Intake.findOne({ customerId: customer._id, isLatest: true }),
        F1Assessment.findOne({ customerId: customer._id }).sort({
          createdAt: -1,
        }),
        F1AiReport.findOne({ customerId: customer._id }).sort({
          createdAt: -1,
        }),
        F1Media.findOne({
          customerId: customer._id,
          type: "before_front",
          status: "ready",
        }).sort({ createdAt: -1 }),
        F1Media.findOne({
          customerId: customer._id,
          type: "before_side",
          status: "ready",
        }).sort({ createdAt: -1 }),
      ]);

    if (!intake || intake.isDraft) {
      return res.status(400).json({
        success: false,
        message:
          "Khách này chưa hoàn tất intake nên chưa thể tạo phần dự đoán.",
      });
    }
    if (!intake.consent?.allowAiAnalysis || !intake.consent?.version) {
      return res.status(403).json({
        success: false,
        message: "Khách hàng chưa đồng ý cho AI phân tích dữ liệu",
      });
    }
    if (!assessment) {
      return res.status(400).json({
        success: false,
        message:
          "Khách này chưa có đánh giá thể chất nên chưa đủ dữ liệu để dự đoán.",
      });
    }
    if (!aiReport) {
      return res.status(400).json({
        success: false,
        message:
          "Cần có AI Report trước thì hệ thống mới có thể dựng phần dự đoán kết quả.",
      });
    }

    const recommendedStartPhase =
      aiReport?.recommendations?.recommendedStartPhase || "phase_1";
    if (recommendedStartPhase === "pending_review") {
      return res.status(400).json({
        success: false,
        message:
          "Khách hiện chưa phù hợp để tạo dự đoán kết quả. PT cần review thêm tình trạng sức khỏe hoặc duyệt test trước khi tiếp tục.",
      });
    }

    // HLV tự thiết kế giai đoạn 1 hoặc để hệ thống đề xuất theo khung NASM.
    const custom = req.body.customStage ? normalizeCustomStage(req.body.customStage) : null;
    // Đã có lộ trình thì chỉ tạo lại giai đoạn 1 theo đúng cách đang dùng và chưa khoá; đổi cách phải qua "Thay đổi dự đoán".
    const existing = await F1ResultPrediction.findOne({ customerId: customer._id })
      .sort({ createdAt: -1 })
      .select("planSource")
      .lean();
    if (existing) {
      const state = describePlanMode({ customer, prediction: existing });
      if (state.locked) {
        throw planModeError(
          "Khách hàng này đã thay đổi cách dự đoán một lần nên không thể tạo lại giai đoạn 1.",
          "F1_PLAN_MODE_LOCKED",
        );
      }
      const requested = custom ? "trainer" : "system";
      if (requested !== state.initial) {
        throw planModeError(
          `Khách hàng này đang dùng cách "${PLAN_MODE_LABELS[state.initial]}". Hãy dùng "Thay đổi dự đoán" để đổi cách.`,
          "F1_PLAN_MODE_MISMATCH",
        );
      }
    }
    let phaseCeiling;
    let framework;
    let phaseRoadmap;
    let outcomeTable;
    let visualStages;
    if (custom) {
      const built = buildTrainerStageOne({ intake, assessment, aiReport, custom, trainerId: req.user.id });
      phaseCeiling = custom.phaseKey;
      ({ framework, phaseRoadmap, outcomeTable, visualStages } = built);
    } else {
      phaseCeiling = determinePhaseCeiling({
        intake,
        assessment,
        aiReport,
      });
      const personalizedPath = buildPersonalizedPath(
        recommendedStartPhase,
        phaseCeiling,
      );
      framework = buildFramework({
        recommendedStartPhase,
        phaseCeiling,
        personalizedPath,
      });
      phaseRoadmap = buildPhaseRoadmap({
        personalizedPath,
        intake,
        assessment,
        aiReport,
      });
      outcomeTable = buildOutcomeTable({
        intake,
        assessment,
        personalizedPath,
        phaseRoadmap,
      });
      visualStages = buildVisualStages({
        personalizedPath,
        intake,
        assessment,
      });
    }

    const result = await createIdempotentF1Artifact({
      Model: F1ResultPrediction,
      customerId: customer._id,
      sourceFields: {
        customerId: customer._id,
        intakeId: intake._id,
        assessmentId: assessment._id,
        aiReportId: aiReport._id,
      },
      sourceDocuments: [intake, assessment, aiReport],
      engineVersion: "result-prediction-v2",
      requestId: req.body.requestId,
      // Bản HLV thiết kế luôn là một phiên bản mới.
      regenerate: Boolean(req.body.regenerate) || Boolean(custom),
      payload: {
        planSource: custom ? "trainer" : "system",
        framework,
        phaseRoadmap,
        outcomeTable,
        beforeImages: {
          frontMediaId: frontMedia?._id || null,
          sideMediaId: sideMedia?._id || null,
          frontUrl: "",
          sideUrl: "",
        },
        visualStages,
        sourceSummary: {
          primaryGoal: intake?.trainingProfileGoal?.primaryGoal || "",
          currentWeightKg: Number(intake?.bodyMetrics?.weightKg || 0) || null,
          targetWeightKg:
            Number(intake?.trainingProfileGoal?.targetWeightKg || 0) || null,
          bodyFatPercent:
            Number(intake?.bodyMetrics?.bodyFatPercent || 0) || null,
          restingHeartRate:
            Number(intake?.bodyMetrics?.restingHeartRate || 0) || null,
          overallPhysicalLevel: assessment?.overallPhysicalLevel || "",
          readinessStatus: aiReport?.inputSummary?.readinessStatus || "",
          startPhase: custom ? custom.phaseKey : recommendedStartPhase,
          phaseCeiling,
          hasBeforeFront: Boolean(frontMedia),
          hasBeforeSide: Boolean(sideMedia),
        },
      },
      customerUpdate: (prediction) => ({
        lastResultPredictionId: prediction._id,
      }),
      audit: {
        actorId: req.user.id,
        actorRole: req.user.role,
        action: "generate_f1_prediction",
        targetType: "f1_result_prediction",
        requestId: req.id,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      },
    });

    return res.status(result.idempotentReplay ? 200 : 201).json({
      success: true,
      data: withPlanMode(serializePrediction(result.artifact), customer),
      idempotentReplay: result.idempotentReplay,
      message: result.idempotentReplay
        ? "Dự đoán đã tồn tại cho nguồn dữ liệu này"
        : "Đã tạo dự đoán kết quả thành công.",
    });
  } catch (error) {
    return next(error);
  }
};

export const getLatestResultPrediction = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);
    const prediction = await F1ResultPrediction.findOne({
      customerId: customer._id,
    }).sort({ createdAt: -1 });
    res.setHeader("Cache-Control", "private, no-store");
    return res.json({
      success: true,
      data: withPlanMode(serializePrediction(prediction), customer),
    });
  } catch (error) {
    return next(error);
  }
};

const reserveStageGeneration = ({
  predictionId,
  customerId,
  phaseKey,
  requestId,
}) => {
  const now = new Date();
  return F1ResultPrediction.findOneAndUpdate(
    {
      _id: predictionId,
      customerId,
      visualStages: {
        $elemMatch: {
          phaseKey,
          "generation.attemptCount": {
            $lt: MAX_AI_IMAGE_ATTEMPTS_PER_STAGE,
          },
          $or: [
            { imageStatus: { $ne: "generating" } },
            { "generation.reservedUntil": { $lte: now } },
            { "generation.reservationId": requestId },
          ],
        },
      },
    },
    {
      $set: {
        "visualStages.$.imageStatus": "generating",
        "visualStages.$.generation.reservationId": requestId,
        "visualStages.$.generation.reservedUntil": new Date(
          now.getTime() + IMAGE_RESERVATION_MS,
        ),
        "visualStages.$.generation.lastRequestedAt": now,
        "visualStages.$.generation.lastError": "",
      },
      $inc: { "visualStages.$.generation.attemptCount": 1 },
    },
    { returnDocument: "after" },
  );
};

const getSerializedStage = (prediction, phaseKey) =>
  serializePrediction(prediction)?.visualStages?.find(
    (stage) => stage.phaseKey === phaseKey,
  );

export const generateResultPredictionStageImages = async (req, res, next) => {
  const requestId = req.body.requestId;
  let createdFront = null;
  let createdSide = null;
  let reservationAcquired = false;
  let prediction = null;

  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);
    prediction = await F1ResultPrediction.findOne({
      _id: req.params.predictionId,
      customerId: customer._id,
    });
    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy result prediction tương ứng",
      });
    }
    const phaseKey = req.params.phaseKey;
    const currentStage = prediction.visualStages.find(
      (item) => item.phaseKey === phaseKey,
    );
    if (!currentStage) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phase tương ứng trong result prediction",
      });
    }
    if (
      currentStage.imageStatus === "generated" &&
      currentStage.generation?.reservationId === requestId
    ) {
      return res.json({
        success: true,
        data: getSerializedStage(prediction, phaseKey),
        idempotentReplay: true,
      });
    }
    if (
      currentStage.imageStatus === "generated" &&
      !req.body.forceRegenerate
    ) {
      return res.json({
        success: true,
        data: getSerializedStage(prediction, phaseKey),
        idempotentReplay: true,
        message: "Phase này đã có ảnh AI, không cần tạo lại",
      });
    }

    const reserved = await reserveStageGeneration({
      predictionId: prediction._id,
      customerId: customer._id,
      phaseKey,
      requestId,
    });
    if (!reserved) {
      const latest = await F1ResultPrediction.findById(prediction._id);
      const latestStage = latest?.visualStages?.find(
        (item) => item.phaseKey === phaseKey,
      );
      const error = new Error(
        Number(latestStage?.generation?.attemptCount || 0) >=
          MAX_AI_IMAGE_ATTEMPTS_PER_STAGE
          ? `Phase này đã đạt giới hạn ${MAX_AI_IMAGE_ATTEMPTS_PER_STAGE} lần tạo ảnh AI`
          : "Một request khác đang tạo ảnh cho phase này",
      );
      error.status =
        Number(latestStage?.generation?.attemptCount || 0) >=
        MAX_AI_IMAGE_ATTEMPTS_PER_STAGE
          ? 400
          : 409;
      error.code =
        error.status === 409
          ? "F1_IMAGE_GENERATION_IN_PROGRESS"
          : "F1_IMAGE_ATTEMPTS_EXHAUSTED";
      throw error;
    }
    reservationAcquired = true;

    const [frontMedia, sideMedia] = await Promise.all([
      F1Media.findOne({
        _id: reserved.beforeImages?.frontMediaId,
        customerId: customer._id,
        status: "ready",
      }),
      F1Media.findOne({
        _id: reserved.beforeImages?.sideMediaId,
        customerId: customer._id,
        status: "ready",
      }),
    ]);
    if (!frontMedia || !sideMedia) {
      const error = new Error(
        "Thiếu ảnh before front hoặc before side ở private storage",
      );
      error.status = 400;
      error.code = "F1_BEFORE_MEDIA_REQUIRED";
      throw error;
    }
    const [frontReference, sideReference] = await Promise.all([
      getPrivateImageReference(frontMedia),
      getPrivateImageReference(sideMedia),
    ]);
    const promptPrediction = reserved.toObject();
    promptPrediction.beforeImages.frontUrl = frontReference;
    promptPrediction.beforeImages.sideUrl = sideReference;
    const generationPayload = buildStageImageGenerationPayload({
      customer,
      prediction: promptPrediction,
      phaseKey,
      forceRegenerate: req.body.forceRegenerate,
    });
    const aiResult = await generateStageImagesWithAI({
      beforeImages: generationPayload.beforeImages,
      prompts: generationPayload.prompts,
      context: generationPayload.context,
      phaseKey,
    });
    const mediaBase = {
      customerId: customer._id,
      intakeId: reserved.intakeId,
      predictionId: reserved._id,
      phaseKey,
      actorId: req.user.id,
      actorRole: req.user.role,
      requestContext: getRequestContext(req),
    };
    createdFront = (
      await createF1MediaFromReference({
        ...mediaBase,
        type: "prediction_front",
        reference: aiResult.frontUrl,
      })
    ).media;
    createdSide = (
      await createF1MediaFromReference({
        ...mediaBase,
        type: "prediction_side",
        reference: aiResult.sideUrl,
      })
    ).media;

    const oldStage = prediction.visualStages.find(
      (item) => item.phaseKey === phaseKey,
    );
    const updated = await F1ResultPrediction.findOneAndUpdate(
      {
        _id: prediction._id,
        customerId: customer._id,
        visualStages: {
          $elemMatch: {
            phaseKey,
            "generation.reservationId": requestId,
            imageStatus: "generating",
          },
        },
      },
      {
        $set: {
          "visualStages.$.imageStatus": "generated",
          "visualStages.$.images.frontMediaId": createdFront._id,
          "visualStages.$.images.sideMediaId": createdSide._id,
          "visualStages.$.images.frontUrl": "",
          "visualStages.$.images.sideUrl": "",
          "visualStages.$.generation.generatedAt": new Date(),
          "visualStages.$.generation.provider": aiResult.provider || "",
          "visualStages.$.generation.model": aiResult.model || "",
          "visualStages.$.generation.lastError": "",
          "visualStages.$.generation.reservedUntil": null,
        },
      },
      { returnDocument: "after" },
    );
    if (!updated) {
      const error = new Error("Image generation reservation is no longer valid");
      error.status = 409;
      error.code = "F1_IMAGE_RESERVATION_LOST";
      throw error;
    }

    const oldIds = [
      oldStage?.images?.frontMediaId,
      oldStage?.images?.sideMediaId,
    ].filter(Boolean);
    if (oldIds.length > 0) {
      const oldMedia = await F1Media.find({ _id: { $in: oldIds } });
      await Promise.all(
        oldMedia.map((media) =>
          queueF1MediaDeletion({
            media,
            actorId: req.user.id,
            actorRole: req.user.role,
            requestContext: getRequestContext(req),
          }),
        ),
      );
    }

    return res.json({
      success: true,
      data: {
        predictionId: updated._id,
        ...getSerializedStage(updated, phaseKey),
        maxAttempts: MAX_AI_IMAGE_ATTEMPTS_PER_STAGE,
      },
      message: "Đã tạo ảnh AI cho phase thành công",
    });
  } catch (error) {
    // Lỗi do nhà cung cấp ảnh (quá tải, hết hạn mức, từ chối) không tính vào số lượt.
    const providerFault = String(error.code || "").startsWith("AI_IMAGE_PROVIDER");
    if (reservationAcquired && prediction) {
      await F1ResultPrediction.updateOne(
        {
          _id: prediction._id,
          visualStages: {
            $elemMatch: {
              phaseKey: req.params.phaseKey,
              "generation.reservationId": requestId,
            },
          },
        },
        {
          ...(providerFault
            ? { $inc: { "visualStages.$.generation.attemptCount": -1 } }
            : {}),
          $set: {
            "visualStages.$.imageStatus": "failed",
            "visualStages.$.generation.lastError": String(
              error.code || "F1_IMAGE_GENERATION_FAILED",
            ).slice(0, 100),
            "visualStages.$.generation.reservedUntil": null,
          },
        },
      ).catch(() => undefined);
    }
    const unattached = [createdFront, createdSide].filter(Boolean);
    await Promise.all(
      unattached.map((media) =>
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

// Xem trước giai đoạn 1 do HLV thiết kế: gợi ý nội dung và bảng dự đoán của hệ thống, không lưu.
export const previewStageDesign = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);
    const [intake, assessment, aiReport] = await Promise.all([
      F1Intake.findOne({ customerId: customer._id, isLatest: true }),
      F1Assessment.findOne({ customerId: customer._id }).sort({ createdAt: -1 }),
      F1AiReport.findOne({ customerId: customer._id }).sort({ createdAt: -1 }),
    ]);
    if (!intake || intake.isDraft || !assessment || !aiReport) {
      return res.status(400).json({
        success: false,
        message: "Cần có kết quả khảo sát, đánh giá thể chất và phân tích tự động trước khi thiết kế lộ trình.",
      });
    }
    const custom = normalizeCustomStage(req.body.customStage);
    const built = buildTrainerStageOne({ intake, assessment, aiReport, custom });
    const [systemStage] = buildPhaseRoadmap({
      personalizedPath: [custom.phaseKey],
      intake,
      assessment,
      aiReport,
    });
    const checkpoint = built.outcomeTable.phaseCheckpoints[0];
    res.setHeader("Cache-Control", "private, no-store");
    return res.json({
      success: true,
      data: {
        suggestion: {
          durationWeeks: systemStage.durationWeeks,
          objective: systemStage.objective,
          entryReason: systemStage.entryReason,
          keyFocus: systemStage.keyFocus,
          expectedChanges: systemStage.expectedChanges,
          exitCriteria: systemStage.exitCriteria,
        },
        baseline: built.outcomeTable.baseline,
        systemProjected: checkpoint.systemProjected,
      },
    });
  } catch (error) {
    return next(error);
  }
};
