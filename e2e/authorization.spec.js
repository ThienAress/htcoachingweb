import { test, expect } from "@playwright/test";

test.describe("admin actor", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "admin" },
      }),
    );
  });

  test("can open an admin-only route", async ({ page }) => {
    await page.goto("/admin/recipes");
    await expect(
      page.getByRole("heading", { name: "Quản lý Công thức nấu ăn" }),
    ).toBeVisible();
  });
});

test.describe("trainer actor", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "trainer" },
      }),
    );
  });

  test("can open trainer routes but is redirected away from admin routes", async ({ page }) => {
    await page.goto("/trainer");
    await expect(page).toHaveURL(/\/trainer$/);

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/trainer$/);
  });
});

test.describe("regular user without subscription", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "user" },
      }),
    );
  });

  test("cannot enter trainer routes", async ({ page }) => {
    await page.goto("/trainer");
    await expect(page).toHaveURL(/\/$/);
  });
});
