import { describe, expect, it } from "vitest";

import { buildSevenDayReferencePlan } from "../referencePlan.js";

const acceptancePrompt =
  "Lập kế hoạch ăn uống và tập luyện chi tiết trong 7 ngày cho người mới muốn giảm mỡ.";

describe("seven-day reference plan", () => {
  it("returns all seven days for the exact acceptance prompt", () => {
    const plan = buildSevenDayReferencePlan(acceptancePrompt);

    expect(plan).toMatch(
      /Ngày 1[\s\S]*Ngày 2[\s\S]*Ngày 3[\s\S]*Ngày 4[\s\S]*Ngày 5[\s\S]*Ngày 6[\s\S]*Ngày 7/iu,
    );
  });

  it("gives named foods, example portions and their weighing state", () => {
    const plan = buildSevenDayReferencePlan(acceptancePrompt);

    expect(plan).toMatch(
      /yến mạch 50 g \(khô\)[\s\S]*ức gà 120 g \(đã nấu chín\)[\s\S]*cơm gạo lứt 150 g \(đã nấu chín\)/iu,
    );
  });

  it("includes beginner bodyweight prescriptions and recovery days", () => {
    const plan = buildSevenDayReferencePlan(acceptancePrompt);

    expect(plan).toMatch(
      /Wall Push-up[^\n]*2 hiệp x 8–10 lần[^\n]*nghỉ 60 giây[\s\S]*Ngày 4[\s\S]*hồi phục[\s\S]*Ngày 7[\s\S]*nghỉ hoàn toàn/iu,
    );
  });

  it("labels portions as adaptable examples and includes a pain stop guard", () => {
    const plan = buildSevenDayReferencePlan(acceptancePrompt);

    expect(plan).toMatch(
      /khẩu phần dưới đây là ví dụ[\s\S]*điều chỉnh sau khi thu thập thông tin đầu vào[\s\S]*dừng bài tập nếu đau/iu,
    );
  });

  it("does not invent a personalized calorie target or weight-loss guarantee", () => {
    const plan = buildSevenDayReferencePlan(acceptancePrompt);

    expect(plan).not.toMatch(/\b\d{3,4}\s*(?:kcal|calo)|giảm\s+\d+(?:[.,]\d+)?\s*kg/iu);
  });

  it.each([
    `${acceptancePrompt} Tôi ăn thuần chay.`,
    `${acceptancePrompt} Mục tiêu 1.500 kcal mỗi ngày.`,
    `${acceptancePrompt} Cần đúng 120 g protein mỗi ngày.`,
    `${acceptancePrompt} Tôi dị ứng đậu phộng.`,
    `${acceptancePrompt} Tôi bị tiểu đường.`,
    `${acceptancePrompt} Đầu gối đang đau.`,
    `${acceptancePrompt} Tôi chỉ có một đôi tạ đơn.`,
    `${acceptancePrompt} Không có dụng cụ tập.`,
    `${acceptancePrompt} Ngân sách tối đa 100.000 đồng/ngày.`,
  ])("returns null for an explicit personal constraint: %s", (message) => {
    expect(buildSevenDayReferencePlan(message)).toBeNull();
  });

  it.each([
    `${acceptancePrompt} Tôi ăn chay.`,
    `${acceptancePrompt} Tôi ăn chay trường.`,
    `${acceptancePrompt} Hãy làm theo chế độ vegan.`,
    `${acceptancePrompt} Tôi là vegetarian.`,
    `${acceptancePrompt} Tôi không ăn thịt và cá.`,
    `${acceptancePrompt} Tôi không dùng sữa.`,
    `${acceptancePrompt} Loại bỏ trứng khỏi thực đơn.`,
    `${acceptancePrompt} Tránh hải sản.`,
    `${acceptancePrompt} Không ăn tôm.`,
    `${acceptancePrompt} Tránh tôm.`,
    `${acceptancePrompt} Không ăn nấm.`,
    `${acceptancePrompt} Chỉ ăn cua và rau.`,
    `${acceptancePrompt} Ưu tiên món không có hạt điều.`,
    `${acceptancePrompt} Avoid shrimp.`,
  ])("returns null instead of violating a dietary restriction: %s", (message) => {
    expect(buildSevenDayReferencePlan(message)).toBeNull();
  });

  it.each([
    `${acceptancePrompt} Tôi chỉ tập 2 buổi mỗi tuần.`,
    `${acceptancePrompt} Tối đa 20 phút/ngày.`,
    `${acceptancePrompt} Mỗi buổi chỉ có 30 phút.`,
    `${acceptancePrompt} Tôi chỉ ăn 2 bữa mỗi ngày.`,
  ])("returns null for an explicit schedule or duration constraint: %s", (message) => {
    expect(buildSevenDayReferencePlan(message)).toBeNull();
  });

  it.each([
    `${acceptancePrompt} Tôi đang mang thai.`,
    `${acceptancePrompt} Tôi đang cho con bú.`,
    `${acceptancePrompt} Kế hoạch này dành cho người vị thành niên.`,
    `${acceptancePrompt} Kế hoạch này dành cho bé 15 tuổi.`,
    `${acceptancePrompt} Tôi bị hạn chế vận động.`,
    `${acceptancePrompt} Tôi tập tại nhà.`,
    `${acceptancePrompt} Tôi làm ca đêm.`,
  ])("returns null for a body or personal-context constraint: %s", (message) => {
    expect(buildSevenDayReferencePlan(message)).toBeNull();
  });

  it.each([
    "Gợi ý thực đơn 7 ngày cho gia đình.",
    "Lập lịch tập 7 ngày cho người mới.",
    "Lập kế hoạch ăn uống và tập luyện trong 5 ngày cho người mới.",
    "Lập kế hoạch ăn uống và tập luyện 7 ngày cho vận động viên nâng cao.",
  ])("returns null outside the general combined beginner scope: %s", (message) => {
    expect(buildSevenDayReferencePlan(message)).toBeNull();
  });
});
