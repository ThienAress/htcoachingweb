import { protect } from "./auth.middleware.js";

export const optionalMealScanAuth = (req, res, next) => {
  if (!req.cookies?.accessToken) return next();
  return protect(req, res, next);
};
