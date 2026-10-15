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
      .select("bodyMetrics trainingProfileGoal")
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

const contextFor = (chain, stageOrder) =>
  buildStageContext({
    stageOrder,
    prediction: chain.prediction,
    intake: chain.intake,
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
    if (context) contexts[stageOrder] = context;
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
    const context = contextFor(chain, stageOrder);
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
      intake: chain.intake,
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
