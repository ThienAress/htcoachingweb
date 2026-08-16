import { test, expect } from "@playwright/test";

const getBackgroundBrightness = (locator) =>
  locator.evaluate((element) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.fillStyle = getComputedStyle(element).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    return context
      .getImageData(0, 0, 1, 1)
      .data.slice(0, 3)
      .reduce((sum, channel) => sum + channel, 0);
  });

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

  test("online coaching follows customer theme while media stays dark", async ({
    page,
  }) => {
    await page.goto("/online-coaching");

    const surface = page.locator(".customer-tool-surface");
    await expect(surface).toHaveAttribute("data-theme", "light");

    const coachingPanel = surface.locator('[class~="bg-gray-900/50"]').first();
    await expect(coachingPanel).toBeVisible();
    expect(await getBackgroundBrightness(coachingPanel)).toBeGreaterThan(600);

    const mediaSurface = surface.locator(".theme-preserve-dark").first();
    await expect(mediaSurface).toBeVisible();
    expect(await getBackgroundBrightness(mediaSurface)).toBeLessThan(120);

    await page.evaluate(() =>
      localStorage.setItem("ht_customer_dashboard_theme_v1", "dark"),
    );
    await page.reload();
    await expect(surface).toHaveAttribute("data-theme", "dark");
  });
});
