import { getRequestContext } from "./requestContext.js";

const REDACTED_FIELDS = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "signatureimage",
  "refreshtoken",
  "accesstoken",
  "csrftoken",
  "authorization",
  "cookie",
  "phone",
  "cccd",
  "idnumber",
  "email",
  "address",
  "clientname",
  "recipient",
  "to",
  "oauthstate",
  "prompt",
  "messagecontent",
  "messages",
  "healthscreening",
  "intake",
  "assessment",
  "signedurl",
  "storagekey",
  "publicid",
]);

const sanitizeString = (value) => {
  const redacted = value
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[REDACTED_EMAIL]",
    )
    .replace(/\b(?:\+?84|0)\d{9,10}\b/g, "[REDACTED_PHONE]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED_JWT]",
    )
    .replace(/(https?:\/\/[^\s?]+)\?[^\s]*/gi, "$1?[REDACTED_QUERY]");
  return redacted.length > 1000
    ? `${redacted.slice(0, 1000)}...[truncated]`
    : redacted;
};

const sanitizeForLog = (value, seen = new WeakSet()) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") {
    return typeof value === "string" ? sanitizeString(value) : value;
  }
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeForLog(item, seen));
  }

  const sanitized = {};
  for (const [key, child] of Object.entries(value)) {
    sanitized[key] = REDACTED_FIELDS.has(key.toLowerCase())
      ? "[REDACTED]"
      : sanitizeForLog(child, seen);
  }
  return sanitized;
};

const write = (level, event, details = {}) => {
  const context = getRequestContext();
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: "htcoaching-api",
    event,
    ...(context.requestId ? { requestId: context.requestId } : {}),
    ...(context.traceId ? { traceId: context.traceId } : {}),
    ...sanitizeForLog(details),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

export const safeLog = {
  info(event, details = {}) {
    write("info", event, details);
  },

  error(event, error, context = null) {
    write("error", event, {
      errorName: error?.name || "Error",
      errorMessage: error?.message || String(error),
      ...(process.env.NODE_ENV !== "production" && error?.stack
        ? { stack: error.stack }
        : {}),
      ...(context ? { context } : {}),
    });
  },

  warn(event, message, context = null) {
    write("warn", event, {
      message,
      ...(context ? { context } : {}),
    });
  },

  security(event, details = {}) {
    write("warn", `security.${event}`, details);
  },
};

export { sanitizeForLog };
