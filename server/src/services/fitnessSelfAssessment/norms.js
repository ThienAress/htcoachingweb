// Bảng chuẩn dùng cho Đánh giá bản thân (HT Fitness+).
// Chỉ dùng số liệu đã công bố; chỗ nào không có bảng chuẩn thì trả `null` (ghi nhận làm mốc, không xếp mức).
//
// Nguồn:
// - Hít đất: Payne VG, Gledhill N, Katzmarzyk PT, Jamnik VK, Keir PJ (2000). "Canadian musculoskeletal
//   fitness norms", Can J Appl Physiol; đưa vào sổ tay CSEP. Nam: hít đất chuẩn (standard); nữ: hít đất quỳ (knee).
// - Tim phổi: Rockport 1-mile walk, Kline GM và cs. (1987), Med Sci Sports Exerc. Công thức quy ra VO2max
//   (đã kiểm chứng ở tuổi 30-69; ngoài khoảng đó chỉ là ước lượng tham khảo). Xếp mức theo bảng VO2max
//   của The Cooper Institute (percentile 40/60/80/95).
// - Đứng lên khỏi ghế 30 giây: CDC STEADI (ngưỡng "dưới trung bình" cho 60-94 tuổi). Dưới 60 tuổi chưa có bảng chuẩn.
// - Plank: không có bảng chuẩn quần thể chung. Mốc thực dụng điều chỉnh từ nghiên cứu "Fitness norms for the plank
//   exercise" (Int J Exerc Sci Conf Proc, 2014): 102 vận động viên 18-25 tuổi, trung vị 95 giây nữ và 110 giây nam;
//   các mức dưới được hạ thấp cho người tập phổ thông. Đây là mốc tham khảo, không phải chuẩn quần thể.

export const LEVELS = Object.freeze([
  "needs_improvement",
  "fair",
  "good",
  "very_good",
  "excellent",
]);

export const levelToRank = (level) => {
  const index = LEVELS.indexOf(level);
  return index === -1 ? null : index + 1;
};

export const rankToLevel = (rank) => LEVELS[Math.min(Math.max(Math.round(rank), 1), 5) - 1];

// Cận dưới của các mức fair/good/very_good/excellent theo nhóm tuổi (số lần tối đa liên tục).
// Dưới cận "fair" là needs_improvement.
const PUSH_UP_MALE_STANDARD = [
  { maxAge: 29, floors: [17, 22, 29, 36] },
  { maxAge: 39, floors: [12, 17, 22, 30] },
  { maxAge: 49, floors: [10, 13, 17, 25] },
  { maxAge: 59, floors: [7, 10, 13, 21] },
  { maxAge: 69, floors: [5, 8, 11, 18] },
];

const PUSH_UP_FEMALE_KNEE = [
  { maxAge: 29, floors: [10, 15, 21, 30] },
  { maxAge: 39, floors: [8, 13, 20, 27] },
  { maxAge: 49, floors: [5, 11, 15, 24] },
  { maxAge: 59, floors: [2, 7, 11, 21] },
  { maxAge: 69, floors: [2, 5, 12, 17] },
];

const levelFromFloors = (value, floors) => {
  let rank = 1;
  floors.forEach((floor) => {
    if (value >= floor) rank += 1;
  });
  return LEVELS[rank - 1];
};

const pickAgeBand = (table, age) => {
  // 18-19 tuổi dùng nhóm 20-29 (gần nhất); từ 70 tuổi trở lên không có bảng chuẩn.
  if (age < 18 || age > 69) return null;
  return table.find((band) => age <= band.maxAge) || null;
};

export const ratePushUp = ({ gender, variant, reps, age }) => {
  if (!Number.isFinite(reps) || !Number.isFinite(age)) return null;
  if (gender === "male" && variant === "standard") {
    const band = pickAgeBand(PUSH_UP_MALE_STANDARD, age);
    return band ? levelFromFloors(reps, band.floors) : null;
  }
  if (gender === "female" && variant === "knee") {
    const band = pickAgeBand(PUSH_UP_FEMALE_KNEE, age);
    return band ? levelFromFloors(reps, band.floors) : null;
  }
  return null;
};

