import mongoose from "mongoose";

const trainingScheduleSchema = new mongoose.Schema(
  {
    // HLV tạo lịch
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Tên khách hàng
    clientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // Ngày trong tuần: 0=Thứ 2, 1=Thứ 3, ..., 6=Chủ nhật
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },

    // Giờ bắt đầu (HH:mm)
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    // Giờ kết thúc (HH:mm)
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    // Loại bài tập
    exerciseType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    // Ghi chú
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    // Màu hiển thị (hex)
    color: {
      type: String,
      default: "#ff5500",
      match: /^#([0-9A-Fa-f]{6})$/,
    },

    // Đã gửi email nhắc chưa
    reminderSent: {
      type: Boolean,
      default: false,
    },

    // Khách hàng tự đăng ký (dành cho client booking)
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Lần cuối khách hàng cập nhật lịch này
    lastClientEdit: {
      type: Date,
      default: null,
    },

    // Thời điểm hết hạn — MongoDB TTL sẽ tự xóa khi quá thời điểm này
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// ✅ TTL Index — MongoDB tự động xóa document khi expiresAt <= now
trainingScheduleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ✅ Compound index cho query nhanh theo trainer + ngày
trainingScheduleSchema.index({ trainerId: 1, dayOfWeek: 1 });

export default mongoose.model("TrainingSchedule", trainingScheduleSchema);
