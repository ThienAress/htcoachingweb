import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { HabitListItem } from "../HabitCard";

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
});
