import jwt from "jsonwebtoken";
import User from "../models/User.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import { safeLog } from "../utils/safeLogger.js";

// ✅ Dùng 1 middleware duy nhất (bỏ verifyToken)
export const protect = async (req, res, next) => {
  const token = req.cookies.accessToken;

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
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Không có token" });
    }
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Không có quyền" });
    }
    next();
  };

// ✅ Check trainer access (Admin, Trainer cứng, hoặc User có subscription active)
export const requireTrainerAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Không có token" });
  }

  const { id, role } = req.user;

  // Nếu là admin hoặc trainer (legacy)
  if (role === "admin" || role === "trainer") {
    req.isAdmin = role === "admin";
    req.isTrainer = true;
    return next();
  }

  // Kiểm tra gói đăng ký
  try {
    const activeSub = await TrainerSubscription.findOne({
      userId: id,
      isActive: true,
      endDate: { $gt: new Date() },
    });

    if (activeSub) {
      req.isAdmin = false;
      req.isTrainer = true;
      return next();
    }

    return res.status(403).json({ success: false, message: "Không có quyền truy cập Trainer" });
  } catch (err) {
    safeLog.error("requireTrainerAccess", err);
    return res.status(500).json({ success: false, message: "Lỗi kiểm tra quyền" });
  }
};
