export const buildConversionOriginFields = ({ originType, originId } = {}) => {
  const normalizedId = String(originId || "").trim();
  if (!normalizedId) return {};
  if (originType === "booking") return { originBookingId: normalizedId };
  if (originType === "contact") {
    return { originContactMessageId: normalizedId };
  }
  return {};
};

export const pickDefinedFields = (source, fields) =>
  Object.fromEntries(
    fields
      .filter((field) => source[field] !== undefined)
      .map((field) => [field, source[field]]),
  );
