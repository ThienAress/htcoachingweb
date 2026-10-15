import F1Intake from "../../models/F1Intake.js";
import F1Assessment from "../../models/F1Assessment.js";
import F1AiReport from "../../models/F1AiReport.js";
import F1ResultPrediction from "../../models/F1ResultPrediction.js";
import F1PhaseReview from "../../models/F1PhaseReview.js";
import { F1Customer, assertCustomerAccess } from "./shared.js";
import { buildStageContext } from "./phaseReview.context.js";
import { normalizePhaseReviewInput } from "./phaseReview.input.js";
import { evaluatePhaseReview } from "./phaseReview.scoring.js";
import { buildNextStage } from "./phaseReview.projection.js";
import { serializeVisual } from "./phaseReview.visual.controller.js";
import { applyProfile, normalizeProfile } from "./phaseReview.profile.js";

const MAX_STAGES = 20;

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
};

// Lấy bản dự đoán mới nhất và đúng bộ nguồn (khảo sát, đánh giá, phân tích) đã tạo ra nó.
const loadChain = async (req) => {
  const customer = await F1Customer.findById(req.params.id);
  assertCustomerAccess(customer, req);
  const prediction = await F1ResultPrediction.findOne({ customerId: customer._id })
    .sort({ createdAt: -1 })
    .select("phaseRoadmap outcomeTable intakeId assessmentId aiReportId customerId")
    .lean();
  if (!prediction) return { customer, prediction: null };
  const [intake, assessment, aiReport, reviews] = await Promise.all([
    F1Intake.findOne({ _id: prediction.intakeId, customerId: customer._id })
      .select("bodyMetrics trainingProfileGoal healthScreening lifestyleNutrition")
      .lean(),
    F1Assessment.findOne({ _id: prediction.assessmentId, customerId: customer._id })
      .select("strengthAssessment enduranceAssessment cardioAssessment movementAssessment overallPhysicalLevel")
      .lean(),
    F1AiReport.findOne({ _id: prediction.aiReportId, customerId: customer._id })
      .select("recommendations")
      .lean(),
    F1PhaseReview.find({ customerId: customer._id, predictionId: prediction._id })
      .sort({ stageOrder: 1 })
      .limit(MAX_STAGES)
      .lean(),
  ]);
  return { customer, prediction, intake, assessment, aiReport, reviews };
};

// Khảo sát gốc cộng hồ sơ đã cập nhật ở các lần đánh giá trước giai đoạn này.
const intakeFor = (chain, stageOrder, ownProfile = null) => {
  const earlier = (chain.reviews || [])
    .filter((item) => item.stageOrder < stageOrder && item.profile && item.profileConfirmedAt)
    .sort((a, b) => b.stageOrder - a.stageOrder)[0];
  return applyProfile(applyProfile(chain.intake, earlier?.profile), ownProfile);
};

const contextFor = (chain, stageOrder, ownProfile = null) =>
  buildStageContext({
    stageOrder,
    prediction: chain.prediction,
    intake: intakeFor(chain, stageOrder, ownProfile),
    assessment: chain.assessment,
    aiReport: chain.aiReport,
    reviews: chain.reviews,
  });

const serializeReview = (review) => ({
  _id: review._id,
  stageOrder: review.stageOrder,
  phaseKey: review.phaseKey,
  measuredAt: review.measuredAt,
  actual: review.actual,
  adherence: review.adherence,
  recommendationChecks: review.recommendationChecks,
  retests: review.retests,
  ohsa: review.ohsa,
  safety: review.safety,
  evaluation: review.evaluation,
  nextPhasePlan: review.nextPhasePlan,
  nextOutcome: review.nextOutcome,
  profile: review.profile || null,
  profileConfirmed: Boolean(review.profileConfirmedAt),
  visual: serializeVisual(review),
  updatedAt: review.updatedAt,
});

const buildPayload = (chain) => {
  const reviews = chain.reviews || [];
  const nextStage = reviews.length + 1;
  // Ngữ cảnh cho lần đánh giá gần nhất (để sửa) và cho giai đoạn kế tiếp (để nhập mới).
  const contexts = {};
  for (const stageOrder of [reviews.length, nextStage]) {
    if (stageOrder < 1 || stageOrder > MAX_STAGES) continue;
    const context = contextFor(chain, stageOrder);
    if (context) {
      const own = reviews.find((item) => item.stageOrder === stageOrder);
      const base = intakeFor(chain, stageOrder);
      contexts[stageOrder] = {
        ...context,
        // Giá trị gợi ý sẵn trong form cập nhật mục tiêu cho giai đoạn kế tiếp.
        profileDefaults: own?.profile || {
          healthScreening: base.healthScreening || {},
          lifestyleNutrition: base.lifestyleNutrition || {},
          trainingProfileGoal: base.trainingProfileGoal || {},
        },
      };
    }
  }
  return {
    predictionId: chain.prediction._id,
    reviews: reviews.map(serializeReview),
    contexts,
  };
};

export const getPhaseReviews = async (req, res, next) => {
  try {
    const chain = await loadChain(req);
    res.setHeader("Cache-Control", "private, no-store");
    return res.json({
      success: true,
      data: chain.prediction ? buildPayload(chain) : null,
    });
  } catch (error) {
    return next(error);
  }
};

