import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";

import User from "../models/User.js";
import Order from "../models/Order.js";
import WalletTransaction from "../models/WalletTransaction.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import CustomerStory from "../models/CustomerStory.js";
import { uploadAvatar } from "../middlewares/avatarUpload.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import {
  getUsers,
  deleteUser,
} from "../controllers/user.controller.js";
import {
  validateDeleteUser,
} from "../middlewares/validation.js";

const router = express.Router();

// ===== GET CURRENT USER =====
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    // Tìm orders của user để lấy customer story
    const orders = await Order.find({ userId: req.user.id }).select("_id");
    const orderIds = orders.map(o => o._id);

    const story = await CustomerStory.findOne({ orderId: { $in: orderIds } }).select("slug");
    if (story) {
      user.customerStorySlug = story.slug;
    }

    res.json(user);
  } catch (err) {
    console.error("getMe error:", err.message);
    res.status(500).json({ message: "Lỗi lấy thông tin cá nhân" });
  }
});

// ===== UPDATE PROFILE =====
router.put("/me/profile", protect, csrfProtection, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    
    // validation
    if (!name || name.trim() === "") {
      return res.status(400).json({ success: false, message: "Họ tên không được để trống" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { 
        $set: { 
          name: name.trim(), 
          phone: phone ? phone.trim() : "", 
          address: address ? address.trim() : "" 
        } 
      },
      { returnDocument: 'after' }
    ).select("-password");

    res.json({ success: true, message: "Cập nhật thông tin thành công", user: updatedUser });
  } catch (err) {
    console.error("updateProfile error:", err.message);
    res.status(500).json({ success: false, message: "Lỗi cập nhật thông tin cá nhân" });
  }
});

// ===== UPDATE AVATAR =====
router.put("/me/avatar", protect, csrfProtection, uploadAvatar.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Không tìm thấy file tải lên" });
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "htcoaching/avatars",
      transformation: [
        { width: 200, height: 200, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { avatar: result.url } },
      { returnDocument: 'after' }
    ).select("-password");

    res.json({ success: true, message: "Cập nhật ảnh đại diện thành công", avatar: result.url, user: updatedUser });
  } catch (err) {
    console.error("updateAvatar error:", err.message);
    res.status(500).json({ success: false, message: "Lỗi cập nhật ảnh đại diện" });
  }
});


// ===== GET USER ORDERS =====
router.get("/me/orders", protect, async (req, res) => {
  try {
    // Đơn hàng HLV: những người mua gói HLV để quản lý học viên
    const trainerSubscriptions = await TrainerSubscription.find({ userId: req.user.id })
      .sort({ createdAt: -1 });

    // Đơn hàng Khách PT: khách hàng mua gói PT (userId là user hiện tại)
    const trainerOrders = await Order.find({ userId: req.user.id })
      .populate("trainerId", "name email phone avatar")
      .sort({ createdAt: -1 });

    // Đơn hàng Khách PT: đối với trainer xem danh sách học viên
    const clientOrders = await Order.find({ trainerId: req.user.id })
      .populate("userId", "name email phone avatar")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      trainerSubscriptions,
      trainerOrders,
      clientOrders,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi lấy danh sách đơn hàng" });
  }
});

// ===== GET USER TRANSACTIONS =====
router.get("/me/transactions", protect, async (req, res) => {
  try {
    const transactions = await WalletTransaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      transactions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi lấy lịch sử giao dịch" });
  }
});





// ===== GET USER FROM GOOGLE =====
router.get("/users", protect, requireRoles("admin"), getUsers);
router.delete(
  "/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateDeleteUser,
  deleteUser,
);

export default router;
