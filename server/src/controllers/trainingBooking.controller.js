import TrainingSchedule from "../models/TrainingSchedule.js";
import Order from "../models/Order.js";

// ===== GET /api/training-booking/my-booking — Lấy lịch đã đăng ký của khách hàng =====
export const getMyBookings = async (req, res) => {
  try {
    const clientId = req.user.id;

    const schedules = await TrainingSchedule.find({
      clientId,
      expiresAt: { $gt: new Date() },
    })
      .populate("trainerId", "name role")
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();

    const formattedSchedules = schedules.map((s) => {
      if (s.trainerId && (s.trainerId.role === "admin" || s.trainerId.name.toLowerCase() === "admin")) {
        s.trainerId.name = "Hoàng Thiện";
      }
      return s;
    });

    return res.status(200).json({
      success: true,
      data: formattedSchedules,
    });
  } catch (err) {
    console.error("getMyBookings error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy lịch đăng ký",
    });
  }
};

import User from "../models/User.js";

// ===== GET /api/training-booking/my-trainer — Lấy thông tin HLV phụ trách =====
export const getMyTrainer = async (req, res) => {
  try {
    const clientId = req.user.id;
    const order = await Order.findOne({
      userId: clientId,
      status: "approved",
    })
      .sort({ createdAt: -1 })
      .populate("trainerId", "name email");

    if (!order) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    let trainer = order.trainerId;
    if (!trainer) {
      trainer = await User.findOne({ role: "admin" });
    }

    if (!trainer) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    let trainerName = trainer.name;
    if (trainer.role === "admin" || trainerName.toLowerCase() === "admin") {
      trainerName = "Hoàng Thiện";
    }

    return res.status(200).json({
      success: true,
      data: {
        _id: trainer._id,
        name: trainerName,
      },
    });
  } catch (err) {
    console.error("getMyTrainer error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy thông tin HLV",
    });
  }
};

// ===== GET /api/training-booking/busy-times — Lấy danh sách giờ đã kín của HLV =====
export const getBusyTimes = async (req, res) => {
  try {
    const { trainerId, dayOfWeek } = req.query;

    if (!trainerId || dayOfWeek === undefined) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin trainerId hoặc dayOfWeek",
      });
    }

    // Tìm tất cả các lịch tập của HLV trong ngày đó
    const busySchedules = await TrainingSchedule.find({
      trainerId,
      dayOfWeek: Number(dayOfWeek),
      expiresAt: { $gt: new Date() },
    })
      .select("startTime endTime")
      .sort({ startTime: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: busySchedules,
    });
  } catch (err) {
    console.error("getBusyTimes error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy giờ bận",
    });
  }
};

// ===== POST /api/training-booking/book — Khách hàng tạo lịch tập =====
export const createBooking = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { dayOfWeek, startTime, endTime, notes } = req.body;

    if (dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc (dayOfWeek, startTime, endTime)",
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

    if (endTime !== "00:00" && startTime >= endTime) {
      return res.status(400).json({
        success: false,
        message: "Giờ bắt đầu phải nhỏ hơn giờ kết thúc",
      });
    }

    // Kiểm tra xem khách hàng đã có lịch vào thứ (dayOfWeek) này chưa
    const existingSchedule = await TrainingSchedule.findOne({
      clientId,
      dayOfWeek,
      expiresAt: { $gt: new Date() },
    });

    if (existingSchedule) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã đăng ký lịch tập vào ngày này rồi. Vui lòng chọn ngày khác hoặc chỉnh sửa lịch đã có.",
      });
    }

    // Tìm Order đã duyệt
    const order = await Order.findOne({
      userId: clientId,
      status: "approved",
    }).sort({ createdAt: -1 }).populate("trainerId", "name email role");

    if (!order) {
      return res.status(403).json({
        success: false,
        message: "Bạn chưa có gói tập nào được duyệt hợp lệ. Vui lòng đợi Admin xác nhận.",
      });
    }

    let trainer = order.trainerId;
    if (!trainer) {
      trainer = await User.findOne({ role: "admin" });
    }

    if (!trainer) {
      return res.status(403).json({
        success: false,
        message: "Hệ thống chưa thiết lập Admin để tiếp nhận lịch.",
      });
    }

    const trainerId = trainer._id;

    // Tính expiresAt = now + 7 ngày
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const schedule = await TrainingSchedule.create({
      trainerId,
      clientId,
      clientName: req.user.name || "Khách hàng",
      dayOfWeek,
      startTime,
      endTime,
      exerciseType: "Tự do (Khách đăng ký)",
      notes: notes?.trim() || "",
      color: "#9ca3af", // Màu xám cho khách đăng ký
      expiresAt,
    });

    return res.status(201).json({
      success: true,
      message: "Đã đăng ký lịch tập thành công",
      data: schedule,
    });
  } catch (err) {
    console.error("createBooking error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo lịch tập",
    });
  }
};

// ===== PUT /api/training-booking/book/:id — Khách hàng sửa lịch tập =====
export const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;
    const { dayOfWeek, startTime, endTime, notes } = req.body;

    const schedule = await TrainingSchedule.findById(id);
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch tập",
      });
    }

    // Chỉ người tạo mới được sửa
    if (!schedule.clientId || schedule.clientId.toString() !== clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền sửa lịch tập này",
      });
    }

    // Kiểm tra giới hạn 1 lần 1 ngày
    if (schedule.lastClientEdit) {
      const now = new Date();
      const diffMs = now - schedule.lastClientEdit;
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours < 24) {
        return res.status(403).json({
          success: false,
          message: "Bạn chỉ có thể chỉnh sửa lịch này 1 lần mỗi ngày. Vui lòng thử lại sau.",
        });
      }
    }

    // Validate time
    if (startTime && endTime && endTime !== "00:00" && startTime >= endTime) {
      return res.status(400).json({
        success: false,
        message: "Giờ bắt đầu phải nhỏ hơn giờ kết thúc",
      });
    }

    // Kiểm tra trùng ngày nếu có thay đổi ngày
    if (dayOfWeek !== undefined && dayOfWeek !== schedule.dayOfWeek) {
      const existingSchedule = await TrainingSchedule.findOne({
        clientId,
        dayOfWeek,
        _id: { $ne: id },
        expiresAt: { $gt: new Date() },
      });
      if (existingSchedule) {
        return res.status(400).json({
          success: false,
          message: "Bạn đã có một lịch tập khác vào ngày này. Vui lòng chọn ngày khác.",
        });
      }
    }

    // Update fields
    if (dayOfWeek !== undefined) schedule.dayOfWeek = dayOfWeek;
    if (startTime !== undefined) schedule.startTime = startTime;
    if (endTime !== undefined) schedule.endTime = endTime;
    if (notes !== undefined) schedule.notes = notes.trim();

    // Lưu thời điểm sửa
    schedule.lastClientEdit = new Date();

    await schedule.save();

    return res.status(200).json({
      success: true,
      message: "Đã cập nhật lịch tập thành công",
      data: schedule,
    });
  } catch (err) {
    console.error("updateBooking error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật lịch tập",
    });
  }
};
