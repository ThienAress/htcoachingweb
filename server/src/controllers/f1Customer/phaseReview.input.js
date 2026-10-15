// Chuẩn hoá dữ liệu HLV gửi lên cho đánh giá cuối giai đoạn: chỉ nhận field cho phép,
// kiểm kiểu và khoảng giá trị; lỗi trả câu tiếng Việt, không lặp lại số liệu sức khỏe.
import { MAX_RECOMMENDATION_CHECKS, MAX_RETESTS } from "../../models/F1PhaseReview.js";

const LEVELS = new Set(["low", "below_average", "average", "good", ""]);
const QUALITIES = new Set(["good", "fair", "poor"]);
const STATUSES = new Set(["met", "partial", "not_met"]);
const TIERS = new Set(["easy", "standard", "advanced", ""]);

const fail = (message) => {
  const error = new Error(message);
  error.status = 400;
  error.expose = true;
  throw error;
};

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const numberIn = (value, min, max, label, { required = false, integer = false } = {}) => {
  if (value === null || value === undefined || value === "") {
    if (required) fail(`Vui lòng nhập ${label}`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    fail(`${label[0].toUpperCase()}${label.slice(1)} không hợp lệ`);
  }
  return parsed;
};

const text = (value, max, label) => {
  if (typeof value !== "string") fail(`${label} không hợp lệ`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) fail(`${label} không hợp lệ`);
  return trimmed;
};

const VIEWS = ["anterior", "lateral", "posterior"];
const ITEM_STATUSES = new Set(["persists", "resolved", "new"]);

const normalizeOhsa = (ohsa) => {
  if (!Array.isArray(ohsa.items)) {
    return {
      anteriorIssue: ohsa.anteriorIssue === true,
      lateralIssue: ohsa.lateralIssue === true,
      posteriorIssue: ohsa.posteriorIssue === true,
      items: [],
    };
  }
  if (ohsa.items.length > 24) fail("Danh sách biểu hiện tư thế sai quá dài");
  const items = ohsa.items.map((item) => {
    if (!isPlainObject(item) || !VIEWS.includes(item.view)) fail("Góc nhìn không hợp lệ");
    if (!ITEM_STATUSES.has(item.status)) fail("Trạng thái biểu hiện không hợp lệ");
    const key = typeof item.key === "string" ? item.key.trim().slice(0, 100) : "";
    return { view: item.view, key, label: text(item.label, 100, "Biểu hiện tư thế sai"), status: item.status };
  });
  const has = (view) => items.some((item) => item.view === view && item.status !== "resolved");
  return {
    anteriorIssue: has("anterior"),
    lateralIssue: has("lateral"),
    posteriorIssue: has("posterior"),
    items,
  };
};

export const normalizePhaseReviewInput = (body) => {
  if (!isPlainObject(body)) fail("Dữ liệu đánh giá không hợp lệ");
  const actual = isPlainObject(body.actual) ? body.actual : fail("Thiếu chỉ số đo lại");
  const adherence = isPlainObject(body.adherence) ? body.adherence : fail("Thiếu thông tin tuân thủ");
  const ohsa = isPlainObject(body.ohsa) ? body.ohsa : {};
  const safety = isPlainObject(body.safety) ? body.safety : {};

  const measuredAt = new Date(body.measuredAt);
  if (Number.isNaN(measuredAt.getTime())) fail("Ngày đo không hợp lệ");
  if (measuredAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) fail("Ngày đo không được ở tương lai");

  const plannedSessions = numberIn(adherence.plannedSessions, 1, 400, "số buổi theo kế hoạch", { required: true, integer: true });
  const completedSessions = numberIn(adherence.completedSessions, 0, 400, "số buổi đã tập", { required: true, integer: true });

  const checks = body.recommendationChecks ?? [];
  if (!Array.isArray(checks) || checks.length > MAX_RECOMMENDATION_CHECKS) fail("Danh sách lời khuyên không hợp lệ");
  const retests = body.retests ?? [];
  if (!Array.isArray(retests) || retests.length > MAX_RETESTS) fail("Danh sách bài test lại không hợp lệ");

  const note = safety.note ?? "";
  if (typeof note !== "string" || note.length > 200) fail("Ghi chú an toàn tối đa 200 ký tự");

  return {
    measuredAt,
    actual: {
      weightKg: numberIn(actual.weightKg, 10, 300, "cân nặng", { required: true }),
      waistCm: numberIn(actual.waistCm, 30, 250, "vòng eo"),
      hipCm: numberIn(actual.hipCm, 30, 250, "vòng hông"),
      bodyFatPercent: numberIn(actual.bodyFatPercent, 2, 70, "tỷ lệ mỡ"),
      restingHeartRate: numberIn(actual.restingHeartRate, 30, 220, "nhịp tim nghỉ"),
    },
    adherence: {
      plannedSessions,
      completedSessions,
      nutrition: QUALITIES.has(adherence.nutrition) ? adherence.nutrition : fail("Mức ăn uống không hợp lệ"),
      sleep: QUALITIES.has(adherence.sleep) ? adherence.sleep : fail("Mức giấc ngủ không hợp lệ"),
    },
    recommendationChecks: checks.map((item) => {
      if (!isPlainObject(item) || !STATUSES.has(item.status)) fail("Trạng thái lời khuyên không hợp lệ");
      return { text: text(item.text, 300, "Lời khuyên"), status: item.status };
    }),
    retests: retests.map((item) => {
      if (!isPlainObject(item)) fail("Bài test lại không hợp lệ");
      if (!LEVELS.has(item.level ?? "")) fail("Mức đánh giá bài test lại không hợp lệ");
      if (!TIERS.has(item.tier ?? "")) fail("Cấp độ bài test lại không hợp lệ");
      return {
        metricKey: text(item.metricKey, 40, "Nhóm bài test"),
        name: text(item.name, 80, "Tên bài test"),
        tier: item.tier ?? "",
        sets: numberIn(item.sets, 0, 20, "số hiệp", { integer: true }),
        reps: numberIn(item.reps, 0, 500, "số lần", { integer: true }),
        durationSec: numberIn(item.durationSec, 0, 7200, "thời gian giữ"),
        level: item.level ?? "",
      };
    }),
    ohsa: normalizeOhsa(ohsa),
    safety: {
      newPain: safety.newPain === true,
      newInjury: safety.newInjury === true,
      warningSigns: safety.warningSigns === true,
      note: note.trim(),
    },
  };
};
