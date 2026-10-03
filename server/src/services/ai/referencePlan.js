const normalize = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/gi, "d")
  .toLowerCase()
  .replace(/[^a-z0-9.,/\s-]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const MEAL_INTENT = /\b(?:an uong|thuc don|bua an|meal plan|diet plan)\b/;
const TRAINING_INTENT = /\b(?:tap luyen|lich tap|tap the duc|workout|training)\b/;
const SEVEN_DAY_SCOPE = /\b7\s*(?:ngay|days?)\b/;
const BEGINNER_SCOPE = /\b(?:nguoi moi|moi bat dau|beginner|newbie)\b/;

const CONSTRAINT_PATTERNS = Object.freeze([
  /\b(?:\d{1,2}(?:[.,]\d{3})+|\d{3,4})\s*(?:kcal|calo|calories?)\b/,
  /\b(?:\d{1,3}(?:[.,]\d+)?\s*(?:g|gram)\s*(?:protein|chat dam|dam|carbs?|carbohydrate|fat|chat beo)|(?:protein|chat dam|dam|carbs?|carbohydrate|fat|chat beo)\s*\d{1,3}(?:[.,]\d+)?\s*(?:g|gram))\b/,
  /\b(?:di ung|allerg(?:y|ies|ic)?|khong dung nap|lactose free)\b/,
  /\b(?:benh|tieu duong|dai thao duong|huyet ap|tim mach|suy than|benh than|benh gan|gan nhiem mo|gout|gut|mang thai|thai ky)\b/,
  /\b(?:dau|chan thuong|phau thuat|rehab|phuc hoi chuc nang)\b/,
  /\b(?:dung cu|equipment|ta don|ta tay|dumbbells?|kettlebells?|day khang luc|resistance bands?|may tap|bodyweight)\b/,
  /\b(?:ngan sach|budget|chi phi|gia re|tiet kiem)\b|\b\d[\d.,\s]{2,12}\s*(?:d|vnd|dong)\b/,
  /\b(?:\d{1,3}\s*(?:kg|cm)|\d{1,3}\s*tuoi|can nang|chieu cao)\b/,
  /\b(?:an chay|thuan chay|chay truong|vegan|vegetarian|halal|kosher|nhin an|an gian doan|intermittent fasting)\b/,
  // A fixed example cannot honor arbitrary food exclusions or preferences.
  /\b(?:khong (?:an|dung|thich)|loai bo|tranh|chi an|bat buoc|uu tien|avoid|exclude|without|only eat|do not eat|don t eat|no)\b/,
  /\b(?:\d{1,3}\s*phut)(?:\s*(?:\/|moi|mot)\s*(?:ngay|buoi))?\b/,
  /\b(?:chi\s+)?(?:tap\s+)?\d{1,2}\s*(?:buoi|lan)(?:\s*(?:\/|moi|mot)\s*(?:tuan|ngay))?\b/,
  /\b(?:chi\s+)?(?:an\s+)?\d{1,2}\s*bua(?:\s*(?:\/|moi|mot)\s*ngay)?\b/,
  /\b(?:tre em|vi thanh nien|duoi 18 tuoi|cho con bu|sau sinh|han che van dong|ngoi xe lan|tap tai nha|tap o nha|lam ca dem|ca dem)\b/,
]);

const REFERENCE_PLAN = `Kế hoạch minh họa chung cho người mới trong 7 ngày. Khẩu phần dưới đây là ví dụ; cần điều chỉnh sau khi thu thập thông tin đầu vào về cơ thể, mức vận động và thói quen ăn uống. Kế hoạch không ấn định năng lượng hay chất dinh dưỡng cá nhân hóa và không bảo đảm mức giảm mỡ cụ thể.

Quy ước khối lượng: yến mạch, hạt và bún khô được cân khi khô; cơm, khoai, thịt, cá, trứng và đậu phụ được cân sau khi nấu chín; rau quả được cân ở phần ăn được.

Ngày 1
- Ăn: sáng yến mạch 50 g (khô), sữa chua không đường 170 g, chuối 100 g; trưa ức gà 120 g (đã nấu chín), cơm gạo lứt 150 g (đã nấu chín), bông cải xanh 200 g; xế táo 150 g và hạnh nhân 15 g; tối cá hồi 120 g, khoai lang 180 g, rau xà lách 200 g.
- Tập toàn thân A: Wall Push-up 2 hiệp x 8–10 lần, Bodyweight Squat xuống ghế 2 hiệp x 10 lần, Glute Bridge 2 hiệp x 12 lần, Dead Bug 2 hiệp x 6 lần mỗi bên; nghỉ 60 giây giữa hiệp.

Ngày 2
- Ăn: sáng 2 trứng luộc 100 g, bánh mì nguyên cám 70 g, cà chua 150 g; trưa thịt thăn heo 120 g, cơm trắng 150 g, cải thìa 200 g; xế ổi 180 g; tối đậu phụ 180 g, khoai tây 180 g, rau luộc 200 g.
- Hồi phục chủ động: đi bộ nhanh 25 phút ở nhịp vẫn nói chuyện được, sau đó giãn bắp chân và gập hông 2 hiệp x 30 giây mỗi bên; nghỉ 30 giây.

Ngày 3
- Ăn: sáng khoai lang 180 g, 2 trứng 100 g, dưa leo 150 g; trưa cá basa 140 g, cơm gạo lứt 150 g, rau muống 200 g; xế sữa chua không đường 170 g và thanh long 150 g; tối ức gà 120 g, bún gạo lứt 60 g (khô), cải xanh 200 g.
- Tập toàn thân B: Incline Push-up tựa bàn chắc chắn 2 hiệp x 8–10 lần, Supported Reverse Lunge 2 hiệp x 6–8 lần mỗi bên, Bird Dog 2 hiệp x 6 lần mỗi bên, Prone Y-T Raise 2 hiệp x 8 lần; nghỉ 60–75 giây giữa hiệp.

Ngày 4
- Ăn: sáng yến mạch 50 g (khô), sữa tươi không đường 200 ml, xoài 120 g; trưa bò nạc 120 g, cơm trắng 150 g, đậu que 200 g; xế cam 180 g; tối cá thu 120 g, khoai lang 180 g, rau cải 200 g.
- Ngày hồi phục: đi bộ thư thả 20 phút và tập Cat-Cow 2 hiệp x 8 lần, Child's Pose 2 hiệp x 30 giây; nghỉ 30 giây.

Ngày 5
- Ăn: sáng bánh mì nguyên cám 70 g, 2 trứng 100 g, bơ 50 g; trưa ức gà 120 g, cơm gạo lứt 150 g, bí đỏ 200 g; xế lê 160 g và hạt điều 15 g; tối tôm 140 g, khoai tây 180 g, salad rau 200 g.
- Tập toàn thân C: Knee Push-up 2 hiệp x 6–8 lần, Sit-to-Stand 2 hiệp x 10 lần, Single-leg Glute Bridge hỗ trợ 2 hiệp x 6 lần mỗi bên, Side Plank gối chạm sàn 2 hiệp x 15–20 giây mỗi bên; nghỉ 60–75 giây giữa hiệp.

Ngày 6
- Ăn: sáng sữa chua không đường 170 g, yến mạch 45 g (khô), đu đủ 150 g; trưa cá rô phi 140 g, cơm trắng 150 g, rau củ hấp 200 g; xế chuối 100 g; tối đậu phụ 180 g, bún gạo lứt 60 g (khô), nấm và cải 200 g.
- Hồi phục chủ động: đi bộ nhanh 30 phút, rồi giãn cơ đùi trước và ngực 2 hiệp x 30 giây mỗi bên; nghỉ 30 giây.

Ngày 7
- Ăn: sáng khoai lang 180 g, 2 trứng 100 g, cà chua 150 g; trưa thịt thăn heo 120 g, cơm gạo lứt 150 g, bắp cải 200 g; xế táo 150 g; tối cá hồi 120 g, khoai tây 180 g, salad rau 200 g.
- Vận động: nghỉ hoàn toàn; có thể đi bộ nhẹ 10–15 phút nếu thấy dễ chịu.

Khởi động 5 phút trước buổi tập. Dừng bài tập nếu đau, chóng mặt hoặc khó thở bất thường và tìm hỗ trợ chuyên môn phù hợp.`;

/**
 * Trả một kế hoạch minh họa cố định cho yêu cầu chung, không có constraints cá nhân.
 * Caller tiếp tục intake/model path khi hàm trả về null.
 */
export const buildSevenDayReferencePlan = (message) => {
  const normalized = normalize(message);
  const isEligible = MEAL_INTENT.test(normalized) &&
    TRAINING_INTENT.test(normalized) &&
    SEVEN_DAY_SCOPE.test(normalized) &&
    BEGINNER_SCOPE.test(normalized);

  if (!isEligible || CONSTRAINT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return null;
  }

  return REFERENCE_PLAN;
};