export const savePhaseReview = async (req, res, next) => {
  try {
    const stageOrder = Number(req.params.stageOrder);
    const input = normalizePhaseReviewInput(req.body);
    const chain = await loadChain(req);
    if (!chain.prediction) {
      throw httpError(400, "Cần tạo dự đoán kết quả trước khi đánh giá cuối giai đoạn.");
    }
    if (!chain.intake || !chain.assessment || !chain.aiReport) {
      throw httpError(409, "Dữ liệu gốc của lộ trình không còn đầy đủ. Hãy tạo lại dự đoán kết quả.");
    }
    const reviewed = chain.reviews.length;
    if (stageOrder > reviewed + 1) {
      throw httpError(409, `Cần đánh giá xong giai đoạn ${reviewed + 1} trước.`);
    }
    if (stageOrder < reviewed) {
      throw httpError(409, "Chỉ sửa được lần đánh giá gần nhất.");
    }
    const previous = chain.reviews.find((item) => item.stageOrder === stageOrder - 1);
    if (previous && !previous.profileConfirmedAt) {
      throw httpError(409, `Cần cập nhật mục tiêu cho giai đoạn ${stageOrder} trước.`);
    }
    const existing = chain.reviews.find((item) => item.stageOrder === stageOrder);
    const ownProfile = existing?.profile || null;
    const context = contextFor(chain, stageOrder, ownProfile);
    if (!context) {
      throw httpError(409, "Chưa có kế hoạch cho giai đoạn này.");
    }

    // Mức trước của bài test lại lấy từ server, bỏ các bài không thuộc lộ trình.
    const known = new Map(context.retests.map((item) => [`${item.metricKey}|${item.name}`, item]));
    input.retests = input.retests
      .filter((item) => known.has(`${item.metricKey}|${item.name}`))
      .map((item) => ({
        ...item,
        tier: known.get(`${item.metricKey}|${item.name}`).tier,
        previousLevel: known.get(`${item.metricKey}|${item.name}`).previousLevel,
      }));

    if (context.heightCm) {
      const meters = context.heightCm / 100;
      input.actual.bmi = Math.round((input.actual.weightKg / (meters * meters)) * 10) / 10;
    }

    const evaluation = {
      ...evaluatePhaseReview({ input, context }),
      stageWeeks: context.durationWeeks,
      // Mốc đầu và dự kiến cuối giai đoạn để so với kết quả thực tế.
      start: context.start,
      projected: context.projected,
    };
    const { nextPhasePlan, nextOutcome } = buildNextStage({
      input,
      context,
      evaluation,
      intake: intakeFor(chain, stageOrder, ownProfile),
      assessment: chain.assessment,
      aiReport: chain.aiReport,
    });

    await F1PhaseReview.findOneAndUpdate(
      { customerId: chain.customer._id, predictionId: chain.prediction._id, stageOrder },
      {
        $set: {
          trainerId: req.user.id,
          phaseKey: context.phaseKey,
          ...input,
          evaluation,
          nextPhasePlan,
          nextOutcome,
          engineVersion: "phase-review-v1",
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    const updated = await loadChain(req);
    return res.status(200).json({
      success: true,
      data: buildPayload(updated),
      message: `Đã lưu đánh giá cuối giai đoạn ${stageOrder}.`,
    });
  } catch (error) {
    return next(error);
  }
};

// Bước 2: HLV cập nhật mục tiêu, sức khỏe và lối sống rồi hệ thống dựng đề xuất và dự đoán cho giai đoạn kế tiếp.
export const saveStageProfile = async (req, res, next) => {
  try {
    const stageOrder = Number(req.params.stageOrder);
    const profile = normalizeProfile(req.body);
    const chain = await loadChain(req);
    if (!chain.prediction) {
      throw httpError(400, "Cần tạo dự đoán kết quả trước.");
    }
    if (!chain.intake || !chain.assessment || !chain.aiReport) {
      throw httpError(409, "Dữ liệu gốc của lộ trình không còn đầy đủ. Hãy tạo lại dự đoán kết quả.");
    }
    const review = chain.reviews.find((item) => item.stageOrder === stageOrder);
    if (!review) {
      throw httpError(409, `Cần lưu kết quả cuối giai đoạn ${stageOrder} trước.`);
    }
    if (stageOrder < chain.reviews.length) {
      throw httpError(409, "Chỉ sửa được lần đánh giá gần nhất.");
    }

    const context = contextFor(chain, stageOrder, profile);
    const input = {
      actual: review.actual,
      adherence: review.adherence,
      recommendationChecks: review.recommendationChecks,
      retests: review.retests,
      ohsa: review.ohsa,
      safety: review.safety,
    };
    const { nextPhasePlan, nextOutcome } = buildNextStage({
      input,
      context,
      evaluation: review.evaluation,
      intake: intakeFor(chain, stageOrder, profile),
      assessment: chain.assessment,
      aiReport: chain.aiReport,
    });

    await F1PhaseReview.updateOne(
      { _id: review._id },
      {
        $set: {
          profile,
          profileConfirmedAt: new Date(),
          nextPhasePlan,
          nextOutcome,
          trainerId: req.user.id,
        },
      },
    );

    const updated = await loadChain(req);
    return res.status(200).json({
      success: true,
      data: buildPayload(updated),
      message: `Đã lưu mục tiêu và dựng lộ trình giai đoạn ${stageOrder + 1}.`,
    });
  } catch (error) {
    return next(error);
  }
};
