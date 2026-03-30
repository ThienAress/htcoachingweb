import crypto from "crypto";

export const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

export const csrfProtection = (req, res, next) => {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const csrfTokenFromCookie = req.cookies.csrfToken;
  const csrfTokenFromHeader = req.headers["x-csrf-token"];

  if (!csrfTokenFromCookie || !csrfTokenFromHeader) {
    return res.status(403).json({
      success: false,
      message: "CSRF token missing",
    });
  }

  if (csrfTokenFromCookie !== csrfTokenFromHeader) {
    return res.status(403).json({
      success: false,
      message: "Invalid CSRF token",
    });
  }

  next();
};
