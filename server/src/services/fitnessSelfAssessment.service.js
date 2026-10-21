import FitnessSelfAssessment from "../models/FitnessSelfAssessment.js";
import { SELF_ASSESSMENT_RETEST_DAYS } from "../constants/serviceAccessPolicies.js";
import { resolveCustomerDashboardAccess } from "./customerDashboardAccess.service.js";
import { TEST_METRICS, TEST_METRIC_KEYS } from "./fitnessSelfAssessment/constants.js";
import { buildRecommendation } from "./fitnessSelfAssessment/recommendation.js";
import { normalizeDraftPayload } from "./fitnessSelfAssessment/sanitize.js";
import { buildSelfScreening } from "./fitnessSelfAssessment/screening.js";
import { scoreTests } from "./fitnessSelfAssessment/scoring.js";

export const SELF_ASSESSMENT_RESULT_VERSION = "2026-10-21.1";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_HISTORY_LIMIT = 20;

const failure = (statusCode, code, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.expose = true;
  return error;
};

const canWrite = async (actor) =>
  (await resolveCustomerDashboardAccess({ id: actor.id, role: actor.role })).accessMode === "self_managed";

const assertCanWrite = async (actor) => {
  if (await canWrite(actor)) return;
  throw failure(
    403,
    "SELF_ASSESSMENT_ENTITLEMENT_REQUIRED",
    "Gói HT Fitness+ của bạn không còn hiệu lực nên chưa thể thực hiện đánh giá. Bạn vẫn xem lại được các kết quả cũ.",
  );
};

export const toSelfAssessmentDto = (doc) => {
  if (!doc) return null;
  const source = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(source._id),
    status: source.status,
    draftStep: source.draftStep,
    screening: source.screening,
    profile: source.profile,
    training: source.training,
    tests: source.tests,
    systemFlags: source.systemFlags,
    consent: source.consent,
    result: source.status === "completed" ? source.result : null,
    completedAt: source.completedAt,
    nextEligibleAt: source.nextEligibleAt,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};

const plain = (value) => JSON.parse(JSON.stringify(value || {}));

const hasTestValue = (entry, key) => entry && entry[TEST_METRICS[key].valueKey] !== null && entry[TEST_METRICS[key].valueKey] !== undefined;

