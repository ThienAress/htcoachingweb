import { safeLog } from "../utils/safeLogger.js";

export const errorHandler = (err, req, res, next) => {
  safeLog.error("GLOBAL ERROR", err);

  const isProd = process.env.NODE_ENV === "production";

  // Lỗi upload file (Multer)
  if (err.name === "MulterError") {
    let message = "Lỗi upload file";
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "Ảnh quá lớn. Vui lòng chọn ảnh có dung lượng nhỏ hơn.";
    } else if (err.code === "LIMIT_FILE_COUNT") {
      message = "Quá nhiều file. Vui lòng chọn ít file hơn.";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      message = "File không hợp lệ hoặc sai tên field.";
    }
    return res.status(400).json({ success: false, message });
  }

  // Lỗi file không đúng định dạng (từ fileFilter)
  if (err.message?.includes("Chỉ chấp nhận")) {
    return res.status(400).json({ success: false, message: err.message });
  }

  // Lỗi mongoose validation
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: "Dữ liệu không hợp lệ: " + messages.join(", "),
    });
  }

  // Lỗi duplicate key (unique)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      message: `${field} đã tồn tại`,
    });
  }

  // Lỗi JWT
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ",
    });
  }

  // Lỗi khác
  res.status(err.status || 500).json({
    success: false,
    message: isProd ? "Lỗi server nội bộ" : (err.message || "Lỗi server nội bộ"),
  });
};
