export const errorHandler = (err, req, res, next) => {
  console.error("🔥 [GLOBAL ERROR]:", err);

  // Lỗi mongoose validation
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: messages,
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
    message: err.message || "Lỗi server nội bộ",
  });
};
