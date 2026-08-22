import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("../../../context/AuthContext", () => ({ useAuth: mocks.useAuth }));
vi.mock("@tanstack/react-query", () => ({
  queryOptions: (options) => options,
  useQuery: () => ({
    data: {
      data: {
        summary: { total: 1, averageRating: 4.5 },
        myReview: null,
        items: [
          {
            id: "review-1",
            displayName: "Thành viên HT",
            rating: 5,
            comment: "Công thức dễ làm.",
            isOwner: false,
          },
        ],
      },
    },
    isLoading: false,
    isError: false,
  }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

import RecipeReviews from "../RecipeReviews.jsx";

describe("RecipeReviews", () => {
  it("shows public reviews and asks guests to sign in", () => {
    mocks.useAuth.mockReturnValue({ user: null });
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RecipeReviews recipeId="recipe-1" />
      </MemoryRouter>,
    );

    expect(html).toContain("detail.reviews.title");
    expect(html).toContain("Thành viên HT");
    expect(html).toContain("Công thức dễ làm.");
    expect(html).toContain('href="/login"');
    expect(html).not.toContain("detail.reviews.comment_placeholder");
  });

  it("shows the rating composer to signed-in users", () => {
    mocks.useAuth.mockReturnValue({ user: { id: "user-1" } });
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RecipeReviews recipeId="recipe-1" />
      </MemoryRouter>,
    );

    expect(html).toContain("detail.reviews.comment_placeholder");
    expect(html).toContain("detail.reviews.submit");
    expect(html).not.toContain('href="/login"');
  });
});
