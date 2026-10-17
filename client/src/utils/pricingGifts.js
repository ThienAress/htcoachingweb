// Khóa (tab-gói) khớp với server/src/utils/pricingGifts.js; nhãn dùng cho trang quản trị.
export const PRICING_GIFT_PLANS = Object.freeze([
  { key: "1-1-basic", tab: "1-1", plan: "Cơ bản" },
  { key: "1-1-advanced", tab: "1-1", plan: "Nâng cao" },
  { key: "1-1-vip", tab: "1-1", plan: "VIP" },
  { key: "online-basic", tab: "ONLINE", plan: "Cơ bản" },
  { key: "online-advanced", tab: "ONLINE", plan: "Nâng cao" },
  { key: "online-vip", tab: "ONLINE", plan: "VIP" },
  { key: "trial", tab: "Trải nghiệm", plan: "Gói trải nghiệm" },
]);

export const MAX_PRICING_GIFTS = 8;
export const MAX_PRICING_GIFT_LENGTH = 120;

// Admin đã lưu danh sách cho gói (kể cả danh sách rỗng) thì dùng danh sách đó, chưa lưu thì dùng quà mặc định.
export const resolvePricingGifts = (overrides, key, defaults = []) => {
  const saved = overrides?.[key];
  return Array.isArray(saved) ? saved : defaults;
};

// Mỗi dòng là một quà tặng; bỏ dòng trống và dòng lặp (không phân biệt hoa thường).
export const giftsFromText = (text) => {
  const seen = new Set();
  const gifts = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const gift = line.replace(/\s+/g, " ").trim();
    const dedupeKey = gift.toLocaleLowerCase("vi");
    if (!gift || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    gifts.push(gift);
  }
  return gifts;
};

export const giftsToText = (gifts) => (Array.isArray(gifts) ? gifts.join("\n") : "");

export const validateGifts = (gifts) => {
  if (gifts.length > MAX_PRICING_GIFTS) {
    return `Mỗi gói tối đa ${MAX_PRICING_GIFTS} quà tặng`;
  }
  if (gifts.some((gift) => gift.length > MAX_PRICING_GIFT_LENGTH)) {
    return `Mỗi quà tặng tối đa ${MAX_PRICING_GIFT_LENGTH} ký tự`;
  }
  return "";
};
