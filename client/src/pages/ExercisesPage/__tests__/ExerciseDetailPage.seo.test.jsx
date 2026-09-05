import { renderToStaticMarkup } from "react-dom/server";
import { HelmetProvider } from "react-helmet-async";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: true, isError: false }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "vi", resolvedLanguage: "vi" },
    t: (key) => key,
  }),
}));
vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useParams: () => ({
    id: "6a4b4b4aa5de82055378ac81",
    slug: "dumbbell-burpee",
  }),
}));
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("../../../queries/exercise.queries", () => ({
  exerciseDetailQueryOptions: () => ({}),
  exerciseReviewsQueryOptions: () => ({}),
}));
vi.mock("../../../sections/Header/Header", () => ({ default: () => null }));
vi.mock("../../../components/ChatIcons", () => ({ default: () => null }));
vi.mock("../../../components/ScrollToTop", () => ({ default: () => null }));
vi.mock("../ExerciseReviews", () => ({ default: () => null }));

import ExerciseDetailPage from "../ExerciseDetailPage.jsx";

describe("ExerciseDetailPage hydration SEO", () => {
  it("does not add a transient noindex tag while cohort data is loading", () => {
    const html = renderToStaticMarkup(
      <HelmetProvider>
        <ExerciseDetailPage />
      </HelmetProvider>,
    );

    expect(html).not.toContain('name="robots"');
  });
});
