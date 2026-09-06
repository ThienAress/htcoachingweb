import { describe, expect, it } from "vitest";

import {
  hasClearedCookie,
  readSetCookieValue,
} from "../stagingAuthAcceptance.js";

describe("staging Auth acceptance helpers", () => {
  it("reads one cookie without exposing unrelated Set-Cookie values", () => {
    expect(
      readSetCookieValue(
        [
          "accessToken=access-secret; Path=/; HttpOnly",
          "refreshToken=refresh-secret; Path=/; HttpOnly",
          "csrfToken=csrf-secret; Path=/",
        ],
        "refreshToken",
      ),
    ).toBe("refresh-secret");
  });

  it("recognizes only an explicitly cleared target cookie", () => {
    expect(
      hasClearedCookie(
        [
          "accessToken=; Path=/; Max-Age=0",
          "refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        ],
        "refreshToken",
      ),
    ).toBe(true);
    expect(
      hasClearedCookie(["accessToken=; Path=/; Max-Age=0"], "refreshToken"),
    ).toBe(false);
  });
});
