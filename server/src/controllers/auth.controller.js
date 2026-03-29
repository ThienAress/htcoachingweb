import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const isProd = process.env.NODE_ENV === "production";

export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin" });
    }
    const user = await User.findOne({ email, role: "admin" });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy admin" });
    }
    if (!user.password) {
      return res
        .status(400)
        .json({ success: false, message: "Admin chưa có mật khẩu" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Sai mật khẩu" });
    }

    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    // Hash refresh token trước khi lưu
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    user.refreshToken = hashedRefreshToken;
    await user.save();

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const loginTrainer = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin" });
    }
    const user = await User.findOne({ email, role: "trainer" });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy trainer" });
    }
    if (!user.password) {
      return res
        .status(400)
        .json({ success: false, message: "Tài khoản chưa có mật khẩu" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Sai mật khẩu" });
    }

    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    user.refreshToken = hashedRefreshToken;
    await user.save();

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const refreshTokenController = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res
      .status(401)
      .json({ success: false, message: "No refresh token" });
  }
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    // So sánh hash
    if (
      !user ||
      !user.refreshToken ||
      !(await bcrypt.compare(refreshToken, user.refreshToken))
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid refresh token" });
    }

    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
    const newRefreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    const hashedNewRefreshToken = await bcrypt.hash(newRefreshToken, 10);
    user.refreshToken = hashedNewRefreshToken;
    await user.save();

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, data: { token: newAccessToken } });
  } catch (err) {
    return res.status(403).json({ success: false, message: "Token expired" });
  }
};

export const logout = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (user) {
    user.refreshToken = null;
    await user.save();
  }

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
  });
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
  });
  res.clearCookie("csrfToken", {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
  });

  res.json({ success: true, message: "Logged out" });
};
