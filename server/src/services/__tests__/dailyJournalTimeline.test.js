import { describe, expect, it } from "vitest";

import { journalRevisionLabel } from "../dailyJournalTimeline.service.js";

describe("daily journal timeline labels", () => {
  it("nêu rõ báo cáo dinh dưỡng đã được gửi", () => {
    expect(
      journalRevisionLabel({
        action: "nutrition_submit",
        changes: [{ path: "nutrition.submittedAt" }],
      }),
    ).toBe("Đã gửi báo cáo dinh dưỡng cho HLV");
  });

  it("nêu rõ field wellness đã cập nhật", () => {
    expect(
      journalRevisionLabel({
        action: "correction",
        changes: [
          { path: "wellness.energy" },
          { path: "wellness.hunger" },
        ],
      }),
    ).toBe("Đã cập nhật năng lượng và cảm giác đói");
  });

  it("tóm tắt gọn khi submit nhiều chỉ số", () => {
    expect(
      journalRevisionLabel({
        action: "submit",
        changes: [
          { path: "wellness.sleepHours" },
          { path: "wellness.energy" },
          { path: "wellness.stress" },
        ],
      }),
    ).toBe("Đã gửi nhật ký: giấc ngủ, năng lượng và 1 chỉ số khác");
  });
});
