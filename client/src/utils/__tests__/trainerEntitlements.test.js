import { describe, expect, it } from "vitest";
import { canAccessF1 } from "../trainerEntitlements";

describe("canAccessF1", () => {
  it("cho phép admin không phụ thuộc subscription", () => {
    expect(canAccessF1({ role: "admin" }, null)).toBe(true);
  });

  it.each(["user", "trainer"])(
    "chặn %s khi gói Free không có entitlement",
    (role) => {
      expect(
        canAccessF1(
          { role },
          { planCode: "free", entitlements: { f1CrmAi: false } },
        ),
      ).toBe(false);
    },
  );

  it("cho phép gói có F1 entitlement", () => {
    expect(
      canAccessF1(
        { role: "user" },
        { planCode: "professional", entitlements: { f1CrmAi: true } },
      ),
    ).toBe(true);
  });

  it("fail closed khi response cũ không có entitlements", () => {
    expect(canAccessF1({ role: "trainer" }, { planCode: "premium" })).toBe(
      false,
    );
  });
});
