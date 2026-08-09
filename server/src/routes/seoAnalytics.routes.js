import express from "express";

import { createSeoAnalyticsController } from "../controllers/seoAnalytics.controller.js";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { analyticsSyncLimiter } from "../middlewares/rateLimit.js";
import {
  validateSeoAnalyticsBlogDetail,
  validateSeoAnalyticsBlogList,
  validateSeoAnalyticsKeywordList,
  validateSeoAnalyticsRead,
  validateSeoAnalyticsSync,
} from "../middlewares/validation.js";
import { createSeoAnalyticsModule } from "../services/seoAnalytics.module.js";

export const createSeoAnalyticsRouter = ({ readService, syncService } = {}) => {
  const services =
    readService && syncService
      ? { readService, syncService }
      : createSeoAnalyticsModule();
  const controller = createSeoAnalyticsController(services);
  const router = express.Router();

  router.use(protect, requireRoles("admin"));
  router.get("/overview", validateSeoAnalyticsRead, controller.overview);
  router.get("/providers", controller.providers);
  router.get("/blog", validateSeoAnalyticsBlogList, controller.blog);
  router.get("/keywords", validateSeoAnalyticsKeywordList, controller.keywords);
  router.get(
    "/blog/:slug",
    validateSeoAnalyticsBlogDetail,
    controller.blogDetail,
  );
  router.post(
    "/sync",
    analyticsSyncLimiter,
    csrfProtection,
    validateSeoAnalyticsSync,
    controller.sync,
  );
  return router;
};

export default createSeoAnalyticsRouter();
