import mongoose from "mongoose";

const blogPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    content: {
      type: String,
      default: "",
    },
    excerpt: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      enum: ["kien-thuc-nen", "giao-an-opt", "danh-gia-f1", "dinh-duong"],
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    coverImage: {
      type: String,
      default: "",
      trim: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trainer",
      default: null,
    },
    metaTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 70,
    },
    metaDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    focusKeyword: {
      type: String,
      default: "",
      trim: true,
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
    views: {
      type: Number,
      default: 0,
    },
    readTime: {
      type: Number,
      default: 1,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ status: 1, category: 1 });
blogPostSchema.index({ slug: 1 }, { unique: true });

// Tự tính readTime trước khi save
blogPostSchema.pre("save", function () {
  if (this.isModified("content") && this.content) {
    const wordCount = this.content.trim().split(/\s+/).length;
    this.readTime = Math.max(1, Math.ceil(wordCount / 200));
  }
});

export default mongoose.model("BlogPost", blogPostSchema);
