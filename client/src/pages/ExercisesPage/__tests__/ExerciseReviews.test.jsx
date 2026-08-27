import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      data: {
        summary: { total: 1, averageRating: 4.5 },
        myReview: null,
        items: [
          {
            id: "review-1",
            displayName: "Người tập HT",
            rating: 5,
            comment: "Setup rõ ràng.",
            isOwner: false,
          },
        ],
      },
    },
    isLoading: false,
    isError: false,
  }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) =>
      ({
        "detail.reviews.eyebrow": "Góc nhìn cộng đồng",
        "detail.reviews.title": "Đánh giá từ người tập",
        "detail.reviews.login_cta": "Đăng nhập để đánh giá",
      })[key] || key,
  }),
}));
vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("../../../queries/exercise.queries", () => ({
  exerciseReviewsQueryOptions: (exerciseId) => ({
    queryKey: ["exercise-reviews", exerciseId],
  }),
}));

import ExerciseReviews from "../ExerciseReviews";

describe("ExerciseReviews", () => {
  it("renders community feedback as a standalone section", () => {
    const html = renderToStaticMarkup(
      <ExerciseReviews exerciseId="exercise-1" />,
    );

    expect(html).toContain('data-exercise-reviews="standalone"');
    expect(html).toContain("Đánh giá từ người tập");
    expect(html).not.toContain("detail.reviews.caption");
    expect(html).toContain("Người tập HT");
    expect(html).toContain("Setup rõ ràng.");
  });
});
