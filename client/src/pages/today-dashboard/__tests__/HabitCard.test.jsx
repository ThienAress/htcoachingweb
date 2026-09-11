import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CreateHabitForm } from "../CreateHabitForm";
import { HabitListItem } from "../HabitCard";
import { habitFormToPayload } from "../habitForm";

describe("HabitListItem", () => {
  it("hiện thói quen trong tuần nhưng khóa hành động vào ngày không được chọn", async () => {
    const html = renderToStaticMarkup(
      <HabitListItem
        habit={{
          _id: "64b000000000000000000001",
          lineageKey: "weekly-habit",
          version: 1,
          title: "Đi bộ 20 phút",
          description: "Đi bộ sau bữa tối",
          createdByRole: "trainer",
          visibility: "shared",
          status: "active",
          currentStreak: 0,
          scheduledToday: false,
          withinScheduleRange: true,
        }}
        completion={null}
        disabled={false}
        onComplete={vi.fn()}
      />,
    );

    expect(html).toContain("Đi bộ 20 phút");
    expect(html).toContain("Đi bộ sau bữa tối");
    expect(html).toContain("Không áp dụng hôm nay");
    expect((html.match(/disabled=""/g) || [])).toHaveLength(2);
  });

  it("không hiển thị trạng thái chia sẻ HLV trong chế độ tự quản lý", () => {
    const html = renderToStaticMarkup(
      <HabitListItem
        selfManaged
        habit={{
          _id: "64b000000000000000000002",
          title: "Uống đủ nước",
          createdByRole: "user",
          visibility: "shared",
          status: "active",
          currentStreak: 1,
          scheduledToday: true,
        }}
        completion={null}
        disabled={false}
        onComplete={vi.fn()}
        onStatus={vi.fn()}
      />,
    );

    expect(html).not.toMatch(/HLV|Đã chia sẻ/);
  });

  it("không cho chọn chia sẻ HLV trong form tự quản lý", () => {
    const html = renderToStaticMarkup(
      <CreateHabitForm
        selfManaged
        dateKey="2026-09-08"
        disabled={false}
        onCreate={vi.fn()}
      />,
    );

    expect(html).not.toContain("Chia sẻ thói quen này với HLV");
  });

  it("chuẩn hóa payload thói quen tự quản lý thành riêng tư", () => {
    const payload = habitFormToPayload(
      {
        title: "Đi bộ",
        description: "",
        category: "movement",
        daysOfWeek: [0],
        shared: true,
      },
      "2026-09-08",
      { selfManaged: true },
    );

    expect(payload.visibility).toBe("private");
  });
});
