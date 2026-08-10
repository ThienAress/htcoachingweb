export const COMMUNITY_FEATURE_CATALOG_VERSION = "2026-08-10.2";
const HISTORY_SNAPSHOT_VERSION_2026_08_10 = "2026-08-10.2";

const GROUPS = Object.freeze({
  AI_SUPPORT: Object.freeze({ key: "ai_support", label: "AI hỗ trợ" }),
  NUTRITION: Object.freeze({ key: "nutrition", label: "Dinh dưỡng" }),
  TRAINING: Object.freeze({ key: "training", label: "Tập luyện" }),
  TRACKING: Object.freeze({ key: "tracking", label: "Theo dõi" }),
  DISCOVERY: Object.freeze({ key: "discovery", label: "Khám phá" }),
  EDUCATION: Object.freeze({ key: "education", label: "Kiến thức" }),
});

const PRIORITIES = Object.freeze({
  F0: Object.freeze({ code: "F0", rank: 0, label: "Cần ưu tiên ngay" }),
  F1: Object.freeze({ code: "F1", rank: 1, label: "Ưu tiên kế tiếp" }),
  F2: Object.freeze({ code: "F2", rank: 2, label: "Cải tiến sau" }),
  F3: Object.freeze({ code: "F3", rank: 3, label: "Theo dõi dài hạn" }),
});

export const COMMUNITY_FEATURE_DELIVERY_STATUSES = Object.freeze({
  IN_PROGRESS: Object.freeze({
    code: "in_progress",
    rank: 0,
    label: "Đang xử lý",
  }),
  IMPLEMENTED: Object.freeze({
    code: "implemented",
    rank: 1,
    label: "Đã code",
  }),
  VERIFIED: Object.freeze({
    code: "verified",
    rank: 2,
    label: "Đã kiểm thử",
  }),
  PRODUCTION_VERIFIED: Object.freeze({
    code: "production_verified",
    rank: 3,
    label: "Đã xác minh production",
  }),
});

const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const HT_ASSISTANT_2026_08_10_SNAPSHOT = deepFreeze({
  catalogVersion: HISTORY_SNAPSHOT_VERSION_2026_08_10,
  featureLabel: "HT Assistant",
  group: GROUPS.AI_SUPPORT,
  priority: PRIORITIES.F0,
  primaryValue:
    "Trả lời và định hướng người dùng về tập luyện, dinh dưỡng, phục hồi và các dịch vụ HTCOACHING.",
  audiences: ["Cộng đồng", "Khách hàng", "HLV"],
});

const MEAL_PLAN_2026_08_10_SNAPSHOT = deepFreeze({
  catalogVersion: HISTORY_SNAPSHOT_VERSION_2026_08_10,
  featureLabel: "Meal Plan",
  group: GROUPS.NUTRITION,
  priority: PRIORITIES.F0,
  primaryValue:
    "Gợi ý thực đơn theo mục tiêu calo, macro và số bữa trong ngày.",
  audiences: ["Cộng đồng", "Khách hàng", "HLV"],
});

const featureFromSnapshot = (featureKey, snapshot, rest) => ({
  featureKey,
  label: snapshot.featureLabel,
  group: snapshot.group,
  priority: snapshot.priority,
  primaryValue: snapshot.primaryValue,
  audiences: snapshot.audiences,
  ...rest,
});

