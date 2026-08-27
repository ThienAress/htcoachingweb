import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RecipeNutritionImportModal from "../RecipeNutritionImportModal.jsx";

describe("RecipeNutritionImportModal", () => {
  it("requires a preview before the commit action can be used", () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <RecipeNutritionImportModal
          isOpen
          onClose={vi.fn()}
          onImported={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(html).toContain("Nhập Giá trị dinh dưỡng");
    expect(html).toContain("Xem trước không ghi dữ liệu");
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Xác nhận cập nhật<\/button>/,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });
});
