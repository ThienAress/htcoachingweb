const THUMBNAIL_HOST = "imgs.search.brave.com";
const MAX_IMAGES = 3;

const safeHttps = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
};

/**
 * Validated thumbnails from a web answer card. Only https thumbnails served by the search
 * provider's image proxy are rendered, each linking to its publisher page.
 */
export const getSafeWebImages = (cards = []) => {
  const seen = new Set();
  const images = [];
  for (const card of cards) {
    if (card?.cardType !== "webSources" || !Array.isArray(card.data?.images)) continue;
    for (const image of card.data.images) {
      const src = safeHttps(image?.src);
      const page = safeHttps(image?.pageUrl);
      if (!src || src.hostname !== THUMBNAIL_HOST || !page || seen.has(src.href)) continue;
      seen.add(src.href);
      images.push({
        src: src.href,
        pageUrl: page.href,
        host: page.hostname.replace(/^www\./, ""),
        title: String(image?.title || page.hostname).slice(0, 120),
      });
      if (images.length >= MAX_IMAGES) return images;
    }
  }
  return images;
};
