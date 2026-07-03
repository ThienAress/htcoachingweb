
import { test, expect } from "@playwright/test";

/**
 * E2E Test: Public Pages — SEO & Routing
 * Verify: Các trang public load thành công, có SEO meta tags.
 */

const PUBLIC_PAGES = [
  { path: "/", expectedTitle: "HTCOACHING" },
  { path: "/ket-qua-khach-hang", expectedTitle: "HTCOACHING" },
  { path: "/tdee-calculator", expectedTitle: "TDEE" },
  { path: "/exercises", expectedTitle: "HTCOACHING" },
  { path: "/club", expectedTitle: "HTCOACHING" },
  { path: "/login", expectedTitle: "HTCOACHING" },
];

test.describe("Public Pages — Kiểm tra routing & SEO", () => {
  for (const pg of PUBLIC_PAGES) {
    test(`${pg.path} — load thành công (không 404)`, async ({ page }) => {
      const response = await page.goto(pg.path);

      // Response phải là 200 (SPA luôn trả 200)
      expect(response?.status()).toBeLessThan(400);
      await page.waitForLoadState("networkidle");
    });

    test(`${pg.path} — title chứa "${pg.expectedTitle}"`, async ({ page }) => {
      await page.goto(pg.path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      const title = await page.title();
      expect(title.toUpperCase()).toContain(pg.expectedTitle.toUpperCase());
    });
  }

  test("trang không tồn tại hiển thị fallback", async ({ page }) => {
    await page.goto("/trang-khong-ton-tai-xyz123");
    await page.waitForLoadState("networkidle");

    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});

test.describe("SEO Meta Tags — Kiểm tra meta tags cơ bản", () => {
  test("homepage có meta description", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Dùng .first() để tránh strict mode violation khi có duplicate
    const metaDesc = await page
      .locator('meta[name="description"]')
      .first()
      .getAttribute("content");
    expect(metaDesc).toBeTruthy();
    expect(metaDesc?.length).toBeGreaterThan(20);
  });

  test("homepage có Open Graph title", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // .first() vì react-helmet-async + index.html có thể tạo duplicate
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .first()
      .getAttribute("content");
    expect(ogTitle).toBeTruthy();
    expect(String(ogTitle)).toContain("HTCOACHING");
  });

  test("homepage có canonical URL", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // .first() vì có thể duplicate
    const canonical = await page
      .locator('link[rel="canonical"]')
      .first()
      .getAttribute("href");
    expect(canonical).toBeTruthy();
    expect(String(canonical)).toContain("htcoachingweb");
  });
});
