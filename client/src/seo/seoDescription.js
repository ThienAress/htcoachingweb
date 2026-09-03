export const SEO_DESCRIPTION_MIN_LENGTH = 150;
export const SEO_DESCRIPTION_MAX_LENGTH = 160;

export const normalizeSeoDescription = (value) => {
  const description = String(value || "").replace(/\s+/gu, " ").trim();
  if (description.length <= SEO_DESCRIPTION_MAX_LENGTH) return description;

  const prefix = description.slice(0, SEO_DESCRIPTION_MAX_LENGTH - 1);
  const wordBoundary = prefix.lastIndexOf(" ");
  const end = wordBoundary >= SEO_DESCRIPTION_MIN_LENGTH - 1
    ? wordBoundary
    : prefix.length;

  return `${prefix.slice(0, end).trimEnd()}…`;
};
