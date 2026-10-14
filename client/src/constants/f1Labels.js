export const F1_GENDER_LABELS = Object.freeze({
  male: "Nam",
  female: "Nữ",
  other: "Khác",
});

export const getF1GenderLabel = (value) => F1_GENDER_LABELS[value] || value || "";

export const F1_GOAL_LABELS = Object.freeze({
  fat_loss: "Giảm mỡ",
  weight_gain: "Tăng cân",
  muscle_gain: "Tăng cơ",
  maintenance: "Duy trì",
});

export const F1_EXPERIENCE_LABELS = Object.freeze({
  none: "Chưa từng tập",
  beginner: "Mới bắt đầu",
  intermediate: "Trung bình",
  advanced: "Lâu năm",
});

export const F1_STRESS_LABELS = Object.freeze({
  low: "Thấp",
  medium: "Vừa",
  high: "Cao",
});

export const F1_WORK_ACTIVITY_LABELS = Object.freeze({
  sedentary: "Ngồi nhiều",
  standing: "Đứng nhiều",
  active: "Di chuyển nhiều",
  heavy_labor: "Lao động nặng",
});

export const F1_WARNING_SIGN_LABELS = Object.freeze({
  chest_pain: "Đau ngực",
  dizziness: "Chóng mặt",
  shortness_of_breath: "Khó thở bất thường",
  radiating_pain: "Tê lan",
  balance_loss: "Mất thăng bằng",
});

export const F1_LEVEL_LABELS = Object.freeze({
  low: "Yếu",
  below_average: "Dưới trung bình",
  average: "Trung bình",
  good: "Tốt",
});

export const F1_POSTURE_LABELS = Object.freeze({
  normal: "Bình thường",
  pes_planus: "Bàn chân bẹt",
  feet_turn_out: "Bàn chân xoay ra ngoài",
  mild_heel_rise: "Gót chân nhấc lên nhẹ",
  knee_valgus: "Gối xoay vào trong",
  knee_varus: "Gối đẩy ra ngoài",
  knee_hyperextension: "Ưỡn gối quá mức",
  rounded_shoulders: "Vai tròn / cuộn vai ra trước",
  elevated_shoulders: "Vai nhô cao",
  thoracic_kyphosis: "Lưng gù",
  asymmetrical_shoulders: "Vai lệch không đều",
  forward_head_posture: "Đầu đưa ra trước",
  head_tilt_rotation: "Đầu nghiêng hoặc xoay",
  anterior_pelvic_tilt: "Nghiêng khung chậu ra trước",
  posterior_pelvic_tilt: "Nghiêng khung chậu ra sau",
  pelvic_tilt_rotation: "Hông không cân bằng",
  knees_move_inward: "Gối chụm vào trong",
  knees_move_outward: "Gối đẩy ra ngoài",
  excessive_forward_lean: "Đổ người về trước quá mức",
  low_back_arch: "Võng thắt lưng",
  low_back_round: "Tròn / cụp lưng dưới",
  arms_fall_forward: "Tay rớt về phía trước",
  heel_rise: "Gót chân nhấc lên",
  pelvic_shift: "Hông lệch bấp bênh",
});

export const labelOf = (map, value, fallback = "--") =>
  (value && map[value]) || value || fallback;
