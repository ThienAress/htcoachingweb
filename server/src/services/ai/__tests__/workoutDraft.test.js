import { describe, expect, it } from "vitest";

import { validateWorkoutEquipmentOutput } from "../equipmentConstraint.js";
import { buildBoundedWorkoutDraft } from "../workoutDraft.js";

const acceptancePrompt =
  "Tạo lịch tập tăng cơ 4 ngày/tuần cho người mới, chỉ có đôi tạ đơn điều chỉnh và dây kháng lực; mỗi buổi tối đa 60 phút, kèm deload.";

describe("bounded workout draft", () => {
  it("builds a complete four-day beginner draft within the stated equipment", () => {
    const draft = buildBoundedWorkoutDraft(acceptancePrompt);

    expect(draft).toMatch(
      /Buổi 1[\s\S]*Buổi 2[\s\S]*Buổi 3[\s\S]*Buổi 4[\s\S]*hiệp[\s\S]*RPE[\s\S]*nghỉ/iu,
    );
    expect(validateWorkoutEquipmentOutput(acceptancePrompt, draft)).toMatchObject({
      applies: true,
      valid: true,
      reasonCodes: [],
    });
  });

  it("keeps the estimate below 60 minutes and gives an explicit deload", () => {
    const draft = buildBoundedWorkoutDraft(acceptancePrompt);

    expect(draft).toMatch(
      /mỗi buổi 45[–-]55 phút, gồm 6 phút khởi động[\s\S]*deload, giảm khoảng 30% volume/iu,
    );
  });

  it("uses a lower-volume prescription for an explicit 30-minute cap", () => {
    const draft = buildBoundedWorkoutDraft(
      "Tạo lịch 2 ngày mỗi tuần cho người mới, chỉ có tạ đơn, tối đa 30 phút mỗi buổi.",
    );
    const firstSession = draft.split("\n").find((line) => line.startsWith("Buổi 1"));

    expect({
      estimate: draft.match(/mỗi buổi (\d+)[–-](\d+) phút/)?.slice(1),
      exerciseCount: (firstSession.match(/hiệp/g) || []).length,
      prescription: firstSession,
    }).toMatchObject({
      estimate: ["25", "30"],
      exerciseCount: 3,
      prescription: expect.stringMatching(/2 hiệp[\s\S]*nghỉ 60 giây/iu),
    });
  });

  it("keeps four exercises and three sets when the cap is 60 minutes", () => {
    const draft = buildBoundedWorkoutDraft(acceptancePrompt);
    const firstSession = draft.split("\n").find((line) => line.startsWith("Buổi 1"));

    expect({
      exerciseCount: (firstSession.match(/hiệp/g) || []).length,
      allThreeSets: (firstSession.match(/3 hiệp/g) || []).length,
    }).toEqual({ exerciseCount: 4, allThreeSets: 4 });
  });

  it("labels the deterministic plan as a general reference", () => {
    expect(buildBoundedWorkoutDraft(acceptancePrompt)).toMatch(
      /khung tham khảo[\s\S]*không phải đơn tập cá nhân/iu,
    );
  });

  it("places deload in the final requested week when a program length is explicit", () => {
    const draft = buildBoundedWorkoutDraft(
      `${acceptancePrompt} Hãy ghi cách tăng tiến trong 6 tuần.`,
    );

    expect(draft).toMatch(/Tuần 6 deload, giảm khoảng 30% volume/iu);
  });

  it("supports a nearby band-only three-day request without inventing dumbbells", () => {
    const prompt =
      "Lập lịch tập 3 buổi/tuần cho beginner, chỉ dùng dây kháng lực, mỗi buổi tối đa 50 phút.";
    const draft = buildBoundedWorkoutDraft(prompt);

    expect(draft).toMatch(/Buổi 1[\s\S]*Buổi 2[\s\S]*Buổi 3/iu);
    expect(draft).not.toMatch(/dumbbell|tạ đơn|ghế|máy|cáp|thanh đòn/iu);
  });

  it("uses two full-body sessions for a two-day dumbbell plan", () => {
    const draft = buildBoundedWorkoutDraft(
      "Lập lịch tập 2 buổi/tuần cho người mới, chỉ có tạ đơn, tối đa 45 phút.",
    );

    expect(draft).toMatch(
      /Buổi 1 \(toàn thân A[\s\S]*Floor Press[\s\S]*(?:Goblet Squat|Romanian Deadlift)[\s\S]*Buổi 2 \(toàn thân B[\s\S]*(?:Row|Press)[\s\S]*(?:Squat|Lunge)/iu,
    );
  });

  it("schedules four upper-lower sessions with rest before sessions 3 and 4", () => {
    const draft = buildBoundedWorkoutDraft(acceptancePrompt);

    expect(draft).toMatch(
      /Thứ 2: Buổi 1 \(thân trên\)[\s\S]*Thứ 3: Buổi 2 \(thân dưới\)[\s\S]*Thứ 4: nghỉ[\s\S]*Thứ 5: Buổi 3 \(thân trên\)[\s\S]*Thứ 6: nghỉ[\s\S]*Thứ 7: Buổi 4 \(thân dưới\)[\s\S]*hai buổi thân dưới không liền nhau/iu,
    );
  });

  it("supports the explicit no-adjacent-leg-days constraint it schedules", () => {
    const draft = buildBoundedWorkoutDraft(
      `${acceptancePrompt} Tôi không muốn tập chân hai ngày liên tiếp.`,
    );

    expect(draft).toMatch(/hai buổi thân dưới không liền nhau/iu);
  });

  it("allows an explicit statement that there is no injury", () => {
    expect(buildBoundedWorkoutDraft(
      `${acceptancePrompt} Tôi không có chấn thương và không bị đau.`,
    )).toMatch(/Buổi 1/iu);
  });

  it("includes a bounded stop-pain rule without handling a medical condition", () => {
    expect(buildBoundedWorkoutDraft(acceptancePrompt)).toMatch(
      /Dừng bài nếu đau nhói, chóng mặt hoặc triệu chứng tăng/iu,
    );
  });

  it("supports a no-equipment beginner request with bodyweight exercises", () => {
    const draft = buildBoundedWorkoutDraft(
      "Tạo lịch 2 ngày mỗi tuần cho người mới, không cần dụng cụ, tối đa 45 phút mỗi buổi.",
    );

    expect(draft).toMatch(/Buổi 1[\s\S]*(?:Wall Push-up|Squat|Glute Bridge)[\s\S]*Buổi 2/iu);
    expect(draft).not.toMatch(/dumbbell|tạ đơn|dây kháng lực|bench|ghế/iu);
  });

  it.each([
    "Tạo lịch 4 ngày cho người mới, tôi có kettlebell, tối đa 60 phút.",
    "Tạo lịch cho người mới, chỉ có tạ đơn và dây kháng lực.",
    "Tạo lịch 4 ngày, chỉ có tạ đơn và dây kháng lực.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây, tối đa 25 phút.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây, chỉ tập thân trên.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây, tránh bài chân.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây, không muốn tập vai.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây, ưu tiên ngực nhiều hơn.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây, không thích lunge.",
    "Tạo lịch 4 ngày cho người mới bị chấn thương gối, chỉ có tạ đơn và dây.",
    "Tạo lịch 4 ngày cho người mới bị tiểu đường, chỉ có tạ đơn và dây.",
    "Tạo lịch 4 ngày cho người mới đang mang thai, chỉ có tạ đơn và dây.",
    "Tạo lịch 4 ngày cho người mới 16 tuổi, chỉ có tạ đơn và dây.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn 10 kg và dây kháng lực.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây; tăng 2 kg mỗi tuần.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây; tăng 10% mỗi tuần.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây; giữ RPE 8.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây; bắt buộc 5 bài mỗi buổi.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây; tôi không muốn tập buổi sáng.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây; tập vào thứ 2, 3, 5, 7.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây; ăn gì để đủ 120 g protein?",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây; mỗi buổi ít nhất 45 phút.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây; mỗi buổi 30-45 phút.",
    "Tạo lịch 4 ngày cho người mới, chỉ có tạ đơn và dây; bắt buộc có Bulgarian split squat.",
    "Tạo lịch 5 ngày cho người mới, chỉ có tạ đơn và dây kháng lực.",
  ])("returns null instead of assuring an unclear bounded draft: %s", (message) => {
    expect(buildBoundedWorkoutDraft(message)).toBeNull();
  });
});
