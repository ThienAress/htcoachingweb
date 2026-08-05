import { normalizePublicPath } from "../src/utils/publicSeoPath.js";

const normalizeSitemapLocations = (existing, siteUrl) => {
  const siteOrigin = new URL(siteUrl).origin;

  return existing.replace(
    /<loc>\s*([^<]+?)\s*<\/loc>/gi,
    (locationTag, locationValue) => {
      try {
        const url = new URL(locationValue.trim());
        if (url.origin !== siteOrigin || url.search || url.hash) {
          return locationTag;
        }

        url.pathname = normalizePublicPath(url.pathname);
        return "<loc>" + url.href + "</loc>";
      } catch {
        return locationTag;
      }
    },
  );
};

export const mergeMissingStaticRoutes = ({
  existing,
  staticRoutes,
  siteUrl,
  routeToXml,
}) => {
  const normalizedExisting = normalizeSitemapLocations(existing, siteUrl);
  const missingRoutes = staticRoutes.filter(
    (route) =>
      !normalizedExisting.includes(
        "<loc>" + siteUrl + normalizePublicPath(route.url) + "</loc>",
      ),
  );

  if (missingRoutes.length === 0) {
    return {
      content: normalizedExisting,
      missingCount: 0,
      changed: normalizedExisting !== existing,
    };
  }

  const closingTag = "</urlset>";
  if (!normalizedExisting.includes(closingTag)) {
    return { content: null, missingCount: 0, changed: false };
  }

  return {
    content: normalizedExisting.replace(
      closingTag,
      missingRoutes.map(routeToXml).join("\n") + "\n" + closingTag,
    ),
    missingCount: missingRoutes.length,
    changed: true,
  };
};