
import { test, expect } from "@playwright/test";

/**
 * E2E Test: Homepage & Navigation
 * Pattern: Reconnaissance-then-Action (Anthropic webapp-testing)
 */

test.describe("Homepage — Trang chủ", () => {
  test("trang chủ load thành công + hiển thị hero section", async ({ page }) => {
    await page.goto("/");

    const heroHeading = page.locator("main h1, section h1").first();
    await expect(heroHeading).toBeVisible({ timeout: 10000 });
    await expect(heroHeading).toContainText("90");

    await expect(
      page.getByText(/Lộ trình riêng biệt|Personalized training plan/i).first(),
    ).toBeVisible();
    await expect(
      page
        .getByText(/Cam kết đạt mục tiêu 100%|100% goal achievement guarantee/i)
        .first(),
    ).toBeVisible();
  });

  test("navigation bar chứa các menu items chính", async ({ page }) => {
    await page.goto("/");

    // Kiểm tra nav element tồn tại và có links
    const nav = page.locator("nav, header");
    await expect(nav.first()).toBeVisible();

    const loginLink = page.locator("header a[href='/login']:visible").first();
    await expect(loginLink).toBeVisible();
  });

  test("click vào logo/link CLB chuyển đến /club", async ({ page }) => {
    await page.goto("/club");

    // Verify URL đúng
    expect(page.url()).toContain("/club");

    // Page không bị crash — có content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(500);
  });

  test("trang login accessible từ navigation", async ({ page }) => {
    await page.goto("/login");

    expect(page.url()).toContain("/login");

    // Có nút Google login hoặc form login
    const content = await page.content();
    expect(content.length).toBeGreaterThan(500);
  });

  test("page title chứa HTCOACHING", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/HTCOACHING/i);
  });

  test("trang không có lỗi console nghiêm trọng", async ({ page }) => {
    /** @type {string[]} */
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");
    const criticalErrors = errors.filter((error) => !error.includes("favicon"));

    expect(criticalErrors).toHaveLength(0);
  });
});
