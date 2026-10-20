import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, options) => (options?.count === undefined ? key : `${key}:${options.count}`),
  }),
}));

import TrainerPlans from "../TrainerPlans";

const plans = [
  { code: "free", title: "Dùng thử", subtitle: "30 ngày", isFree: true, durationDays: 30, maxClients: 3, priceMonth: 0, priceYear: 0 },
  { code: "standard", title: "Tiêu chuẩn", subtitle: "Mới bắt đầu", maxClients: 5, priceMonth: 200000, priceYear: 2000000 },
  { code: "professional", title: "Chuyên nghiệp", subtitle: "Phát triển", featured: true, maxClients: 20, priceMonth: 250000, priceYear: 2500000 },
];
const shared = [{ key: "coaching", name: "Coaching", features: ["Gửi bài tập"] }];
const perPlan = {
  free: [],
  standard: [],
  professional: [{ key: "crm_ai", name: "F1 CRM & AI", icon: "✨", features: ["AI phân tích"] }],
};

const render = (billingCycle = "month", overrides = {}) =>
  renderToStaticMarkup(
    <TrainerPlans
      plans={plans}
      shared={shared}
      perPlan={perPlan}
      billingCycle={billingCycle}
      renderAction={(plan) => <button type="button">Chọn {plan.code}</button>}
      {...overrides}
    />,
  );

describe("TrainerPlans", () => {
  it("lists shared benefits once and each plan's own extras only on that plan", () => {
    const html = render();

    expect(html.match(/Gửi bài tập/g)).toHaveLength(1);
    expect(html.match(/AI phân tích/g)).toHaveLength(1);
    expect(html.match(/pricing\.trainer_plans\.extra_label/g)).toHaveLength(1);
  });

  it("shows the student capacity as the headline number of every paid plan", () => {
    const html = render();

    for (const count of [5, 20]) expect(html).toContain(`>${count}</p>`);
    expect(html.match(/pricing\.trainer_plans\.students_label/g)).toHaveLength(2);
  });

  it("puts the trial in its own strip above the paid plans, not in the plan grid", () => {
    const html = render();

    expect(html).toContain('aria-label="Dùng thử"');
    expect(html).toContain("pricing.trainer_plans.trial_strip_meta:3");
    expect(html.indexOf("Dùng thử")).toBeLessThan(html.indexOf("Tiêu chuẩn"));
    expect(html.match(/<article/g)).toHaveLength(2);
  });

  it("hides the trial strip when the parent says the account can no longer use it", () => {
    const html = render("month", { showTrial: false });

    expect(html).not.toContain("Dùng thử");
    expect(html).not.toContain("Chọn free");
    expect(html.match(/<article/g)).toHaveLength(2);
  });

  it("lets a long yearly price wrap instead of overflowing the card", () => {
    const html = render("year");

    expect(html).toContain("flex-wrap");
    expect(html).toContain("items-start");
  });

  it("shows paid plans per month or per year with the monthly average", () => {
    const month = render("month");
    expect(month).toContain("200.000");
    expect(month).not.toContain("pricing.avg_per_month");

    const year = render("year");
    expect(year).toContain("2.000.000");
    expect(year.match(/pricing\.avg_per_month/g)).toHaveLength(2);
  });

  it("marks only the featured plan as popular and lets the parent supply actions", () => {
    const html = render();

    expect(html.match(/pricing\.popular/g)).toHaveLength(1);
    expect(html).toContain("Chọn free");
    expect(html).toContain("Chọn professional");
  });

  it("skips the shared block and the extras area when there is nothing to show", () => {
    const html = render("month", { shared: [], perPlan: { free: [], standard: [], professional: [] } });

    expect(html).not.toContain("pricing.included_all");
    expect(html).not.toContain("pricing.trainer_plans.extra_label");
  });
});
