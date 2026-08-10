const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_DEDUPE_KEY = /^[a-z0-9:_-]+$/i;
const SAFE_MEASUREMENT_ID = /^G-[A-Z0-9]+$/;
const SAFE_PAGE_PATH = /^\/[a-z0-9/_%.-]*$/i;
const DEFAULT_PRODUCTION_HOSTNAME = "htcoachingweb.io.vn";
const trackedOnceInMemory = new Set();

const EVENT_RULES = Object.freeze({
  blog_read_engaged: {
    params: {
      content_type: new Set(["blog"]),
      content_slug: SAFE_SLUG,
      content_category: SAFE_SLUG,
      language: new Set(["vi", "en"]),
    },
    required: ["content_type", "content_slug", "content_category", "language"],
  },
  consultation_cta_click: {
    params: {
      cta_placement: new Set([
        "hero_primary",
        "blog_author",
        "blog_sidebar",
      ]),
      content_type: new Set(["homepage", "blog"]),
      content_slug: SAFE_SLUG,
    },
    required: ["cta_placement", "content_type"],
  },
  generate_lead: {
    params: {
      lead_type: new Set(["contact", "booking"]),
    },
    required: ["lead_type"],
  },
});

const sanitizeValue = (value, rule) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 160) return null;
  if (rule instanceof Set) return rule.has(normalized) ? normalized : null;
  return rule.test(normalized) ? normalized : null;
};

const sanitizeEventParams = (eventName, params) => {
  const eventRule = EVENT_RULES[eventName];
  if (
    !eventRule ||
    !params ||
    typeof params !== "object" ||
    Array.isArray(params)
  ) {
    return null;
  }

  const sanitized = {};
  Object.entries(eventRule.params).forEach(([key, rule]) => {
    const value = sanitizeValue(params[key], rule);
    if (value !== null) sanitized[key] = value;
  });
  if (eventRule.required.some((key) => !(key in sanitized))) return null;
  if (
    eventName === "consultation_cta_click" &&
    sanitized.content_type === "blog" &&
    !sanitized.content_slug
  ) {
    return null;
  }
  return sanitized;
};

const resolveGtag = () => {
  try {
    return typeof window !== "undefined" && typeof window.gtag === "function"
      ? window.gtag
      : null;
  } catch {
    return null;
  }
};

const resolveSessionStorage = () => {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

export const initializeAnalytics = ({
  measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID,
  allowedHostname =
    import.meta.env.VITE_GA4_HOSTNAME || DEFAULT_PRODUCTION_HOSTNAME,
  isProduction = import.meta.env.PROD,
  windowRef = typeof window !== "undefined" ? window : null,
  documentRef = typeof document !== "undefined" ? document : null,
} = {}) => {
  const normalizedMeasurementId = String(measurementId || "")
    .trim()
    .toUpperCase();
  const normalizedHostname = String(windowRef?.location?.hostname || "")
    .trim()
    .toLowerCase();
  const normalizedAllowedHostname = String(allowedHostname || "")
    .trim()
    .toLowerCase();

  if (
    !isProduction ||
    !windowRef ||
    !documentRef ||
    !SAFE_MEASUREMENT_ID.test(normalizedMeasurementId) ||
    !normalizedAllowedHostname ||
    normalizedHostname !== normalizedAllowedHostname
  ) {
    return false;
  }
  if (windowRef.__htGa4MeasurementId === normalizedMeasurementId) return true;

  const dataLayer = Array.isArray(windowRef.dataLayer)
    ? windowRef.dataLayer
    : [];
  windowRef.dataLayer = dataLayer;
  windowRef.gtag = function gtag() {
    dataLayer.push(arguments);
  };
  windowRef.__htGa4MeasurementId = normalizedMeasurementId;

  const script = documentRef.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(normalizedMeasurementId)}`;
  script.dataset.htGa4 = normalizedMeasurementId;
  documentRef.head.appendChild(script);

  windowRef.gtag("js", new Date());
  windowRef.gtag("config", normalizedMeasurementId, { send_page_view: false });
  return true;
};

export const trackAnalyticsPageView = (
  pathname,
  {
    gtag = resolveGtag(),
    measurementId =
      typeof window !== "undefined" ? window.__htGa4MeasurementId : "",
  } = {},
) => {
  const normalizedPath = String(pathname || "").trim();
  if (
    typeof gtag !== "function" ||
    !SAFE_MEASUREMENT_ID.test(String(measurementId || "")) ||
    normalizedPath.length > 300 ||
    !SAFE_PAGE_PATH.test(normalizedPath) ||
    normalizedPath.startsWith("//")
  ) {
    return false;
  }
  try {
    gtag("event", "page_view", { page_path: normalizedPath });
    return true;
  } catch {
    return false;
  }
};

export const trackAnalyticsEvent = (
  eventName,
  params = {},
  { gtag = resolveGtag() } = {},
) => {
  const sanitized = sanitizeEventParams(eventName, params);
  if (!sanitized || typeof gtag !== "function") return false;

  try {
    gtag("event", eventName, sanitized);
    return true;
  } catch {
    return false;
  }
};

export const trackAnalyticsEventOnce = (
  eventName,
  dedupeKey,
  params = {},
  { gtag = resolveGtag(), storage = resolveSessionStorage() } = {},
) => {
  const normalizedKey = String(dedupeKey || "").trim();
  if (
    !normalizedKey ||
    normalizedKey.length > 200 ||
    !SAFE_DEDUPE_KEY.test(normalizedKey)
  ) {
    return false;
  }

  const storageKey = `ht_analytics_once:${eventName}:${normalizedKey}`;
  if (trackedOnceInMemory.has(storageKey)) return false;
  try {
    if (storage?.getItem(storageKey) === "1") return false;
  } catch {
    // Analytics must not affect the user journey when storage is blocked.
  }

  const tracked = trackAnalyticsEvent(eventName, params, { gtag });
  if (!tracked) return false;

  trackedOnceInMemory.add(storageKey);
  try {
    storage?.setItem(storageKey, "1");
  } catch {
    // The event was sent; dedupe degrades to page-lifetime behavior only.
  }
  return true;
};