export const COMMUNITY_FEATURE_CATALOG = deepFreeze([
  featureFromSnapshot("ht_assistant", HT_ASSISTANT_2026_08_10_SNAPSHOT, {
    currentImprovement: {
      improvementKey: "production_background_chat_validation",
      description:
        "Xác minh production các luồng chạy nền, spinner và mở chat chủ động, rồi đo tỷ lệ request hoàn tất.",
      openedAt: "2026-08-10",
    },
    improvementHistory: [
      {
        improvementKey: "conversation_continuity",
        opportunity: "Giữ phản hồi khi chuyển cuộc trò chuyện",
        result:
          "Phản hồi tiếp tục chạy đúng conversation nguồn khi người dùng chuyển sang conversation khác.",
        snapshot: HT_ASSISTANT_2026_08_10_SNAPSHOT,
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.IMPLEMENTED,
            statusDate: "2026-08-10",
          },
        ],
      },
      {
        improvementKey: "manual_open_only",
        opportunity: "Loại bỏ gợi ý chủ động",
        result:
          "HT Assistant chỉ mở khi người dùng chủ động bấm launcher hoặc nhập câu hỏi.",
        snapshot: HT_ASSISTANT_2026_08_10_SNAPSHOT,
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.IMPLEMENTED,
            statusDate: "2026-08-10",
          },
        ],
      },
      {
        improvementKey: "pending_conversation_indicator",
        opportunity: "Hiển thị conversation đang nhận phản hồi",
        result:
          "Sidebar hiển thị spinner riêng cho conversation đang nhận phản hồi.",
        snapshot: HT_ASSISTANT_2026_08_10_SNAPSHOT,
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.IMPLEMENTED,
            statusDate: "2026-08-10",
          },
        ],
      },
    ],
  }),
  {
    featureKey: "tdee_calculator",
    label: "TDEE Calculator",
    group: GROUPS.NUTRITION,
    priority: PRIORITIES.F1,
    primaryValue:
      "Ước tính BMR, TDEE, lượng calo và macro theo mục tiêu cá nhân.",
    audiences: ["Cộng đồng"],
    currentImprovement: {
      improvementKey: "explain_uncertainty_and_compare_progress",
      description:
        "Diễn giải rõ độ sai số và hỗ trợ lưu, so sánh kết quả theo tiến độ.",
      openedAt: "2026-08-10",
    },
    improvementHistory: [],
  },
  featureFromSnapshot("meal_plan", MEAL_PLAN_2026_08_10_SNAPSHOT, {
    currentImprovement: {
      improvementKey: "production_saved_meal_plan_validation",
      description:
        "Xác minh production luồng lưu/xem lại cho tài khoản đã đăng nhập, rồi mở rộng cá nhân hóa theo dị ứng, sở thích và ngân sách.",
      openedAt: "2026-08-10",
    },
    improvementHistory: [
      {
        improvementKey: "personal_save_without_trainer",
        opportunity: "Lưu thực đơn không phụ thuộc Order hoặc HLV",
        result:
          "Tài khoản đã đăng nhập có thể lưu thực đơn mà không phụ thuộc Order hoặc HLV.",
        snapshot: MEAL_PLAN_2026_08_10_SNAPSHOT,
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.IMPLEMENTED,
            statusDate: "2026-08-10",
          },
        ],
      },
      {
        improvementKey: "customer_facing_save_copy",
        opportunity: "Việt hóa thao tác và lỗi lưu thực đơn",
        result:
          "Thao tác và lỗi lưu thực đơn đã được Việt hóa cho khách hàng.",
        snapshot: MEAL_PLAN_2026_08_10_SNAPSHOT,
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.IMPLEMENTED,
            statusDate: "2026-08-10",
          },
        ],
      },
    ],
  }),
  {
    featureKey: "meal_scan",
    label: "Meal Scan",
    group: GROUPS.NUTRITION,
    priority: PRIORITIES.F1,
    primaryValue:
      "Phân tích ảnh món ăn để ước tính khẩu phần, calo và macro.",
    audiences: ["Cộng đồng", "Khách hàng", "HLV"],
    currentImprovement: {
      improvementKey: "journal_integration_and_accuracy",
      description:
        "Lưu kết quả đã chỉnh khẩu phần vào nhật ký và đo độ chính xác thực tế.",
      openedAt: "2026-08-10",
    },
    improvementHistory: [],
  },
  {
    featureKey: "recipes",
    label: "Công thức nấu ăn",
    group: GROUPS.NUTRITION,
    priority: PRIORITIES.F2,
    primaryValue:
      "Giúp người dùng tìm, lọc, lưu và thực hành các công thức phù hợp.",
    audiences: ["Cộng đồng", "Khách hàng"],
    currentImprovement: {
      improvementKey: "serving_macros_and_shopping_list",
      description:
        "Bổ sung macro theo khẩu phần, đổi số phần ăn và danh sách mua sắm.",
      openedAt: "2026-08-10",
    },
    improvementHistory: [],
  },
  {
    featureKey: "exercise_library",
    label: "Thư viện & bộ tạo bài tập",
    group: GROUPS.TRAINING,
    priority: PRIORITIES.F1,
    primaryValue:
      "Tra cứu bài tập theo nhóm cơ và xây dựng buổi tập có thể xuất PDF.",
    audiences: ["Cộng đồng", "Khách hàng", "HLV"],
    currentImprovement: {
      improvementKey: "equipment_difficulty_injury_filters",
      description:
        "Lọc thêm theo thiết bị, độ khó, lưu ý chấn thương và bài tập yêu thích.",
      openedAt: "2026-08-10",
    },
    improvementHistory: [],
  },
  {
    featureKey: "workout_plans",
    label: "Giáo án tập luyện",
    group: GROUPS.TRAINING,
    priority: PRIORITIES.F1,
    primaryValue:
      "Giúp HLV thiết kế giáo án và khách hàng xem kế hoạch được giao.",
    audiences: ["Khách hàng", "HLV"],
    currentImprovement: {
      improvementKey: "completion_feedback_and_revision_history",
      description:
        "Theo dõi mức hoàn thành, phản hồi từng bài và lịch sử điều chỉnh giáo án.",
      openedAt: "2026-08-10",
    },
    improvementHistory: [],
  },
  {
    featureKey: "today_dashboard",
    label: "Today Dashboard",
    group: GROUPS.TRACKING,
    priority: PRIORITIES.F1,
    primaryValue:
      "Tập trung lịch tập, dinh dưỡng, thói quen và nhật ký hằng ngày tại một nơi.",
    audiences: ["Khách hàng", "HLV"],
    currentImprovement: {
      improvementKey: "onboarding_and_next_action",
      description:
        "Cải thiện onboarding và gợi ý hành động tiếp theo từ mức độ tuân thủ.",
      openedAt: "2026-08-10",
    },
    improvementHistory: [],
  },
  {
    featureKey: "progress_tracking",
    label: "Tiến độ & Weekly Check-in",
    group: GROUPS.TRACKING,
    priority: PRIORITIES.F1,
    primaryValue:
      "Theo dõi xu hướng sức khỏe, mức độ tuân thủ và phản hồi định kỳ từ HLV.",
    audiences: ["Khách hàng", "HLV"],
    currentImprovement: {
      improvementKey: "goal_comparison_and_anomaly_explanation",
      description:
        "So sánh với mục tiêu và giải thích các xu hướng hoặc dữ liệu bất thường.",
      openedAt: "2026-08-10",
    },
    improvementHistory: [],
  },
  {
    featureKey: "gym_finder",
    label: "Tìm phòng tập",
    group: GROUPS.DISCOVERY,
    priority: PRIORITIES.F3,
    primaryValue:
      "Hỗ trợ cộng đồng tìm phòng tập theo khu vực và nhu cầu.",
    audiences: ["Cộng đồng"],
    currentImprovement: {
      improvementKey: "nearest_location_directions_and_verified_date",
      description:
        "Thêm vị trí gần nhất, chỉ đường và ngày xác minh thông tin phòng tập.",
      openedAt: "2026-08-10",
    },
    improvementHistory: [],
  },
  {
    featureKey: "blog_knowledge",
    label: "Blog & kiến thức",
    group: GROUPS.EDUCATION,
    priority: PRIORITIES.F2,
    primaryValue:
      "Cung cấp nội dung hướng dẫn về tập luyện, dinh dưỡng và sức khỏe.",
    audiences: ["Cộng đồng"],
    currentImprovement: {
      improvementKey: "review_date_sources_and_tool_links",
      description:
        "Hiển thị ngày rà soát, nguồn tham khảo và liên kết tới công cụ liên quan.",
      openedAt: "2026-08-10",
    },
    improvementHistory: [],
  },
]);
