import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Thiếu thông tin" });
    }

    const user = await User.findOne({ email, role: "admin" });

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy admin" });
    }

    if (!user.password) {
      return res.status(400).json({ message: "Admin chưa có mật khẩu" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Sai mật khẩu" });
    }

    // 🔥 ACCESS TOKEN (ngắn hạn)
    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    // 🔥 REFRESH TOKEN (dài hạn)
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    // 🔥 lưu refreshToken vào DB
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      token: accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
};

export const refreshTokenController = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    res.json({ token: newAccessToken });
  } catch (err) {
    return res.status(403).json({ message: "Token expired" });
  }
};

export const logout = async (req, res) => {
  const user = await User.findById(req.user.id);

  user.refreshToken = null;
  await user.save();

  res.json({ message: "Logged out" });
};
