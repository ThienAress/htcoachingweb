import User from "../models/User.js";
import { deleteAccountData } from "../services/accountDeletion.service.js";
import { safeLog } from "../utils/safeLogger.js";

export const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { role: "user" };
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select("-password")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    safeLog.error("user.list_failed", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const deletion = await deleteAccountData({
      userId: req.params.id,
      actorId: req.user.id,
      actorRole: req.user.role,
    });

    if (!deletion) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    res.json({
      success: true,
      data: deletion,
      message: "Xóa người dùng và dữ liệu liên quan thành công",
    });
  } catch (err) {
    safeLog.error("user.delete_failed", err);
    res.status(err.status || 500).json({
      success: false,
      ...(err.code ? { code: err.code } : {}),
      message:
        err.status && err.message
          ? err.message
          : "Không thể xóa người dùng lúc này",
    });
  }
};
