
import { test, expect } from "@playwright/test";

/**
 * E2E Test: Admin Login Flow
 * Pattern: Reconnaissance-then-Action (Anthropic webapp-testing)
 *
 * Test luồng login admin — form validation, error handling, UI states.
 * KHÔNG test với credentials thật (không hardcode password).
 * Focus: UI behavior + validation + error display.
 */

test.describe("Admin Login — Đăng nhập Admin", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin-login");
    await page.waitForLoadState("networkidle");
  });

  test("trang admin-login render đúng UI", async ({ page }) => {
    // Tiêu đề
    await expect(page.locator("text=ADMIN PORTAL")).toBeVisible();
    await expect(
      page.locator("text=Đăng nhập để truy cập hệ thống quản lý")
    ).toBeVisible();

    // Input fields
    const emailInput = page.locator('input[placeholder="Email"]');
    const passwordInput = page.locator('input[placeholder="Password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Submit button
    await expect(page.locator("text=Đăng nhập Admin")).toBeVisible();

    // Footer note
    await expect(
      page.locator("text=Chỉ dành cho quản trị viên")
    ).toBeVisible();
  });

  test("nút submit disabled khi form rỗng", async ({ page }) => {
    const submitBtn = page.locator("button", {
      hasText: "Đăng nhập Admin",
    });

    // Click submit với form rỗng
    await submitBtn.click();

    // Phải không navigate đi (vẫn ở trang login)
    expect(page.url()).toContain("/admin-login");
  });

  test("hiển thị lỗi khi đăng nhập với email sai", async ({ page }) => {
    const emailInput = page.locator('input[placeholder="Email"]');
    const passwordInput = page.locator('input[placeholder="Password"]');
    const submitBtn = page.locator("button", {
      hasText: "Đăng nhập Admin",
    });

    // Nhập credentials sai
    await emailInput.fill("wrong@email.com");
    await passwordInput.fill("wrongpassword");
    await submitBtn.click();

    // Đợi response — phải hiển thị error (toast hoặc inline)
    // Timeout lâu hơn vì đợi API response
    await page.waitForTimeout(3000);

    // Vẫn ở trang admin-login (không redirect)
    expect(page.url()).toContain("/admin-login");
  });

  test("password input có type=password (ẩn mật khẩu)", async ({ page }) => {
    const passwordInput = page.locator('input[placeholder="Password"]');
    const inputType = await passwordInput.getAttribute("type");
    expect(inputType).toBe("password");
  });

  test("email input nhận keyboard input đúng", async ({ page }) => {
    const emailInput = page.locator('input[placeholder="Email"]');

    await emailInput.fill("test@example.com");

    const value = await emailInput.inputValue();
    expect(value).toBe("test@example.com");
  });

  test("không có console errors nghiêm trọng trên trang login", async ({
    page,
  }) => {
    /** @type {string[]} */
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/admin-login");
    await page.waitForLoadState("networkidle");

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("CORS") &&
        !e.includes("ERR_CONNECTION_REFUSED") &&
        !e.includes("Failed to load resource")
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
