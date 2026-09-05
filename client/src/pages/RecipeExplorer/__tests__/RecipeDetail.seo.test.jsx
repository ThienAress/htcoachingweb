import { renderToStaticMarkup } from "react-dom/server";
import { HelmetProvider } from "react-helmet-async";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQuery: () => ({ data: undefined, isLoading: true, error: null }),
  useQueryClient: () => ({}),
}));
vi.mock("react-i18next", () => ({
  Trans: ({ i18nKey }) => i18nKey,
  useTranslation: () => ({
    i18n: { language: "vi" },
    t: (key) => key,
  }),
}));
vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useParams: () => ({ slug: "vietnamese-style-veggie-hotpot" }),
}));
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("../../../queries/recipe.queries", () => ({
  recipeBookmarkCacheCallbacks: () => ({}),
  recipeBookmarksQueryOptions: () => ({ queryKey: ["bookmarks"] }),
  recipeDetailQueryOptions: () => ({ queryKey: ["recipe-detail"] }),
}));
vi.mock("../../../sections/Header/Header", () => ({ default: () => null }));
vi.mock("../../../sections/Footer/Footer", () => ({ default: () => null }));
vi.mock("../../../components/ChatIcons", () => ({ default: () => null }));
vi.mock("../../../components/ScrollToTop", () => ({ default: () => null }));

import RecipeDetail from "../RecipeDetail.jsx";

describe("RecipeDetail hydration SEO", () => {
  it("does not add a transient noindex tag while cohort data is loading", () => {
    const html = renderToStaticMarkup(
      <HelmetProvider>
        <RecipeDetail />
      </HelmetProvider>,
    );

    expect(html).not.toContain('name="robots"');
  });
});
