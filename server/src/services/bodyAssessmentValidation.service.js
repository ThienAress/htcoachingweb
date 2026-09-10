import mongoose from "mongoose";
import { getMonthWeekPeriod, getVietnamDateKey, parseDateKey } from "../utils/dateKey.js";

export const BODY_SEGMENTS = ["leftArm", "rightArm", "trunk", "leftLeg", "rightLeg"];
export const BODY_SEGMENT_FIELDS = ["leanKg", "leanReferencePercent", "fatKg", "fatReferencePercent"];
export const assessmentError = (statusCode, message, codeName = "BODY_ASSESSMENT_INVALID") => Object.assign(new Error(message), { statusCode, codeName });
const invalid = (message) => { throw assessmentError(400, message); };
const exact = (value, keys) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) invalid("Dữ liệu có trường không hợp lệ");
};
const string = (value, max, fallback = "") => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || value.length > max) invalid("Nội dung văn bản không hợp lệ");
  return value.trim();
};
export const assertBodyAssessmentTarget = (clientId, period) => {
  if (!mongoose.isValidObjectId(clientId)) invalid("clientId không hợp lệ");
  if (period !== undefined) {
    parseDateKey(period);
    const range = getMonthWeekPeriod(period);
    if (range.startDateKey !== period || range.rangeStartDateKey > getVietnamDateKey()) invalid("Kỳ báo cáo không hợp lệ");
  }
};
export const normalizeBodyAssessmentDraft = (value) => {
  exact(value, ["measuredDateKey", "deviceLabel", "referenceBasis", "note", "segments"]);
  const measuredDateKey = string(value.measuredDateKey, 10);
  if (measuredDateKey) {
    parseDateKey(measuredDateKey);
    if (measuredDateKey > getVietnamDateKey()) invalid("Ngày đo không được ở tương lai");
  }
  const input = value.segments ?? {};
  exact(input, BODY_SEGMENTS);
  const segments = Object.fromEntries(BODY_SEGMENTS.map((key) => {
    const segment = input[key] ?? {};
    exact(segment, BODY_SEGMENT_FIELDS);
    return [key, Object.fromEntries(BODY_SEGMENT_FIELDS.map((field) => {
      const number = segment[field] ?? null;
      if (number !== null && (typeof number !== "number" || !Number.isFinite(number) || number < 0)) invalid("Số đo phải là số hữu hạn không âm hoặc để trống");
      return [field, number];
    }))];
  }));
  return { measuredDateKey, deviceLabel: string(value.deviceLabel, 120), referenceBasis: string(value.referenceBasis, 120, "unspecified") || "unspecified", note: string(value.note, 2000), segments };
};
export const normalizeBodyAssessmentCommand = (body, action) => {
  exact(body, action === "save" ? ["expectedRevision", "requestId", "draft", "reason"] : ["expectedRevision", "requestId", "confirmPartial", "reason"]);
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) invalid("expectedRevision không hợp lệ");
  if (typeof body.requestId !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(body.requestId)) invalid("requestId không hợp lệ");
  if (body.confirmPartial !== undefined && typeof body.confirmPartial !== "boolean") invalid("Xác nhận kết quả thiếu không hợp lệ");
  return { expectedRevision: body.expectedRevision, requestId: body.requestId, reason: string(body.reason, 1000), ...(action === "save" ? { draft: normalizeBodyAssessmentDraft(body.draft) } : { confirmPartial: body.confirmPartial === true }) };
};
export const assertBodyAssessmentPublish = (draft, confirmPartial) => {
  if (!draft?.measuredDateKey || !draft.deviceLabel) invalid("Cần ngày đo và thiết bị/nguồn đo trước khi gửi");
  const values = BODY_SEGMENTS.flatMap((key) => [draft.segments[key].leanKg, draft.segments[key].fatKg]);
  if (!values.some((value) => value !== null)) invalid("Cần ít nhất một giá trị khối lượng kg");
  if (values.some((value) => value === null) && !confirmPartial) throw assessmentError(400, "Hãy xác nhận gửi kết quả còn thiếu vùng đo", "BODY_ASSESSMENT_PARTIAL_CONFIRMATION_REQUIRED");
};
export const bodyAssessmentPagination = (query = {}) => {
  exact(query, ["page", "limit"]);
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) invalid("Phân trang không hợp lệ");
  return { page, limit };
};
export const assertBodyAssessmentDelete = (body) => {
  exact(body, ["confirmation"]);
  if (body.confirmation !== "DELETE_MY_BODY_ASSESSMENTS") invalid("Thiếu xác nhận xóa kết quả đo");
  return true;
};
