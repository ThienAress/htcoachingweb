export const formatSeoTitle = ({ title, siteName, defaultTitle }) => {
  const normalizedTitle = String(title || "").trim();
  if (!normalizedTitle) return defaultTitle;

  const normalizedSiteName = String(siteName || "").trim();
  if (normalizedTitle.toLowerCase() === normalizedSiteName.toLowerCase()) {
    return defaultTitle;
  }
  if (
    normalizedTitle
      .toLowerCase()
      .endsWith(`| ${normalizedSiteName.toLowerCase()}`)
  ) {
    return normalizedTitle;
  }
  return `${normalizedTitle} | ${normalizedSiteName}`;
};
