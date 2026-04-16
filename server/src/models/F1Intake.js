import mongoose from "mongoose";

const reasonItemSchema = new mongoose.Schema(
  {
    field: { type: String, default: "", trim: true },
    label: { type: String, default: "", trim: true },
    value: { type: String, default: "", trim: true },
    values: { type: [String], default: [] },
  },
  { _id: false },
);

const f1IntakeSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1Customer",
      required: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    isLatest: {
      type: Boolean,
      default: true,
    },
    draftStep: {
      type: Number,
      default: 1,
      min: 1,
      max: 6,
    },
    isDraft: {
      type: Boolean,
      default: true,
    },
    customerInfo: {
      fullName: { type: String, default: "", trim: true },
      age: { type: Number, default: null },
      gender: {
        type: String,
        enum: ["male", "female", "other", ""],
        default: "",
      },
      occupation: { type: String, default: "", trim: true },
      phone: { type: String, default: "", trim: true },
      email: { type: String, default: "", trim: true, lowercase: true },
    },
    healthScreening: {
      hasPainNow: { type: Boolean, default: false },
      painLocation: { type: [String], default: [] },
      painLevel: { type: Number, default: 0, min: 0, max: 10 },
      injuries: { type: String, default: "", trim: true },
      currentConditions: { type: String, default: "", trim: true },
      surgeries: { type: String, default: "", trim: true },
      medications: { type: String, default: "", trim: true },
      doctorRestrictions: { type: String, default: "", trim: true },
      warningSigns: { type: [String], default: [] },
    },
    lifestyleNutrition: {
      mealsPerDay: { type: Number, default: null, min: 1, max: 10 },
      usuallyEatOut: { type: Boolean, default: false },
      foodAllergies: { type: String, default: "", trim: true },
      drinkEnoughWater: { type: Boolean, default: false },
      sleepHours: { type: Number, default: null, min: 0, max: 24 },
      stressLevel: {
        type: String,
        enum: ["low", "medium", "high", ""],
        default: "",
      },
      workActivityLevel: {
        type: String,
        enum: ["sedentary", "standing", "active", "heavy_labor", ""],
        default: "",
      },
    },
    bodyMetrics: {
      heightCm: { type: Number, default: null, min: 50, max: 250 },
      weightKg: { type: Number, default: null, min: 10, max: 300 },
      bodyFatPercent: { type: Number, default: null, min: 0, max: 80 },
      waistCm: { type: Number, default: null, min: 20, max: 250 },
      hipCm: { type: Number, default: null, min: 20, max: 250 },
      restingHeartRate: { type: Number, default: null, min: 20, max: 220 },
      bmi: { type: Number, default: null },
      waistHipRatio: { type: Number, default: null },
    },
    trainingProfileGoal: {
      currentlyTraining: { type: Boolean, default: false },
      trainingDaysPerWeek: { type: Number, default: null, min: 0, max: 14 },
      sessionDurationMinutes: { type: Number, default: null, min: 0, max: 600 },
      sportsHistory: { type: [String], default: [] },
      trainingExperience: {
        type: String,
        enum: ["none", "beginner", "intermediate", "advanced", ""],
        default: "",
      },
      breakDuration: { type: String, default: "", trim: true },
      primaryGoal: {
        type: String,
        enum: ["fat_loss", "weight_gain", "muscle_gain", "maintenance", ""],
        default: "",
      },
      targetWeightKg: { type: Number, default: null, min: 10, max: 300 },
      targetDeadline: { type: Date, default: null },
    },
    postureMediaSummary: {
      frontImageUploaded: { type: Boolean, default: false },
      backImageUploaded: { type: Boolean, default: false },
      sideImageUploaded: { type: Boolean, default: false },
    },
    consent: {
      allowDataStorage: { type: Boolean, default: false },
      allowMediaStorage: { type: Boolean, default: false },
      allowAiAnalysis: { type: Boolean, default: false },
    },
    systemFlags: {
      painFlag: {
        type: String,
        enum: ["none", "mild", "moderate", "severe"],
        default: "none",
      },
      medicalReviewFlag: { type: Boolean, default: false },
      testPermission: {
        type: String,
        enum: ["full_test", "modified_test", "hold_test"],
        default: "full_test",
      },
      recommendedStartPhase: {
        type: String,
        enum: ["phase_1", "pending_review"],
        default: "phase_1",
      },
      reviewDecision: {
        type: String,
        enum: ["keep_hold", "approve_modified_test", "approve_full_test", ""],
        default: "",
      },
      reviewNote: {
        type: String,
        default: "",
        trim: true,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      holdReasons: { type: [reasonItemSchema], default: [] },
      cautionReasons: { type: [reasonItemSchema], default: [] },
    },
    submittedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

f1IntakeSchema.index({ customerId: 1, version: -1 });
f1IntakeSchema.index({ customerId: 1, isLatest: 1 });
f1IntakeSchema.index({ customerId: 1, isDraft: 1 });
f1IntakeSchema.index({ "systemFlags.testPermission": 1 });
f1IntakeSchema.index({ "trainingProfileGoal.primaryGoal": 1 });

export default mongoose.model("F1Intake", f1IntakeSchema);
