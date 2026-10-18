// Nội dung bảng giá và ưu đãi đăng nhập do admin chỉnh. Khóa cố định để không nhận khóa lạ từ client.
export const PRICING_CONTENT_KEYS = Object.freeze([
  "1-1-customer",
  "1-1-system",
  "online-customer",
  "online-system",
  "trial-customer",
  "trial-system",
]);

export const MAX_PRICING_CONTENT_ITEMS = 12;
export const MAX_PRICING_CONTENT_LENGTH = 160;

export const DEFAULT_LOGIN_PROMO = Object.freeze({ enabled: true, percent: 15 });
export const MIN_LOGIN_PROMO_PERCENT = 1;
export const MAX_LOGIN_PROMO_PERCENT = 100;

const KEY_SET = new Set(PRICING_CONTENT_KEYS);

export const isPricingContentKey = (key) => typeof key === "string" && KEY_SET.has(key);

// Trả về { items } đã làm sạch, hoặc { error } bằng tiếng Việt để trả thẳng cho admin.
export const normalizePricingContent = (value) => {
  if (!Array.isArray(value)) {
    return { error: "Danh sách quyền lợi không hợp lệ" };
  }

  const items = [];
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== "string") {
      return { error: "Mỗi quyền lợi phải là một dòng chữ" };
    }
    const text = entry.replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (text.length > MAX_PRICING_CONTENT_LENGTH) {
      return { error: `Mỗi quyền lợi tối đa ${MAX_PRICING_CONTENT_LENGTH} ký tự` };
    }
    const dedupeKey = text.toLocaleLowerCase("vi");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    items.push(text);
  }

  if (items.length === 0) {
    return { error: "Cần ít nhất một quyền lợi; muốn dùng nội dung gốc hãy chọn Khôi phục mặc định" };
  }
  if (items.length > MAX_PRICING_CONTENT_ITEMS) {
    return { error: `Mỗi danh sách tối đa ${MAX_PRICING_CONTENT_ITEMS} quyền lợi` };
  }

  return { items };
};

// Ưu đãi giảm giá cho lần đăng ký đầu có tài khoản: bật/tắt và phần trăm (số nguyên).
export const normalizeLoginPromo = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Cấu hình ưu đãi không hợp lệ" };
  }
  const { enabled, percent } = value;
  if (typeof enabled !== "boolean") {
    return { error: "Trạng thái bật/tắt ưu đãi không hợp lệ" };
  }
  if (
    !Number.isSafeInteger(percent)
    || percent < MIN_LOGIN_PROMO_PERCENT
    || percent > MAX_LOGIN_PROMO_PERCENT
  ) {
    return {
      error: `Phần trăm giảm phải là số nguyên từ ${MIN_LOGIN_PROMO_PERCENT} đến ${MAX_LOGIN_PROMO_PERCENT}`,
    };
  }
  return { loginPromo: { enabled, percent } };
};
