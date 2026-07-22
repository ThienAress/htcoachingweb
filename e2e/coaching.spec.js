import { test, expect } from "@playwright/test";

test.describe("client coaching journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "user" },
      }),
    );
  });

  test("loads a bounded plan list and its selected day details", async ({ page }) => {
    await page.goto("/online-coaching");
    await expect(page.getByText("E2E Strength Day").first()).toBeVisible();
    await expect(page.getByText("Squat").first()).toBeVisible();
    await expect(page.getByText("E2E Trainer").first()).toBeVisible();
  });
});
