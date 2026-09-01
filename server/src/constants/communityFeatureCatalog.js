export const COMMUNITY_FEATURE_CATALOG_VERSION = "2026-08-29.2";
const HISTORY_SNAPSHOT_VERSION_2026_08_10 = "2026-08-10.2";

export const COMMUNITY_FEATURE_AUDIENCES = Object.freeze({
  COMMUNITY: Object.freeze({ key: "community", label: "Cộng đồng" }),
  CUSTOMER: Object.freeze({ key: "customer", label: "Khách hàng" }),
  TRAINER: Object.freeze({ key: "trainer", label: "HLV" }),
});

export const COMMUNITY_FEATURE_AUDIENCE_OPTIONS = Object.freeze(
  Object.values(COMMUNITY_FEATURE_AUDIENCES),
);

const AUDIENCE_KEY_BY_LABEL = new Map(
  COMMUNITY_FEATURE_AUDIENCE_OPTIONS.map(({ key, label }) => [label, key]),
);

export const getCommunityFeatureAudienceKeys = (audiences = []) =>
  [...new Set(
    (Array.isArray(audiences) ? audiences : [])
      .map((audience) => AUDIENCE_KEY_BY_LABEL.get(audience) || audience)
      .filter((key) =>
        COMMUNITY_FEATURE_AUDIENCE_OPTIONS.some((item) => item.key === key),
      ),
  )];

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

const featureWithCurrentSnapshot = ({ improvementHistory = [], ...feature }) => {
  const snapshot = deepFreeze({
    catalogVersion: COMMUNITY_FEATURE_CATALOG_VERSION,
    featureLabel: feature.label,
    group: feature.group,
    priority: feature.priority,
    primaryValue: feature.primaryValue,
    audiences: feature.audiences,
  });
  return {
    ...feature,
    improvementHistory: improvementHistory.map((record) => ({
      snapshot,
      ...record,
    })),
  };
};

const MEAL_PLAN_2026_08_25_SNAPSHOT = deepFreeze({
  catalogVersion: "2026-08-25.1",
  featureLabel: "Meal Plan",
  group: GROUPS.NUTRITION,
  priority: PRIORITIES.F1,
  primaryValue:
    "Gợi ý thực đơn theo mục tiêu calo, macro và số bữa trong ngày.",
  audiences: ["Cộng đồng", "Khách hàng", "HLV"],
});

