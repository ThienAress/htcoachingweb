import TrainingSchedule from "../models/TrainingSchedule.js";

// Danh sách loại bài tập cố định
const FIXED_EXERCISE_TYPES = ["Boxing", "Gym", "Cardio", "Yoga", "Stretching"];

// ===== GET /api/training-schedules — Lấy tất cả lịch tập của trainer =====
export const getMySchedules = async (req, res) => {
  try {
    const trainerId = req.user.id;

    const schedules = await TrainingSchedule.find({
      trainerId,
      expiresAt: { $gt: new Date() },
    })
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: schedules,
    });
  } catch (err) {
    console.error("getMySchedules error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy lịch tập",
    });
  }
};

// ===== POST /api/training-schedules — Tạo 1 slot lịch tập =====
export const createSchedule = async (req, res) => {
  try {
    const trainerId = req.user.id;
    const { clientName, dayOfWeek, startTime, endTime, exerciseType, notes, color } = req.body;

    // Validate required fields
    if (!clientName || dayOfWeek === undefined || !startTime || !endTime || !exerciseType) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc (clientName, dayOfWeek, startTime, endTime, exerciseType)",
      });
    }

    // Validate dayOfWeek
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({
        success: false,
        message: "dayOfWeek phải từ 0 (Thứ 2) đến 6 (Chủ nhật)",
      });
    }

    // Validate time format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({
        success: false,
        message: "Định dạng thời gian không hợp lệ (HH:mm)",
      });
    }

    // Validate startTime < endTime (endTime "00:00" = midnight, luôn hợp lệ)
    if (endTime !== "00:00" && startTime >= endTime) {
      return res.status(400).json({
        success: false,
        message: "Giờ bắt đầu phải nhỏ hơn giờ kết thúc",
      });
    }

    // Tính expiresAt = now + 7 ngày
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const schedule = await TrainingSchedule.create({
      trainerId,
      clientName: clientName.trim(),
      dayOfWeek,
      startTime,
      endTime,
      exerciseType: exerciseType.trim(),
      notes: notes?.trim() || "",
      color: color || "#ff5500",
      expiresAt,
    });

    return res.status(201).json({
      success: true,
      message: "Đã tạo lịch tập thành công",
      data: schedule,
    });
  } catch (err) {
    console.error("createSchedule error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo lịch tập",
    });
  }
};

// ===== PUT /api/training-schedules/:id — Sửa 1 slot lịch tập =====
export const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerId = req.user.id;
    const { clientName, dayOfWeek, startTime, endTime, exerciseType, notes, color } = req.body;

    // Tìm schedule
    const schedule = await TrainingSchedule.findById(id);
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch tập",
      });
    }

    // Chỉ trainer tạo mới được sửa
    if (schedule.trainerId.toString() !== trainerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền sửa lịch tập này",
      });
    }

    // Validate time nếu cung cấp (endTime "00:00" = midnight)
    if (startTime && endTime && endTime !== "00:00" && startTime >= endTime) {
      return res.status(400).json({
        success: false,
        message: "Giờ bắt đầu phải nhỏ hơn giờ kết thúc",
      });
    }

    // Update fields
    if (clientName !== undefined) schedule.clientName = clientName.trim();
    if (dayOfWeek !== undefined) schedule.dayOfWeek = dayOfWeek;
    if (startTime !== undefined) schedule.startTime = startTime;
    if (endTime !== undefined) schedule.endTime = endTime;
    if (exerciseType !== undefined) schedule.exerciseType = exerciseType.trim();
    if (notes !== undefined) schedule.notes = notes.trim();
    if (color !== undefined) schedule.color = color;

    await schedule.save();

    return res.status(200).json({
      success: true,
      message: "Đã cập nhật lịch tập",
      data: schedule,
    });
  } catch (err) {
    console.error("updateSchedule error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật lịch tập",
    });
  }
};

// ===== DELETE /api/training-schedules/:id — Xóa 1 slot lịch tập =====
export const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerId = req.user.id;

    const schedule = await TrainingSchedule.findById(id);
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch tập",
      });
    }

    // Chỉ trainer tạo mới được xóa
    if (schedule.trainerId.toString() !== trainerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa lịch tập này",
      });
    }

    await TrainingSchedule.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Đã xóa lịch tập",
    });
  } catch (err) {
    console.error("deleteSchedule error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xóa lịch tập",
    });
  }
};

// ===== DELETE /api/training-schedules — Xóa tất cả lịch tập (reset tuần) =====
export const clearAllSchedules = async (req, res) => {
  try {
    const trainerId = req.user.id;

    const result = await TrainingSchedule.deleteMany({ trainerId });

    return res.status(200).json({
      success: true,
      message: `Đã xóa ${result.deletedCount} lịch tập`,
      data: { deletedCount: result.deletedCount },
    });
  } catch (err) {
    console.error("clearAllSchedules error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xóa tất cả lịch tập",
    });
  }
};

// ===== GET /api/training-schedules/exercise-types — Lấy danh sách loại bài tập =====
export const getExerciseTypes = (req, res) => {
  return res.status(200).json({
    success: true,
    data: FIXED_EXERCISE_TYPES,
  });
};
