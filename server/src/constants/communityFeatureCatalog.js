export const COMMUNITY_FEATURE_CATALOG_VERSION = "2026-08-09";

const GROUPS = Object.freeze({
  AI_SUPPORT: Object.freeze({ key: "ai_support", label: "AI hỗ trợ" }),
  NUTRITION: Object.freeze({ key: "nutrition", label: "Dinh dưỡng" }),
  TRAINING: Object.freeze({ key: "training", label: "Tập luyện" }),
  TRACKING: Object.freeze({ key: "tracking", label: "Theo dõi" }),
  DISCOVERY: Object.freeze({ key: "discovery", label: "Khám phá" }),
  EDUCATION: Object.freeze({ key: "education", label: "Kiến thức" }),
});

const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

export const COMMUNITY_FEATURE_CATALOG = deepFreeze([
  {
    featureKey: "ht_assistant",
    label: "HT Assistant",
    group: GROUPS.AI_SUPPORT,
    primaryValue:
      "Trả lời và định hướng người dùng về tập luyện, dinh dưỡng, phục hồi và các dịch vụ HTCOACHING.",
    audiences: ["Cộng đồng", "Khách hàng", "HLV"],
    initialImprovement:
      "Đo tỷ lệ câu hỏi ngoài phạm vi, mức hữu ích và cải thiện chuyển hướng theo phản hồi thực tế.",
  },
  {
    featureKey: "tdee_calculator",
    label: "TDEE Calculator",
    group: GROUPS.NUTRITION,
    primaryValue:
      "Ước tính BMR, TDEE, lượng calo và macro theo mục tiêu cá nhân.",
    audiences: ["Cộng đồng"],
    initialImprovement:
      "Diễn giải rõ độ sai số và hỗ trợ lưu, so sánh kết quả theo tiến độ.",
  },
  {
    featureKey: "meal_plan",
    label: "Meal Plan",
    group: GROUPS.NUTRITION,
    primaryValue:
      "Gợi ý thực đơn theo mục tiêu calo, macro và số bữa trong ngày.",
    audiences: ["Cộng đồng", "Khách hàng", "HLV"],
    initialImprovement:
      "Cá nhân hóa theo dị ứng, sở thích ăn uống, ngân sách và danh sách mua sắm.",
  },
  {
    featureKey: "meal_scan",
    label: "Meal Scan",
    group: GROUPS.NUTRITION,
    primaryValue:
      "Phân tích ảnh món ăn để ước tính khẩu phần, calo và macro.",
    audiences: ["Cộng đồng", "Khách hàng", "HLV"],
    initialImprovement:
      "Lưu kết quả đã chỉnh khẩu phần vào nhật ký và đo độ chính xác thực tế.",
  },
  {
    featureKey: "recipes",
    label: "Công thức nấu ăn",
    group: GROUPS.NUTRITION,
    primaryValue:
      "Giúp người dùng tìm, lọc, lưu và thực hành các công thức phù hợp.",
    audiences: ["Cộng đồng", "Khách hàng"],
    initialImprovement:
      "Bổ sung macro theo khẩu phần, đổi số phần ăn và danh sách mua sắm.",
  },
  {
    featureKey: "exercise_library",
    label: "Thư viện & bộ tạo bài tập",
    group: GROUPS.TRAINING,
    primaryValue:
      "Tra cứu bài tập theo nhóm cơ và xây dựng buổi tập có thể xuất PDF.",
    audiences: ["Cộng đồng", "Khách hàng", "HLV"],
    initialImprovement:
      "Lọc thêm theo thiết bị, độ khó, lưu ý chấn thương và bài tập yêu thích.",
  },
  {
    featureKey: "workout_plans",
    label: "Giáo án tập luyện",
    group: GROUPS.TRAINING,
    primaryValue:
      "Giúp HLV thiết kế giáo án và khách hàng xem kế hoạch được giao.",
    audiences: ["Khách hàng", "HLV"],
    initialImprovement:
      "Theo dõi mức hoàn thành, phản hồi từng bài và lịch sử điều chỉnh giáo án.",
  },
  {
    featureKey: "today_dashboard",
    label: "Today Dashboard",
    group: GROUPS.TRACKING,
    primaryValue:
      "Tập trung lịch tập, dinh dưỡng, thói quen và nhật ký hằng ngày tại một nơi.",
    audiences: ["Khách hàng", "HLV"],
    initialImprovement:
      "Cải thiện onboarding và gợi ý hành động tiếp theo từ mức độ tuân thủ.",
  },
  {
    featureKey: "progress_tracking",
    label: "Tiến độ & Weekly Check-in",
    group: GROUPS.TRACKING,
    primaryValue:
      "Theo dõi xu hướng sức khỏe, mức độ tuân thủ và phản hồi định kỳ từ HLV.",
    audiences: ["Khách hàng", "HLV"],
    initialImprovement:
      "So sánh với mục tiêu và giải thích các xu hướng hoặc dữ liệu bất thường.",
  },
  {
    featureKey: "gym_finder",
    label: "Tìm phòng tập",
    group: GROUPS.DISCOVERY,
    primaryValue:
      "Hỗ trợ cộng đồng tìm phòng tập theo khu vực và nhu cầu.",
    audiences: ["Cộng đồng"],
    initialImprovement:
      "Thêm vị trí gần nhất, chỉ đường và ngày xác minh thông tin phòng tập.",
  },
  {
    featureKey: "blog_knowledge",
    label: "Blog & kiến thức",
    group: GROUPS.EDUCATION,
    primaryValue:
      "Cung cấp nội dung hướng dẫn về tập luyện, dinh dưỡng và sức khỏe.",
    audiences: ["Cộng đồng"],
    initialImprovement:
      "Hiển thị ngày rà soát, nguồn tham khảo và liên kết tới công cụ liên quan.",
  },
]);
