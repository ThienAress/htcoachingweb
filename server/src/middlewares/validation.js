import { body, param, query, validationResult } from "express-validator";
import mongoose from "mongoose";
import {
  TRAINER_BILLING_CYCLES,
  TRAINER_PLAN_CODES,
} from "../constants/trainerPlans.js";
import { parseDateKey } from "../utils/dateKey.js";

// ============================================================================
// MIDDLEWARE & CUSTOM VALIDATORS
// ============================================================================

// Middleware kiểm tra kết quả validation
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  return next();
};

// Custom validator: Kiểm tra ObjectId có thể null/undefined/rỗng
const nullableObjectId = (value) => {
  if (value === null || value === undefined || value === "") return true;
  return mongoose.Types.ObjectId.isValid(value);
};

// Custom validator cho thời gian: đảm bảo có thể parse thành Date hợp lệ
const isValidDate = (value) => {
  if (!value) return true; // cho phép optional
  const date = new Date(value);
  return !isNaN(date.getTime());
};

// ============================================================================
// COMMON VALIDATIONS
// ============================================================================

export const validateId = [
  param("id").isMongoId().withMessage("ID không hợp lệ"),
  handleValidationErrors,
];

export const validateRecipeId = [
  param("recipeId").isMongoId().withMessage("ID công thức không hợp lệ"),
  handleValidationErrors,
];

// ============================================================================
// F1 CUSTOMER VALIDATIONS
// ============================================================================

export const validateF1CustomerId = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),
  handleValidationErrors,
];

export const validateCreateF1Customer = [
  body("fullName")
    .notEmpty()
    .withMessage("Họ và tên không được để trống")
    .trim()
    .isLength({ min: 8, max: 20 })
    .withMessage("Họ và tên phải từ 8 đến 20 ký tự"),

  body("age")
    .notEmpty()
    .withMessage("Tuổi không được để trống")
    .isInt({ min: 1, max: 100 })
    .withMessage("Tuổi phải là số từ 1 đến 100"),

  body("gender")
    .notEmpty()
    .withMessage("Giới tính không được để trống")
    .isIn(["male", "female", "other"])
    .withMessage("Giới tính không hợp lệ"),

  body("occupation")
    .notEmpty()
    .withMessage("Nghề nghiệp không được để trống")
    .trim()
    .isLength({ max: 20 })
    .withMessage("Nghề nghiệp tối đa 20 ký tự"),

  body("phone")
    .notEmpty()
    .withMessage("Số điện thoại không được để trống")
    .matches(/^\d{10}$/)
    .withMessage("Số điện thoại phải đúng 10 chữ số"),

  body("email")
    .notEmpty()
    .withMessage("Gmail không được để trống")
    .trim()
    .toLowerCase()
    .matches(/^[a-zA-Z0-9._%+-]+@gmail\.com$/)
    .withMessage("Email phải có định dạng @gmail.com"),

  body("assignedTrainerId")
    .optional({ nullable: true })
    .custom(nullableObjectId)
    .withMessage("assignedTrainerId không hợp lệ"),

  body("source")
    .optional()
    .isIn(["manual", "booking", "referral", "walkin"])
    .withMessage("Nguồn khách không hợp lệ"),

  handleValidationErrors,
];

export const validateUpdateF1Customer = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),
  body("fullName").optional().isString().withMessage("Họ và tên không hợp lệ"),
  body("age")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Tuổi không hợp lệ"),
  body("gender")
    .optional()
    .isIn(["male", "female", "other"])
    .withMessage("Giới tính không hợp lệ"),
  body("occupation")
    .optional()
    .isString()
    .withMessage("Nghề nghiệp không hợp lệ"),
  body("phone").optional().isString().withMessage("Số điện thoại không hợp lệ"),
  body("email")
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage("Email không hợp lệ")
    .normalizeEmail(),
  body("assignedTrainerId")
    .optional({ nullable: true })
    .custom(nullableObjectId)
    .withMessage("assignedTrainerId không hợp lệ"),
  body("notesInternal")
    .optional()
    .isString()
    .withMessage("Ghi chú nội bộ không hợp lệ"),
  handleValidationErrors,
];

export const validateUpdateF1Status = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),
  body("status")
    .isIn([
      "new",
      "intake_in_progress",
      "intake_completed",
      "assessment_completed",
      "ai_report_generated",
      "program_started",
      "archived",
    ])
    .withMessage("Trạng thái không hợp lệ"),
  handleValidationErrors,
];

// ============================================================================
// INTAKE VALIDATIONS
// ============================================================================

export const validateSaveIntakeDraft = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),
  body("step").isInt({ min: 1, max: 6 }).withMessage("step phải từ 1 đến 6"),
  body("data").isObject().withMessage("data phải là object"),
  handleValidationErrors,
];

