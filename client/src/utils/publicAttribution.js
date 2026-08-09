const STORAGE_KEY = "ht_public_attribution_v1";
const SAFE_TOKEN = /^[a-z0-9._-]+$/;
const SAFE_CAMPAIGN = /^[\p{L}\p{N} ._-]*$/u;
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_HOST = /^(?:[a-z0-9-]+\.)*[a-z0-9-]+$/;
const CONTENT_TYPES = new Set(["page", "blog"]);

const boundedToken = (value, fallback, maxLength = 64) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (
    !normalized ||
    normalized.length > maxLength ||
    !SAFE_TOKEN.test(normalized)
  ) {
    return fallback;
  }
  return normalized;
};

const boundedCampaign = (value) => {
  const normalized = String(value || "").trim();
  if (normalized.length > 100 || !SAFE_CAMPAIGN.test(normalized)) return "";
  return normalized;
};

const safeSlug = (value) => {
  const normalized = String(value || "").trim().toLowerCase().slice(0, 160);
  return SAFE_SLUG.test(normalized) ? normalized : "";
};

const validCapturedAt = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const sourceFromReferrer = (referrerHost) => {
  if (!referrerHost) return { source: "direct", medium: "none" };
  if (/(^|\.)google\./i.test(referrerHost)) {
    return { source: "google", medium: "organic" };
  }
  return { source: referrerHost, medium: "referral" };
};

const safeLandingPath = (value) => {
  const path = String(value || "").slice(0, 300);
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[?#\\\s]/.test(path)
  ) {
    return null;
  }
  return path;
};

const parseUrl = (value) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const sanitizeStoredAttribution = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const landingPath = safeLandingPath(value.landingPath);
  if (!landingPath) return null;
  const referrerHost = String(value.referrerHost || "").toLowerCase().slice(0, 253);
  if (referrerHost && !SAFE_HOST.test(referrerHost)) return null;

  const contentType = CONTENT_TYPES.has(value.contentType)
    ? value.contentType
    : "page";
  return {
    source: boundedToken(value.source, "direct"),
    medium: boundedToken(value.medium, "none"),
    campaign: boundedCampaign(value.campaign),
    referrerHost,
    landingPath,
    contentType,
    contentSlug: contentType === "blog" ? safeSlug(value.contentSlug) : "",
    capturedAt: validCapturedAt(value.capturedAt),
  };
};

export const buildPublicAttribution = ({
  href,
  referrer = "",
  capturedAt = new Date().toISOString(),
  contentType,
  contentSlug,
}) => {
  const locationUrl = parseUrl(href);
  if (!locationUrl || !["http:", "https:"].includes(locationUrl.protocol)) {
    return null;
  }

  const referrerUrl = parseUrl(referrer);
  const isSameOriginReferrer = referrerUrl?.origin === locationUrl.origin;
  const parsedReferrerHost = isSameOriginReferrer
    ? ""
    : referrerUrl?.hostname.toLowerCase().slice(0, 253) || "";
  const referrerHost = SAFE_HOST.test(parsedReferrerHost) ? parsedReferrerHost : "";
  const fallbackSource = sourceFromReferrer(referrerHost);
  const normalizedContentType = CONTENT_TYPES.has(contentType)
    ? contentType
    : locationUrl.pathname.startsWith("/blog/")
      ? "blog"
      : "page";
  const pathSlug = locationUrl.pathname.split("/").filter(Boolean).at(-1);

  return {
    source: boundedToken(locationUrl.searchParams.get("utm_source"), fallbackSource.source),
    medium: boundedToken(locationUrl.searchParams.get("utm_medium"), fallbackSource.medium),
    campaign: boundedCampaign(locationUrl.searchParams.get("utm_campaign")),
    referrerHost,
    landingPath: safeLandingPath(locationUrl.pathname) || "/",
    contentType: normalizedContentType,
    contentSlug:
      normalizedContentType === "blog"
        ? safeSlug(contentSlug || pathSlug)
        : "",
    capturedAt: validCapturedAt(capturedAt),
  };
};

export const getPublicAttribution = ({
  browser = typeof window !== "undefined" ? window : null,
  documentObject = typeof document !== "undefined" ? document : null,
  capturedAt,
  contentType,
  contentSlug,
} = {}) => {
  if (!browser?.location?.href) return null;

  let stored = null;
  try {
    stored = sanitizeStoredAttribution(
      JSON.parse(browser.sessionStorage?.getItem(STORAGE_KEY) || "null"),
    );
  } catch {
    stored = null;
  }

  const initial =
    stored ||
    buildPublicAttribution({
      href: browser.location.href,
      referrer: documentObject?.referrer || "",
      capturedAt,
      contentType,
      contentSlug,
    });
  if (!initial) return null;

  const nextContentType = CONTENT_TYPES.has(contentType)
    ? contentType
    : initial.contentType;
  const next = {
    ...initial,
    contentType: nextContentType,
    contentSlug:
      nextContentType === "blog"
        ? safeSlug(contentSlug || initial.contentSlug)
        : "",
  };

  try {
    browser.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Attribution remains available for this request even with blocked storage.
  }
  return next;
};

export const rememberPublicContent = ({ contentType, contentSlug }) =>
  getPublicAttribution({ contentType, contentSlug });
