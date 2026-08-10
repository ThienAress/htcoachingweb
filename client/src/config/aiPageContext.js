const DEFAULT_SUGGESTIONS = [
  { emoji: "🌐", label: "Khám phá", value: "Giới thiệu các tính năng và dịch vụ chính của HTCOACHING" },
  { emoji: "🔥", label: "Tính TDEE", value: "Tính TDEE và macro cho tôi" },
  { emoji: "🥗", label: "Thực đơn", value: "Gợi ý thực đơn phù hợp mục tiêu tập luyện" },
  { emoji: "👨‍🏫", label: "Tìm HLV", value: "Giúp tôi chọn huấn luyện viên phù hợp" },
];

const suggestion = (emoji, label, value) => ({ emoji, label, value });

const PAGE_DEFINITIONS = [
  {
    path: "/",
    pageType: "home",
    list: [suggestion("🧭", "Tìm tính năng phù hợp", "Tôi nên bắt đầu với tính năng nào trên HTCOACHING?")],
  },
  {
    path: "/blog",
    pageType: "blog",
    list: [suggestion("📰", "Bài đáng đọc", "Gợi ý cho tôi chủ đề fitness đáng đọc")],
    detail: [
      suggestion("📖", "Tóm tắt bài viết", "Tóm tắt nội dung bài viết tôi đang đọc"),
      suggestion("💡", "Ý chính", "Những ý chính trong bài viết này là gì?"),
      suggestion("🏋️", "Cách áp dụng", "Tôi nên áp dụng kiến thức trong bài viết này như thế nào?"),
    ],
  },
  {
    path: "/cong-thuc-nau-an",
    pageType: "recipe",
    list: [suggestion("🍳", "Món ăn healthy", "Gợi ý vài công thức healthy phù hợp người tập gym")],
    detail: [
      suggestion("🥗", "Đánh giá món", "Món tôi đang xem có phù hợp mục tiêu tập luyện không?"),
      suggestion("📋", "Các bước nấu", "Tóm tắt đầy đủ các bước nấu món này"),
      suggestion("🔄", "Thay nguyên liệu", "Gợi ý thay thế nguyên liệu lành mạnh hơn cho món này"),
    ],
  },
  {
    path: "/huan-luyen-vien",
    pageType: "trainer_profile",
    detail: [
      suggestion("👨‍🏫", "Giới thiệu HLV", "Giới thiệu chuyên môn của HLV tôi đang xem"),
      suggestion("🎯", "Có phù hợp không?", "HLV này phù hợp với mục tiêu nào?"),
    ],
  },
  {
    path: "/ket-qua-khach-hang",
    pageType: "customer_story",
    detail: [
      suggestion("📊", "Tóm tắt kết quả", "Tóm tắt kết quả của học viên tôi đang xem"),
      suggestion("💪", "Phương pháp", "Học viên này đã áp dụng phương pháp gì?"),
    ],
  },
  {
    path: "/tdee-calculator",
    pageType: "tdee_calculator",
    list: [
      suggestion("🔥", "Tính TDEE", "Tính TDEE và macro cho tôi"),
      suggestion("❓", "Hiểu kết quả", "Giải thích cách đọc và áp dụng kết quả TDEE"),
    ],
  },
  {
    path: "/mealplan",
    pageType: "meal_plan",
    list: [suggestion("🥗", "Cá nhân hóa", "Giúp tôi cá nhân hóa thực đơn theo mục tiêu")],
  },
  {
    path: "/exercises",
    pageType: "exercises",
    list: [
      suggestion("💪", "Tìm bài tập", "Gợi ý bài tập phù hợp nhóm cơ tôi muốn tập"),
      suggestion("🎯", "Lên buổi tập", "Giúp tôi chọn bài cho một buổi tập"),
    ],
  },
  {
    path: "/club",
    pageType: "club",
    list: [suggestion("📍", "Chọn phòng tập", "Giúp tôi chọn phòng tập phù hợp vị trí và nhu cầu")],
  },
  {
    path: "/quet-mon-an",
    pageType: "meal_scan",
    list: [suggestion("📷", "Hiểu kết quả", "Giải thích cách đọc kết quả quét món ăn")],
  },
  {
    path: "/book-training",
    pageType: "booking",
    list: [suggestion("📅", "Chọn lịch tập", "Hướng dẫn tôi chọn lịch và đăng ký tập")],
  },
  { path: "/workout-plans", pageType: "workout_plan", list: [suggestion("📋", "Hiểu giáo án", "Giải thích giáo án tập của tôi")] },
  { path: "/training-schedule", pageType: "training_schedule", list: [suggestion("📅", "Xem lịch tập", "Cho tôi biết lịch tập sắp tới")] },
  { path: "/wallet", pageType: "wallet", list: [suggestion("💳", "Kiểm tra ví", "Kiểm tra số dư ví của tôi")] },
  { path: "/account", pageType: "account", list: [suggestion("⚙️", "Hỗ trợ tài khoản", "Hướng dẫn tôi quản lý tài khoản")] },
  { path: "/checkin", pageType: "checkin", list: [suggestion("✅", "Hướng dẫn check-in", "Hướng dẫn tôi check-in đúng cách")] },
  { path: "/my-history", pageType: "history", list: [suggestion("📈", "Xem lịch sử", "Giúp tôi hiểu lịch sử tập luyện của mình")] },
  { path: "/online-coaching", pageType: "online_coaching", list: [suggestion("🧭", "Dùng Coaching", "Hướng dẫn tôi sử dụng khu vực Online Coaching")] },
  { path: "/today", pageType: "dashboard", list: [suggestion("☀️", "Kế hoạch hôm nay", "Giúp tôi xem việc cần làm hôm nay")] },
  { path: "/progress", pageType: "progress", list: [suggestion("📊", "Hiểu tiến trình", "Giúp tôi hiểu tiến trình tập luyện của mình")] },
  { path: "/notifications", pageType: "notifications", list: [suggestion("🔔", "Hiểu thông báo", "Giải thích các thông báo tập luyện của tôi")] },
  { path: "/contracts", pageType: "contract", list: [suggestion("📝", "Hướng dẫn ký", "Hướng dẫn tôi hoàn tất quy trình ký hợp đồng")] },
];

const normalizePath = (value) => {
  const path = String(value || "/").split(/[?#]/, 1)[0];
  return path.length > 1 ? path.replace(/\/$/, "") : path;
};

export const getAiPageContext = (pathname) => {
  const path = normalizePath(pathname);
  const exact = PAGE_DEFINITIONS.find((item) => item.path === path);
  const definition =
    exact ||
    PAGE_DEFINITIONS
      .filter((item) => item.path !== "/" && path.startsWith(`${item.path}/`))
      .sort((left, right) => right.path.length - left.path.length)[0];
  if (!definition) {
    return { pageType: "general", isDetail: false };
  }
  const isDetail = path !== definition.path;
  return { ...definition, isDetail };
};

export const getAiPageSuggestions = (pathname) => {
  const page = getAiPageContext(pathname);
  const contextual = page.isDetail ? page.detail || page.list || [] : page.list || [];
  return [
    ...contextual,
    ...DEFAULT_SUGGESTIONS.filter(
      (fallback) => !contextual.some((item) => item.value === fallback.value),
    ),
  ].slice(0, 4);
};

export const getAiMessageContext = (pathname, pageTitle = "") => ({
  page: normalizePath(pathname),
  pageType: getAiPageContext(pathname).pageType,
  pageTitle,
});
