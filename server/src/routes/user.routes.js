import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { createTrainer } from "../controllers/admin.controller.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import { getUsers, deleteUser } from "../controllers/user.controller.js";

const router = express.Router();

// ===== GET CURRENT USER =====
router.get("/me", protect, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json(user);
});

// ===== GET TRAINERS =====
router.get("/trainers", protect, async (req, res) => {
  const trainers = await User.find({ role: "trainer" }).select("-password");

  res.json({
    success: true,
    data: trainers,
  });
});

// ===== DELETE TRAINERS =====
router.delete(
  "/trainers/:id",
  protect,
  requireRoles("admin"),
  async (req, res) => {
    try {
      const trainerId = req.params.id;

      // Kiểm tra xem trainer có đang phụ trách order nào không
      const orders = await Order.find({ trainerId });
      if (orders.length > 0) {
        // Có thể xóa hoặc gán lại cho null, tuỳ logic. Ở đây ta xóa nhưng cảnh báo.
        // Nên set trainerId = null để không mất order
        await Order.updateMany({ trainerId }, { trainerId: null });
      }

      await User.findByIdAndDelete(trainerId);
      res.json({ success: true, message: "Xóa trainer thành công" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Lỗi xóa trainer" });
    }
  },
);

// ===== CREATE TRAINER =====
router.post("/create-trainer", protect, requireRoles("admin"), createTrainer);

// ===== GET USER FROM GOOGLE =====
router.get("/users", protect, requireRoles("admin"), getUsers);
router.delete("/:id", protect, requireRoles("admin"), deleteUser);

export default router;
