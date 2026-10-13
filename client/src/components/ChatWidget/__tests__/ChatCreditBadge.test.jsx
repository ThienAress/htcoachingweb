import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ChatCreditBadge from "../ChatCreditBadge";

const quota = {
  serviceKey: "ai_credits",
  windows: [
    { key: "burst", limit: 40, remaining: 38, periodLabel: "giờ" },
    { key: "monthly", limit: 1200, remaining: 4, periodLabel: "30 ngày" },
  ],
};

describe("ChatCreditBadge", () => {
  it("shows the spendable credits with a low-credit tone and an accessible label", () => {
    const html = renderToStaticMarkup(<ChatCreditBadge quota={quota} costs={null} />);
    expect(html).toContain('aria-label="Còn 4 credit. Xem chi tiết credit"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("text-amber-700");
    expect(html).toMatch(/>4<\/button>/);
  });

  it("renders nothing until the server reports a usable quota", () => {
    expect(renderToStaticMarkup(<ChatCreditBadge quota={null} costs={null} />)).toBe("");
    expect(renderToStaticMarkup(<ChatCreditBadge quota={{ remaining: 3 }} costs={null} />)).toBe("");
  });
});
