import mongoose from "mongoose";

const storyImagesSchema = {
  type: [String],
  default: [],
  validate: {
    validator: (arr) => arr.length <= 3,
    message: "Tối đa 3 ảnh cho mỗi mục before/after",
  },
};

const milestoneSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      default: "",
      trim: true,
    },
    content: {
      type: String,
      default: "",
      trim: true,
    },
    beforeImg: storyImagesSchema,
    afterImg: storyImagesSchema,
    bullets: {
      type: [String],
      default: [],
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

const customerStorySchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trainer",
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: String,
      default: "",
      trim: true,
    },
    job: {
      type: String,
      default: "",
      trim: true,
    },
    result: {
      type: String,
      default: "",
      trim: true,
    },
    duration: {
      type: String,
      default: "",
      trim: true,
    },
    packageName: {
      type: String,
      default: "",
      trim: true,
    },
    goal: {
      type: String,
      default: "",
      trim: true,
    },
    startWeight: {
      type: String,
      default: "",
      trim: true,
    },
    endWeight: {
      type: String,
      default: "",
      trim: true,
    },
    schedule: {
      type: String,
      default: "",
      trim: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    problem: {
      type: String,
      default: "",
      trim: true,
    },
    solution: {
      type: String,
      default: "",
      trim: true,
    },
    quote: {
      type: String,
      default: "",
      trim: true,
    },
    beforeImg: storyImagesSchema,
    afterImg: storyImagesSchema,
    heroImage: {
      type: String,
      default: "",
      trim: true,
    },
    heroPosition: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    highlights: {
      type: [String],
      default: [],
    },
    milestones: {
      type: [milestoneSchema],
      default: [],
    },
    // i18n: Bản dịch tiếng Anh (fallback về field gốc tiếng Việt nếu trống)
    i18n: {
      en: {
        message: { type: String, default: "" },
        result: { type: String, default: "" },
        duration: { type: String, default: "" },
        goal: { type: String, default: "" },
        job: { type: String, default: "" },
        problem: { type: String, default: "" },
        solution: { type: String, default: "" },
        quote: { type: String, default: "" },
        highlights: { type: [String], default: [] },
      },
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    featured: {
      type: Boolean,
      default: false,
    },
    isContinuing: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

customerStorySchema.index({ status: 1, featured: 1, sortOrder: 1 });
customerStorySchema.index({ status: 1, publishedAt: -1 });

export default mongoose.model("CustomerStory", customerStorySchema);
