const decodeXmlText = (value) =>
  String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");

export const routesFromSitemap = (sitemapXml, siteUrl) => {
  const siteOrigin = new URL(siteUrl).origin;
  const locations = [
    ...String(sitemapXml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi),
  ];

  if (locations.length === 0) {
    throw new Error("Generated sitemap does not contain any URLs");
  }

  const routes = locations.map((match) => {
    const url = new URL(decodeXmlText(match[1]));
    if (url.origin !== siteOrigin) {
      throw new Error("Sitemap URL is outside the site origin: " + url.href);
    }
    if (url.search || url.hash) {
      throw new Error("Sitemap URL must not contain a query or hash: " + url.href);
    }
    return url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
  });

  return [...new Set(routes)];
};

export const mapWithConcurrency = async (items, concurrency, worker) => {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new Error("Prerender concurrency must be a positive integer");
  }

  const results = new Array(items.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => runWorker(),
    ),
  );
  return results;
};