export const validateSubmitIntake = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),

  body("customerInfo.fullName")
    .trim()
    .notEmpty()
    .withMessage("Họ tên không được để trống"),

  body("customerInfo.age")
    .isInt({ min: 10, max: 100 })
    .withMessage("Tuổi không hợp lệ"),

  body("customerInfo.gender")
    .isIn(["male", "female", "other"])
    .withMessage("Giới tính không hợp lệ"),

  body("healthScreening.hasPainNow")
    .isBoolean()
    .withMessage("hasPainNow phải là boolean"),

  body("healthScreening.painLevel")
    .isInt({ min: 0, max: 10 })
    .withMessage("Mức độ đau không hợp lệ"),

  body("healthScreening.painLocation")
    .optional()
    .isArray()
    .withMessage("painLocation phải là mảng"),

  body("healthScreening.warningSigns")
    .optional()
    .isArray()
    .withMessage("warningSigns phải là mảng"),

  body("lifestyleNutrition.mealsPerDay")
    .isInt({ min: 1, max: 10 })
    .withMessage("Số bữa ăn không hợp lệ"),

  body("lifestyleNutrition.usuallyEatOut")
    .isBoolean()
    .withMessage("usuallyEatOut phải là boolean"),

  body("lifestyleNutrition.drinkEnoughWater")
    .isBoolean()
    .withMessage("drinkEnoughWater phải là boolean"),

  body("lifestyleNutrition.sleepHours")
    .isFloat({ min: 0, max: 24 })
    .withMessage("Số giờ ngủ không hợp lệ"),

  body("lifestyleNutrition.stressLevel")
    .isIn(["low", "medium", "high"])
    .withMessage("stressLevel không hợp lệ"),

  body("lifestyleNutrition.workActivityLevel")
    .isIn(["sedentary", "standing", "active", "heavy_labor"])
    .withMessage("workActivityLevel không hợp lệ"),

  body("bodyMetrics.heightCm")
    .isFloat({ min: 50, max: 250 })
    .withMessage("Chiều cao không hợp lệ"),

  body("bodyMetrics.weightKg")
    .isFloat({ min: 10, max: 300 })
    .withMessage("Cân nặng không hợp lệ"),

  body("bodyMetrics.bodyFatPercent")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 80) {
        throw new Error("Body fat không hợp lệ");
      }
      return true;
    }),

  body("bodyMetrics.waistCm")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 20 || parsed > 250) {
        throw new Error("Số đo eo không hợp lệ");
      }
      return true;
    }),

  body("bodyMetrics.hipCm")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 20 || parsed > 250) {
        throw new Error("Số đo hông không hợp lệ");
      }
      return true;
    }),

  body("bodyMetrics.restingHeartRate")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 20 || parsed > 220) {
        throw new Error("Nhịp tim nghỉ không hợp lệ");
      }
      return true;
    }),

  body("trainingProfileGoal.currentlyTraining")
    .isBoolean()
    .withMessage("currentlyTraining phải là boolean"),

  body("trainingProfileGoal.trainingDaysPerWeek").custom((value, { req }) => {
    const isTraining = Boolean(
      req.body?.trainingProfileGoal?.currentlyTraining,
    );
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 14) {
      throw new Error("Số ngày tập/tuần không hợp lệ");
    }

    if (isTraining && parsed <= 0) {
      throw new Error("Nếu khách đang tập thì số ngày tập/tuần phải lớn hơn 0");
    }

    return true;
  }),

  body("trainingProfileGoal.sessionDurationMinutes").custom(
    (value, { req }) => {
      const isTraining = Boolean(
        req.body?.trainingProfileGoal?.currentlyTraining,
      );
      const parsed = Number(value);

      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 600) {
        throw new Error("Thời lượng buổi tập không hợp lệ");
      }

      if (isTraining && parsed <= 0) {
        throw new Error(
          "Nếu khách đang tập thì thời lượng buổi tập phải lớn hơn 0",
        );
      }

      return true;
    },
  ),

  body("trainingProfileGoal.sportsHistory")
    .optional()
    .isArray()
    .withMessage("sportsHistory phải là mảng"),

  body("trainingProfileGoal.trainingExperience")
    .isIn(["none", "beginner", "intermediate", "advanced"])
    .withMessage("Kinh nghiệm tập luyện không hợp lệ"),

  body("trainingProfileGoal.breakDuration")
    .optional({ nullable: true })
    .isString()
    .withMessage("breakDuration không hợp lệ"),

  body("trainingProfileGoal.primaryGoal")
    .isIn(["fat_loss", "weight_gain", "muscle_gain", "maintenance"])
    .withMessage("Mục tiêu chính không hợp lệ"),

  body("trainingProfileGoal.targetWeightKg")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 10 || parsed > 300) {
        throw new Error("Cân nặng mong muốn không hợp lệ");
      }
      return true;
    }),

  body("trainingProfileGoal.targetDeadline")
    .optional({ nullable: true, checkFalsy: true })
    .custom(isValidDate)
    .withMessage("targetDeadline không hợp lệ"),

  body("consent.allowDataStorage")
    .isBoolean()
    .withMessage("allowDataStorage phải là boolean"),

  body("consent.allowMediaStorage")
    .isBoolean()
    .withMessage("allowMediaStorage phải là boolean"),

  body("consent.allowAiAnalysis")
    .isBoolean()
    .withMessage("allowAiAnalysis phải là boolean"),

  handleValidationErrors,
];
// ============================================================================
// MEDIA VALIDATIONS
// ============================================================================

export const validateCreateF1Media = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),

  body("intakeId")
    .optional({ nullable: true })
    .custom(nullableObjectId)
    .withMessage("intakeId không hợp lệ"),

  body("type")
    .isIn([
      "before_front",
      "before_back",
      "before_side",
      "posture_front",
      "posture_back",
      "posture_side",
    ])
    .withMessage("type media không hợp lệ"),

  handleValidationErrors,
];

export const validateDeleteF1Media = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),
  param("mediaId").isMongoId().withMessage("ID media không hợp lệ"),
  handleValidationErrors,
];

// ============================================================================
// ASSESSMENT & AI REPORT VALIDATIONS
// ============================================================================

export const validateCreateAssessment = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),

  body("postureAssessment")
    .optional()
    .isObject()
    .withMessage("postureAssessment phải là object"),

  body("movementAssessment")
    .optional()
    .isObject()
    .withMessage("movementAssessment phải là object"),

  body("strengthAssessment")
    .optional()
    .isObject()
    .withMessage("strengthAssessment phải là object"),

  body("enduranceAssessment")
    .optional()
    .isObject()
    .withMessage("enduranceAssessment phải là object"),

  body("cardioAssessment")
    .optional()
    .isObject()
    .withMessage("cardioAssessment phải là object"),

  body("overallPhysicalLevel")
    .optional()
    .isIn(["low", "below_average", "average", "good"])
    .withMessage("overallPhysicalLevel không hợp lệ"),

  body("overallPhysicalScore")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
        throw new Error("overallPhysicalScore phải từ 0 đến 10");
      }
      return true;
    }),

  body("assessorNotes")
    .optional()
    .isString()
    .withMessage("assessorNotes không hợp lệ"),

  handleValidationErrors,
];

