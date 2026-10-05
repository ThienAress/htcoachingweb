import { expect, test } from "@playwright/test";

const tdeeCard = (page) => page.getByRole("link", {
  name: /ĐO LƯỢNG MỨC TIÊU THỤ NĂNG LƯỢNG/,
});

async function expectDestination(page, path, heading) {
  await expect(page).toHaveURL(new RegExp(`${path}/?$`));
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /Bản xem thử chuyển động/ })).toHaveCount(0);
}

const tdeeHeading = /ĐO LƯỢNG CALO ĐỐT CHÁY TRONG 1 NGÀY/;

test.describe("public tool navigation", () => {
  test.afterEach(async ({ page }, testInfo) => {
    await page.getByRole("heading", { level: 1 }).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("navigation.png") });
  });

  test("desktop TDEE card opens the calculator", async ({ page }) => {
    await page.goto("/");
    await tdeeCard(page).click();
    await expectDestination(page, "/tdee-calculator", tdeeHeading);
  });

  test("desktop exercise link opens the library", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Hệ thống bài tập", exact: true }).first().click();
    await expectDestination(page, "/exercises", "THƯ VIỆN BÀI TẬP");
  });

  test("mobile exercise link opens the library and releases the drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Mở menu" }).click();
    await page.locator("#mobile-menu-drawer")
      .getByRole("link", { name: "Hệ thống bài tập", exact: true })
      .click();
    await expectDestination(page, "/exercises", "THƯ VIỆN BÀI TẬP");
    await expect(page.getByRole("button", { name: "Mở menu" })).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow === "hidden")).toBe(false);
  });

  test("reduced motion preserves TDEE navigation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await tdeeCard(page).click();
    await expectDestination(page, "/tdee-calculator", tdeeHeading);
  });

  test("Save-Data preserves TDEE navigation", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", {
        value: { saveData: true },
        configurable: true,
      });
    });
    await page.goto("/");
    await tdeeCard(page).click();
    await expectDestination(page, "/tdee-calculator", tdeeHeading);
  });

  test("keyboard activation opens the calculator", async ({ page }) => {
    await page.goto("/");
    await tdeeCard(page).focus();
    await tdeeCard(page).press("Enter");
    await expectDestination(page, "/tdee-calculator", tdeeHeading);
  });
});
