import { resolveRequestServiceAccessTier } from "../services/serviceAccessPolicy.service.js";

export const resolveServiceAccessTierMiddleware = async (req, res, next) => {
  try {
    await resolveRequestServiceAccessTier(req);
    return next();
  } catch (error) {
    return next(error);
  }
};