export const validateUpdateAssessment = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),
  param("assessmentId").isMongoId().withMessage("assessmentId không hợp lệ"),

  body("postureAssessment")
    .optional()
    .isObject()
    .withMessage("postureAssessment phải là object"),

  body("movementAssessment")
    .optional()
    .isObject()
    .withMessage("movementAssessment phải là object"),

  body("strengthAssessment")
    .optional()
    .isObject()
    .withMessage("strengthAssessment phải là object"),

  body("enduranceAssessment")
    .optional()
    .isObject()
    .withMessage("enduranceAssessment phải là object"),

  body("cardioAssessment")
    .optional()
    .isObject()
    .withMessage("cardioAssessment phải là object"),

  body("overallPhysicalLevel")
    .optional()
    .isIn(["low", "below_average", "average", "good"])
    .withMessage("overallPhysicalLevel không hợp lệ"),

  body("assessorNotes")
    .optional()
    .isString()
    .withMessage("assessorNotes không hợp lệ"),

  body("overallPhysicalScore")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
        throw new Error("overallPhysicalScore phải từ 0 đến 10");
      }
      return true;
    }),

  handleValidationErrors,
];

export const validateGenerateAiReport = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),
  body("requestId")
    .isUUID(4)
    .withMessage("requestId phải là UUID v4"),
  body("regenerate")
    .optional()
    .isBoolean()
    .withMessage("regenerate phải là boolean"),
  handleValidationErrors,
];

export const validateApproveAiReport = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),
  param("reportId").isMongoId().withMessage("reportId không hợp lệ"),
  body("approvedByCoach")
    .isBoolean()
    .withMessage("approvedByCoach phải là boolean"),
  body("coachNote").optional().isString().withMessage("coachNote không hợp lệ"),
  handleValidationErrors,
];

// ============================================================================
// CHECKIN VALIDATIONS
// ============================================================================

export const validateCheckin = [
  body("orderId")
    .notEmpty()
    .withMessage("orderId là bắt buộc")
    .isMongoId()
    .withMessage("orderId không hợp lệ"),
  body("clientRequestId")
    .notEmpty()
    .withMessage("clientRequestId là bắt buộc")
    .isUUID(4)
    .withMessage("clientRequestId phải là UUID v4"),
  body("time")
    .optional()
    .isISO8601()
    .withMessage("time phải là định dạng ISO 8601")
    .custom(isValidDate)
    .withMessage("time không phải là thời gian hợp lệ"),
  body("muscle")
    .notEmpty()
    .withMessage("Vui lòng chọn nhóm cơ")
    .isString()
    .isLength({ max: 200 })
    .withMessage("muscle tối đa 200 ký tự"),
  body("note")
    .optional()
    .isString()
    .withMessage("note phải là chuỗi")
    .isLength({ max: 2000 })
    .withMessage("note tối đa 2000 ký tự"),
  handleValidationErrors,
];

export const validateUpdateCheckin = [
  param("id").isMongoId().withMessage("ID checkin không hợp lệ"),
  body("time")
    .optional()
    .isISO8601()
    .withMessage("time phải là định dạng ISO 8601")
    .custom(isValidDate)
    .withMessage("time không phải là thời gian hợp lệ"),
  body("muscle")
    .optional()
    .isString()
    .withMessage("muscle phải là chuỗi")
    .isLength({ max: 200 })
    .withMessage("muscle tối đa 200 ký tự"),
  body("note")
    .optional()
    .isString()
    .withMessage("note phải là chuỗi")
    .isLength({ max: 2000 })
    .withMessage("note tối đa 2000 ký tự"),
  handleValidationErrors,
];

export const validateGenerateOutcomeForecast = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),
  body("requestId")
    .isUUID(4)
    .withMessage("requestId phải là UUID v4"),
  body("regenerate")
    .optional()
    .isBoolean()
    .withMessage("regenerate phải là boolean"),
  handleValidationErrors,
];

// ============================================================================
// ORDER VALIDATIONS
// ============================================================================

export const validateCreateOrder = [
  (req, res, next) => {
    next();
  },
  body("name")
    .notEmpty()
    .withMessage("Tên không được để trống")
    .isString()
    .withMessage("Tên phải là chuỗi"),
  body("email")
    .notEmpty()
    .withMessage("Email không được để trống")
    .isEmail()
    .withMessage("Email không hợp lệ"),
  body("phone")
    .optional()
    .isMobilePhone("vi-VN")
    .withMessage("Số điện thoại không hợp lệ"),
  body("package")
    .notEmpty()
    .withMessage("Gói tập không được để trống")
    .isString(),
  body("sessions")
    .isInt({ min: 1, max: 10000 })
    .withMessage("Số buổi phải là số nguyên lớn hơn 0"),
  body("gym")
    .notEmpty()
    .withMessage("Phòng tập không được để trống")
    .isString(),
  body("schedule")
    .notEmpty()
    .withMessage("Lịch tập không được để trống")
    .isString(),
  body("note").optional().isString(),
  body("trainerId")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === "") return true;
      return mongoose.Types.ObjectId.isValid(value);
    })
    .withMessage("trainerId không hợp lệ"),
  handleValidationErrors,
];

export const validateUpdateOrder = [
  param("id").isMongoId().withMessage("ID đơn hàng không hợp lệ"),
  body("name").optional().isString(),
  body("email").optional().isEmail(),
  body("phone").optional().isString(),
  body("package").optional().isString(),
  body("sessions").optional().isInt({ min: 0, max: 10000 }),
  body("totalSessions").optional().isInt({ min: 1, max: 10000 }),
  body("status")
    .optional()
    .isIn(["pending", "approved", "completed", "cancelled"])
    .withMessage("Trạng thái đơn không hợp lệ"),
  body("gym").optional().isString(),
  body("schedule").optional().isString(),
  body("note").optional().isString(),
  body("trainerId")
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage("trainerId không hợp lệ"),
  handleValidationErrors,
];

// ============================================================================
// USER / TRAINER / AUTH VALIDATIONS
// ============================================================================

export const validateLogin = [
  body("email")
    .notEmpty()
    .withMessage("Email không được để trống")
    .isEmail()
    .withMessage("Email không hợp lệ"),
  body("password")
    .notEmpty()
    .withMessage("Mật khẩu không được để trống")
    .isLength({ min: 6 })
    .withMessage("Mật khẩu tối thiểu 6 ký tự"),
  handleValidationErrors,
];

export const validateDeleteUser = [
  param("id").isMongoId().withMessage("ID không hợp lệ"),
  handleValidationErrors,
];

// ============================================================================
// DAILY JOURNAL VALIDATIONS
// ============================================================================

