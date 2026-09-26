import { expect, test } from "@playwright/test";

const tdeeCard = (page) => page.getByRole("link", {
  name: /ĐO LƯỢNG MỨC TIÊU THỤ NĂNG LƯỢNG/,
});
const preview = (page) => page.getByRole("dialog", {
  name: "Tự điêu khắc phiên bản mạnh hơn",
});

test.describe("self-sculpting looping preview", () => {
  test("stays open beyond a nominal five-second cycle without changing the route", async ({ page }) => {
    await page.goto("/");
    await expect(tdeeCard(page)).toBeVisible();

    await tdeeCard(page).click();
    await expect(preview(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await page.waitForTimeout(6_200);

    await expect(preview(page)).toBeVisible();
    await expect(page.locator('[data-sculpt-mode="preview"]')).toBeVisible();
    await expect(page.locator('[data-sculpt-timeline="enabled"]')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("closes cleanly and can reopen immediately without cooldown", async ({ page }) => {
    await page.goto("/");
    await tdeeCard(page).click();
    await preview(page).getByRole("button", { name: "Đóng xem thử" }).click();

    await expect(preview(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => ({
      inert: document.querySelector("main").closest("[inert]") !== null,
      locked: document.body.style.overflow === "hidden",
    }))).toEqual({ inert: false, locked: false });

    await tdeeCard(page).click();
    await expect(preview(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("Escape only closes the preview and releases the background", async ({ page }) => {
    await page.goto("/");
    await tdeeCard(page).click();
    await preview(page).getByRole("button", { name: "Đóng xem thử" }).press("Escape");

    await expect(preview(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() =>
      document.querySelector("main").closest("[inert]") !== null,
    )).toBe(false);
  });

  test("mobile exercise link opens the same preview and keeps the home route", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Mở menu" }).click();
    await page.locator("#mobile-menu-drawer")
      .getByRole("link", { name: "Hệ thống bài tập", exact: true })
      .click();

    await expect(preview(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await preview(page).getByRole("button", { name: "Đóng xem thử" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => document.body.style.overflow === "hidden")).toBe(false);
  });

  test("reduced motion opens a static preview without navigating", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await tdeeCard(page).click();

    await expect(preview(page)).toBeVisible();
    await expect(preview(page)).toContainText("Chuyển động đã tắt theo cài đặt thiết bị");
    await expect(page.locator('[data-sculpt-timeline="off"]')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("Save-Data opens a static preview without navigating", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", {
        value: { saveData: true },
        configurable: true,
      });
    });
    await page.goto("/");
    await tdeeCard(page).click();

    await expect(preview(page)).toBeVisible();
    await expect(preview(page)).toContainText("Chuyển động đã tắt theo cài đặt thiết bị");
    await expect(page.locator('[data-sculpt-timeline="off"]')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});
