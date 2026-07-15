/**
 * Safe Logger — Log errors mà không leak PII trong production.
 *
 * Trong production: chỉ log error message + stack trace (không log request body/params).
 * Trong dev: log đầy đủ để debug.
 *
 * Sử dụng: import { safeLog } from "../utils/safeLogger.js";
 *          safeLog.error("LABEL", err);
 */

const isProd = process.env.NODE_ENV === "production";

// Danh sách fields PII không bao giờ được log
const PII_FIELDS = new Set([
  "password",
  "newPassword",
  "currentPassword",
  "signatureImage",
  "refreshToken",
  "accessToken",
  "csrfToken",
  "phone",
  "cccd",
  "idNumber",
]);

/**
 * Sanitize object: loại bỏ PII fields trước khi log.
 */
const sanitizeForLog = (obj) => {
  if (!obj || typeof obj !== "object") return obj;

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELDS.has(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

export const safeLog = {
  error(label, error, context = null) {
    if (isProd) {
      // Production: chỉ log message + tên error, không log full object
      console.error(`[ERROR] ${label}:`, error?.message || error);
    } else {
      // Dev: log đầy đủ để debug
      console.error(`[ERROR] ${label}:`, error);
      if (context) {
        console.error(`[CONTEXT]`, sanitizeForLog(context));
      }
    }
  },

  warn(label, message) {
    console.warn(`[WARN] ${label}:`, message);
  },

  /**
   * Log security events (login failures, CSRF failures, etc.)
   * Luôn log ở mọi môi trường — nhưng KHÔNG log PII.
   */
  security(event, details = {}) {
    const safeDetails = sanitizeForLog(details);
    console.warn(`[SECURITY] ${event}:`, JSON.stringify(safeDetails));
  },
};
