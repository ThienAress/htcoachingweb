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
import { generateStageImagesWithAI } from "../../services/aiImageGenerator.service.js";

export const generateResultPrediction = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const [intake, assessment, aiReport, frontMedia, sideMedia] =
      await Promise.all([
        F1Intake.findOne({
          customerId: customer._id,
          isLatest: true,
        }),
        F1Assessment.findOne({
          customerId: customer._id,
        }).sort({ createdAt: -1 }),
        F1AiReport.findOne({
          customerId: customer._id,
        }).sort({ createdAt: -1 }),
        F1Media.findOne({
          customerId: customer._id,
          type: "before_front",
        }).sort({ createdAt: -1 }),
        F1Media.findOne({
          customerId: customer._id,
          type: "before_side",
        }).sort({ createdAt: -1 }),
      ]);

    if (!intake || intake.isDraft) {
      return res.status(400).json({
        success: false,
        message:
          "Khách này chưa hoàn tất intake nên chưa thể tạo phần dự đoán.",
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

    const phaseCeiling = determinePhaseCeiling({
      intake,
      assessment,
      aiReport,
    });

    const personalizedPath = buildPersonalizedPath(
      recommendedStartPhase,
      phaseCeiling,
    );

    const framework = buildFramework({
      recommendedStartPhase,
      phaseCeiling,
      personalizedPath,
    });

    const phaseRoadmap = buildPhaseRoadmap({
      personalizedPath,
      intake,
      assessment,
      aiReport,
    });

    const outcomeTable = buildOutcomeTable({
      intake,
      assessment,
      personalizedPath,
      phaseRoadmap,
    });

    const visualStages = buildVisualStages({
      personalizedPath,
      intake,
      assessment,
    });

    const prediction = await F1ResultPrediction.create({
      customerId: customer._id,
      intakeId: intake._id,
      assessmentId: assessment._id,
      aiReportId: aiReport._id,
      framework,
      phaseRoadmap,
      outcomeTable,
      beforeImages: {
        frontMediaId: frontMedia?._id || null,
        sideMediaId: sideMedia?._id || null,
        frontUrl: frontMedia?.url || "",
        sideUrl: sideMedia?.url || "",
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
        startPhase: recommendedStartPhase,
        phaseCeiling,
        hasBeforeFront: Boolean(frontMedia),
        hasBeforeSide: Boolean(sideMedia),
      },
      engineVersion: "result-prediction-v1",
    });

    return res.status(201).json({
      success: true,
      data: prediction,
      message: "Đã tạo dự đoán kết quả thành công.",
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

    return res.json({
      success: true,
      data: prediction || null,
    });
  } catch (error) {
    return next(error);
  }
};

export const generateResultPredictionStageImages = async (req, res, next) => {
  let prediction = null;
  let stageIndex = -1;

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

    const generationPayload = buildStageImageGenerationPayload({
      customer,
      prediction,
      phaseKey: req.params.phaseKey,
      forceRegenerate: req.body?.forceRegenerate,
    });

    stageIndex = prediction.visualStages.findIndex(
      (item) => item.phaseKey === generationPayload.phaseKey,
    );

    if (stageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phase tương ứng trong result prediction",
      });
    }

    const currentStage = prediction.visualStages[stageIndex];

    if (
      generationPayload.alreadyGenerated &&
      !generationPayload.forceRegenerate
    ) {
      return res.json({
        success: true,
        data: {
          predictionId: prediction._id,
          phaseKey: currentStage.phaseKey,
          imageStatus: currentStage.imageStatus,
          images: currentStage.images || {
            frontUrl: "",
            sideUrl: "",
          },
          generation: currentStage.generation || {},
        },
        message: "Phase này đã có ảnh AI, không cần tạo lại",
      });
    }

    prediction.visualStages[stageIndex].imageStatus = "generating";
    prediction.visualStages[stageIndex].generation = {
      ...(prediction.visualStages[stageIndex].generation || {}),
      lastError: "",
    };
    prediction.markModified("visualStages");
    await prediction.save();

    const aiResult = await generateStageImagesWithAI({
      beforeImages: generationPayload.beforeImages,
      prompts: generationPayload.prompts,
      context: generationPayload.context,
      phaseKey: generationPayload.phaseKey,
    });

    prediction.visualStages[stageIndex].imageStatus = "generated";
    prediction.visualStages[stageIndex].images = {
      frontUrl: aiResult.frontUrl,
      sideUrl: aiResult.sideUrl,
    };
    prediction.visualStages[stageIndex].generation = {
      generatedAt: new Date(),
      provider: aiResult.provider || "",
      model: aiResult.model || "",
      lastError: "",
    };
    prediction.markModified("visualStages");
    await prediction.save();

    const updatedStage = prediction.visualStages[stageIndex];

    return res.json({
      success: true,
      data: {
        predictionId: prediction._id,
        phaseKey: updatedStage.phaseKey,
        imageStatus: updatedStage.imageStatus,
        images: updatedStage.images || {
          frontUrl: "",
          sideUrl: "",
        },
        generation: updatedStage.generation || {},
      },
      message: "Đã tạo ảnh AI cho phase thành công",
    });
  } catch (error) {
    if (prediction && stageIndex >= 0) {
      try {
        prediction.visualStages[stageIndex].imageStatus = "failed";
        prediction.visualStages[stageIndex].generation = {
          ...(prediction.visualStages[stageIndex].generation || {}),
          lastError: error?.message || "Generate ảnh AI thất bại",
        };
        prediction.markModified("visualStages");
        await prediction.save();
      } catch (_saveError) {
        // Không throw thêm để tránh che mất lỗi gốc
      }
    }

    return next(error);
  }
};