const journalDate = () =>
  param("dateKey")
    .matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .withMessage("dateKey phải theo YYYY-MM-DD")
    .custom((value) => {
      parseDateKey(value);
      return true;
    })
    .withMessage("dateKey không tồn tại");

const journalCommandFields = () => [
  body("expectedRevision")
    .isInt({ min: 0 })
    .withMessage("expectedRevision phải là số nguyên không âm")
    .toInt(),
  body("requestId").isUUID().withMessage("requestId không hợp lệ"),
];

const journalPatchFields = () => [
  body("patch").isObject().withMessage("patch phải là object"),
  body("patch.wellness.sleepHours")
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 24 })
    .withMessage("sleepHours phải từ 0 đến 24")
    .toFloat(),
  body("patch.wellness.waterMl")
    .optional({ nullable: true })
    .isInt({ min: 0, max: 20000 })
    .withMessage("waterMl phải từ 0 đến 20000")
    .toInt(),
  body("patch.wellness.steps")
    .optional({ nullable: true })
    .isInt({ min: 0, max: 200000 })
    .withMessage("steps phải từ 0 đến 200000")
    .toInt(),
  ...["energy", "hunger", "stress", "soreness"].map((field) =>
    body("patch.wellness." + field)
      .optional({ nullable: true })
      .isInt({ min: 1, max: 10 })
      .withMessage(field + " phải từ 1 đến 10")
      .toInt(),
  ),
  body("patch.wellness.pain")
    .optional({ nullable: true })
    .isInt({ min: 0, max: 10 })
    .withMessage("pain phải từ 0 đến 10")
    .toInt(),
  body("patch.wellness.painArea")
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 120 })
    .withMessage("painArea tối đa 120 ký tự"),
  ...["private", "shared"].map((field) =>
    body("patch.notes." + field)
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 2000 })
      .withMessage("Ghi chú tối đa 2000 ký tự"),
  ),
  body("patch.nutrition")
    .optional()
    .isObject()
    .withMessage("nutrition phải là object"),
  body("patch.nutrition.assignment")
    .optional({ nullable: true })
    .isObject()
    .withMessage("nutrition.assignment phải là object hoặc null"),
  body("patch.nutrition.assignment.savedMealPlanId")
    .optional()
    .isMongoId()
    .withMessage("savedMealPlanId không hợp lệ"),
  body("patch.nutrition.entries")
    .optional()
    .isArray({ max: 10 })
    .withMessage("nutrition.entries có tối đa 10 phần tử"),
  body("patch.nutrition.entries.*.entryId")
    .isUUID(4)
    .withMessage("entryId phải là UUID v4"),
  body("patch.nutrition.entries.*.mode")
    .isIn(["follow_plan", "recipe", "manual"])
    .withMessage("Meal entry mode không hợp lệ"),
  body("patch.nutrition.entries.*.status")
    .isIn(["eaten", "changed", "skipped"])
    .withMessage("Meal entry status không hợp lệ"),
  body("patch.nutrition.entries.*.plannedMealKey")
    .optional()
    .isString()
    .isLength({ min: 1, max: 40 }),
  body("patch.nutrition.entries.*.recipeId")
    .optional()
    .isMongoId()
    .withMessage("recipeId không hợp lệ"),
  body("patch.nutrition.entries.*.description")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 240 }),
  body("patch.nutrition.entries.*.note")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 240 }),
  body("patch.habitCompletions")
    .optional()
    .isArray({ max: 20 })
    .withMessage("habitCompletions có tối đa 20 phần tử"),
  body("patch.habitCompletions.*.habitId")
    .isMongoId()
    .withMessage("habitId không hợp lệ"),
  body("patch.habitCompletions.*.status")
    .isIn(["completed", "skipped"])
    .withMessage("Habit completion status không hợp lệ"),
];

export const validateDailyJournalDate = [
  journalDate(),
  handleValidationErrors,
];

export const validateSaveDailyJournal = [
  journalDate(),
  ...journalCommandFields(),
  ...journalPatchFields(),
  handleValidationErrors,
];

export const validateSubmitDailyJournal = [
  journalDate(),
  ...journalCommandFields(),
  handleValidationErrors,
];

export const validateCorrectDailyJournal = [
  journalDate(),
  ...journalCommandFields(),
  ...journalPatchFields(),
  body("reason")
    .isString()
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage("Chỉnh sửa sau khi gửi cần lý do từ 3 đến 500 ký tự"),
  handleValidationErrors,
];

export const validateDailyJournalPagination = [
  journalDate(),
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
  handleValidationErrors,
];

export const validateDailyJournalExport = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  handleValidationErrors,
];

export const validateTrainerDailyJournalRead = [
  param("clientId").isMongoId().withMessage("clientId không hợp lệ"),
  journalDate(),
  handleValidationErrors,
];

export const validateDeleteDailyJournalData = [
  body("confirmation")
    .equals("DELETE_MY_DAILY_JOURNALS")
    .withMessage("Thiếu xác nhận xóa dữ liệu nhật ký"),
  handleValidationErrors,
];

// ============================================================================
// SAVED MEAL PLAN VALIDATIONS
// ============================================================================

const savedMealPlanContentFields = () => [
  body("title")
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("title phải có từ 1 đến 100 ký tự"),
  body("target")
    .optional({ nullable: true })
    .isObject()
    .withMessage("target phải là object"),
  body("target.label")
    .optional()
    .isString()
    .isLength({ max: 80 })
    .withMessage("target.label tối đa 80 ký tự"),
  body("target.protein").optional({ nullable: true }).isFloat({ min: 0, max: 1000 }).toFloat(),
  body("target.carb").optional({ nullable: true }).isFloat({ min: 0, max: 2000 }).toFloat(),
  body("target.fat").optional({ nullable: true }).isFloat({ min: 0, max: 1000 }).toFloat(),
  body("target.calories").optional({ nullable: true }).isFloat({ min: 0, max: 20000 }).toFloat(),
  body("meals")
    .isArray({ min: 1, max: 6 })
    .withMessage("meals cần từ 1 đến 6 bữa"),
  body("meals.*.key")
    .isString()
    .matches(/^[a-z0-9][a-z0-9_-]*$/i)
    .isLength({ min: 1, max: 40 })
    .withMessage("meal key không hợp lệ"),
  body("meals.*.name")
    .isString()
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage("meal name không hợp lệ"),
  body("meals.*.type")
    .isIn(["breakfast", "lunch", "dinner", "snack", "other"])
    .withMessage("meal type không hợp lệ"),
  body("meals.*.foods")
    .isArray({ min: 1, max: 8 })
    .withMessage("Mỗi bữa cần từ 1 đến 8 thực phẩm"),
  body("meals.*.foods.*.foodId")
    .isMongoId()
    .withMessage("foodId không hợp lệ"),
  body("meals.*.foods.*.amountGrams")
    .isFloat({ min: 1, max: 1000 })
    .withMessage("amountGrams phải từ 1 đến 1000")
    .toFloat(),
];

