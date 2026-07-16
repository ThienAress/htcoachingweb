import mongoose from "mongoose";

const specialtySchema = new mongoose.Schema(
  {
    icon: {
      type: String,
      required: true,
      enum: ["dumbbell", "utensils", "chart-line", "heart-pulse"],
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const trainerSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    experience: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
    },
    motto: {
      type: String,
      trim: true,
      default: "",
    },
    trainingStyle: {
      type: String,
      trim: true,
      default: "",
    },
    achievements: {
      type: [String],
      default: [],
    },
    philosophy: {
      type: String,
      trim: true,
    },
    headline: {
      type: String,
      trim: true,
    },
    videoIntro: {
      type: String,
      trim: true,
    },
    stats: {
      type: [{
        label: { type: String, required: true },
        value: { type: String, required: true }
      }],
      default: []
    },
    certifications: {
      type: [String],
      default: []
    },
    methodologies: {
      type: [{
        title: { type: String, required: true },
        description: { type: String, required: true }
      }],
      default: []
    },
    faqs: {
      type: [{
        question: { type: String, required: true },
        answer: { type: String, required: true }
      }],
      default: []
    },
    socialLinks: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      tiktok: { type: String, default: "" },
      zalo: { type: String, default: "" },
      lemon8: { type: String, default: "" },
      threads: { type: String, default: "" },
    },
    // Hỗ trợ tối đa 3 ảnh, backward compatible với field `image` cũ
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (v) => v.length <= 3,
        message: "Tối đa 3 ảnh",
      },
    },
    // Giữ lại field cũ để backward compatible khi đọc
    image: {
      type: String,
      trim: true,
    },
    specialties: [specialtySchema],
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    isHeadCoach: {
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
    // i18n: Bản dịch tiếng Anh cho các field text (fallback về field gốc nếu trống)
    i18n: {
      en: {
        title: { type: String, default: "" },
        bio: { type: String, default: "" },
        motto: { type: String, default: "" },
        trainingStyle: { type: String, default: "" },
        philosophy: { type: String, default: "" },
        headline: { type: String, default: "" },
        achievements: { type: [String], default: [] },
      },
    },
  },
  {
    timestamps: true,
  }
);

const Trainer = mongoose.model("Trainer", trainerSchema);

export default Trainer;
