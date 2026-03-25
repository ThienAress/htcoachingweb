import jwt from "jsonwebtoken";
import User from "../models/User.js";

// ✅ Dùng 1 middleware duy nhất (bỏ verifyToken)
export const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "Không có token" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Tài khoản không tồn tại" });
    }
    // Gán thông tin từ user trong DB (chứ không chỉ decoded)
    req.user = { id: user._id, role: user.role };
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Token không hợp lệ" });
  }
};

// ✅ Check admin
export const requireRoles =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền",
      });
    }
    next();
  };
