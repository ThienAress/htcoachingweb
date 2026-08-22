import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: {},
  useQuery: () => ({
    data: {
      data: [
        {
          _id: "food-1",
          label: "Ức gà",
          protein: 31,
          carb: 0,
          fat: 3.6,
          calories: 165,
          source: { type: "manual_verified" },
          allergenProfile: { reviewStatus: "reviewed" },
        },
      ],
      pagination: { total: 1, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
  }),
  useMutation: () => ({ mutate: vi.fn() }),
  useQueryClient: () => ({}),
}));
vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock("../../../hooks/useDebounce", () => ({ useDebounce: (value) => value }));

import FoodManagement from "../FoodManagement.jsx";

describe("FoodManagement", () => {
  it("does not show nutrition provenance as a list column", () => {
    const html = renderToStaticMarkup(<FoodManagement />);

    expect(html).toContain("Tên thực phẩm");
    expect(html).toContain("Năng lượng (kcal)");
    expect(html).not.toContain(">Nguồn</th>");
    expect(html).not.toContain("HTCOACHING xác minh thủ công");
  });
});
