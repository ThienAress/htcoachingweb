// Mục tiêu, sức khỏe và lối sống HLV cập nhật lại khi bắt đầu giai đoạn mới. Cùng các trường với khảo sát
// ban đầu nhưng chỉ nhận field cho phép, kiểm kiểu và khoảng giá trị.
const fail = (message) => {
  const error = new Error(message);
  error.status = 400;
  error.expose = true;
  throw error;
};

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const text = (value, max, label) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") fail(`${label} không hợp lệ`);
  const trimmed = value.trim();
  if (trimmed.length > max) fail(`${label} tối đa ${max} ký tự`);
  return trimmed;
};

const bool = (value) => value === true;

const optionalNumber = (value, min, max, label) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) fail(`${label} không hợp lệ`);
  return parsed;
};

const list = (value, maxItems, maxLength, label) => {
  if (value === undefined || value === null || value === "") return [];
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : fail(`${label} không hợp lệ`);
  if (items.length > maxItems) fail(`${label} quá dài`);
  return items
    .map((item) => {
      if (typeof item !== "string") fail(`${label} không hợp lệ`);
      return item.trim();
    })
    .filter(Boolean)
    .map((item) => {
      if (item.length > maxLength) fail(`${label} không hợp lệ`);
      return item;
    });
};

const oneOf = (value, allowed, label, { required = false } = {}) => {
  const normalized = value ?? "";
  if (normalized === "" && !required) return "";
  if (!allowed.includes(normalized)) fail(`${label} không hợp lệ`);
  return normalized;
};

export const normalizeProfile = (body) => {
  if (!isObject(body)) fail("Dữ liệu cập nhật không hợp lệ");
  const health = isObject(body.healthScreening) ? body.healthScreening : {};
  const life = isObject(body.lifestyleNutrition) ? body.lifestyleNutrition : {};
  const goal = isObject(body.trainingProfileGoal) ? body.trainingProfileGoal : fail("Thiếu mục tiêu và tập luyện");

  const painLevel = optionalNumber(health.painLevel, 0, 10, "Mức độ đau");
  const trainingExperience = oneOf(
    goal.trainingExperience,
    ["none", "beginner", "intermediate", "advanced"],
    "Kinh nghiệm tập luyện",
    { required: true },
  );

  return {
    healthScreening: {
      hasPainNow: bool(health.hasPainNow),
      painLocation: list(health.painLocation, 10, 60, "Vị trí đau"),
      painLevel: painLevel ?? 0,
      injuries: text(health.injuries, 500, "Chấn thương"),
      currentConditions: text(health.currentConditions, 500, "Bệnh lý hiện tại"),
      surgeries: text(health.surgeries, 500, "Phẫu thuật"),
      medications: text(health.medications, 500, "Thuốc đang dùng"),
      doctorRestrictions: text(health.doctorRestrictions, 500, "Hạn chế do bác sĩ"),
      warningSigns: list(health.warningSigns, 20, 60, "Dấu hiệu cảnh báo"),
    },
    lifestyleNutrition: {
      mealsPerDay: optionalNumber(life.mealsPerDay, 1, 10, "Số bữa ăn mỗi ngày"),
      usuallyEatOut: bool(life.usuallyEatOut),
      foodAllergies: text(life.foodAllergies, 500, "Dị ứng thực phẩm"),
      drinkEnoughWater: bool(life.drinkEnoughWater),
      sleepHours: optionalNumber(life.sleepHours, 0, 24, "Giờ ngủ"),
      stressLevel: oneOf(life.stressLevel, ["low", "medium", "high"], "Mức căng thẳng"),
      workActivityLevel: oneOf(
        life.workActivityLevel,
        ["sedentary", "standing", "active", "heavy_labor"],
        "Vận động trong công việc",
      ),
    },
    trainingProfileGoal: {
      currentlyTraining: bool(goal.currentlyTraining),
      trainingDaysPerWeek: optionalNumber(goal.trainingDaysPerWeek, 0, 14, "Số buổi mỗi tuần"),
      sessionDurationMinutes: optionalNumber(goal.sessionDurationMinutes, 0, 600, "Thời lượng buổi tập"),
      sportsHistory: list(goal.sportsHistory, 20, 60, "Các môn từng tập"),
      trainingExperience,
      breakDuration: text(goal.breakDuration, 100, "Thời gian nghỉ tập"),
      primaryGoal: oneOf(goal.primaryGoal, ["fat_loss", "weight_gain", "muscle_gain", "maintenance"], "Mục tiêu chính", { required: true }),
      targetWeightKg: optionalNumber(goal.targetWeightKg, 10, 300, "Cân nặng mong muốn"),
      targetTimeframe: text(goal.targetTimeframe, 60, "Thời gian mong muốn"),
    },
  };
};

// Áp hồ sơ cập nhật lên khảo sát gốc (chỉ ba nhóm này thay đổi).
export const applyProfile = (intake, profile) => {
  if (!intake || !profile) return intake;
  return {
    ...intake,
    healthScreening: { ...intake.healthScreening, ...profile.healthScreening },
    lifestyleNutrition: { ...intake.lifestyleNutrition, ...profile.lifestyleNutrition },
    trainingProfileGoal: { ...intake.trainingProfileGoal, ...profile.trainingProfileGoal },
  };
};
