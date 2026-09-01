import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HealthGoalsSection } from "../HealthGoalsSection";

describe("HealthGoalsSection", () => {
  it("groups daily wellness and customer habits in one health-goal section", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <HealthGoalsSection
          dateKey="2026-08-29"
          journal={{ status: "draft", revision: 0, habitCompletions: [] }}
          canEdit
          onChanged={() => {}}
        />
      </QueryClientProvider>,
    );

    expect(html).toContain("Mục tiêu sức khỏe");
    expect(html).toContain("Sức khỏe hôm nay");
    expect(html).toContain("Thói quen khách hàng");
    expect(html).not.toContain("Thói quen hôm nay");
  });
});
