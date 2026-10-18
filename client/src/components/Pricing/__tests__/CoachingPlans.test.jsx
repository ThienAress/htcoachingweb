import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

import CoachingPlans from "../CoachingPlans";

const plans = [
  { title: "Cơ bản", durationText: "8 tuần", totalSessions: 24, gifts: ["Shaker"] },
  { title: "Nâng cao", durationText: "16 tuần", totalSessions: 48, featured: true, gifts: ["Shaker", "Biscotti"] },
  { title: "VIP", durationText: "24 tuần", totalSessions: 72, gifts: ["Balo", "Shaker", "Biscotti"] },
];

const render = (list = plans) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <CoachingPlans
        plans={list}
        sharedFeatures={["Tập 1 kèm 1", "Giáo án cá nhân hóa"]}
        systemFeatures={["Thư viện bài tập"]}
        onRegister={vi.fn()}
      />
    </MemoryRouter>,
  );

describe("CoachingPlans", () => {
  it("lists the benefits every plan shares once, not once per plan", () => {
    const html = render();

    expect(html.match(/Tập 1 kèm 1/g)).toHaveLength(1);
    expect(html.match(/Giáo án cá nhân hóa/g)).toHaveLength(1);
    expect(html.match(/Thư viện bài tập/g)).toHaveLength(1);
  });

  it("titles the customer list at the same level as the system list", () => {
    const html = render();
    const heading = (key) => html.match(new RegExp(`<h4 class="([^"]*)">${key}</h4>`))?.[1];

    expect(heading("pricing.customer_benefits")).toBeTruthy();
    expect(heading("pricing.customer_benefits")).toBe(heading("pricing.system_benefits_plain"));
    expect(html.indexOf("pricing.customer_benefits")).toBeLessThan(html.indexOf("Tập 1 kèm 1"));
  });

  it("centres the plan name and duration and does not show a session count", () => {
    const html = render();

    expect(html.match(/<div class="text-center"><h3/g)).toHaveLength(3);
    for (const text of ["8 tuần", "16 tuần", "24 tuần"]) expect(html).toContain(text);
    expect(html).not.toContain("sessions_count");
    expect(html).not.toContain("sessions_per_week");
    expect(html).not.toContain("24 buổi");
  });

  it("shows each plan's own gifts and nothing when a plan has none", () => {
    const html = render();
    expect(html.match(/Biscotti/g)).toHaveLength(2);
    expect(html.match(/Balo/g)).toHaveLength(1);

    const noGifts = render([{ title: "Cơ bản", durationText: "8 tuần", gifts: [] }, plans[1]]);
    expect(noGifts.match(/pricing\.gifts_label/g)).toHaveLength(1);
  });

  it("marks only the featured plan as popular and gives each plan one register link", () => {
    const html = render();

    expect(html.match(/pricing\.popular/g)).toHaveLength(1);
    expect(html.match(/href="\/register"/g)).toHaveLength(3);
  });

  it("keeps a lone plan (trial) in a narrow centred column instead of a three-column grid", () => {
    const html = render([plans[0]]);

    expect(html).toContain("mx-auto max-w-sm");
    expect(html).not.toContain("lg:grid-cols-3");
  });
});
