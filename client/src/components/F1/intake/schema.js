import { z } from "zod";

const normalizeOptionalText = (val) => {
  const normalized = String(val || "").trim();
  const negativeWords = ["không", "khong", "none", "no", "không có"];
  return negativeWords.includes(normalized.toLowerCase()) ? "" : normalized;
};

export const customerInfoSchema = z.object({
  fullName: z.string().trim().min(1, "Vui lòng nhập họ và tên"),
  age: z.coerce.number().min(1, "Vui lòng nhập tuổi").max(100, "Tuổi không hợp lệ"),
  gender: z.enum(["male", "female", "other"], {
    errorMap: () => ({ message: "Vui lòng chọn giới tính" }),
  }),
  occupation: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
});

export const healthScreeningSchema = z.object({
  hasPainNow: z.boolean(),
  painLocation: z.string().optional(),
  painLevel: z.coerce.number().min(0).max(10).optional(),
  injuries: z.string().optional(),
  currentConditions: z.string().optional(),
  surgeries: z.string().optional(),
  medications: z.string().optional(),
  doctorRestrictions: z.string().optional(),
  warningSigns: z.array(z.string()).optional().default([]),
});

export const lifestyleNutritionSchema = z.object({
  mealsPerDay: z.coerce.number().min(1).max(10).optional().or(z.literal("").transform(() => undefined)),
  usuallyEatOut: z.boolean(),
  foodAllergies: z.string().optional(),
  drinkEnoughWater: z.boolean(),
  sleepHours: z.coerce.number().min(0).max(24).optional().or(z.literal("").transform(() => undefined)),
  stressLevel: z.string().optional(),
  workActivityLevel: z.string().optional(),
});

export const bodyMetricsSchema = z.object({
  heightCm: z.coerce.number().min(50).max(250, "Chiều cao không hợp lệ").optional().or(z.literal("").transform(() => undefined)),
  weightKg: z.coerce.number().min(10).max(300, "Cân nặng không hợp lệ").optional().or(z.literal("").transform(() => undefined)),
  bodyFatPercent: z.coerce.number().min(0).max(80).optional().or(z.literal("").transform(() => undefined)),
  waistCm: z.coerce.number().min(20).max(250).optional().or(z.literal("").transform(() => undefined)),
  hipCm: z.coerce.number().min(20).max(250).optional().or(z.literal("").transform(() => undefined)),
  restingHeartRate: z.coerce.number().min(20).max(220).optional().or(z.literal("").transform(() => undefined)),
});

export const trainingGoalSchema = z.object({
  currentlyTraining: z.boolean(),
  trainingDaysPerWeek: z.coerce.number().optional().or(z.literal("").transform(() => undefined)),
  sessionDurationMinutes: z.coerce.number().optional().or(z.literal("").transform(() => undefined)),
  sportsHistory: z.string().optional(),
  trainingExperience: z.string().min(1, "Vui lòng chọn kinh nghiệm tập luyện"),
  breakDuration: z.string().optional(),
  primaryGoal: z.string().min(1, "Vui lòng chọn mục tiêu chính"),
  targetWeightKg: z.coerce.number().optional().or(z.literal("").transform(() => undefined)),
  targetDeadline: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.currentlyTraining) {
    if (!data.trainingDaysPerWeek || data.trainingDaysPerWeek <= 0 || data.trainingDaysPerWeek > 14) {
      ctx.addIssue({
        path: ["trainingDaysPerWeek"],
        message: "Nếu đang tập, số ngày tập phải từ 1 đến 14",
        code: z.ZodIssueCode.custom,
      });
    }
    if (!data.sessionDurationMinutes || data.sessionDurationMinutes <= 0 || data.sessionDurationMinutes > 600) {
      ctx.addIssue({
        path: ["sessionDurationMinutes"],
        message: "Thời lượng buổi tập phải từ 1 đến 600 phút",
        code: z.ZodIssueCode.custom,
      });
    }
  } else {
    if (data.trainingExperience !== "none" && !data.breakDuration) {
      ctx.addIssue({
        path: ["breakDuration"],
        message: "Vui lòng nhập khách đã nghỉ tập bao lâu",
        code: z.ZodIssueCode.custom,
      });
    }
  }

  if (data.targetWeightKg !== undefined && data.targetWeightKg !== null) {
    if (data.targetWeightKg < 10 || data.targetWeightKg > 300) {
      ctx.addIssue({
        path: ["targetWeightKg"],
        message: "Cân nặng mong muốn không hợp lệ",
        code: z.ZodIssueCode.custom,
      });
    }
  }

  if (data.targetDeadline) {
    const date = new Date(data.targetDeadline);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({
        path: ["targetDeadline"],
        message: "Thời gian mong muốn không hợp lệ",
        code: z.ZodIssueCode.custom,
      });
    }
  }
});

export const postureMediaSchema = z.object({
  frontImage: z.any().optional(),
  backImage: z.any().optional(),
  sideImage: z.any().optional(),
});

export const consentSchema = z.object({
  allowDataStorage: z.boolean().refine(val => val === true, "Vui lòng đồng ý lưu dữ liệu"),
  allowMediaStorage: z.boolean(),
  allowAiAnalysis: z.boolean().refine(val => val === true, "Vui lòng đồng ý để AI hỗ trợ phân tích"),
});

export const intakeSchema = z.object({
  customerInfo: customerInfoSchema,
  healthScreening: healthScreeningSchema,
  lifestyleNutrition: lifestyleNutritionSchema,
  bodyMetrics: bodyMetricsSchema,
  trainingProfileGoal: trainingGoalSchema,
  postureMedia: postureMediaSchema,
  consent: consentSchema,
});
