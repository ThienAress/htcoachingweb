import mongoose from "mongoose";

const storyImageSchema = {
  type: String,
  default: "",
  trim: true,
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
    beforeImg: storyImageSchema,
    afterImg: storyImageSchema,
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
    beforeImg: storyImageSchema,
    afterImg: storyImageSchema,
    heroImage: storyImageSchema,
    highlights: {
      type: [String],
      default: [],
    },
    milestones: {
      type: [milestoneSchema],
      default: [],
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
