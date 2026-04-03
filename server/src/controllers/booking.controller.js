import Booking from "../models/Booking.js";
import { sendBookingNotificationToAdmin } from "../utils/sendMail.js";

// Tạo booking mới (không cần đăng nhập, nhưng nếu có user thì lưu userId)
export const createBooking = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      gym,
      schedule,
      note,
      package: pkg,
      sessions,
      discountCode,
      gifts,
    } = req.body;
    const userId = req.user?.id || null;

    const booking = await Booking.create({
      userId,
      name,
      phone,
      email,
      gym,
      schedule,
      note: note || "",
      package: pkg,
      sessions,
      discountCode: discountCode || null,
      gifts: gifts || [],
    });
    sendBookingNotificationToAdmin(booking).catch((err) =>
      console.error("Mail error:", err),
    );
    res
      .status(201)
      .json({ success: true, data: booking, message: "Đăng ký thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Lấy danh sách booking (chỉ admin)
export const getBookings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search || "";

    let filter = {};
    if (
      status &&
      ["pending", "contacted", "completed", "cancelled"].includes(status)
    ) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Booking.countDocuments(filter);
    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email");

    res.json({
      success: true,
      data: bookings,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Cập nhật trạng thái booking (admin)
export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, noteAdmin } = req.body;

    const updateData = { status };
    if (status === "contacted") updateData.contactedAt = new Date();
    if (noteAdmin !== undefined) updateData.noteAdmin = noteAdmin;

    const booking = await Booking.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy" });
    res.json({ success: true, data: booking, message: "Cập nhật thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const checkUserHasBookings = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.json({ success: true, hasBookings: false });
    }
    const count = await Booking.countDocuments({ userId });
    res.json({ success: true, hasBookings: count > 0 });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Xóa booking (admin)
export const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findByIdAndDelete(id);
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy" });
    res.json({ success: true, message: "Xóa thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};
