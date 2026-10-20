import { describe, expect, it } from "vitest";

import debt from "./apiNamingDebt.json";
import { findNamingViolations, scanApiRoutes } from "./apiNamingScan.js";

// Cổng "chỉ giảm, không tăng" cho tên endpoint (quy tắc: .claude/rules/api-design.md, ADR 0002).
// Endpoint mới phải đúng quy tắc; endpoint cũ vi phạm nằm trong apiNamingDebt.json. Đổi tên hoặc xóa xong
// một endpoint thì xóa dòng của nó khỏi danh sách.
const debtSet = new Set(debt);
const check = (method, path) => findNamingViolations([{ method, path }]);

describe("API naming", () => {
  const routes = scanApiRoutes();
  const violations = findNamingViolations(routes);

  it("reads the real route table (guards the scanner itself)", () => {
    expect(routes.length).toBeGreaterThan(300);
    expect(routes.some((route) => route.method === "POST" && route.path === "/api/orders")).toBe(true);
  });

  it("has no violation outside the debt list", () => {
    expect(violations.filter((violation) => !debtSet.has(violation))).toEqual([]);
  });

  it("keeps the debt list honest: a fixed or removed endpoint must be dropped from it", () => {
    const current = new Set(violations);
    expect(debt.filter((entry) => !current.has(entry))).toEqual([]);
  });

  it("accepts resource-style names and the allowed actions", () => {
    expect(check("GET", "/api/users")).toEqual([]);
    expect(check("GET", "/api/posts/:id/comments")).toEqual([]);
    expect(check("POST", "/api/orders/:id/approve")).toEqual([]);
    expect(check("GET", "/api/contracts/:id/download")).toEqual([]);
    expect(check("GET", "/api/ai/memory/export")).toEqual([]);
    expect(check("GET", "/api/admin/service-access-policies/community-features/report.pdf")).toEqual([]);
  });

  it("flags verbs, wrong case, singular resources, deep nesting and PUT used as an action", () => {
    expect(check("POST", "/api/getUsers")).toEqual(["POST /api/getUsers [kebab-case]"]);
    expect(check("POST", "/api/orders/create")).toContain("POST /api/orders/create [verb-in-path]");
    expect(check("POST", "/api/training-bookings/book")).toContain("POST /api/training-bookings/book [verb-in-path]");
    expect(check("GET", "/api/product")).toContain("GET /api/product [plural-resource]");
    expect(check("GET", "/api/a-things/:id/b-things/:id/c-things/:id/d-things")).toContain(
      "GET /api/a-things/:id/b-things/:id/c-things/:id/d-things [deep-nesting]",
    );
    expect(check("PUT", "/api/orders/:id/approve")).toEqual(["PUT /api/orders/:id/approve [action-should-be-post]"]);
    expect(check("GET", "/api/orders/my")).toEqual(["GET /api/orders/my [my-style]"]);
    expect(check("GET", "/api/coaching/my-plans")).toEqual(["GET /api/coaching/my-plans [my-style]"]);
    expect(check("GET", "/api/orders/me")).toEqual([]);
  });
});
