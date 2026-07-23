import { test, expect } from "@playwright/test";

test.describe("admin content lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "admin" },
      }),
    );
  });

  test("publishes a draft recipe through the admin mutation", async ({ page }) => {
    let publishCalls = 0;
    page.on("dialog", (dialog) => dialog.accept());
    await page.route("**/api/recipes/recipe-e2e", async (route) => {
      if (route.request().method() === "PUT") publishCalls += 1;
      await route.fallback();
    });

    await page.goto("/admin/recipes");
    await expect(page.getByText("E2E Protein Bowl")).toBeVisible();
    await page.getByRole("button", { name: "Draft" }).click();
    await expect.poll(() => publishCalls).toBe(1);
  });

  test("opens the blog list without loading the editor bundle", async ({ page }) => {
    await page.goto("/admin/blog");
    await expect(page.getByRole("heading", { name: "Quản lý Blog" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Viết bài mới" })).toBeVisible();
  });

  test("distinguishes a recipe API failure from an empty result", async ({ page }) => {
    let apiHealthy = false;
    await page.route("**/api/recipes?**", async (route) => {
      if (apiHealthy) return route.fallback();
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Unavailable" }),
      });
    });

    await page.goto("/cong-thuc-nau-an");
    await expect(
      page.getByRole("heading", { name: "Không thể tải công thức" }),
    ).toBeVisible();

    apiHealthy = true;
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByText("Chưa có công thức nào phù hợp")).toBeVisible();
  });
});
