import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";

import RecipePagination from "../RecipePagination.jsx";

describe("RecipePagination", () => {
  test("renders previous, numbered, and next pages as crawlable links", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RecipePagination
          page={2}
          totalPages={5}
          pageNumbers={[1, 2, 3, "...", 5]}
          getPageHref={(targetPage) =>
            `/cong-thuc-nau-an/${targetPage > 1 ? `?page=${targetPage}` : ""}`
          }
          labels={{ previous: "Previous", next: "Next", page: "Page" }}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('aria-label="Previous"');
    expect(html).toContain('href="/cong-thuc-nau-an/"');
    expect(html).toContain('href="/cong-thuc-nau-an/?page=3"');
  });
});
