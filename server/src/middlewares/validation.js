import { body, param, validationResult } from "express-validator";
import mongoose from "mongoose";

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
  body("time")
    .optional()
    .isISO8601()
    .withMessage("time phải là định dạng ISO 8601")
    .custom(isValidDate)
    .withMessage("time không phải là thời gian hợp lệ"),
  body("muscle").notEmpty().withMessage("Vui lòng chọn nhóm cơ").isString(),
  body("note").optional().isString().withMessage("note phải là chuỗi"),
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
  body("muscle").optional().isString().withMessage("muscle phải là chuỗi"),
  body("note").optional().isString().withMessage("note phải là chuỗi"),
  handleValidationErrors,
];

export const validateGenerateOutcomeForecast = [
  param("id").isMongoId().withMessage("ID khách hàng F1 không hợp lệ"),
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
    .isInt({ min: 1 })
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
  body("sessions").optional().isInt({ min: 1 }),
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

export const validateCreateTrainer = [
  body("name").notEmpty().withMessage("Tên không được để trống"),
  body("email").notEmpty().withMessage("Email không được để trống").isEmail(),
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
// CONTACT & BOOKING VALIDATIONS
// ============================================================================

export const validateContactMessage = [
  body("name")
    .notEmpty()
    .withMessage("Họ tên không được để trống")
    .isLength({ min: 8 })
    .withMessage("Họ tên phải có ít nhất 8 ký tự")
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
    .isLength({ min: 8 })
    .withMessage("Họ tên phải có ít nhất 8 ký tự")
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
    .trim(),
  body("schedule")
    .notEmpty()
    .withMessage("Lịch tập không được để trống")
    .isString()
    .withMessage("Lịch tập không hợp lệ")
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
  body("gifts").optional().isArray().withMessage("Quà tặng phải là mảng"),
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

  handleValidationErrors,
];
