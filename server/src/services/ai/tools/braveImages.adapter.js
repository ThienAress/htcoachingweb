const ENDPOINT = "https://api.search.brave.com/res/v1/images/search";
const THUMBNAIL_HOST = "imgs.search.brave.com";
const MAX_RESPONSE_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 4_000;
const MAX_IMAGES_TOTAL = 3;
const MAX_TITLE_LENGTH = 120;

export const isFigureImagesEnabled = (env = process.env) =>
  env.AI_WEB_SEARCH_PROVIDER === "brave" && env.AI_PUBLIC_FIGURE_IMAGES !== "off";

const fold = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();

const httpsUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
};

// Only thumbnails served through Brave's own image proxy are used, so the browser never
// contacts the publisher's server, and an image is kept only when its page or title names the
// person (the last word of the canonical name).
export function normalizeFigureImages(body, canonical, limit = MAX_IMAGES_TOTAL) {
  const results = Array.isArray(body?.results) ? body.results : [];
  const tokens = fold(canonical).split(/\s+/).filter(Boolean);
  const surname = tokens.at(-1) || "";
  // A long first word ("lebron", "cristiano") is also distinctive enough to identify the person.
  const givenName = tokens.length > 1 && tokens[0].length >= 6 ? tokens[0] : "";
  if (surname.length < 3) return [];
  const seenHosts = new Set();
  const images = [];
  for (const result of results.slice(0, 40)) {
    const thumbnail = httpsUrl(result?.thumbnail?.src);
    const page = httpsUrl(result?.url);
    if (!thumbnail || thumbnail.hostname !== THUMBNAIL_HOST || !page) continue;
    const title = String(result?.title || "").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
    const haystack = fold(`${title} ${page.href}`);
    if (!haystack.includes(surname) && !(givenName && haystack.includes(givenName))) continue;
    const host = page.hostname.replace(/^www\./, "");
    if (seenHosts.has(host)) continue;
    seenHosts.add(host);
    const width = Number(result?.thumbnail?.width);
    const height = Number(result?.thumbnail?.height);
    images.push({
      src: thumbnail.href,
      pageUrl: page.href,
      host,
      title: title || host,
      ...(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
        ? { width: Math.round(width), height: Math.round(height) }
        : {}),
    });
    if (images.length >= limit) break;
  }
  return images;
}

async function searchOneSubject(canonical, limit, { signal, fetchImpl }) {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key || /\s/.test(key)) return [];
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", canonical);
  url.searchParams.set("count", "12");
  url.searchParams.set("safesearch", "strict");
  url.searchParams.set("spellcheck", "false");
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "error",
    signal,
    headers: { "X-Subscription-Token": key, Accept: "application/json" },
  });
  if (!response.ok) {
    await response.body?.cancel?.().catch(() => {});
    return [];
  }
  const length = Number(response.headers.get("content-length"));
  if (length > MAX_RESPONSE_BYTES) return [];
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) return [];
  return normalizeFigureImages(JSON.parse(text), canonical, limit);
}

/**
 * Up to three small thumbnails for the curated public figures named in the question.
 * Never throws: any failure, timeout or an empty result returns [].
 */
export async function fetchFigureImages(subjects, { signal, fetchImpl = fetch } = {}) {
  const names = [...new Set((subjects || []).filter(Boolean))].slice(0, 2);
  if (names.length === 0 || !isFigureImagesEnabled()) return [];
  const perSubject = names.length === 1 ? MAX_IMAGES_TOTAL : 1;
  const linked = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
    : AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  try {
    const groups = await Promise.all(
      names.map((name) =>
        searchOneSubject(name, perSubject, { signal: linked, fetchImpl }).catch(() => []),
      ),
    );
    return groups.flat().slice(0, MAX_IMAGES_TOTAL);
  } catch {
    return [];
  }
}