export const COMMUNITY_FEATURE_CATALOG = deepFreeze([
  featureFromSnapshot("ht_assistant", HT_ASSISTANT_2026_08_10_SNAPSHOT, {
    priority: PRIORITIES.F1,
    currentImprovement: {
      improvementKey: "moderation_consistency_and_concise_guidance",
      description:
        "Đồng bộ moderation production, rút gọn phản hồi chuyển hướng và theo dõi tỷ lệ chặn nhầm.",
      openedAt: "2026-08-12",
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
      {
        improvementKey: "production_background_chat_validation",
        opportunity:
          "Xác minh production các luồng chạy nền, spinner và mở chat chủ động",
        result:
          "Các luồng chạy nền, spinner, chuyển conversation và mở chat chủ động hoạt động ổn định trên production theo xác nhận của chủ sản phẩm.",
        snapshot: HT_ASSISTANT_2026_08_10_SNAPSHOT,
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.PRODUCTION_VERIFIED,
            statusDate: "2026-08-12",
          },
        ],
      },
    ],
  }),
  featureWithCurrentSnapshot({
    featureKey: "tdee_calculator",
    label: "TDEE Calculator",
    group: GROUPS.NUTRITION,
    priority: PRIORITIES.F1,
    primaryValue:
      "Ước tính BMR, TDEE, lượng calo và macro theo mục tiêu cá nhân.",
    audiences: ["Cộng đồng"],
    currentImprovement: {
      improvementKey: "calibrate_from_real_progress",
      description:
        "Cho phép đối chiếu ước tính với cân nặng, mức vận động và tiến độ thực tế để gợi ý hiệu chỉnh có giải thích.",
      openedAt: "2026-08-29",
    },
    improvementHistory: [
      {
        improvementKey: "uncertainty_and_activity_evidence",
        opportunity: "Làm rõ độ tin cậy của TDEE",
        result:
          "TDEE đã giải thích đây là ước tính, dùng bằng chứng vận động cả ngày và liên kết với tiến trình cơ thể.",
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.VERIFIED,
            statusDate: "2026-08-12",
          },
        ],
      },
    ],
  }),
  featureFromSnapshot("meal_plan", MEAL_PLAN_2026_08_10_SNAPSHOT, {
    priority: PRIORITIES.F1,
    currentImprovement: {
      improvementKey: "budget_and_allergy_substitutions",
      description:
        "Đề xuất món thay thế theo dị ứng, khẩu vị, ngân sách và giải thích ảnh hưởng tới macro.",
      openedAt: "2026-08-29",
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
      {
        improvementKey: "production_saved_meal_plan_validation",
        opportunity:
          "Xác minh production luồng lưu và xem lại thực đơn cho tài khoản đã đăng nhập",
        result:
          "Luồng tạo, lưu và xem lại thực đơn hoạt động ổn định trên production theo xác nhận của chủ sản phẩm.",
        snapshot: MEAL_PLAN_2026_08_10_SNAPSHOT,
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.PRODUCTION_VERIFIED,
            statusDate: "2026-08-12",
          },
        ],
      },
      {
        improvementKey: "saved_plan_revision_and_daily_execution",
        opportunity:
          "Cho phép quản lý thực đơn đã lưu và ghi nhận bữa ăn thực tế",
        result:
          "Khách hàng có thể đổi tên, chỉnh sửa, lưu trữ thực đơn, ghi bữa phát sinh và gửi dinh dưỡng thực tế cho HLV.",
        snapshot: MEAL_PLAN_2026_08_25_SNAPSHOT,
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.VERIFIED,
            statusDate: "2026-08-25",
          },
        ],
      },
    ],
  }),
  featureWithCurrentSnapshot({
    featureKey: "meal_scan",
    label: "Meal Scan",
    group: GROUPS.NUTRITION,
    priority: PRIORITIES.F1,
    primaryValue:
      "Phân tích ảnh món ăn để ước tính khẩu phần, calo và macro.",
    audiences: ["Cộng đồng", "Khách hàng", "HLV"],
    currentImprovement: {
      improvementKey: "confirmed_journal_entry_and_accuracy",
      description:
        "Cho người dùng xác nhận khẩu phần trước khi đưa vào nhật ký và đo sai lệch trên tập ảnh thực tế.",
      openedAt: "2026-08-29",
    },
    improvementHistory: [
      {
        improvementKey: "entitlement_quota_and_review_flow",
        opportunity: "Chuẩn hóa hạn mức và bước xác nhận Meal Scan",
        result:
          "Meal Scan đã dùng quota theo entitlement và có bước khai báo, khóa, xác nhận trước khi phân tích.",
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.VERIFIED,
            statusDate: "2026-08-18",
          },
        ],
      },
    ],
  }),
  featureWithCurrentSnapshot({
    featureKey: "recipes",
    label: "Công thức nấu ăn",
    group: GROUPS.NUTRITION,
    priority: PRIORITIES.F2,
    primaryValue:
      "Giúp người dùng tìm, lọc, lưu và thực hành các công thức phù hợp.",
    audiences: ["Cộng đồng", "Khách hàng"],
    currentImprovement: {
      improvementKey: "allergy_filters_and_shopping_list",
      description:
        "Lọc theo dị ứng, mục tiêu dinh dưỡng và tạo danh sách mua sắm từ các công thức đã chọn.",
      openedAt: "2026-08-29",
    },
    improvementHistory: [
      {
        improvementKey: "complete_recipe_nutrition_and_community",
        opportunity: "Hoàn thiện dinh dưỡng và tương tác công thức",
        result:
          "Công thức đã có nutrition theo khẩu phần, quy đổi số phần ăn, bookmark, đánh giá và luồng nhập dữ liệu chuyên gia an toàn.",
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.VERIFIED,
            statusDate: "2026-08-27",
          },
        ],
      },
    ],
  }),
  featureWithCurrentSnapshot({
    featureKey: "exercise_library",
    label: "Thư viện & bộ tạo bài tập",
    group: GROUPS.TRAINING,
    priority: PRIORITIES.F1,
    primaryValue:
      "Tra cứu bài tập theo nhóm cơ và xây dựng buổi tập có thể xuất PDF.",
    audiences: ["Cộng đồng", "Khách hàng", "HLV"],
    currentImprovement: {
      improvementKey: "injury_and_personal_fit_filters",
      description:
        "Lọc theo thiết bị, lưu ý chấn thương và gợi ý bài thay thế phù hợp với khả năng từng người.",
      openedAt: "2026-08-29",
    },
    improvementHistory: [
      {
        improvementKey: "exercise_guides_video_reviews_and_difficulty",
        opportunity: "Mở rộng chi tiết và chất lượng hướng dẫn bài tập",
        result:
          "Trang bài tập đã có hướng dẫn setup, video, đánh giá cộng đồng và độ phức tạp kỹ thuật được nhập có kiểm soát.",
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.VERIFIED,
            statusDate: "2026-08-27",
          },
        ],
      },
    ],
  }),
  featureWithCurrentSnapshot({
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
  }),
  featureWithCurrentSnapshot({
    featureKey: "today_dashboard",
    label: "Today Dashboard",
    group: GROUPS.TRACKING,
    priority: PRIORITIES.F0,
    primaryValue:
      "Tập trung lịch tập, dinh dưỡng, thói quen và nhật ký hằng ngày tại một nơi.",
    audiences: ["Khách hàng", "HLV"],
    currentImprovement: {
      improvementKey: "health_goal_adherence_and_next_action",
      description:
        "Tổng hợp mức bám mục tiêu sức khỏe và gợi ý một hành động tiếp theo dễ thực hiện trong ngày.",
      openedAt: "2026-08-29",
    },
    improvementHistory: [
      {
        improvementKey: "daily_wellness_nutrition_and_reports",
        opportunity: "Hoàn thiện nhật ký sức khỏe và dinh dưỡng trong ngày",
        result:
          "Khách hàng có thể gửi sức khỏe, dinh dưỡng thực tế và ghi chú; HLV chỉ xem dữ liệu đã gửi trong khu vực hỗ trợ.",
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.VERIFIED,
            statusDate: "2026-08-25",
          },
        ],
      },
      {
        improvementKey: "weekly_habits_and_health_goal_grouping",
        opportunity: "Gom mục tiêu sức khỏe và thói quen thành một kế hoạch",
        result:
          "Thói quen theo lịch tuần đã được kiểm thử; mục tiêu và Thói quen khách hàng được gom cùng section ở HLV và khách hàng.",
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.VERIFIED,
            statusDate: "2026-08-29",
          },
        ],
      },
      {
        improvementKey: "opt_in_morning_health_email",
        opportunity: "Nhắc khách cập nhật Mục tiêu sức khỏe đúng lúc",
        result:
          "Khách coaching có thể bật email nhắc buổi sáng trong Tài khoản; email mở đúng section sức khỏe, tự bỏ qua ngày đã gửi và chống gửi trùng.",
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.VERIFIED,
            statusDate: "2026-08-29",
          },
        ],
      },
    ],
  }),
  featureWithCurrentSnapshot({
    featureKey: "progress_tracking",
    label: "Tiến độ & Weekly Check-in",
    group: GROUPS.TRACKING,
    priority: PRIORITIES.F1,
    primaryValue:
      "Theo dõi xu hướng sức khỏe, mức độ tuân thủ và phản hồi định kỳ từ HLV.",
    audiences: ["Khách hàng", "HLV"],
    currentImprovement: {
      improvementKey: "goal_comparison_and_actionable_trends",
      description:
        "So sánh xu hướng với mục tiêu, giải thích dữ liệu bất thường và gợi ý nội dung cần trao đổi với HLV.",
      openedAt: "2026-08-29",
    },
    improvementHistory: [
      {
        improvementKey: "body_progress_and_compliance_charts",
        opportunity: "Trực quan hóa tiến trình cơ thể và mức độ thực hiện",
        result:
          "Tiến trình đã có biểu đồ cân nặng, vòng eo, thành phần cơ thể, mức độ thực hiện và sức khỏe trung bình với trạng thái dữ liệu thiếu rõ ràng.",
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.VERIFIED,
            statusDate: "2026-08-23",
          },
        ],
      },
    ],
  }),
  featureWithCurrentSnapshot({
    featureKey: "practice_center",
    label: "Trung tâm thực hành HLV",
    group: GROUPS.EDUCATION,
    priority: PRIORITIES.F2,
    primaryValue:
      "Giúp HLV tự trải nghiệm email Order và Check-in bằng dữ liệu mô phỏng an toàn.",
    audiences: ["HLV"],
    currentImprovement: {
      improvementKey: "template_preview_and_delivery_diagnostics",
      description:
        "Cho xem trước nội dung từng email và trạng thái giao nhận để HLV tự chẩn đoán trước khi hỗ trợ khách hàng.",
      openedAt: "2026-08-29",
    },
    improvementHistory: [
      {
        improvementKey: "safe_order_and_checkin_simulation",
        opportunity: "Cho HLV thực hành quy trình email mà không tạo dữ liệu thật",
        result:
          "HLV/Admin có thể gửi mô phỏng tới email đăng nhập theo hạn mức, không tạo Order, Check-in hay trừ buổi thật.",
        milestones: [
          {
            status: COMMUNITY_FEATURE_DELIVERY_STATUSES.VERIFIED,
            statusDate: "2026-08-28",
          },
        ],
      },
    ],
  }),
  featureWithCurrentSnapshot({
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
  }),
  featureWithCurrentSnapshot({
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
  }),
]);
