// Nhãn tiếng Việt cho Đánh giá bản thân. Không hiển thị enum thô; tên bài tập giữ tiếng Anh.

export const STEP_TITLES = [
  { step: 1, title: "Sàng lọc sức khỏe" },
  { step: 2, title: "Thông tin cá nhân" },
  { step: 3, title: "Tự kiểm tra thể lực" },
];

export const GENDER_OPTIONS = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
];

export const STRESS_OPTIONS = [
  { value: "low", label: "Thấp" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Cao" },
];

export const WORK_ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Ngồi nhiều" },
  { value: "standing", label: "Đứng hoặc đi lại nhẹ" },
  { value: "active", label: "Vận động nhiều" },
  { value: "heavy_labor", label: "Lao động nặng" },
];

export const EXPERIENCE_OPTIONS = [
  { value: "none", label: "Chưa từng tập" },
  { value: "beginner", label: "Mới tập (dưới 6 tháng)" },
  { value: "intermediate", label: "Có kinh nghiệm (6 tháng đến 2 năm)" },
  { value: "advanced", label: "Tập lâu năm (trên 2 năm)" },
];

export const GOAL_OPTIONS = [
  { value: "fat_loss", label: "Giảm mỡ" },
  { value: "muscle_gain", label: "Tăng cơ" },
  { value: "weight_gain", label: "Tăng cân" },
  { value: "maintenance", label: "Duy trì" },
];

export const EQUIPMENT_OPTIONS = [
  { value: "none", label: "Không có dụng cụ" },
  { value: "home_basic", label: "Tập tại nhà (tạ đơn, dây kháng lực)" },
  { value: "gym", label: "Phòng tập đầy đủ" },
];

export const TRAINING_NOW_OPTIONS = [
  { value: "yes", label: "Đang tập đều" },
  { value: "no", label: "Hiện chưa tập" },
];

export const PAIN_AREA_OPTIONS = [
  { value: "neck", label: "Cổ" },
  { value: "shoulder", label: "Vai" },
  { value: "elbow_wrist", label: "Khuỷu tay và cổ tay" },
  { value: "upper_back", label: "Lưng trên" },
  { value: "lower_back", label: "Lưng dưới" },
  { value: "hip", label: "Hông" },
  { value: "knee", label: "Đầu gối" },
  { value: "ankle_foot", label: "Cổ chân và bàn chân" },
];

export const WARNING_SIGN_OPTIONS = [
  { value: "chest_pain", label: "Đau tức ngực khi vận động" },
  { value: "dizziness", label: "Chóng mặt hoặc ngất" },
  { value: "shortness_of_breath", label: "Khó thở bất thường" },
  { value: "radiating_pain", label: "Tê hoặc đau lan xuống tay chân" },
  { value: "balance_loss", label: "Mất thăng bằng" },
];

export const VARIANT_LABELS = {
  standard: "Chuẩn",
  knee: "Hít đất quỳ",
  incline: "Tay đặt trên bục cao",
  wall: "Chống tường",
  full: "Plank đầy đủ",
};

export const LEVEL_TONES = {
  needs_improvement: "border-red-400/40 bg-red-400/10 text-red-200",
  fair: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  good: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  very_good: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  excellent: "border-emerald-300/50 bg-emerald-300/15 text-emerald-100",
};

export const TRAINING_STATUS_LABELS = {
  novice: "Mới tập hoặc quay lại tập",
  intermediate: "Có kinh nghiệm",
  advanced: "Tập lâu năm",
};

export const INTENSITY_LABELS = {
  moderate: "Cường độ vừa",
  moderate_with_intervals: "Cường độ vừa, có thể thêm quãng nhanh",
};

export const INSIGHT_STATUS_LABELS = {
  underweight: "Thấp",
  normal: "Bình thường",
  overweight: "Thừa cân",
  obese_1: "Béo phì độ 1",
  obese_2: "Béo phì độ 2",
  elevated: "Nguy cơ tăng",
  low: "Thấp",
  high: "Cao",
};

export const SELF_ASSESSMENT_PATH = "/dashboard/self-assessment";
export const FITNESS_PLUS_PLANS_PATH = "/?plan=fitness-plus#pricing";

export const METRIC_LABELS = {
  upperBodyPush: "Sức mạnh thân trên (Upper Body Push)",
  lowerBody: "Sức mạnh thân dưới (Lower Body)",
  coreEndurance: "Sức bền thân giữa (Core Endurance)",
  cardio: "Sức bền tim phổi (Cardio Capacity)",
};

export const METRIC_UNITS = {
  upperBodyPush: "lần",
  lowerBody: "lần",
  coreEndurance: "giây",
  cardio: "phút",
};
