// models/Food.js
import mongoose from "mongoose";

const foodSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      unique: true, // tránh trùng tên thực phẩm
    },
    protein: {
      type: Number,
      required: true,
      min: 0,
    },
    carb: {
      type: Number,
      required: true,
      min: 0,
    },
    fat: {
      type: Number,
      required: true,
      min: 0,
    },
    calories: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

// Indexes
foodSchema.index({ label: "text" }); // hỗ trợ tìm kiếm
foodSchema.index({ createdAt: -1 });

export default mongoose.model("Food", foodSchema);
