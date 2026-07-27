export const BLOG_CATEGORIES = [
  "tap-luyen",
  "dinh-duong",
  "hieu-co-the",
  "tu-duy-loi-song",
  "cong-cu-tinh-toan",
];

export const BLOG_SUB_CATEGORIES = {
  "tap-luyen": [
    "form-ky-thuat",
    "giao-an-mau",
    "sua-loi-sai",
    "theo-muc-tieu",
    "thiet-bi-dung-cu",
  ],
  "dinh-duong": [
    "macro-calo",
    "thuc-pham-cho",
    "goi-y-thuc-don",
    "thuc-pham-bo-sung",
  ],
  "hieu-co-the": [
    "voc-dang-tu-the",
    "dot-mo-xay-co",
    "phuc-hoi-chan-thuong",
    "hormone-giac-ngu",
  ],
  "tu-duy-loi-song": [
    "goc-nhin-chuyen-gia",
    "cau-chuyen-thanh-cong",
    "tu-duy-ky-luat",
    "thoi-quen-loi-song",
  ],
  "cong-cu-tinh-toan": [
    "huong-dan-tdee",
    "hieu-ket-qua-meal-plan",
    "tra-cuu-bai-tap",
    "chi-so-the-hinh",
  ],
};

export const LEGACY_BLOG_SUB_CATEGORY_ALIASES = {
  "phuong-phap-coaching": "goc-nhin-chuyen-gia",
};

const categorySet = new Set(BLOG_CATEGORIES);

export const isBlogCategory = (value) => categorySet.has(value);

export const normalizeBlogSubCategory = (value = "") =>
  LEGACY_BLOG_SUB_CATEGORY_ALIASES[value] || value;

export const isBlogSubCategory = (category, subCategory) => {
  if (!subCategory) return true;
  return (BLOG_SUB_CATEGORIES[category] || []).includes(
    normalizeBlogSubCategory(subCategory),
  );
};

export const getBlogSubCategoryFilter = (subCategory) => {
  const normalized = normalizeBlogSubCategory(subCategory);
  const legacyValues = Object.entries(LEGACY_BLOG_SUB_CATEGORY_ALIASES)
    .filter(([, current]) => current === normalized)
    .map(([legacy]) => legacy);

  return legacyValues.length > 0
    ? { $in: [normalized, ...legacyValues] }
    : normalized;
};
