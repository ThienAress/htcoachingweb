// Quà tặng hiển thị trên bảng giá, admin tự chỉnh. Khóa cố định (tab + gói) để không nhận khóa lạ từ client.
export const PRICING_GIFT_KEYS = Object.freeze([
  "1-1-basic",
  "1-1-advanced",
  "1-1-vip",
  "online-basic",
  "online-advanced",
  "online-vip",
  "trial",
]);

export const MAX_PRICING_GIFTS = 8;
export const MAX_PRICING_GIFT_LENGTH = 120;

const KEY_SET = new Set(PRICING_GIFT_KEYS);

export const isPricingGiftKey = (key) => typeof key === "string" && KEY_SET.has(key);

// Trả về { gifts } đã làm sạch, hoặc { error } bằng tiếng Việt để trả thẳng cho admin.
export const normalizePricingGifts = (value) => {
  if (!Array.isArray(value)) {
    return { error: "Danh sách quà tặng không hợp lệ" };
  }

  const gifts = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string") {
      return { error: "Mỗi quà tặng phải là một dòng chữ" };
    }
    const text = item.replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (text.length > MAX_PRICING_GIFT_LENGTH) {
      return { error: `Mỗi quà tặng tối đa ${MAX_PRICING_GIFT_LENGTH} ký tự` };
    }
    const dedupeKey = text.toLocaleLowerCase("vi");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    gifts.push(text);
  }

  if (gifts.length > MAX_PRICING_GIFTS) {
    return { error: `Mỗi gói tối đa ${MAX_PRICING_GIFTS} quà tặng` };
  }

  return { gifts };
};
