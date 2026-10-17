import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import ProgressEntitlementRequired from "../ProgressEntitlementRequired";
import { isProgressEntitlementError } from "../progressPresentation";

describe("progress without an active plan", () => {
  it("recognises the entitlement error returned by the server", () => {
    expect(
      isProgressEntitlementError({
        response: {
          status: 403,
          data: { code: "PROGRESS_ENTITLEMENT_REQUIRED" },
        },
      }),
    ).toBe(true);
  });

  it("does not treat other failures as a missing plan", () => {
    expect(
      isProgressEntitlementError({
        response: { status: 500, data: { code: "PROGRESS_READ_FAILED" } },
      }),
    ).toBe(false);
    expect(isProgressEntitlementError(null)).toBe(false);
  });

  it("explains what is missing and links to the plans instead of showing a failure", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProgressEntitlementRequired />
      </MemoryRouter>,
    );

    expect(html).toContain("Chưa có gói huấn luyện");
    expect(html).toContain("Xem gói huấn luyện");
    expect(html).toContain('href="/#pricing"');
    expect(html).not.toContain("Không thể tải");
  });
});
