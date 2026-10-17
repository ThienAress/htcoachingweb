import { test, expect } from "@playwright/test";

const asRole = (page, role) =>
  page.route("**/api/**", (route) =>
    route.continue({
      headers: { ...route.request().headers(), "x-e2e-role": role },
    }),
  );

test("a signed-in user opening the account page directly stays on it", async ({ page }) => {
  await asRole(page, "user");
  // Session check slower than the page chunk (cold backend): the page must wait, not bounce to login.
  await page.route("**/api/user/me", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fallback();
  });
  await page.goto("/account");

  await expect(page.getByText("E2E Client").first()).toBeVisible();
  await expect(page).toHaveURL(/\/account\/?$/);
});

test("the admin area lands on a page instead of an empty screen", async ({ page }) => {
  await asRole(page, "admin");
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/users\/?$/);
  await expect(page).toHaveTitle(/Người dùng \| HTCOACHING/);
});
