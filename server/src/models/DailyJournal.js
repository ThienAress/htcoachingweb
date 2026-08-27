import mongoose from "mongoose";

const boundedNumber = (min, max, integer = false) => ({
  type: Number,
  min,
  max,
  default: null,
  ...(integer
    ? {
        validate: {
          validator: (value) => value === null || Number.isInteger(value),
          message: "Giá trị phải là số nguyên",
        },
      }
    : {}),
});

const wellnessSchema = new mongoose.Schema(
  {
    sleepHours: boundedNumber(0, 24),
    waterMl: boundedNumber(0, 20000, true),
    steps: boundedNumber(0, 200000, true),
    energy: boundedNumber(1, 10, true),
    hunger: boundedNumber(1, 10, true),
    stress: boundedNumber(1, 10, true),
    soreness: boundedNumber(1, 10, true),
    pain: boundedNumber(0, 10, true),
    painArea: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
  },
  { _id: false },
);

const notesSchema = new mongoose.Schema(
  {
    private: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    shared: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
  },
  { _id: false },
);

const nutritionTotalsSchema = new mongoose.Schema(
  {
    protein: { type: Number, min: 0, max: 10000, required: true },
    carb: { type: Number, min: 0, max: 10000, required: true },
    fat: { type: Number, min: 0, max: 10000, required: true },
    calories: { type: Number, min: 0, max: 100000, required: true },
  },
  { _id: false },
);

const mealPlanAssignmentSchema = new mongoose.Schema(
  {
    savedMealPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SavedMealPlan",
      required: true,
    },
    lineageKey: { type: String, required: true, maxlength: 100 },
    version: { type: Number, min: 1, required: true },
    titleSnapshot: {
      type: String,
      trim: true,
      maxlength: 100,
      required: true,
    },
    assignedAt: { type: Date, required: true },
    totalsSnapshot: { type: nutritionTotalsSchema, default: null },
  },
  { _id: false },
);

const actualFoodSchema = new mongoose.Schema(
  {
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
    },
    labelSnapshot: {
      type: String,
      trim: true,
      maxlength: 120,
      required: true,
    },
    plannedAmountGrams: {
      type: Number,
      min: 1,
      max: 1000,
      required: true,
    },
    actualAmountGrams: {
      type: Number,
      min: 1,
      max: 1000,
      required: true,
    },
    nutrition: { type: nutritionTotalsSchema, required: true },
  },
  { _id: false },
);

const nutritionEntrySchema = new mongoose.Schema(
  {
    entryId: {
      type: String,
      required: true,
      match:
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    },
    mode: {
      type: String,
      enum: ["follow_plan", "recipe", "manual"],
      required: true,
    },
    status: {
      type: String,
      enum: ["eaten", "changed", "skipped"],
      required: true,
    },
    plannedMealKey: { type: String, maxlength: 40, default: "" },
    savedMealPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SavedMealPlan",
      default: null,
    },
    version: { type: Number, min: 1, default: null },
    recipeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      default: null,
    },
    recipeSlugSnapshot: { type: String, maxlength: 180, default: "" },
    labelSnapshot: {
      type: String,
      trim: true,
      maxlength: 240,
      required: true,
    },
    mealName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    description: { type: String, trim: true, maxlength: 240, default: "" },
    note: { type: String, trim: true, maxlength: 240, default: "" },
    actualFoods: {
      type: [actualFoodSchema],
      validate: {
        validator: (items) =>
          items.length <= 8 &&
          new Set(items.map((item) => String(item.foodId))).size === items.length,
        message: "Tối đa 8 thực phẩm thực tế không trùng trong một bữa",
      },
      default: () => [],
    },
    actualTotals: { type: nutritionTotalsSchema, default: null },
    editCount: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "Số lần cập nhật bữa ăn phải là số nguyên",
      },
    },
    recordedAt: { type: Date, required: true },
  },
  { _id: false },
);

const nutritionSchema = new mongoose.Schema(
  {
    assignment: { type: mealPlanAssignmentSchema, default: null },
    entries: {
      type: [nutritionEntrySchema],
      validate: {
        validator: (items) =>
          items.length <= 10 &&
          new Set(items.map((item) => item.entryId)).size === items.length,
        message: "Tối đa 10 meal entries với entryId không trùng",
      },
      default: () => [],
    },
    submittedAt: { type: Date, default: null },
  },
  { _id: false },
);

const habitCompletionSchema = new mongoose.Schema(
  {
    habitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoachingHabit",
      required: true,
    },
    lineageKey: { type: String, required: true, maxlength: 100 },
    version: { type: Number, min: 1, required: true },
    titleSnapshot: {
      type: String,
      trim: true,
      maxlength: 100,
      required: true,
    },
    status: {
      type: String,
      enum: ["completed", "skipped"],
      required: true,
    },
    recordedAt: { type: Date, required: true },
  },
  { _id: false },
);

const dailyJournalSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    trainerIdAtCreation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    dateKey: {
      type: String,
      required: true,
      match: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
    },
    timeZone: {
      type: String,
      enum: ["Asia/Ho_Chi_Minh"],
      default: "Asia/Ho_Chi_Minh",
      required: true,
    },
    wellness: {
      type: wellnessSchema,
      default: () => ({}),
    },
    notes: {
      type: notesSchema,
      default: () => ({}),
    },
    nutrition: {
      type: nutritionSchema,
      default: () => ({}),
    },
    habitCompletions: {
      type: [habitCompletionSchema],
      validate: {
        validator: (items) =>
          items.length <= 20 &&
          new Set(items.map((item) => item.lineageKey)).size === items.length,
        message: "Tối đa 20 habit completions không trùng lineage",
      },
      default: () => [],
    },
    status: {
      type: String,
      enum: ["draft", "submitted"],
      default: "draft",
      required: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    revision: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
    correctionCount: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
      required: true,
    },
    retentionExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

dailyJournalSchema.index(
  { clientId: 1, dateKey: 1 },
  { unique: true, name: "uniq_daily_journal_client_date" },
);
dailyJournalSchema.index(
  { trainerIdAtCreation: 1, dateKey: -1 },
  { name: "daily_journal_trainer_history" },
);
dailyJournalSchema.index(
  { retentionExpiresAt: 1 },
  {
    name: "daily_journal_retention_candidates",
    partialFilterExpression: { retentionExpiresAt: { $type: "date" } },
  },
);

export default mongoose.model("DailyJournal", dailyJournalSchema);
