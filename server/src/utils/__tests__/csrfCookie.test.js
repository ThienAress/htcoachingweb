import { describe, expect, it, vi } from "vitest";

import { setCsrfCookie } from "../csrfCookie.js";

describe("setCsrfCookie", () => {
  it("publishes the same token in the cookie and exposed response header", () => {
    const res = { cookie: vi.fn(), setHeader: vi.fn() };

    setCsrfCookie(res, "fresh-token", { path: "/" });

    expect(res.cookie).toHaveBeenCalledWith(
      "csrfToken",
      "fresh-token",
      { path: "/" },
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-CSRF-Token",
      "fresh-token",
    );
  });
});
