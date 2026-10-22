// Nội dung tĩnh cho hệ thống gợi ý. Tên bài tập luôn để tiếng Anh.

// Ba bậc tiến triển cho mỗi nhóm: bậc 1 = giảm tải, bậc 2 = chuẩn, bậc 3 = nâng cao.
export const EXERCISES_BY_METRIC = Object.freeze({
  upperBodyPush: [
    ["Wall Push-Up", "Incline Push-Up", "Knee Push-Up"],
    ["Push-Up", "Dumbbell Bench Press", "Dumbbell Shoulder Press"],
    ["Barbell Bench Press", "Weighted Push-Up", "Overhead Press"],
  ],
  lowerBody: [
    ["Sit-to-Stand", "Glute Bridge", "Bodyweight Squat"],
    ["Goblet Squat", "Reverse Lunge", "Romanian Deadlift"],
    ["Barbell Back Squat", "Bulgarian Split Squat", "Barbell Hip Thrust"],
  ],
  coreEndurance: [
    ["Dead Bug", "Bird Dog", "Incline Plank"],
    ["Plank", "Side Plank", "Pallof Press"],
    ["Ab Wheel Rollout", "Hanging Knee Raise", "Suitcase Carry"],
  ],
  cardio: [
    ["Brisk Walk", "Easy Cycling"],
    ["Incline Treadmill Walk", "Rowing Machine", "Jog-Walk Intervals"],
    ["Zone 2 Run", "Hill Intervals", "Cycling Intervals"],
  ],
});

// Mỗi bài đẩy nên đi cùng bài kéo vì bộ bài tự kiểm tra không có bài kéo.
export const PULL_BALANCE_EXERCISES = Object.freeze([
  "Seated Cable Row",
  "Lat Pulldown",
  "One-Arm Dumbbell Row",
  "Face Pull",
]);

export const PAIN_AREA_LABELS = Object.freeze({
  neck: "Cổ",
  shoulder: "Vai",
  elbow_wrist: "Khuỷu tay và cổ tay",
  upper_back: "Lưng trên",
  lower_back: "Lưng dưới",
  hip: "Hông",
  knee: "Đầu gối",
  ankle_foot: "Cổ chân và bàn chân",
});

export const PAIN_AREAS = Object.freeze(Object.keys(PAIN_AREA_LABELS));

export const PAIN_AREA_TIPS = Object.freeze({
  neck: "Tránh các bài đè lực lên cổ; giữ cổ trung tính khi tập.",
  shoulder: "Ưu tiên biên độ thoải mái, tránh đẩy qua đầu khi còn đau.",
  elbow_wrist: "Dùng tạ đơn hoặc dây kháng lực để giảm áp lực cổ tay; tránh khóa khuỷu.",
  upper_back: "Tăng các bài kéo nhẹ và giữ tư thế ngực mở.",
  lower_back: "Chọn bài giữ cột sống trung tính (Bird Dog, Dead Bug); tránh gập cúi nặng.",
  hip: "Tăng biên độ dần, ưu tiên bài ổn định hông (Glute Bridge).",
  knee: "Giảm độ sâu và tải ở bài squat/lunge, ưu tiên Glute Bridge và Sit-to-Stand.",
  ankle_foot: "Ưu tiên bài ít chịu lực (đạp xe, bơi) cho tim phổi cho tới khi hết đau.",
});

export const RECOMMENDATION_REFERENCES = Object.freeze([
  "WHO (2020). Guidelines on physical activity and sedentary behaviour.",
  "U.S. Department of Health and Human Services (2018). Physical Activity Guidelines for Americans, 2nd edition.",
  "ACSM (2009). Position Stand: Progression models in resistance training for healthy adults. Med Sci Sports Exerc.",
  "Schoenfeld BJ, Ogborn D, Krieger JW (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci.",
  "Morton RW và cs. (2018). A systematic review, meta-analysis and meta-regression of protein supplementation on resistance training-induced gains. Br J Sports Med.",
  "Tanaka H, Monahan KD, Seals DR (2001). Age-predicted maximal heart rate revisited. J Am Coll Cardiol.",
  "Payne VG và cs. (2000). Canadian musculoskeletal fitness norms. Can J Appl Physiol.",
  "Kline GM và cs. (1987). Estimation of VO2max from a one-mile track walk. Med Sci Sports Exerc.",
  "The Cooper Institute. VO2max classification by age and sex.",
  "CDC STEADI. 30-Second Chair Stand assessment.",
  "WHO Expert Consultation (2004). Appropriate body-mass index for Asian populations. Lancet.",
  "WHO (2008). Waist circumference and waist-hip ratio: report of an expert consultation.",
  "Watson NF và cs. (2015). Recommended amount of sleep for a healthy adult. Sleep.",
  "Paluch AE và cs. (2022). Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts. Lancet Public Health.",
  "NASM. Optimum Performance Training (OPT) model.",
]);
