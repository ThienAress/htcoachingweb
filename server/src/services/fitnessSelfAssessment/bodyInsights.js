import { WAIST_HIP_RISK, WAIST_RISK_CM, classifyBmiAsia } from "./norms.js";

const num = (value) => (value === null || value === undefined || value === "" ? null : Number(value));

const BMI_MESSAGES = {
  underweight: "BMI thấp hơn mức bình thường; nên ưu tiên ăn đủ năng lượng và tăng cơ, tránh giảm cân.",
  normal: "BMI trong khoảng bình thường theo chuẩn khu vực Châu Á - Thái Bình Dương.",
  overweight: "BMI ở mức thừa cân theo chuẩn khu vực Châu Á - Thái Bình Dương.",
  obese_1: "BMI ở mức béo phì độ 1 theo chuẩn khu vực Châu Á - Thái Bình Dương.",
  obese_2: "BMI ở mức béo phì độ 2 theo chuẩn khu vực Châu Á - Thái Bình Dương.",
};

const RESTING_HR_MESSAGES = {
  low: "Nhịp tim nghỉ dưới 60 lần/phút, thường gặp ở người tập đều; nếu kèm chóng mặt hãy hỏi bác sĩ.",
  normal: "Nhịp tim nghỉ trong khoảng bình thường (60-100 lần/phút).",
  high: "Nhịp tim nghỉ trên 100 lần/phút; nên đo lại lúc nghỉ ngơi và hỏi bác sĩ nếu còn cao.",
};

// Chỉ số cơ thể chỉ mang tính tham khảo, không phải chẩn đoán; BMI không phân biệt cơ và mỡ.
export const buildBodyInsights = (profile = {}) => {
  const insights = [];
  const height = num(profile.heightCm);
  const weight = num(profile.weightKg);
  if (height && weight) {
    const bmi = Number((weight / (height / 100) ** 2).toFixed(1));
    const status = classifyBmiAsia(bmi);
    insights.push({
      key: "bmi",
      label: "Chỉ số khối cơ thể (BMI)",
      value: bmi,
      status,
      message: `${BMI_MESSAGES[status]} BMI không phân biệt cơ và mỡ nên người nhiều cơ có thể cao hơn thực tế.`,
    });
  }

  const gender = profile.gender;
  const waist = num(profile.waistCm);
  if (waist && WAIST_RISK_CM[gender]) {
    const risk = waist >= WAIST_RISK_CM[gender];
    insights.push({
      key: "waist",
      label: "Vòng eo",
      value: waist,
      status: risk ? "elevated" : "normal",
      message: risk
        ? "Vòng eo ở mức nguy cơ tăng theo khuyến cáo của WHO; giảm mỡ bụng và tăng vận động sẽ có lợi."
        : "Vòng eo dưới ngưỡng nguy cơ theo khuyến cáo của WHO.",
    });
  }

  const hip = num(profile.hipCm);
  if (waist && hip && WAIST_HIP_RISK[gender]) {
    const ratio = Number((waist / hip).toFixed(2));
    const risk = ratio >= WAIST_HIP_RISK[gender];
    insights.push({
      key: "waistHip",
      label: "Tỷ lệ eo/hông",
      value: ratio,
      status: risk ? "elevated" : "normal",
      message: risk
        ? "Tỷ lệ eo/hông ở mức nguy cơ tăng theo khuyến cáo của WHO."
        : "Tỷ lệ eo/hông dưới ngưỡng nguy cơ theo khuyến cáo của WHO.",
    });
  }

  const resting = num(profile.restingHeartRate);
  if (resting) {
    const status = resting < 60 ? "low" : resting <= 100 ? "normal" : "high";
    insights.push({
      key: "restingHeartRate",
      label: "Nhịp tim nghỉ",
      value: resting,
      status,
      message: RESTING_HR_MESSAGES[status],
    });
  }
  return insights;
};
