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

// Lộ trình luôn hiện ít nhất chừng này tab; giai đoạn chưa mở được khoá
// cho tới khi HLV đánh giá xong giai đoạn trước.
export const MIN_VISIBLE_STAGES = 3;

export const buildStageTabs = (roadmap = []) => {
  const tabs = roadmap.map((stage) => ({
    key: stage.phaseKey,
    stageOrder: stage.stageOrder,
    label: `Giai đoạn ${stage.stageOrder}: ${stage.phaseTitle}`,
    locked: false,
  }));
  for (let order = tabs.length + 1; order <= MIN_VISIBLE_STAGES; order += 1) {
    tabs.push({
      key: `locked_${order}`,
      stageOrder: order,
      label: `Giai đoạn ${order}`,
      locked: true,
    });
  }
  return tabs;
};