export const validateCreateSavedMealPlan = [
  body("requestId").isUUID().withMessage("requestId không hợp lệ"),
  ...savedMealPlanContentFields(),
  handleValidationErrors,
];

export const validateReviseSavedMealPlan = [
  param("id").isMongoId().withMessage("Saved Meal Plan ID không hợp lệ"),
  body("requestId").isUUID().withMessage("requestId không hợp lệ"),
  body("expectedVersion")
    .isInt({ min: 1 })
    .withMessage("expectedVersion không hợp lệ")
    .toInt(),
  ...savedMealPlanContentFields(),
  handleValidationErrors,
];

export const validateArchiveSavedMealPlan = [
  param("id").isMongoId().withMessage("Saved Meal Plan ID không hợp lệ"),
  body("requestId").isUUID().withMessage("requestId không hợp lệ"),
  body("expectedVersion")
    .isInt({ min: 1 })
    .withMessage("expectedVersion không hợp lệ")
    .toInt(),
  handleValidationErrors,
];

export const validateSavedMealPlanId = [
  param("id").isMongoId().withMessage("Saved Meal Plan ID không hợp lệ"),
  handleValidationErrors,
];

const savedMealPlanPagination = () => [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const validateSavedMealPlanList = [
  query("status")
    .optional()
    .isIn(["active", "archived", "all"])
    .withMessage("status không hợp lệ"),
  ...savedMealPlanPagination(),
  handleValidationErrors,
];

export const validateSavedMealPlanExport = [
  ...savedMealPlanPagination(),
  handleValidationErrors,
];

export const validateDeleteSavedMealPlans = [
  body("confirmation")
    .equals("DELETE_MY_SAVED_MEAL_PLANS")
    .withMessage("Thiếu xác nhận xóa Saved Meal Plans"),
  handleValidationErrors,
];

// ============================================================================
// COACHING HABIT VALIDATIONS
// ============================================================================

const coachingHabitFields = () => [
  body("title").isString().trim().isLength({ min: 1, max: 100 }),
  body("description").optional().isString().trim().isLength({ max: 500 }),
  body("category")
    .isIn(["nutrition", "movement", "recovery", "mindset", "other"])
    .withMessage("Habit category không hợp lệ"),
  body("schedule").isObject().withMessage("schedule phải là object"),
  body("schedule.daysOfWeek")
    .isArray({ min: 1, max: 7 })
    .withMessage("daysOfWeek cần từ 1 đến 7 ngày"),
  body("schedule.daysOfWeek.*")
    .isInt({ min: 0, max: 6 })
    .withMessage("daysOfWeek phải trong khoảng 0-6")
    .toInt(),
  body("schedule.startDateKey")
    .matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .withMessage("startDateKey phải theo YYYY-MM-DD"),
  body("schedule.endDateKey")
    .optional({ nullable: true })
    .matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .withMessage("endDateKey phải theo YYYY-MM-DD"),
  body("target")
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100000 })
    .toFloat(),
  body("unit").optional().isString().trim().isLength({ max: 40 }),
  body("visibility")
    .optional()
    .isIn(["private", "shared"])
    .withMessage("visibility không hợp lệ"),
];

export const validateCoachingHabitCreate = [
  body("requestId").isUUID(4).withMessage("requestId phải là UUID v4"),
  ...coachingHabitFields(),
  handleValidationErrors,
];

export const validateTrainerCoachingHabitCreate = [
  param("clientId").isMongoId().withMessage("clientId không hợp lệ"),
  ...validateCoachingHabitCreate,
];

export const validateCoachingHabitList = [
  query("dateKey")
    .matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .withMessage("dateKey phải theo YYYY-MM-DD"),
  handleValidationErrors,
];

export const validateTrainerCoachingHabitList = [
  param("clientId").isMongoId().withMessage("clientId không hợp lệ"),
  ...validateCoachingHabitList,
];

export const validateCoachingHabitUpdate = [
  param("id").isMongoId().withMessage("Habit ID không hợp lệ"),
  body("requestId").isUUID(4).withMessage("requestId phải là UUID v4"),
  body("expectedVersion").isInt({ min: 1 }).toInt(),
  ...coachingHabitFields(),
  handleValidationErrors,
];

export const validateCoachingHabitStatus = [
  param("id").isMongoId().withMessage("Habit ID không hợp lệ"),
  body("requestId").isUUID(4).withMessage("requestId phải là UUID v4"),
  body("expectedVersion").isInt({ min: 1 }).toInt(),
  body("status").isIn(["active", "paused", "archived"]),
  handleValidationErrors,
];

export const validateCoachingHabitExport = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  handleValidationErrors,
];

export const validateDeleteCoachingHabits = [
  body("confirmation")
    .equals("DELETE_MY_COACHING_HABITS")
    .withMessage("Thiếu xác nhận xóa Coaching Habits"),
  handleValidationErrors,
];

// ============================================================================
// WEEKLY CHECK-IN VALIDATIONS
// ============================================================================

const weeklyDateKey = () =>
  param("weekStartDateKey")
    .matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .custom((value) => {
      parseDateKey(value);
      return true;
    })
    .withMessage("weekStartDateKey không hợp lệ");

const exactWeeklyBody = (allowed) =>
  body().custom((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Request body không hợp lệ");
    }
    if (Object.keys(value).some((key) => !allowed.includes(key))) {
      throw new Error("Request chứa field không được phép");
    }
    return true;
  });

