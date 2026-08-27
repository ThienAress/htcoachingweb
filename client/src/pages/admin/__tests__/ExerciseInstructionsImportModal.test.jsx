import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ExerciseInstructionsImportModal from "../ExerciseInstructionsImportModal.jsx";

describe("ExerciseInstructionsImportModal", () => {
  it("requires a preview before the commit action can be used", () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <ExerciseInstructionsImportModal
          isOpen
          onClose={vi.fn()}
          onImported={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(html).toContain("Thêm nhiều bước bài tập");
    expect(html).toContain("Xem trước không ghi dữ liệu");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Xác nhận cập nhật<\/button>/);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });
});
