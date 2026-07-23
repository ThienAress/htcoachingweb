import crypto from "crypto";
import { recordHttpRequest } from "../observability/metrics.js";
import { safeLog } from "../utils/safeLogger.js";
import { runWithRequestContext } from "../utils/requestContext.js";

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]{8,100}$/;
const TRACEPARENT_PATTERN =
  /^[0-9a-f]{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i;

export const requestTelemetry = (req, res, next) => {
  const incoming = req.get("x-request-id");
  const requestId = REQUEST_ID_PATTERN.test(incoming || "")
    ? incoming
    : crypto.randomUUID();
  const startedAt = performance.now();
  const traceMatch = TRACEPARENT_PATTERN.exec(req.get("traceparent") || "");
  const traceId = traceMatch?.[1]?.toLowerCase() || crypto.randomBytes(16).toString("hex");

  req.id = requestId;
  req.traceId = traceId;
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Trace-Id", traceId);
  return runWithRequestContext({ requestId, traceId }, () => {
    res.on("finish", () => {
      const durationMs = Number((performance.now() - startedAt).toFixed(2));
      const route = req.route?.path
        ? `${req.baseUrl || ""}${req.route.path}`
        : req.baseUrl || "unmatched";
      recordHttpRequest({
        method: req.method,
        route,
        status: res.statusCode,
        durationMs,
      });

      if (process.env.NODE_ENV === "production" || res.statusCode >= 400) {
        safeLog.info("http.request", {
          method: req.method,
          route,
          status: res.statusCode,
          durationMs,
        });
      }
    });
    next();
  });
};
