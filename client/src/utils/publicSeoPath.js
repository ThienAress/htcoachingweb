export const normalizePublicPath = (value) => {
  const rawPath = String(value || "/")
    .trim()
    .split("?")[0]
    .split("#")[0];
  const pathWithLeadingSlash = rawPath.startsWith("/")
    ? rawPath
    : `/${rawPath}`;
  const normalizedPath = pathWithLeadingSlash.replace(/\/{2,}/g, "/");

  return normalizedPath === "/"
    ? "/"
    : `${normalizedPath.replace(/\/+$/, "")}/`;
};

export const buildPublicPageHref = (pathname, currentParams, targetPage) => {
  const params = new URLSearchParams(currentParams);
  const page = Math.max(Number.parseInt(targetPage, 10) || 1, 1);

  if (page === 1) params.delete("page");
  else params.set("page", String(page));

  const query = params.toString();
  return `${normalizePublicPath(pathname)}${query ? `?${query}` : ""}`;
};