const getOrCreateDraft = async (userId) => {
  const existing = await FitnessSelfAssessment.findOne({ userId, status: "draft" });
  if (existing) return existing;
  // Làm lại: điền sẵn hồ sơ và đồng ý lưu dữ liệu từ lần trước; sàng lọc và bài test phải làm mới.
  const previous = await FitnessSelfAssessment.findOne({ userId, status: "completed" })
    .sort({ completedAt: -1 })
    .select("profile training consent")
    .lean();
  try {
    return await FitnessSelfAssessment.create({
      userId,
      ...(previous ? { profile: previous.profile, training: previous.training, consent: previous.consent } : {}),
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return FitnessSelfAssessment.findOne({ userId, status: "draft" });
  }
};

const isVersionConflict = (error) => error?.name === "VersionError" || error?.name === "DocumentNotFoundError";

const saveDocument = async (doc) => {
  try {
    await doc.save();
  } catch (error) {
    if (isVersionConflict(error)) {
      throw failure(409, "SELF_ASSESSMENT_CONFLICT", "Bản đánh giá vừa được cập nhật ở nơi khác. Vui lòng tải lại trang rồi thử lại.");
    }
    throw error;
  }
};

const hasValue = (key, entry) => entry?.[TEST_METRICS[key].valueKey] !== null && entry?.[TEST_METRICS[key].valueKey] !== undefined;

// Biến thể rỗng kèm giá trị bị coi là không hợp lệ: nếu không, người ở modified_test có thể lưu bài đầy đủ.
const variantAllowed = (key, entry, permission) => {
  if (!hasValue(key, entry)) return true;
  if (!entry.variant) return false;
  return permission !== "modified_test" || TEST_METRICS[key].modifiedVariants.includes(entry.variant);
};

const emptyTest = (key) => ({
  variant: "",
  [TEST_METRICS[key].valueKey]: null,
  ...(key === "cardio" ? { endHeartRate: null } : {}),
});

// Chưa có thông tin tập luyện thì chưa thể kết luận "mới tập"; tạm tính như người đang tập đều.
const screeningInputs = (draft) => {
  const training = plain(draft.training);
  const known = Boolean(training.trainingExperience);
  return {
    screening: plain(draft.screening),
    training: known ? training : { ...training, currentlyTraining: true, trainingExperience: "intermediate" },
  };
};

// Cờ an toàn luôn do server tính lại; bài test không còn hợp lệ với cờ mới thì bị gỡ.
const applyFlags = (draft) => {
  const flags = buildSelfScreening(screeningInputs(draft));
  draft.systemFlags = flags;
  TEST_METRIC_KEYS.forEach((key) => {
    const blocked =
      flags.testPermission === "hold_test" ||
      (flags.testPermission === "modified_test" && !variantAllowed(key, draft.tests?.[key], flags.testPermission));
    if (blocked) draft.set(`tests.${key}`, emptyTest(key));
  });
  return flags;
};

export const saveSelfAssessmentDraft = async (actor, body) => {
  await assertCanWrite(actor);
  const payload = normalizeDraftPayload(body);
  const draft = await getOrCreateDraft(actor.id);

  ["screening", "profile", "training", "consent"].forEach((section) => {
    Object.entries(payload[section] || {}).forEach(([key, value]) => draft.set(`${section}.${key}`, value));
  });
  if (payload.consent?.allowDataStorage === true && !draft.consent.collectedAt) {
    draft.set("consent.collectedAt", new Date());
  }
  if (!draft.consent.allowDataStorage && Object.keys(payload).some((key) => key !== "step" && key !== "consent")) {
    throw failure(400, "SELF_ASSESSMENT_CONSENT_REQUIRED", "Bạn cần đồng ý cho phép lưu dữ liệu sức khỏe để tiếp tục đánh giá.");
  }

  if (payload.screening) draft.set("screeningAnsweredAt", new Date());
  const touchedScreening = Boolean(payload.screening || payload.training);
  if (payload.tests) {
    const flags = buildSelfScreening(screeningInputs(draft));
    if (flags.testPermission === "hold_test") {
      throw failure(
        422,
        "SELF_ASSESSMENT_TEST_BLOCKED",
        "Dựa trên phần sàng lọc, bạn chưa nên thực hiện các bài kiểm tra. Hãy tham khảo ý kiến bác sĩ hoặc chuyên gia trước.",
      );
    }
    Object.entries(payload.tests).forEach(([key, entry]) => {
      if (!variantAllowed(key, entry, flags.testPermission)) {
        throw failure(
          422,
          "SELF_ASSESSMENT_TEST_BLOCKED",
          entry.variant
            ? "Với tình trạng hiện tại, bạn chỉ nên chọn biến thể giảm tải của bài này."
            : "Hãy chọn cách bạn đã thực hiện bài này.",
        );
      }
      draft.set(`tests.${key}`, entry);
    });
  }
  if (touchedScreening || payload.tests) applyFlags(draft);
  if (payload.step && payload.step > draft.draftStep) draft.draftStep = payload.step;

  await saveDocument(draft);
  return toSelfAssessmentDto(draft);
};

export const submitSelfAssessment = async (actor, draftId) => {
  await assertCanWrite(actor);
  const draft = await FitnessSelfAssessment.findOne({ _id: draftId, userId: actor.id, status: "draft" });
  if (!draft) throw failure(404, "SELF_ASSESSMENT_DRAFT_NOT_FOUND", "Bạn chưa có bản đánh giá nào đang làm dở.");

  const profile = plain(draft.profile);
  const training = plain(draft.training);
  const missingProfile = !profile.age || !profile.gender || !profile.heightCm || !profile.weightKg;
  if (!draft.consent.allowDataStorage || !draft.screeningAnsweredAt || draft.draftStep < 2 || missingProfile || !training.trainingExperience || !training.primaryGoal) {
    throw failure(422, "SELF_ASSESSMENT_INCOMPLETE", "Bạn cần hoàn tất phần sàng lọc và thông tin cá nhân trước khi xem kết quả.");
  }

  const flags = applyFlags(draft);
  const tests = plain(draft.tests);
  if (flags.testPermission !== "hold_test" && !TEST_METRIC_KEYS.some((key) => hasTestValue(tests[key], key))) {
    throw failure(422, "SELF_ASSESSMENT_INCOMPLETE", "Bạn cần nhập kết quả ít nhất một bài kiểm tra thể lực.");
  }

  const scoring = scoreTests({ tests, profile });
  const recommendation = buildRecommendation({
    profile,
    training,
    screening: plain(draft.screening),
    flags: plain(flags),
    scoring,
  });
  const now = new Date();
  draft.status = "completed";
  draft.draftStep = 4;
  draft.completedAt = now;
  draft.nextEligibleAt = new Date(now.getTime() + SELF_ASSESSMENT_RETEST_DAYS * DAY_MS);
  draft.result = { version: SELF_ASSESSMENT_RESULT_VERSION, scoring, recommendation };
  await saveDocument(draft);
  return toSelfAssessmentDto(draft);
};

const retestInfo = (latest, now = new Date()) => ({
  recommendedAfterDays: SELF_ASSESSMENT_RETEST_DAYS,
  nextEligibleAt: latest?.nextEligibleAt || null,
  isEarly: Boolean(latest?.nextEligibleAt && now < new Date(latest.nextEligibleAt)),
});

export const getLatestSelfAssessment = async (actor) => {
  const [writable, draft, latest] = await Promise.all([
    canWrite(actor),
    FitnessSelfAssessment.findOne({ userId: actor.id, status: "draft" }).lean(),
    FitnessSelfAssessment.findOne({ userId: actor.id, status: "completed" }).sort({ completedAt: -1 }).lean(),
  ]);
  return {
    canWrite: writable,
    draft: toSelfAssessmentDto(draft),
    latestCompleted: toSelfAssessmentDto(latest),
    retest: retestInfo(latest),
  };
};

export const listSelfAssessmentHistory = async (actor, { limit = 10, page = 1 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), MAX_HISTORY_LIMIT);
  const safePage = Math.max(Number(page) || 1, 1);
  const filter = { userId: actor.id, status: "completed" };
  const [items, total] = await Promise.all([
    FitnessSelfAssessment.find(filter)
      .sort({ completedAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    FitnessSelfAssessment.countDocuments(filter),
  ]);
  return { items: items.map(toSelfAssessmentDto), total, page: safePage, limit: safeLimit };
};

export const hasSelfAssessmentHistory = async (userId) =>
  Boolean(await FitnessSelfAssessment.exists({ userId }));
