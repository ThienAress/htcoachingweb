import mongoose from "mongoose";
import {
  EQUIPMENT,
  EXPERIENCE_LEVELS,
  GENDERS,
  GOALS,
  SELF_ASSESSMENT_STATUSES,
  STRESS_LEVELS,
  TEST_PERMISSIONS,
  WARNING_SIGNS,
  WORK_ACTIVITY_LEVELS,
} from "../services/fitnessSelfAssessment/constants.js";
import { PAIN_AREAS } from "../services/fitnessSelfAssessment/recommendationContent.js";

const reasonSchema = new mongoose.Schema(
  {
    field: { type: String, default: "", trim: true },
    label: { type: String, default: "", trim: true },
    value: { type: String, default: "", trim: true },
    values: { type: [String], default: [] },
  },
  { _id: false },
);

const text = (maxlength) => ({ type: String, default: "", trim: true, maxlength });
const nullableNumber = () => ({ type: Number, default: null });

// Đánh giá bản thân của HT Fitness+ (không có HLV). Cờ an toàn và kết quả do server tính; client không gửi.
const fitnessSelfAssessmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: SELF_ASSESSMENT_STATUSES, default: "draft" },
    draftStep: { type: Number, default: 1, min: 1, max: 4 },
    // Thời điểm khách gửi phần sàng lọc; nộp bài bắt buộc phải có (không thể bỏ qua cổng an toàn bằng gọi API trực tiếp).
    screeningAnsweredAt: { type: Date, default: null },
    screening: {
      hasPainNow: { type: Boolean, default: false },
      painLocation: { type: [{ type: String, enum: PAIN_AREAS }], default: [] },
      painLevel: { type: Number, default: 0, min: 0, max: 10 },
      injuries: text(500),
      currentConditions: text(500),
      surgeries: text(500),
      medications: text(500),
      doctorRestrictions: text(500),
      warningSigns: { type: [{ type: String, enum: WARNING_SIGNS }], default: [] },
    },
    profile: {
      age: nullableNumber(),
      gender: { type: String, enum: [...GENDERS, ""], default: "" },
      heightCm: nullableNumber(),
      weightKg: nullableNumber(),
      waistCm: nullableNumber(),
      hipCm: nullableNumber(),
      restingHeartRate: nullableNumber(),
      sleepHours: nullableNumber(),
      stressLevel: { type: String, enum: [...STRESS_LEVELS, ""], default: "" },
      workActivityLevel: { type: String, enum: [...WORK_ACTIVITY_LEVELS, ""], default: "" },
    },
    training: {
      currentlyTraining: { type: Boolean, default: false },
      trainingExperience: { type: String, enum: [...EXPERIENCE_LEVELS, ""], default: "" },
      trainingDaysPerWeek: nullableNumber(),
      sessionDurationMinutes: nullableNumber(),
      breakDuration: text(60),
      primaryGoal: { type: String, enum: [...GOALS, ""], default: "" },
      targetWeightKg: nullableNumber(),
      equipment: { type: String, enum: [...EQUIPMENT, ""], default: "" },
    },
    tests: {
      upperBodyPush: { variant: text(20), reps: nullableNumber() },
      lowerBody: { variant: text(20), reps: nullableNumber() },
      coreEndurance: { variant: text(20), seconds: nullableNumber() },
      cardio: { variant: text(20), minutes: nullableNumber(), endHeartRate: nullableNumber() },
    },
    systemFlags: {
      painFlag: { type: String, enum: ["none", "mild", "moderate", "severe"], default: "none" },
      medicalReviewFlag: { type: Boolean, default: false },
      testPermission: { type: String, enum: TEST_PERMISSIONS, default: "full_test" },
      recommendedStartPhase: { type: String, enum: ["phase_1", "pending_review"], default: "phase_1" },
      holdReasons: { type: [reasonSchema], default: [] },
      cautionReasons: { type: [reasonSchema], default: [] },
    },
    consent: {
      allowDataStorage: { type: Boolean, default: false },
      collectedAt: { type: Date, default: null },
    },
    result: {
      version: text(40),
      scoring: { type: mongoose.Schema.Types.Mixed, default: null },
      recommendation: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    completedAt: { type: Date, default: null },
    nextEligibleAt: { type: Date, default: null },
  },
  // optimisticConcurrency: lưu nháp và nộp bài chạy xen nhau thì một bên bị VersionError thay vì ghi đè bản đã hoàn tất.
  { timestamps: true, optimisticConcurrency: true },
);

fitnessSelfAssessmentSchema.index(
  { userId: 1, status: 1, createdAt: -1 },
  { name: "fitness_self_assessment_user_status" },
);
// Mỗi người chỉ có một bản nháp đang mở.
fitnessSelfAssessmentSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "draft" }, name: "fitness_self_assessment_draft_unique" },
);

export default mongoose.model("FitnessSelfAssessment", fitnessSelfAssessmentSchema);
