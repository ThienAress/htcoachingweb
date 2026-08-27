import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WeeklyCheckinCard } from "../WeeklyCheckinCard";

describe("WeeklyCheckinCard period selectors", () => {
  it("uses compact month and week dropdowns with a clear reporting window", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <WeeklyCheckinCard dateKey="2026-08-24" userId="customer-1" />
      </QueryClientProvider>,
    );

    expect((html.match(/<select/g) || [])).toHaveLength(2);
    expect(html).toContain("Bạn có thể chọn tháng hiện tại và 3 tháng trước đó.");
    expect(html).toContain("Tháng 8/2026");
    expect(html).toContain("Tuần 4 · 24/8–31/8");
    expect(html).not.toContain('role="tablist"');
  });
});
