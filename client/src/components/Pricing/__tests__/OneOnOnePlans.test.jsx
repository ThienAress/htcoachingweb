import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, options) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

import OneOnOnePlans from "../OneOnOnePlans";

const plans = [
  { title: "Cơ bản", durationText: "8 tuần", weeks: 8, totalSessions: 24, gifts: ["Shaker"] },
  { title: "Nâng cao", durationText: "16 tuần", weeks: 16, totalSessions: 48, featured: true, gifts: ["Shaker", "Biscotti"] },
  { title: "VIP", durationText: "24 tuần", weeks: 24, totalSessions: 72, gifts: ["Balo", "Shaker", "Biscotti"] },
];

const render = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <OneOnOnePlans
        plans={plans}
        sharedFeatures={["Tập 1 kèm 1", "Giáo án cá nhân hóa"]}
        systemFeatures={["Thư viện bài tập"]}
        onRegister={vi.fn()}
      />
    </MemoryRouter>,
  );

describe("OneOnOnePlans", () => {
  it("lists the benefits every plan shares once, not once per plan", () => {
    const html = render();

    expect(html.match(/Tập 1 kèm 1/g)).toHaveLength(1);
    expect(html.match(/Giáo án cá nhân hóa/g)).toHaveLength(1);
    expect(html.match(/Thư viện bài tập/g)).toHaveLength(1);
  });

  it("shows what differs per plan: duration, sessions, weekly pace and gifts", () => {
    const html = render();

    for (const text of ["8 tuần", "16 tuần", "24 tuần", "pricing.sessions_count:24", "pricing.sessions_count:72"]) {
      expect(html).toContain(text);
    }
    expect(html.match(/pricing\.sessions_per_week:3/g)).toHaveLength(3);
    expect(html.match(/Biscotti/g)).toHaveLength(2);
    expect(html.match(/Balo/g)).toHaveLength(1);
  });

  it("marks only the featured plan as popular and gives each plan one register link", () => {
    const html = render();

    expect(html.match(/pricing\.popular/g)).toHaveLength(1);
    expect(html.match(/href="\/register"/g)).toHaveLength(3);
  });
});
