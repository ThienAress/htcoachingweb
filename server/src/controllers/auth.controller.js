import { generateCsrfToken } from "../middlewares/csrf.js";
import { incrementMetric } from "../observability/metrics.js";
import {
  ACCESS_TOKEN_MAX_AGE_MS,
  isAuthSessionError,
  REFRESH_TOKEN_MAX_AGE_MS,
  revokeAuthSession,
  rotateAuthSession,
} from "../services/authSession.service.js";
import { safeLog } from "../utils/safeLogger.js";
import { setCsrfCookie } from "../utils/csrfCookie.js";

const isProd = process.env.NODE_ENV === "production";

const getAuthCookieOptions = (maxAge = null) => {
  const options = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };

  if (maxAge !== null) {
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

const setAuthCookies = (
  res,
  accessToken,
  refreshToken,
  refreshTokenMaxAgeMs = REFRESH_TOKEN_MAX_AGE_MS,
) => {
  // Xóa cookie cũ (không có domain) để tránh trùng lặp trên production
  if (isProd) {
    res.clearCookie("csrfToken", { path: "/", httpOnly: false, secure: true, sameSite: "none" });
    res.clearCookie("accessToken", { path: "/", httpOnly: true, secure: true, sameSite: "none" });
    res.clearCookie("refreshToken", { path: "/", httpOnly: true, secure: true, sameSite: "none" });
  }

  res.cookie("accessToken", accessToken, getAuthCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
  res.cookie(
    "refreshToken",
    refreshToken,
    getAuthCookieOptions(refreshTokenMaxAgeMs),
  );

  const csrfToken = generateCsrfToken();
  setCsrfCookie(res, csrfToken, getCsrfCookieOptions());
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


export const refreshTokenController = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    incrementMetric("auth.refresh_missing");
    return res
      .status(401)
      .json({ success: false, message: "No refresh token" });
  }

  try {
    const {
      user,
      accessToken,
      refreshToken: newRefreshToken,
      refreshTokenMaxAgeMs,
    } = await rotateAuthSession(refreshToken);

    setAuthCookies(
      res,
      accessToken,
      newRefreshToken,
      refreshTokenMaxAgeMs,
    );
    incrementMetric("auth.refresh_succeeded");

    return res.json({
      success: true,
      data: {
        user: sanitizeUserResponse(user),
      },
    });
  } catch (err) {
    clearAuthCookies(res);
    if (isAuthSessionError(err)) {
      incrementMetric("auth.refresh_rejected");
      return res.status(403).json({
        success: false,
        message: "Invalid refresh token",
      });
    }
    safeLog.error("auth.refresh_failed", err);
    incrementMetric("auth.refresh_failed");
    return res.status(500).json({
      success: false,
      message: "Lỗi làm mới phiên đăng nhập",
    });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) await revokeAuthSession(refreshToken);

    clearAuthCookies(res);
    incrementMetric("auth.logout_succeeded");

    return res.json({
      success: true,
      message: "Logged out",
    });
  } catch (err) {
    safeLog.error("LOGOUT", err);
    incrementMetric("auth.logout_failed");

    clearAuthCookies(res);

    return res.status(500).json({
      success: false,
      message: "Lỗi logout",
    });
  }
};