const weeklyCommandFields = () => [
  body("expectedRevision").isInt({ min: 0 }).toInt(),
  body("requestId").isUUID(4).withMessage("requestId phải là UUID v4"),
];

export const validateSaveWeeklyCheckin = [
  weeklyDateKey(),
  exactWeeklyBody(["expectedRevision", "requestId", "patch"]),
  ...weeklyCommandFields(),
  body("patch").isObject().withMessage("patch phải là object"),
  body("patch.body").isObject().withMessage("patch.body phải là object"),
  handleValidationErrors,
];

export const validateSubmitWeeklyCheckin = [
  weeklyDateKey(),
  exactWeeklyBody(["expectedRevision", "requestId"]),
  ...weeklyCommandFields(),
  handleValidationErrors,
];

export const validateWeeklyCheckinCorrection = [
  weeklyDateKey(),
  exactWeeklyBody(["expectedRevision", "requestId", "patch", "reason"]),
  ...weeklyCommandFields(),
  body("patch").isObject().withMessage("patch phải là object"),
  body("patch.body").isObject().withMessage("patch.body phải là object"),
  body("reason").isString().trim().isLength({ min: 3, max: 500 }),
  handleValidationErrors,
];

export const validateWeeklyCheckinReview = [
  param("clientId").isMongoId().withMessage("clientId không hợp lệ"),
  weeklyDateKey(),
  exactWeeklyBody(["expectedRevision", "requestId", "review"]),
  ...weeklyCommandFields(),
  body("review").isObject().withMessage("review phải là object"),
  body("review.message").isString().trim().isLength({ min: 1, max: 2000 }),
  body("review.rating").optional({ nullable: true }).isInt({ min: 1, max: 10 }).toInt(),
  handleValidationErrors,
];

export const validateWeeklyCheckinRead = [
  param("clientId").optional().isMongoId().withMessage("clientId không hợp lệ"),
  weeklyDateKey(),
  handleValidationErrors,
];

export const validateWeeklyCheckinRevisionList = [
  weeklyDateKey(),
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
  handleValidationErrors,
];

export const validateWeeklyCheckinExport = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  handleValidationErrors,
];

export const validateDeleteWeeklyCheckins = [
  exactWeeklyBody(["confirmation"]),
  body("confirmation")
    .equals("DELETE_MY_WEEKLY_CHECKINS")
    .withMessage("Thiếu xác nhận xóa Weekly Check-ins"),
  handleValidationErrors,
];

export const validateProgressRead = [
  query("days")
    .isInt()
    .toInt()
    .isIn([7, 30, 90])
    .withMessage("days chỉ hỗ trợ 7, 30 hoặc 90"),
  handleValidationErrors,
];

export const validateTrainerProgressRead = [
  param("clientId").isMongoId().withMessage("clientId không hợp lệ"),
  ...validateProgressRead,
];

export const validateTrainerOverview = [
  param("clientId").isMongoId().withMessage("clientId không hợp lệ"),
  query("dateKey")
    .matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .custom((value) => {
      parseDateKey(value);
      return true;
    })
    .withMessage("dateKey không hợp lệ"),
  query("days")
    .isInt()
    .toInt()
    .isIn([7, 30, 90])
    .withMessage("days chỉ hỗ trợ 7, 30 hoặc 90"),
  handleValidationErrors,
];

// ============================================================================
// COACHING COMMENT VALIDATIONS
// ============================================================================

const commentTargetType = (location = "body") =>
  (location === "body" ? body("targetType") : param("targetType"))
    .isIn([
      "daily_journal",
      "weekly_checkin",
      "coaching_day",
      "workout_plan",
    ])
    .withMessage("targetType không hợp lệ");

const exactCommentBody = (allowed) =>
  body().custom((value) => {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key))
    ) {
      throw new Error("Request chứa field không được phép");
    }
    return true;
  });

export const validateCoachingCommentCreate = [
  exactCommentBody(["targetType", "targetId", "requestId", "body"]),
  commentTargetType(),
  body("targetId").isMongoId().withMessage("targetId không hợp lệ"),
  body("requestId").isUUID(4).withMessage("requestId phải là UUID v4"),
  body("body").isString().trim().isLength({ min: 1, max: 2000 }),
  handleValidationErrors,
];

export const validateCoachingCommentList = [
  commentTargetType("param"),
  param("targetId").isMongoId().withMessage("targetId không hợp lệ"),
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
  handleValidationErrors,
];

export const validateCoachingCommentEdit = [
  param("commentId").isMongoId().withMessage("commentId không hợp lệ"),
  exactCommentBody(["expectedRevision", "requestId", "body"]),
  body("expectedRevision").isInt({ min: 1 }).toInt(),
  body("requestId").isUUID(4).withMessage("requestId phải là UUID v4"),
  body("body").isString().trim().isLength({ min: 1, max: 2000 }),
  handleValidationErrors,
];

export const validateCoachingCommentRemove = [
  param("commentId").isMongoId().withMessage("commentId không hợp lệ"),
  exactCommentBody(["expectedRevision", "requestId"]),
  body("expectedRevision").isInt({ min: 1 }).toInt(),
  body("requestId").isUUID(4).withMessage("requestId phải là UUID v4"),
  handleValidationErrors,
];

export const validateCoachingCommentExport = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  handleValidationErrors,
];

export const validateDeleteCoachingComments = [
  exactCommentBody(["confirmation"]),
  body("confirmation")
    .equals("DELETE_MY_COACHING_COMMENTS")
    .withMessage("Thiếu xác nhận xóa Coaching Comments"),
  handleValidationErrors,
];

// ============================================================================
// IN-APP NOTIFICATION VALIDATIONS
// ============================================================================

export const validateNotificationList = [
  query("status").optional().isIn(["all", "unread"]),
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
  handleValidationErrors,
];

export const validateNotificationRead = [
  param("notificationId")
    .isMongoId()
    .withMessage("notificationId không hợp lệ"),
  handleValidationErrors,
];

