import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateCsrfToken } from "../middlewares/csrf.js";

const isProd = process.env.NODE_ENV === "production";

const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";

const getAuthCookieOptions = (maxAge = null) => {
  const options = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };

  if (maxAge) {
    options.maxAge = maxAge;
  }

  return options;
};

const getCsrfCookieOptions = () => ({
  httpOnly: false,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
  maxAge: 24 * 60 * 60 * 1000,
});

const signAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

const signRefreshToken = (user) =>
  jwt.sign({ id: user._id }, process.env.REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, getAuthCookieOptions(15 * 60 * 1000));
  res.cookie(
    "refreshToken",
    refreshToken,
    getAuthCookieOptions(7 * 24 * 60 * 60 * 1000),
  );

  const csrfToken = generateCsrfToken();
  res.cookie("csrfToken", csrfToken, getCsrfCookieOptions());
};

const clearAuthCookies = (res) => {
  res.clearCookie("accessToken", {
    ...getAuthCookieOptions(),
    httpOnly: true,
  });

  res.clearCookie("refreshToken", {
    ...getAuthCookieOptions(),
    httpOnly: true,
  });

  res.clearCookie("csrfToken", {
    ...getCsrfCookieOptions(),
    httpOnly: false,
  });
};

const sanitizeUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const handleRoleLogin = async (req, res, role) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail, role });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          role === "admin" ? "Không tìm thấy admin" : "Không tìm thấy trainer",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message:
          role === "admin"
            ? "Admin chưa có mật khẩu"
            : "Tài khoản chưa có mật khẩu",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Sai mật khẩu" });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    user.refreshToken = hashedRefreshToken;
    await user.save();

    setAuthCookies(res, accessToken, refreshToken);

    return res.json({
      success: true,
      data: {
        user: sanitizeUserResponse(user),
      },
    });
  } catch (err) {
    console.error(`[${role.toUpperCase()} LOGIN ERROR]:`, err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
};

export const loginAdmin = async (req, res) => {
  return handleRoleLogin(req, res, "admin");
};

export const loginTrainer = async (req, res) => {
  return handleRoleLogin(req, res, "trainer");
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

    if (
      !user ||
      !user.refreshToken ||
      !(await bcrypt.compare(refreshToken, user.refreshToken))
    ) {
      clearAuthCookies(res);
      return res
        .status(403)
        .json({ success: false, message: "Invalid refresh token" });
    }

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);

    const hashedNewRefreshToken = await bcrypt.hash(newRefreshToken, 10);
    user.refreshToken = hashedNewRefreshToken;
    await user.save();

    setAuthCookies(res, newAccessToken, newRefreshToken);

    return res.json({
      success: true,
      data: {
        token: newAccessToken,
        user: sanitizeUserResponse(user),
      },
    });
  } catch (err) {
    clearAuthCookies(res);
    return res.status(403).json({
      success: false,
      message: "Token expired",
    });
  }
};

export const logout = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        user.refreshToken = null;
        await user.save();
      }
    }

    clearAuthCookies(res);

    return res.json({
      success: true,
      message: "Logged out",
    });
  } catch (err) {
    console.error("[LOGOUT ERROR]:", err);

    clearAuthCookies(res);

    return res.status(500).json({
      success: false,
      message: "Lỗi logout",
    });
  }
};
