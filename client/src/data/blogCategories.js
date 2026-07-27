export const BLOG_CATEGORIES = [
  {
    value: "tap-luyen",
    key: "categories.tap-luyen",
    label: "Tập Luyện",
  },
  {
    value: "dinh-duong",
    key: "categories.dinh-duong",
    label: "Dinh Dưỡng",
  },
  {
    value: "hieu-co-the",
    key: "categories.hieu-co-the",
    label: "Hiểu Về Cơ Thể",
  },
  {
    value: "tu-duy-loi-song",
    key: "categories.tu-duy-loi-song",
    label: "Tư Duy & Lối Sống",
  },
  {
    value: "cong-cu-tinh-toan",
    key: "categories.cong-cu-tinh-toan",
    label: "Công Cụ & Tính Toán",
  },
];

export const BLOG_SUB_CATEGORIES = {
  "tap-luyen": [
    {
      value: "form-ky-thuat",
      key: "sub_categories.form-ky-thuat",
      label: "Kỹ thuật & Form tập",
    },
    {
      value: "giao-an-mau",
      key: "sub_categories.giao-an-mau",
      label: "Chương trình tập mẫu",
    },
    {
      value: "sua-loi-sai",
      key: "sub_categories.sua-loi-sai",
      label: "Sửa lỗi sai thường gặp",
    },
    {
      value: "theo-muc-tieu",
      key: "sub_categories.theo-muc-tieu",
      label: "Tập theo mục tiêu",
    },
    {
      value: "thiet-bi-dung-cu",
      key: "sub_categories.thiet-bi-dung-cu",
      label: "Thiết bị & Dụng cụ tập",
    },
  ],
  "dinh-duong": [
    {
      value: "macro-calo",
      key: "sub_categories.macro-calo",
      label: "Hiểu về Macro & Calo",
    },
    {
      value: "thuc-pham-cho",
      key: "sub_categories.thuc-pham-cho",
      label: "Thực phẩm & Đi chợ",
    },
    {
      value: "goi-y-thuc-don",
      key: "sub_categories.goi-y-thuc-don",
      label: "Gợi ý Thực đơn",
    },
    {
      value: "thuc-pham-bo-sung",
      key: "sub_categories.thuc-pham-bo-sung",
      label: "Thực phẩm bổ sung",
    },
  ],
  "hieu-co-the": [
    {
      value: "voc-dang-tu-the",
      key: "sub_categories.voc-dang-tu-the",
      label: "Giải mã Vóc dáng & Tư thế",
    },
    {
      value: "dot-mo-xay-co",
      key: "sub_categories.dot-mo-xay-co",
      label: "Cơ chế Đốt mỡ & Xây cơ",
    },
    {
      value: "phuc-hoi-chan-thuong",
      key: "sub_categories.phuc-hoi-chan-thuong",
      label: "Phục hồi & Chấn thương",
    },
    {
      value: "hormone-giac-ngu",
      key: "sub_categories.hormone-giac-ngu",
      label: "Hormone & Giấc ngủ",
    },
  ],
  "tu-duy-loi-song": [
    {
      value: "goc-nhin-chuyen-gia",
      key: "sub_categories.goc-nhin-chuyen-gia",
      label: "Góc nhìn chuyên gia",
    },
    {
      value: "cau-chuyen-thanh-cong",
      key: "sub_categories.cau-chuyen-thanh-cong",
      label: "Câu chuyện thay đổi",
    },
    {
      value: "tu-duy-ky-luat",
      key: "sub_categories.tu-duy-ky-luat",
      label: "Tư duy kỷ luật (Mindset)",
    },
    {
      value: "thoi-quen-loi-song",
      key: "sub_categories.thoi-quen-loi-song",
      label: "Thói quen & Lối sống",
    },
  ],
  "cong-cu-tinh-toan": [
    {
      value: "huong-dan-tdee",
      key: "sub_categories.huong-dan-tdee",
      label: "Hướng dẫn TDEE Calculator",
    },
    {
      value: "hieu-ket-qua-meal-plan",
      key: "sub_categories.hieu-ket-qua-meal-plan",
      label: "Hiểu kết quả Meal Plan",
    },
    {
      value: "tra-cuu-bai-tap",
      key: "sub_categories.tra-cuu-bai-tap",
      label: "Tra cứu bài tập",
    },
    {
      value: "chi-so-the-hinh",
      key: "sub_categories.chi-so-the-hinh",
      label: "Chỉ số thể hình",
    },
  ],
};

export const BLOG_CATEGORY_MAP = Object.fromEntries(
  BLOG_CATEGORIES.map((category) => [category.value, category.label]),
);

export const LEGACY_BLOG_SUB_CATEGORY_ALIASES = {
  "phuong-phap-coaching": "goc-nhin-chuyen-gia",
};

export const normalizeBlogSubCategory = (value = "") =>
  LEGACY_BLOG_SUB_CATEGORY_ALIASES[value] || value;

export const getBlogSubCategoryLabel = (category, subCategory) => {
  const normalizedSubCategory = normalizeBlogSubCategory(subCategory);
  const match = (BLOG_SUB_CATEGORIES[category] || []).find(
    (item) => item.value === normalizedSubCategory,
  );
  return match?.label || subCategory;
};