export const validateNotificationPreference = [
  body().custom((value) => {
    const allowed = [
      "expectedRevision",
      "inAppEnabled",
      "comments",
      "journal",
      "weekly",
    ];
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key))
    ) {
      throw new Error("Request chứa field không được phép");
    }
    return true;
  }),
  body("expectedRevision").isInt({ min: 0 }).toInt(),
  body("inAppEnabled").isBoolean().toBoolean(),
  body("comments").isBoolean().toBoolean(),
  body("journal").isBoolean().toBoolean(),
  body("weekly").isBoolean().toBoolean(),
  handleValidationErrors,
];

export const validateTrainerClientOverview = validateTrainerOverview;

export const validateCoachingActivityRead = [
  query("days")
    .isInt()
    .toInt()
    .isIn([7, 30, 90])
    .withMessage("days chỉ hỗ trợ 7, 30 hoặc 90"),
  handleValidationErrors,
];

export const validateCoachingActivityExport = [
  ...validateCoachingActivityRead.slice(0, -1),
  query("format").isIn(["json", "csv"]).withMessage("format không hợp lệ"),
  handleValidationErrors,
];

// ============================================================================
// CONTACT & BOOKING VALIDATIONS
// ============================================================================

export const validateContactMessage = [
  body("name")
    .notEmpty()
    .withMessage("Họ tên không được để trống")
    .isLength({ min: 8, max: 100 })
    .withMessage("Họ tên phải có từ 8 đến 100 ký tự")
    .trim(),
  body("email")
    .notEmpty()
    .withMessage("Email không được để trống")
    .isEmail()
    .withMessage("Email không hợp lệ")
    .normalizeEmail(),
  body("phone")
    .notEmpty()
    .withMessage("Số điện thoại không được để trống")
    .isMobilePhone("vi-VN")
    .withMessage("Số điện thoại không hợp lệ (phải 10 số)"),
  body("social")
    .notEmpty()
    .withMessage("Vui lòng nhập Facebook/Zalo")
    .isURL({
      protocols: ["https"],
      require_protocol: true,
    })
    .withMessage("Link không hợp lệ, phải bắt đầu bằng https://")
    .isLength({ max: 200 })
    .withMessage("Link quá dài (tối đa 200 ký tự)"),
  body("package")
    .notEmpty()
    .withMessage("Vui lòng chọn gói tập")
    .isIn(["ONLINE", "1-1", "TRIAL"])
    .withMessage("Gói tập không hợp lệ"),
  handleValidationErrors,
];

export const validateCreateBooking = [
  body("name")
    .notEmpty()
    .withMessage("Họ tên không được để trống")
    .isLength({ min: 8, max: 100 })
    .withMessage("Họ tên phải có từ 8 đến 100 ký tự")
    .trim()
    .escape(),
  body("phone")
    .notEmpty()
    .withMessage("Số điện thoại không được để trống")
    .matches(/^[0-9]{10}$/)
    .withMessage("Số điện thoại phải đúng 10 chữ số"),
  body("email")
    .notEmpty()
    .withMessage("Email không được để trống")
    .isEmail()
    .withMessage("Email không hợp lệ")
    .normalizeEmail()
    .matches(/@gmail\.com$/)
    .withMessage("Email phải là @gmail.com"),
  body("gym")
    .notEmpty()
    .withMessage("Phòng tập không được để trống")
    .isString()
    .withMessage("Phòng tập không hợp lệ")
    .isLength({ max: 120 })
    .withMessage("Phòng tập tối đa 120 ký tự")
    .trim(),
  body("schedule")
    .notEmpty()
    .withMessage("Lịch tập không được để trống")
    .isString()
    .withMessage("Lịch tập không hợp lệ")
    .isLength({ max: 500 })
    .withMessage("Lịch tập tối đa 500 ký tự")
    .trim(),
  body("note")
    .optional()
    .isString()
    .withMessage("Ghi chú phải là chuỗi")
    .isLength({ max: 500 })
    .withMessage("Ghi chú tối đa 500 ký tự")
    .trim()
    .escape(),
  body("package")
    .notEmpty()
    .withMessage("Gói tập không được để trống")
    .isString()
    .withMessage("Gói tập không hợp lệ")
    .isLength({ max: 150 })
    .withMessage("Gói tập tối đa 150 ký tự")
    .trim(),
  body("sessions")
    .notEmpty()
    .withMessage("Số buổi không được để trống")
    .isInt({ min: 1, max: 100 })
    .withMessage("Số buổi không hợp lệ"),
  body("discountCode")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("Mã giảm giá không hợp lệ")
    .isLength({ max: 20 }),
  body("gifts")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Quà tặng phải là mảng tối đa 10 phần tử"),
  body("gifts.*")
    .optional()
    .isString()
    .withMessage("Quà tặng phải là chuỗi")
    .isLength({ max: 100 })
    .withMessage("Tên quà tặng tối đa 100 ký tự"),
  body("clientRequestId")
    .isUUID()
    .withMessage("clientRequestId không hợp lệ"),
  handleValidationErrors,
];

// ============================================================================
// FOOD VALIDATIONS
// ============================================================================

export const validateFood = [
  body("label").notEmpty().withMessage("Tên thực phẩm không được trống"),
  body("protein").isFloat({ min: 0 }).withMessage("Protein phải >=0"),
  body("carb").isFloat({ min: 0 }).withMessage("Carb phải >=0"),
  body("fat").isFloat({ min: 0 }).withMessage("Fat phải >=0"),
  body("calories")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Calories phải >=0"),
  handleValidationErrors,
];

export const validateReviewTestPermission = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),

  body("decision")
    .isIn(["keep_hold", "approve_modified_test", "approve_full_test"])
    .withMessage("Quyết định review không hợp lệ"),

  body("reviewNote")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("reviewNote không hợp lệ"),

  handleValidationErrors,
];

export const validateGenerateResultPrediction = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),
  body("requestId")
    .isUUID(4)
    .withMessage("requestId phải là UUID v4"),
  body("regenerate")
    .optional()
    .isBoolean()
    .withMessage("regenerate phải là boolean"),
  handleValidationErrors,
];

export const validateGenerateResultPredictionStageImages = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),

  param("predictionId").isMongoId().withMessage("predictionId không hợp lệ"),

  param("phaseKey")
    .isIn(["phase_1", "phase_2", "phase_3", "phase_4", "phase_5"])
    .withMessage("phaseKey không hợp lệ"),

  body("forceRegenerate")
    .optional()
    .isBoolean()
    .withMessage("forceRegenerate phải là boolean"),

  body("requestId")
    .isUUID(4)
    .withMessage("requestId phải là UUID v4"),

  handleValidationErrors,
];

