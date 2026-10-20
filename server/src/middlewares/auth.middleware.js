import jwt from "jsonwebtoken";
import User from "../models/User.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import { safeLog } from "../utils/safeLogger.js";

const AUTH_REQUIRED_MESSAGE = "Bạn cần đăng nhập để tiếp tục.";

// ✅ Dùng 1 middleware duy nhất (bỏ verifyToken)
export const protect = async (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: AUTH_REQUIRED_MESSAGE });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, code: "ACCOUNT_NOT_FOUND", message: "Tài khoản không tồn tại hoặc đã bị xóa. Vui lòng đăng nhập lại." });
    }
    req.user = { id: user._id, role: user.role };

    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, code: "SESSION_INVALID", message: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại." });
  }
};

// ✅ Check admin
export const requireRoles =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, code: "AUTH_REQUIRED", message: AUTH_REQUIRED_MESSAGE });
    }
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, code: "FORBIDDEN", message: "Bạn không có quyền thực hiện thao tác này." });
    }
    next();
  };

// ✅ Check trainer access (Admin, Trainer cứng, hoặc User có subscription active)
export const requireTrainerAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: AUTH_REQUIRED_MESSAGE });
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
      req.trainerSubscription = activeSub;
      req.isAdmin = false;
      req.isTrainer = true;
      return next();
    }

    return res.status(403).json({ success: false, code: "TRAINER_ACCESS_REQUIRED", message: "Bạn chưa có quyền truy cập khu Huấn luyện viên." });
  } catch (err) {
    safeLog.error("requireTrainerAccess", err);
    return res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: "Hệ thống đang bận. Bạn vui lòng thử lại sau ít phút." });
  }
};
