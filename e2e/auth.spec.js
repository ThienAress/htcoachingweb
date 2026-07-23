import { test, expect } from "@playwright/test";

test("anonymous user is redirected from an authenticated route", async ({ page }) => {
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/login$/);
});

test.describe("authenticated session", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("pricingViewMode", "customer");
    });
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "user" },
      }),
    );
  });

  test("loads the actor and performs logout through the header", async ({ page }) => {
    let logoutCalls = 0;
    await page.route("**/api/auth/logout", async (route) => {
      logoutCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: /E2E Client/ }).click();
    await page.getByRole("button", { name: /Đăng xuất|Logout/i }).click();
    await expect.poll(() => logoutCalls).toBe(1);
  });
});
