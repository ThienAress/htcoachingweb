export const escapeRegex = (value, maxLength = 100) =>
  String(value || "")
    .trim()
    .slice(0, maxLength)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
