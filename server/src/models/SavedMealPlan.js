import mongoose from "mongoose";

const nutritionSchema = new mongoose.Schema(
  {
    protein: { type: Number, min: 0, max: 10000, required: true },
    carb: { type: Number, min: 0, max: 10000, required: true },
    fat: { type: Number, min: 0, max: 10000, required: true },
    calories: { type: Number, min: 0, max: 100000, required: true },
  },
  { _id: false },
);

const foodSnapshotSchema = new mongoose.Schema(
  {
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
    },
    label: { type: String, trim: true, maxlength: 120, required: true },
    amountGrams: { type: Number, min: 1, max: 1000, required: true },
    nutrition: { type: nutritionSchema, required: true },
  },
  { _id: false },
);

const mealSnapshotSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      trim: true,
      maxlength: 40,
      match: /^[a-z0-9][a-z0-9_-]*$/i,
      required: true,
    },
    name: { type: String, trim: true, maxlength: 80, required: true },
    type: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snack", "other"],
      required: true,
    },
    foods: {
      type: [foodSnapshotSchema],
      validate: {
        validator: (items) => items.length >= 1 && items.length <= 8,
        message: "Mỗi bữa cần từ 1 đến 8 thực phẩm",
      },
      required: true,
    },
    totals: { type: nutritionSchema, required: true },
  },
  { _id: false },
);

const targetSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 80, default: "" },
    protein: { type: Number, min: 0, max: 1000, default: null },
    carb: { type: Number, min: 0, max: 2000, default: null },
    fat: { type: Number, min: 0, max: 1000, default: null },
    calories: { type: Number, min: 0, max: 20000, default: null },
  },
  { _id: false },
);

const savedMealPlanSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    trainerIdAtCreation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lineageKey: {
      type: String,
      required: true,
      match:
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    },
    version: { type: Number, min: 1, required: true },
    isLatest: { type: Boolean, default: true, required: true },
    status: {
      type: String,
      enum: ["active", "superseded", "archived"],
      default: "active",
      required: true,
    },
    title: { type: String, trim: true, maxlength: 100, required: true },
    source: {
      type: String,
      enum: ["meal_generator"],
      default: "meal_generator",
      required: true,
    },
    target: { type: targetSchema, default: null },
    meals: {
      type: [mealSnapshotSchema],
      validate: {
        validator: (items) => items.length >= 1 && items.length <= 6,
        message: "Meal plan cần từ 1 đến 6 bữa",
      },
      required: true,
    },
    totals: { type: nutritionSchema, required: true },
    commandType: {
      type: String,
      enum: ["create", "revise"],
      required: true,
      select: false,
    },
    createdByRequestId: {
      type: String,
      required: true,
      select: false,
    },
    payloadFingerprint: {
      type: String,
      minlength: 64,
      maxlength: 64,
      required: true,
      select: false,
    },
    archiveRequestId: { type: String, default: null, select: false },
    archiveFingerprint: { type: String, default: null, select: false },
    archivedAt: { type: Date, default: null },
    retentionExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

savedMealPlanSchema.index(
  { ownerId: 1, lineageKey: 1, version: 1 },
  { unique: true, name: "uniq_saved_meal_plan_version" },
);
savedMealPlanSchema.index(
  { ownerId: 1, createdByRequestId: 1 },
  { unique: true, name: "uniq_saved_meal_plan_request" },
);
savedMealPlanSchema.index(
  { ownerId: 1, lineageKey: 1 },
  {
    unique: true,
    name: "uniq_saved_meal_plan_latest",
    partialFilterExpression: { isLatest: true },
  },
);
savedMealPlanSchema.index(
  { ownerId: 1, archiveRequestId: 1 },
  {
    unique: true,
    name: "uniq_saved_meal_plan_archive_request",
    partialFilterExpression: { archiveRequestId: { $type: "string" } },
  },
);
savedMealPlanSchema.index(
  { ownerId: 1, isLatest: 1, status: 1, updatedAt: -1 },
  { name: "saved_meal_plan_owner_list" },
);
savedMealPlanSchema.index(
  { retentionExpiresAt: 1 },
  {
    name: "saved_meal_plan_retention_candidates",
    partialFilterExpression: { retentionExpiresAt: { $type: "date" } },
  },
);

export default mongoose.model("SavedMealPlan", savedMealPlanSchema);
