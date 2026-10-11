const MAX_SOURCES = 3;
const MAX_URL_LENGTH = 2048;
const RESOLUTION_BUDGET_MS = 750;
const DEADLINE_RESERVE_MS = 500;
const GOOGLE_GROUNDING_ORIGIN = "https://vertexaisearch.cloud.google.com";
const GOOGLE_GROUNDING_PATH = "/grounding-api-redirect/";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const RESERVED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".test",
  ".invalid",
  ".example",
  ".home",
  ".lan",
  ".localdomain",
  ".onion",
  ".arpa",
  ".corp",
];
const RESERVED_HOSTS = new Set([
  "example.com",
  "example.net",
  "example.org",
]);

const stripUnsafeText = (value) =>
  String(value ?? "").replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g,
    "",
  );

export const normalizeEvidenceSources = (sources) => {
  if (!Array.isArray(sources)) return [];
  const normalized = [];
  const seen = new Set();
  for (const source of sources) {
    try {
      const rawUri = String(source?.uri || "");
      if (
        rawUri.length > MAX_URL_LENGTH ||
        /[\u0000-\u0020\u007F\\]/.test(rawUri)
      ) continue;
      const url = new URL(rawUri);
      if (url.protocol !== "https:" || url.username || url.password) continue;
      url.hash = "";
      const uri = url.href;
      if (uri.length > MAX_URL_LENGTH) continue;
      if (!uri || seen.has(uri)) continue;
      const title = stripUnsafeText(source?.title)
        .replace(/[\r\n]+/g, " ")
        .trim()
        .slice(0, 160);
      if (!title) continue;
      seen.add(uri);
      normalized.push({ title, uri });
      if (normalized.length === MAX_SOURCES) break;
    } catch {
      // Provider metadata is untrusted and cannot cross this boundary.
    }
  }
  return normalized;
};

const isGoogleGroundingRedirect = (uri) => {
  if (typeof uri !== "string" || uri.length > MAX_URL_LENGTH) return false;
  if (/[\u0000-\u0020\u007F\\]/.test(uri)) return false;
  try {
    const url = new URL(uri);
    if (
      url.origin !== GOOGLE_GROUNDING_ORIGIN ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) return false;
    const token = url.pathname.slice(GOOGLE_GROUNDING_PATH.length);
    return (
      url.pathname.startsWith(GOOGLE_GROUNDING_PATH) &&
      /^[A-Za-z0-9_-]+={0,2}$/.test(token)
    );
  } catch {
    return false;
  }
};

const isIpLiteral = (hostname) => {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (host.includes(":")) return true;
  const parts = host.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d+$/.test(part) && Number(part) <= 255)
  );
};

const isTrustedPublisherHost = (hostname) => {
  const host = String(hostname || "").toLowerCase();
  const labels = host.split(".");
  if (
    !host ||
    host.length > 253 ||
    host === "localhost" ||
    host === "vertexaisearch.cloud.google.com" ||
    RESERVED_HOSTS.has(host) ||
    labels.length < 2 ||
    isIpLiteral(host) ||
    labels.some(
      (label) =>
        !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
    ) ||
    /^\d+$/.test(labels.at(-1))
  ) {
    return false;
  }
  return !RESERVED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
};

const resolvePublisherHost = (location) => {
  if (
    typeof location !== "string" ||
    location.length > MAX_URL_LENGTH ||
    /[\u0000-\u0020\u007F\\]/.test(location)
  ) return null;
  try {
    const destination = new URL(location);
    if (
      destination.protocol !== "https:" ||
      destination.username ||
      destination.password ||
      destination.port ||
      !isTrustedPublisherHost(destination.hostname)
    ) return null;
    return destination.hostname.toLowerCase();
  } catch {
    return null;
  }
};

const createAbortError = (reason) => {
  const error = new Error(reason?.message || "Source provenance resolution aborted");
  error.name = "AbortError";
  return error;
};

const resolveOneSource = async (source, { signal, timeoutMs }) => {
  if (!isGoogleGroundingRedirect(source.uri)) return source;
  const controller = new AbortController();
  let timer;
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });
  timer = setTimeout(
    () => controller.abort(new Error("Source provenance resolution timed out")),
    timeoutMs,
  );
  let rejectOnAbort;
  const abortPromise = new Promise((_, reject) => {
    rejectOnAbort = () => reject(createAbortError(controller.signal.reason));
    if (controller.signal.aborted) rejectOnAbort();
    else controller.signal.addEventListener("abort", rejectOnAbort, { once: true });
  });

  try {
    const response = await Promise.race([
      fetch(source.uri, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      }),
      abortPromise,
    ]);
    // Fetch must stop at headers: neither the redirect target nor a response body is consumed.
    Promise.resolve(response.body?.cancel?.()).catch(() => {});
    if (!REDIRECT_STATUSES.has(response.status)) return source;
    const publisherHost = resolvePublisherHost(response.headers.get("location"));
    return publisherHost
      ? {
          ...source,
          provenance: { kind: "google_grounding_redirect", publisherHost },
        }
      : source;
  } catch (error) {
    if (signal?.aborted) throw createAbortError(signal.reason);
    return source;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
    controller.signal.removeEventListener("abort", rejectOnAbort);
  }
};

/**
 * Resolves the publisher host exposed by an exact Google grounding redirect.
 * Provider source metadata is normalized first, and only this function creates
 * the additive provenance field.
 */
export async function resolveSourceProvenance(sources, { signal, deadlineAt } = {}) {
  if (signal?.aborted) throw createAbortError(signal.reason);
  const normalized = normalizeEvidenceSources(sources);
  const remainingMs = Number(deadlineAt) - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= DEADLINE_RESERVE_MS) {
    return normalized;
  }
  const timeoutMs = Math.min(
    RESOLUTION_BUDGET_MS,
    remainingMs - DEADLINE_RESERVE_MS,
  );
  if (timeoutMs <= 0) return normalized;
  return Promise.all(
    normalized.map((source) => resolveOneSource(source, { signal, timeoutMs })),
  );
}
