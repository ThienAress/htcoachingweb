const decodeXmlText = (value) =>
  String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");

export const xmlEscape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const buildUrlSet = ({ routes, siteUrl, normalizePath }) => {
  const entries = routes.map(
    (route) => `  <url>
    <loc>${xmlEscape(siteUrl + normalizePath(route.url))}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
};

export const buildSitemapIndex = ({ fileNames, siteUrl, lastmod }) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${fileNames
  .map(
    (fileName) => `  <sitemap>
    <loc>${xmlEscape(siteUrl + "/" + fileName)}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
  )
  .join("\n")}
</sitemapindex>
`;

export const extractSitemapRoutes = (xml, siteUrl) => {
  const origin = new URL(siteUrl).origin;
  return [
    ...String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi),
  ].flatMap((match) => {
    const url = new URL(decodeXmlText(match[1]));
    if (url.origin !== origin || url.search || url.hash) return [];
    if (/\/sitemap(?:-[a-z]+)?\.xml$/i.test(url.pathname)) return [];
    return [url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "")];
  });
};
