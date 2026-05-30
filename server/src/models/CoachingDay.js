import mongoose from "mongoose";

const coachingDaySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dateString: {
      type: String, // Định dạng "YYYY-MM-DD" tránh lệch múi giờ
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    title: {
      type: String,
      required: true, // Ví dụ: "Chest Day - Tập ngực dày và rộng"
    },
    videoUrl: {
      type: String,
      default: "", // Video hướng dẫn tổng quan của ngày (YouTube/Drive...)
    },
    note: {
      type: String,
      default: "", // Lời khuyên, dặn dò của Coach
    },
    exercises: [
      {
        name: { type: String, required: true },
        sets: { type: Number, default: 4 },
        reps: { type: String, default: "10-12" },
        weight: { type: String, default: "60s" },
        videoUrl: { type: String, default: "" }, // Video hướng dẫn riêng từng bài tập (nếu có)
        videoUrl2: { type: String, default: "" }, // Video hướng dẫn thứ 2 (nếu có)
        clientFeedbackVideo: { type: String, default: "" }, // Video phản hồi kỹ thuật riêng từng bài của học viên
        clientFeedbackNote: { type: String, default: "" }, // Cảm nhận riêng của học viên cho từng bài tập
        completed: { type: Boolean, default: false }, // Client tích hoàn thành bài tập này
      },
    ],
    clientFeedbackText: {
      type: String,
      default: "", // Phản hồi văn bản của khách sau khi tập xong
    },
    clientFeedbackVideo: {
      type: String,
      default: "", // Đường dẫn file video phản hồi (tải lên server)
    },
    clientStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// ✅ Thiết lập indexes tối ưu truy vấn
coachingDaySchema.index({ userId: 1, dateString: 1 }, { unique: true }); // Duy nhất 1 giáo án mỗi ngày của khách
coachingDaySchema.index({ trainerId: 1, userId: 1 });
coachingDaySchema.index({ date: -1 });

export default mongoose.model("CoachingDay", coachingDaySchema);