// ============================================================================
// CONTRACT VALIDATIONS
// ============================================================================

export const validateCreateContract = [
  body("orderId")
    .notEmpty()
    .withMessage("orderId là bắt buộc")
    .isMongoId()
    .withMessage("orderId không hợp lệ"),
  handleValidationErrors,
];

export const validateSignContract = [
  param("id").isMongoId().withMessage("ID hợp đồng không hợp lệ"),
  body("signatureImage")
    .notEmpty()
    .withMessage("Chữ ký không được để trống")
    .isString()
    .withMessage("Chữ ký phải là chuỗi base64"),
  handleValidationErrors,
];

export const validateUpdateContract = [
  param("id").isMongoId().withMessage("ID hợp đồng không hợp lệ"),
  body("trainerInfo").optional().isObject().withMessage("trainerInfo phải là object"),
  body("trainerInfo.name").optional().isString().withMessage("Tên HLV không hợp lệ"),
  body("trainerInfo.birthYear").optional().isString().withMessage("Năm sinh không hợp lệ"),
  body("trainerInfo.address").optional().isString().withMessage("Địa chỉ không hợp lệ"),
  body("trainerInfo.phone").optional().isString().withMessage("SĐT HLV không hợp lệ"),
  body("trainerInfo.email").optional().isString().withMessage("Email HLV không hợp lệ"),
  body("clientInfo").optional().isObject().withMessage("clientInfo phải là object"),
  body("clientInfo.name").optional().isString().withMessage("Tên không hợp lệ"),
  body("clientInfo.phone").optional().isString().withMessage("SĐT không hợp lệ"),
  body("clientInfo.email").optional().isString().withMessage("Email không hợp lệ"),
  body("packageDetails").optional().isObject().withMessage("packageDetails phải là object"),
  body("packageDetails.sessions")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Số buổi phải lớn hơn 0"),
  body("packageDetails.pricePerSession")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Giá mỗi buổi phải >= 0"),
  body("packageDetails.totalAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Tổng tiền phải >= 0"),
  handleValidationErrors,
];

// ============================================================================
// TRAINER SUBSCRIPTION VALIDATIONS
// ============================================================================

export const validateTrainerPlanPurchase = [
  body().custom((value) => {
    if (!value?.planCode && !value?.planTitle) {
      throw new Error("planCode hoặc planTitle là bắt buộc");
    }
    return true;
  }),
  body("planCode").optional().isIn(TRAINER_PLAN_CODES)
    .withMessage("planCode không hợp lệ"),
  body("planTitle").optional().isString().isLength({ min: 1, max: 60 })
    .withMessage("planTitle không hợp lệ"),
  body("billingCycle").isIn(TRAINER_BILLING_CYCLES)
    .withMessage("billingCycle không hợp lệ"),
  body("requestId").isUUID().withMessage("requestId không hợp lệ"),
  body("expectedAmount")
    .custom(
      (value) => Number.isSafeInteger(value) && value >= 0,
    )
    .withMessage("expectedAmount không hợp lệ"),
  body("catalogFingerprint")
    .isString()
    .matches(/^[a-f0-9]{64}$/)
    .withMessage("catalogFingerprint không hợp lệ"),
  body("protocolVersion")
    .custom((value) => value === 1)
    .withMessage("protocolVersion không hợp lệ"),
  handleValidationErrors,
];

export const validateTrainerPlanGrant = [
  body("email").isString().trim().isLength({ min: 3, max: 320 }).isEmail()
    .withMessage("Email không hợp lệ"),
  body("planCode")
    .isIn(TRAINER_PLAN_CODES)
    .withMessage("planCode không hợp lệ"),
  body("billingCycle")
    .isIn(TRAINER_BILLING_CYCLES)
    .withMessage("billingCycle không hợp lệ"),
  handleValidationErrors,
];

const exactWellnessTargetBody = (allowed) =>
  body().custom((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Request body không hợp lệ");
    }
    if (Object.keys(value).some((key) => !allowed.includes(key))) {
      throw new Error("Request chứa field không được phép");
    }
    return true;
  });

const exactWellnessTargets = body("targets").custom((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("targets phải là object");
  }
  const allowed = ["sleepHours", "waterMl", "steps"];
  if (
    Object.keys(value).length !== allowed.length ||
    Object.keys(value).some((key) => !allowed.includes(key))
  ) {
    throw new Error("targets phải có đúng sleepHours, waterMl và steps");
  }
  return true;
});

export const validateWellnessTargetOwnRead = [
  query("dateKey")
    .isString()
    .custom((value) => {
      parseDateKey(value);
      return true;
    })
    .withMessage("dateKey không hợp lệ"),
  handleValidationErrors,
];

export const validateWellnessTargetClient = [
  param("clientId").isMongoId().withMessage("clientId không hợp lệ"),
  handleValidationErrors,
];

export const validateWellnessTargetWrite = [
  param("clientId").isMongoId().withMessage("clientId không hợp lệ"),
  exactWellnessTargetBody([
    "expectedVersion",
    "requestId",
    "targets",
    "note",
  ]),
  body("expectedVersion").isInt({ min: 0 }).toInt(),
  body("requestId").isUUID(4).withMessage("requestId phải là UUID v4"),
  exactWellnessTargets,
  body("targets.sleepHours").isFloat({ min: 1, max: 24 }).toFloat(),
  body("targets.waterMl").isInt({ min: 250, max: 20000 }).toInt(),
  body("targets.steps").isInt({ min: 100, max: 200000 }).toInt(),
  body("note").optional().isString().trim().isLength({ max: 500 }),
  handleValidationErrors,
];

export const validateWellnessTargetExport = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  handleValidationErrors,
];

export const validateDeleteWellnessTargets = [
  exactWellnessTargetBody(["confirmation"]),
  body("confirmation")
    .equals("DELETE_MY_WELLNESS_TARGETS")
    .withMessage("Thiếu xác nhận xóa Wellness Targets"),
  handleValidationErrors,
];
