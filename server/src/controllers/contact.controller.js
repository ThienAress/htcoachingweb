import ContactMessage from "../models/ContactMessage.js";
import { sendContactNotificationToAdmin } from "../utils/sendMail.js";

// Tạo mới liên hệ (không cần đăng nhập)
export const createContactMessage = async (req, res) => {
  try {
    const { name, email, phone, social, package: packageType } = req.body;

    // Lưu vào DB
    const message = await ContactMessage.create({
      name,
      email,
      phone,
      social,
      package: packageType,
    });

    // Gửi email thông báo cho admin (bất đồng bộ, không chờ)
    sendContactNotificationToAdmin(message).catch((err) =>
      console.error("Failed to send admin notification:", err),
    );

    res.status(201).json({
      success: true,
      data: message,
      message: "Gửi thông tin thành công.",
    });
  } catch (err) {
    console.error("CREATE CONTACT ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi server, vui lòng thử lại sau.",
    });
  }
};

// Lấy danh sách liên hệ (chỉ admin)
export const getContactMessages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search || "";

    let filter = {};
    if (status && ["pending", "processed"].includes(status)) {
      filter.status = status;
    }
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const total = await ContactMessage.countDocuments(filter);
    const messages = await ContactMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: messages,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("GET CONTACT MESSAGES ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi tải dữ liệu." });
  }
};

// Cập nhật trạng thái (đánh dấu đã xử lý)
export const updateContactStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "processed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ.",
      });
    }

    const message = await ContactMessage.findByIdAndUpdate(
      id,
      {
        status,
        processedAt: status === "processed" ? new Date() : null,
      },
      { new: true },
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy liên hệ.",
      });
    }

    res.json({
      success: true,
      data: message,
      message: "Cập nhật trạng thái thành công.",
    });
  } catch (err) {
    console.error("UPDATE CONTACT STATUS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi cập nhật.",
    });
  }
};

// Xóa liên hệ
export const deleteContactMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await ContactMessage.findByIdAndDelete(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy liên hệ.",
      });
    }

    res.json({
      success: true,
      message: "Xóa liên hệ thành công.",
    });
  } catch (err) {
    console.error("DELETE CONTACT ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi xóa.",
    });
  }
};
