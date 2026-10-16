// Tên và giải thích các giai đoạn theo khung NASM OPT, viết cho HLV và khách đọc.
// Key `phase_N` là số giai đoạn trong khung NASM, không phải thứ tự giai đoạn trong lộ trình của khách.

export const PHASE_NAMES = {
  phase_1: "Ổn định và sức bền nền (Stabilization Endurance)",
  phase_2: "Sức mạnh bền (Strength Endurance)",
  phase_3: "Phát triển cơ bắp (Hypertrophy)",
  phase_4: "Sức mạnh tối đa (Maximal Strength)",
  phase_5: "Sức bật (Power)",
};

export const PHASE_EXPLANATIONS = {
  phase_1:
    "Giai đoạn xây nền: tập chậm, nhiều lần lặp với mức tải nhẹ để khớp ổn định, cơ lõi kiểm soát tốt và tư thế chuẩn trước khi tăng tải.",
  phase_2:
    "Giai đoạn cầu nối giữa ổn định và sức mạnh: ghép một bài sức mạnh với một bài ổn định cùng nhóm cơ (superset), tăng tải vừa phải mà vẫn giữ form chuẩn, giúp cơ khỏe hơn và bền hơn.",
  phase_3:
    "Giai đoạn tăng khối lượng cơ: tập nhiều hiệp với mức tải trung bình đến nặng để cơ phát triển, cần nền kỹ thuật và hồi phục tốt từ các giai đoạn trước.",
  phase_4:
    "Giai đoạn tăng sức mạnh tối đa: mức tải nặng, ít lần lặp, nghỉ dài; chỉ phù hợp khi kỹ thuật đã vững và có mục tiêu sức mạnh.",
  phase_5:
    "Giai đoạn sức bật: kết hợp bài nặng với bài tốc độ để tạo lực nhanh; dành cho mục tiêu thể thao, thành tích.",
};

// Nhãn trọng tâm tập luyện do bộ phân tích tự động đề xuất.
const TRAINING_FOCUS_LABELS = {
  energy_expenditure: "Tăng tiêu hao năng lượng",
  cardio_base_building: "Xây nền tim mạch",
  strength_progression: "Tăng sức mạnh theo từng giai đoạn",
  movement_quality_under_load: "Tập nặng hơn nhưng vẫn giữ form chuẩn",
  lower_body_strength: "Tăng sức mạnh thân dưới",
  core_strength: "Tăng sức mạnh cơ lõi",
  muscular_endurance: "Cải thiện sức bền cơ",
  pattern_retraining: "Chỉnh lại kiểu vận động",
  general_foundation: "Xây nền thể lực tổng quát",
  movement_foundation: "Xây nền chuyển động",
  stability_training: "Tăng khả năng ổn định cơ thể",
  core_control: "Cải thiện kiểm soát cơ lõi",
  form_maintenance: "Duy trì kiểm soát form khi tăng tải",
};

export const translateTrainingFocus = (items = []) =>
  items.map((item) => TRAINING_FOCUS_LABELS[item] || item);

// Lộ trình luôn hiện ít nhất chừng này tab; giai đoạn chưa mở được khoá
// cho tới khi HLV đánh giá xong giai đoạn trước.
export const MIN_VISIBLE_STAGES = 3;

const PHASE_TITLES = {
  phase_1: "Stabilization Endurance",
  phase_2: "Strength Endurance",
  phase_3: "Hypertrophy",
  phase_4: "Maximal Strength",
  phase_5: "Power",
};
const PHASE_SEQUENCE = Object.keys(PHASE_TITLES);
// Hệ thống tự đề xuất tối đa tới giai đoạn 3 của khung NASM.
const AUTO_CEILING_INDEX = PHASE_SEQUENCE.indexOf("phase_3");

// Giai đoạn dự kiến kế tiếp khi khách đạt yêu cầu (nếu kéo dài thì giữ nguyên giai đoạn).
export const expectedNextPhaseTitle = (phaseKey) => {
  const idx = PHASE_SEQUENCE.indexOf(phaseKey);
  if (idx < 0) return "";
  return PHASE_TITLES[PHASE_SEQUENCE[Math.min(idx + 1, Math.max(AUTO_CEILING_INDEX, idx))]];
};

// Giai đoạn 1 lấy từ lộ trình dự đoán; giai đoạn 2 trở đi mở ra sau mỗi lần HLV đánh giá
// cuối giai đoạn trước (`reviews` sắp theo stageOrder), cộng thêm một tab kế tiếp đang khoá.
export const buildStageTabs = (roadmap = [], reviews = []) => {
  const first = roadmap[0];
  let lastPhaseKey = first?.phaseKey || "";
  const tabs = first
    ? [
        {
          key: first.phaseKey,
          stageOrder: 1,
          label: `Giai đoạn 1: ${first.phaseTitle}`,
          locked: false,
        },
      ]
    : [];
  // Giai đoạn chỉ mở khi HLV đã xác nhận mục tiêu cho giai đoạn đó.
  for (const review of reviews.filter((item) => item.profileConfirmed)) {
    const plan = review.nextPhasePlan || {};
    const stageOrder = review.stageOrder + 1;
    lastPhaseKey = plan.phaseKey || lastPhaseKey;
    tabs.push({
      key: `stage_${stageOrder}`,
      stageOrder,
      label: plan.phaseTitle
        ? `Giai đoạn ${stageOrder}: ${plan.phaseTitle}`
        : `Giai đoạn ${stageOrder}`,
      locked: false,
    });
  }
  const firstLocked = tabs.length + 1;
  const minimum = Math.max(MIN_VISIBLE_STAGES, firstLocked);
  for (let order = firstLocked; order <= minimum; order += 1) {
    // Chỉ giai đoạn kế tiếp có tên dự kiến; các giai đoạn xa hơn chưa đoán được.
    const expected = order === firstLocked ? expectedNextPhaseTitle(lastPhaseKey) : "";
    tabs.push({
      key: `locked_${order}`,
      stageOrder: order,
      label: expected ? `Giai đoạn ${order}: ${expected}` : `Giai đoạn ${order}`,
      locked: true,
    });
  }
  return tabs;
};