// CDC STEADI: dưới ngưỡng là "dưới trung bình". Chỉ dùng cho 60-94 tuổi.
const CHAIR_STAND_BELOW_AVERAGE = {
  male: [
    [64, 14],
    [74, 12],
    [79, 11],
    [84, 10],
    [89, 8],
    [94, 7],
  ],
  female: [
    [64, 12],
    [69, 11],
    [79, 10],
    [84, 9],
    [89, 8],
    [94, 4],
  ],
};

export const rateChairStand = ({ gender, reps, age }) => {
  if (!Number.isFinite(reps) || !Number.isFinite(age)) return null;
  if (age < 60 || age > 94) return null;
  const table = CHAIR_STAND_BELOW_AVERAGE[gender];
  if (!table) return null;
  const row = table.find(([maxAge]) => age <= maxAge);
  if (!row) return null;
  // Chỉ có một ranh giới công bố: dưới ngưỡng là cần cải thiện, đạt ngưỡng là mức khá.
  return reps < row[1] ? "needs_improvement" : "good";
};

const PLANK_FLOORS = [30, 60, 90, 120];

export const ratePlank = ({ seconds }) => {
  if (!Number.isFinite(seconds)) return null;
  return levelFromFloors(seconds, PLANK_FLOORS);
};

// Cooper Institute: [fair, good, excellent, superior] theo percentile 40/60/80/95 (ml/kg/phút).
const VO2_TABLE = {
  male: [
    { maxAge: 29, floors: [41.7, 45.4, 51.1, 55.4] },
    { maxAge: 39, floors: [40.5, 44.0, 48.3, 54.0] },
    { maxAge: 49, floors: [38.5, 42.4, 46.4, 52.5] },
    { maxAge: 59, floors: [35.6, 39.2, 43.4, 48.9] },
    { maxAge: 69, floors: [32.3, 35.5, 39.5, 45.7] },
    { maxAge: 79, floors: [29.4, 32.3, 36.7, 42.1] },
  ],
  female: [
    { maxAge: 29, floors: [36.1, 39.5, 43.9, 49.6] },
    { maxAge: 39, floors: [34.4, 37.8, 42.4, 47.4] },
    { maxAge: 49, floors: [33.0, 36.3, 39.7, 45.3] },
    { maxAge: 59, floors: [30.1, 33.0, 36.7, 41.1] },
    { maxAge: 69, floors: [27.5, 30.0, 33.0, 37.8] },
    { maxAge: 79, floors: [25.9, 28.1, 30.9, 36.7] },
  ],
};

export const rateVo2Max = ({ gender, vo2max, age }) => {
  if (!Number.isFinite(vo2max) || !Number.isFinite(age) || age < 18 || age > 79) return null;
  const table = VO2_TABLE[gender];
  if (!table) return null;
  const band = table.find((row) => age <= row.maxAge);
  return band ? levelFromFloors(vo2max, band.floors) : null;
};

// Rockport (Kline 1987). Cân nặng đổi sang pound; giới tính: nam = 1, nữ = 0.
export const estimateVo2MaxRockport = ({ gender, age, weightKg, minutes, endHeartRate }) => {
  const values = [age, weightKg, minutes, endHeartRate];
  if (values.some((value) => !Number.isFinite(value))) return null;
  const weightLb = weightKg * 2.20462;
  const sex = gender === "male" ? 1 : 0;
  const vo2 =
    132.853 -
    0.0769 * weightLb -
    0.3877 * age +
    6.315 * sex -
    3.2649 * minutes -
    0.1565 * endHeartRate;
  return Number(vo2.toFixed(1));
};

export const ROCKPORT_VALIDATED_AGE = Object.freeze({ min: 30, max: 69 });

// BMI theo Tổ chức Y tế Thế giới khu vực Châu Á - Thái Bình Dương (WHO/IASO/IOTF 2000).
export const classifyBmiAsia = (bmi) => {
  if (!Number.isFinite(bmi)) return null;
  if (bmi < 18.5) return "underweight";
  if (bmi < 23) return "normal";
  if (bmi < 25) return "overweight";
  if (bmi < 30) return "obese_1";
  return "obese_2";
};

// Vòng eo (WHO 2008): nam >= 94 cm, nữ >= 80 cm là nguy cơ tăng.
export const WAIST_RISK_CM = Object.freeze({ male: 94, female: 80 });
// Tỷ lệ eo/hông (WHO 2008): nam >= 0,90, nữ >= 0,85.
export const WAIST_HIP_RISK = Object.freeze({ male: 0.9, female: 0.85 });
