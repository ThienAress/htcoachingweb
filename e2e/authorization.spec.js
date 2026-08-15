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

  test("trainer theme covers dark and light legacy routes and persists", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/trainer");

    const workspace = page.locator(".trainer-workspace");
    await expect(workspace).toHaveAttribute("data-theme", "light");

    for (const path of [
      "/trainer/checkin",
      "/trainer/coaching",
      "/trainer/schedule",
      "/trainer/workout-plans",
    ]) {
      await page.goto(path);
      const legacyDarkSurface = page.locator(".from-gray-900").first();
      await expect(legacyDarkSurface).toBeVisible();
      expect(await getBackgroundBrightness(legacyDarkSurface)).toBeGreaterThan(600);
    }

    await page.goto("/trainer");
    await page
      .getByRole("button", { name: "Chuyển sang giao diện tối" })
      .click();
    await expect(workspace).toHaveAttribute("data-theme", "dark");

    for (const path of [
      "/trainer/orders",
      "/trainer/contracts",
      "/trainer/checkin-history",
    ]) {
      await page.goto(path);
      await expect(workspace).toHaveAttribute("data-theme", "dark");
      const legacyLightSurface = page.locator(".bg-white").first();
      await expect(legacyLightSurface).toBeVisible();
      expect(await getBackgroundBrightness(legacyLightSurface)).toBeLessThan(120);
    }

    await page.reload();
    await expect(workspace).toHaveAttribute("data-theme", "dark");

    await page.goto("/trainer");
    await expect(
      page.getByRole("button", { name: "Chuyển sang giao diện sáng" }),
    ).toBeVisible();
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
