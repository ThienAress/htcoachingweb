import User from "../models/User.js";
import bcrypt from "bcryptjs";

export const createTrainer = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // ❗ validate
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin",
      });
    }

    // ❗ check email tồn tại
    const existed = await User.findOne({ email });
    if (existed) {
      return res.status(400).json({
        success: false,
        message: "Email đã tồn tại",
      });
    }

    // 🔥 hash password
    const hash = await bcrypt.hash(password, 10);

    // 🔥 tạo trainer
    const user = await User.create({
      name,
      email,
      password: hash,
      role: "trainer",
    });

    res.json({
      success: true,
      message: "Tạo trainer thành công",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("CREATE TRAINER ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
};
