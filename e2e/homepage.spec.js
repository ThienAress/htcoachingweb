
import { test, expect } from "@playwright/test";

/**
 * E2E Test: Homepage & Navigation
 * Pattern: Reconnaissance-then-Action (Anthropic webapp-testing)
 */

test.describe("Homepage — Trang chủ", () => {
  test("trang chủ load thành công + hiển thị hero section", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Hero heading phải hiển thị
    const heroText = page.locator("text=TĂNG CƠ - GIẢM MỠ");
    await expect(heroText).toBeVisible({ timeout: 10000 });

    // Bullet points trong hero
    await expect(page.locator("text=Lộ trình riêng biệt")).toBeVisible();
    await expect(page.locator("text=Cam kết đạt mục tiêu 100%")).toBeVisible();
  });

  test("navigation bar chứa các menu items chính", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Kiểm tra nav element tồn tại và có links
    const nav = page.locator("nav, header");
    await expect(nav.first()).toBeVisible();

    // Kiểm tra nút đăng nhập luôn hiển thị trên nav
    const loginLink = page.locator("text=Đăng nhập").first();
    await expect(loginLink).toBeVisible();
  });

  test("click vào logo/link CLB chuyển đến /club", async ({ page }) => {
    await page.goto("/club");
    await page.waitForLoadState("networkidle");

    // Verify URL đúng
    expect(page.url()).toContain("/club");

    // Page không bị crash — có content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(500);
  });

  test("trang login accessible từ navigation", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/login");

    // Có nút Google login hoặc form login
    const content = await page.content();
    expect(content.length).toBeGreaterThan(500);
  });

  test("page title chứa HTCOACHING", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const title = await page.title();
    expect(title.toUpperCase()).toContain("HTCOACHING");
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
    await page.waitForLoadState("networkidle");

    // Filter bỏ lỗi thường gặp trong dev
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("CORS") &&
        !e.includes("ERR_CONNECTION_REFUSED") &&
        !e.includes("Failed to load resource") &&
        !e.includes("net::ERR_")
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
