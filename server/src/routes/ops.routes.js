import express from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { getMetricsSnapshot } from "../observability/metrics.js";
import {
  getOperationalAlerts,
  getPrometheusMetrics,
  incrementMetric,
  observeMetric,
} from "../observability/metrics.js";
import WebVitalSample from "../models/WebVitalSample.js";
import F1Customer from "../models/F1Customer.js";
import F1DataDeletionJob from "../models/F1DataDeletionJob.js";
import F1Media from "../models/F1Media.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { cspReportLimiter, rumLimiter } from "../middlewares/rateLimit.js";
import { runF1RetentionSweep } from "../services/f1PrivacyLifecycle.service.js";
import { safeLog } from "../utils/safeLogger.js";
import { getRuntimeState } from "../operations/runtimeState.js";
import { getRumBaseline } from "../observability/rumBaseline.js";

const router = express.Router();

const hasValidOpsToken = (req) => {
  const expected = String(process.env.OPS_METRICS_TOKEN || "");
  const received = String(req.get("x-ops-token") || "");
  if (expected.length < 24 || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(received, "utf8"),
    Buffer.from(expected, "utf8"),
  );
};

const requireOpsReadAccess = (req, res, next) => {
  if (hasValidOpsToken(req)) return next();
  return protect(req, res, () => requireRoles("admin")(req, res, next));
};

const sendReadiness = (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  const runtimeState = getRuntimeState();
  const ready = databaseReady && !runtimeState.draining;
  res.setHeader("Cache-Control", "no-store");
  res.status(ready ? 200 : 503).json({
    success: ready,
    service: "htcoaching-api",
    database: databaseReady ? "ready" : "unavailable",
    lifecycle: runtimeState.draining ? "draining" : "ready",
  });
};

router.get("/health/live", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    success: true,
    service: "htcoaching-api",
    lifecycle: getRuntimeState().draining ? "draining" : "running",
  });
});

router.get("/health/ready", sendReadiness);
router.get("/health", sendReadiness);

router.get("/metrics", protect, requireRoles("admin"), (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, data: getMetricsSnapshot() });
});

router.get(
  "/metrics/prometheus",
  requireOpsReadAccess,
  (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.type("text/plain; version=0.0.4");
    res.send(getPrometheusMetrics());
  },
);

router.get("/alerts", requireOpsReadAccess, (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, data: getOperationalAlerts() });
});

router.get("/rum-baseline", requireOpsReadAccess, async (_req, res, next) => {
  try {
    const baseline = await getRumBaseline({ days: 7 });
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true, data: baseline });
  } catch (error) {
    next(error);
  }
});

const normalizeRumRoute = (value) => {
  const pathname = String(value || "").split("?")[0].slice(0, 120);
  if (!pathname.startsWith("/") || /[^a-zA-Z0-9/_-]/.test(pathname)) {
    return "/unknown";
  }
  return pathname
    .split("/")
    .map((segment) =>
      /^[0-9a-f]{24}$/i.test(segment) || /^\d+$/.test(segment)
        ? ":id"
        : segment,
    )
    .join("/");
};

const webVitalRating = (name, value) => {
  const thresholds = {
    LCP: [2500, 4000],
    INP: [200, 500],
    CLS: [0.1, 0.25],
  }[name];
  if (value <= thresholds[0]) return "good";
  if (value <= thresholds[1]) return "needs-improvement";
  return "poor";
};

router.post("/web-vitals", rumLimiter, async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").toUpperCase();
    const value = Number(req.body?.value);
    const device = req.body?.device === "mobile" ? "mobile" : "desktop";
    if (!["LCP", "INP", "CLS"].includes(name) || !Number.isFinite(value)) {
      return res.status(400).json({ success: false, message: "Invalid metric" });
    }
    const maximum = name === "CLS" ? 10 : 120_000;
    if (value < 0 || value > maximum) {
      return res.status(400).json({ success: false, message: "Invalid value" });
    }
    const route = normalizeRumRoute(req.body?.route);
    await WebVitalSample.create({
      name,
      value,
      route,
      device,
      rating: webVitalRating(name, value),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    incrementMetric("rum.samples");
    observeMetric(
      name === "LCP"
        ? "rum.lcp_ms"
        : name === "INP"
          ? "rum.inp_ms"
          : "rum.cls_score",
      value,
    );
    return res.status(202).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/csp-report",
  cspReportLimiter,
  express.json({
    type: ["application/csp-report", "application/reports+json"],
    limit: "32kb",
  }),
  (req, res) => {
    incrementMetric("security.csp_reports");
    const report = Array.isArray(req.body) ? req.body[0]?.body : req.body?.["csp-report"];
    safeLog.security("csp_report", {
      effectiveDirective: report?.effectiveDirective || report?.["effective-directive"] || "",
      disposition: report?.disposition || "report",
      statusCode: Number(report?.statusCode || report?.["status-code"] || 0),
    });
    res.status(204).end();
  },
);

router.get(
  "/privacy/f1",
  protect,
  requireRoles("admin"),
  async (_req, res, next) => {
    try {
      const [customers, mediaByStatus, deletionJobs] = await Promise.all([
        F1Customer.countDocuments({ deletedAt: null }),
        F1Media.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        F1DataDeletionJob.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
      ]);
      res.setHeader("Cache-Control", "no-store");
      return res.json({
        success: true,
        data: { customers, mediaByStatus, deletionJobs },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/privacy/f1/retention",
  protect,
  csrfProtection,
  requireRoles("admin"),
  async (req, res, next) => {
    try {
      const result = await runF1RetentionSweep({
        enforce: req.body?.enforce === true,
      });
      return res.json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
