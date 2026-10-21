import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, options) => (options?.days !== undefined ? `${key}:${options.days}` : key),
    i18n: { language: "vi" },
  }),
}));

import PlanUpgradeBreakdown from "../PlanUpgradeBreakdown";

const upgradeQuote = {
  eligible: true,
  action: "upgrade_to_year",
  listAmount: 990000,
  creditAmount: 49500,
  amount: 940500,
  remainingDays: 15,
};

const NBSP = String.fromCharCode(160);
const normalize = (html) => html.split(NBSP).join(" ");

describe("PlanUpgradeBreakdown", () => {
  it("nâng cấp: hiện giá gói, phần tháng chưa dùng bị trừ và tổng đã giảm", () => {
    const html = normalize(renderToStaticMarkup(<PlanUpgradeBreakdown quote={upgradeQuote} />));
    expect(html).toContain("990.000");
    expect(html).toContain("-49.500");
    expect(html).toContain("pricing.upgrade.credit:15");
    expect(html).toContain("940.500");
  });

  it("mua thường: không có dòng trừ tín dụng", () => {
    const html = normalize(
      renderToStaticMarkup(
        <PlanUpgradeBreakdown quote={{ eligible: true, listAmount: 99000, creditAmount: 0, amount: 99000, remainingDays: 0 }} />,
      ),
    );
    expect(html).not.toContain("pricing.upgrade.credit");
    expect(html).toContain("99.000");
  });

  it("đang tính giá và lỗi tính giá có thông báo, nút thử lại", () => {
    expect(renderToStaticMarkup(<PlanUpgradeBreakdown loading />)).toContain("pricing.upgrade.loading");
    const failed = renderToStaticMarkup(<PlanUpgradeBreakdown error onRetry={() => {}} />);
    expect(failed).toContain("pricing.upgrade.failed");
    expect(failed).toContain("pricing.upgrade.retry");
  });

  it("dùng số tiền dự phòng khi chưa có báo giá", () => {
    const html = normalize(renderToStaticMarkup(<PlanUpgradeBreakdown fallbackAmount={500000} />));
    expect(html).toContain("500.000");
  });
});
