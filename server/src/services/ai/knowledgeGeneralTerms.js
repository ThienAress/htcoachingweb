// Thuật ngữ thể hình, dinh dưỡng, tổ chức và địa danh phổ biến viết hoa trong nội dung kiến thức.
// Bộ lọc quyền riêng tư coi cụm viết hoa là tên người; các cụm dưới đây là khái niệm chung nên được
// hạ về chữ thường trước khi dò tên. Đây không phải danh sách người hay ID; không thêm tên riêng của
// một người cụ thể (kể cả vận động viên) vào đây.
const GENERAL_TERMS = [
  // Phương pháp, khái niệm tập luyện
  "Body Recomposition", "Progressive Overload", "Mind-Muscle Connection", "Resistance Training",
  "Fasted Training", "Circuit Training", "Corrective Exercise Training", "Personal Fitness Training",
  "Optimum Performance Training", "Self-Myofascial Release", "Dynamic Warm-up", "Rest Day",
  "Posterior Chain", "Overhead Squat Assessment", "Overhead Press", "Barbell Row", "Leg Press",
  "Lat Pulldown", "Bench Press", "Decline Bench Press", "Front Squat", "High-bar Squat", "Low-bar Squat",
  "Foam Roller", "Knee Sleeves", "Knee Wraps", "Inversion Table", "Weightlifting Shoes",
  "Upper Crossed Syndrome", "Diastasis Recti", "Pelvic Floor", "Pelvic Tilts", "Bird-Dog",
  "Diaphragmatic Breathing", "Transversus Abdominis",
  // Dinh dưỡng, thực phẩm chức năng
  "Mass Gainer", "Fat Burner", "Whey Protein", "Pre-workout", "Post-workout", "L-Carnitine",
  "Creatine Monohydrate", "Conjugated Linoleic Acid", "Fish Oil", "Caloric Deficit", "Energy Balance",
  "Calories In", "Calories Out", "Anabolic Window", "Muscle Protein Synthesis", "Nutrient Timing",
  "Total Daily Energy Expenditure", "If It Fits Your Macros", "Eat Clean", "Real Food", "Dietary Supplements",
  "Sports Nutrition", "Sports Medicine", "Public Health", "Heat Shock Proteins", "Cold Water Immersion",
  "Ice Bath", "Deep Sleep", "Online Coaching", "Offline Coaching",
  // Chất dinh dưỡng, hormone, thuật ngữ cơ thể và bài tập (từ đơn rõ ràng không phải tên người)
  "Keto", "Kẽm", "Magiê", "Magnesium", "Serotonin", "Melatonin", "Fructose", "Glucose", "Cortisol", "Adenosine",
  "Sodium", "Glycogen", "Caffeine", "Creatine", "Testosterone", "Insulin", "Tribulus", "Maca", "BCAA", "EAA", "ZMA",
  "Deadlift", "Deload", "Crunch", "Sit-up", "Butt wink", "Neutral Spine", "Test Booster", "Linea Alba", "Overtraining",
  "DOMS", "Delayed Onset Muscle Soreness", "Resting Heart Rate", "Hormone Tăng Trưởng", "Red Flag", "Hypertension",
  "Hypothyroidism", "Lipolysis",
  // Hạng mục thi đấu, danh hiệu
  "Classic Physique", "Men's Physique", "Women's Physique", "Bikini Open", "Pro Card", "Pro League", "Pro Show",
  "Golden Era", "Mr Olympia", "Mr. Olympia", "Head Coach",
  // Tổ chức, chứng chỉ (viết đầy đủ)
  "National Academy of Sports Medicine", "American College of Sports Medicine", "American College of Obstetricians and Gynecologists",
  "International Society of Sports Nutrition", "Harvard Medical School", "Harvard T.H. Chan School of Public Health",
  "Office of Dietary Supplements", "Sleep Foundation", "Corrective Exercise Specialist", "Women's Fitness Specialist",
  "Certified Personal Trainer", "Code of Professional Conduct", "Professional Conduct",
  // Quốc gia, địa danh, tổ chức tiếng Việt
  "Việt Nam", "Hoa Kỳ", "Nhật Bản", "Hàn Quốc", "Hà Nội", "Bắc Giang", "Thanh Hóa", "An Giang", "Viện Y tế Quốc gia Hoa Kỳ",
  "Viện Dinh dưỡng Quốc gia", "Cục Thể dục Thể thao", "Hiệp hội Dinh dưỡng Thể thao Quốc tế",
  "Hiệp hội Tuyến giáp Hoa Kỳ", "Hiệp hội Thể lực và Thể thao Hoa Kỳ", "Trường Cao đẳng Sản phụ khoa Hoa Kỳ",
  "Trung tâm Kiểm soát và Phòng ngừa Dịch bệnh", "Viện Dinh dưỡng Thể thao Quốc tế",
  "Tạp chí Quốc tế về Dinh dưỡng Thể thao và Chuyển hóa Tập thể dục",
  "Journal of Strength and Conditioning Research", "Journal of Clinical Medicine",
  "Báo Người Đưa Tin", "Báo Thể Thao Văn Hóa", "Báo Thanh Niên", "Báo Phụ Nữ Hiện Đại", "Báo Đời Sống",
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const GENERAL_TERM_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:${[...GENERAL_TERMS]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|")})(?![\\p{L}\\p{N}_])`,
  "giu",
);

// Từ xưng hô đứng ngay trước một cụm viết hoa cho thấy đó có thể là tên người ("Chị Thanh Hóa"), nên không hạ chữ thường.
const ADDRESS_TERM_BEFORE_PATTERN =
  /(?:^|[^\p{L}])(?:chi|anh|em|ong|ba|co|cau|bac|di|chu|ms|mr|mrs|miss|hoc vien|khach hang|khach|member|client)\.?\s+$/u;

// Một từ viết hoa đứng liền trước (không dấu câu) cho thấy cụm có thể là họ tên ("Hùng Deadlift").
const CAPITALIZED_WORD_RIGHT_BEFORE_PATTERN = /\p{Lu}[\p{L}\p{M}'’-]*[ \t]+$/u;

const foldForCue = (value) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

// "an toàn" (chữ thường) là tính từ, không phải tên "An" ("cho an toàn"). Không dùng cờ i: "An Toàn" viết hoa vẫn là tên.
const SAFE_ADJECTIVE_PATTERN = /(?<![\p{L}\p{N}_])an toàn(?![\p{L}\p{N}_])/gu;

// Giữ nguyên độ dài chuỗi để vị trí khớp của các bước sau không bị lệch.
export const maskGeneralKnowledgeTerms = (value) =>
  String(value || "")
    .replace(GENERAL_TERM_PATTERN, (match, offset, whole) => {
      const before = whole.slice(Math.max(0, offset - 24), offset);
      return ADDRESS_TERM_BEFORE_PATTERN.test(foldForCue(before)) ||
        CAPITALIZED_WORD_RIGHT_BEFORE_PATTERN.test(before)
        ? match
        : match.toLocaleLowerCase("vi");
    })
    .replace(SAFE_ADJECTIVE_PATTERN, "an_toan");

// Tên tổ chức và tiêu đề tài liệu có chứa từ y khoa ("Sports Medicine", "Clients with Hypertension").
// Thay bằng cụm trung tính trước khi dò dữ liệu sức khỏe cá nhân để dòng dẫn nguồn không bị coi là hồ sơ bệnh.
const REFERENCE_TITLES = [
  "National Academy of Sports Medicine", "American College of Sports Medicine", "Sports Medicine",
  "Journal of Clinical Medicine", "Journal of Sports Medicine", "British Journal of Sports Medicine",
  "NASM Guidelines for Clients with Hypertension", "Guidelines for Clients with Hypertension",
  "Hiệp hội Tim mạch Hoa Kỳ", "Trung tâm Kiểm soát và Phòng ngừa Dịch bệnh", "Healthy Weight Loss",
  "Viện Y tế Quốc gia Hoa Kỳ", "Viện Y tế Quốc gia", "Viện Dinh dưỡng Thể thao Quốc tế",
  "Harvard Medical School", "Office of Dietary Supplements", "Dietary Supplements",
];

const REFERENCE_TITLE_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:${[...REFERENCE_TITLES]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|")})(?![\\p{L}\\p{N}_])`,
  "giu",
);

export const neutralizeReferenceTitles = (value) =>
  String(value || "").replace(REFERENCE_TITLE_PATTERN, "neutral_reference_title");
