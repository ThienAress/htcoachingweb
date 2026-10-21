import { test, expect } from "@playwright/test";

test.describe("deposit and wallet administration", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "admin" },
      }),
    );
  });

  test("approves a pending deposit once", async ({ page }) => {
    let approveCalls = 0;
    await page.route("**/api/admin/deposits/deposit-e2e/approve", async (route) => {
      approveCalls += 1;
      await route.fallback();
    });

    await page.goto("/admin/deposits");
    await expect(page.getByText("HTC-E2E-0001")).toBeVisible();
    await page.getByRole("button", { name: "Duyệt", exact: true }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toContainText("Tiền thưởng");
    expect(approveCalls).toBe(0);
    await confirmDialog.getByRole("button", { name: "Duyệt nạp" }).click();
    await expect.poll(() => approveCalls).toBe(1);
  });

  test("reverses a paid deposit with a required reason", async ({ page }) => {
    let reverseCalls = 0;
    await page.route(
      "**/api/admin/deposits/deposit-paid-e2e/reverse",
      async (route) => {
        reverseCalls += 1;
        await route.fallback();
      },
    );

    await page.goto("/admin/deposits");
    const paidCard = page
      .locator("div.bg-white")
      .filter({ hasText: "HTC-E2E-PAID" })
      .first();
    await expect(paidCard.getByRole("button", { name: "Hoàn tác" })).toBeVisible();
    await expect(paidCard.getByRole("button", { name: "Xóa" })).toHaveCount(0);
    await paidCard.getByRole("button", { name: "Hoàn tác" }).click();
    await page
      .getByPlaceholder("Lý do hoàn tác (ít nhất 8 ký tự)")
      .fill("Đối soát xác nhận giao dịch bị duyệt nhầm");
    await page.getByRole("button", { name: "Xác nhận hoàn tác" }).click();
    await expect.poll(() => reverseCalls).toBe(1);
  });

  test("cancels a trainer subscription without a delete action", async ({
    page,
  }) => {
    let cancelCalls = 0;
    await page.route(
      "**/api/trainer-subscriptions/subscription-admin-e2e/cancel",
      async (route) => {
        cancelCalls += 1;
        await route.fallback();
      },
    );

    await page.goto("/admin/trainer-subscribers");
    await expect(page.getByText("E2E Subscriber")).toBeVisible();
    await page.getByTitle("Hủy gói").click();
    await page
      .getByPlaceholder("Lý do hủy (ít nhất 8 ký tự)")
      .fill("Chấm dứt quyền truy cập theo yêu cầu quản trị");
    await page.getByRole("button", { name: "Xác nhận hủy" }).click();
    await expect.poll(() => cancelCalls).toBe(1);
  });
});

test.describe("customer deposit amount input", () => {
  test("groups the typed amount with thousand separators while keeping the digits editable", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route("**/api/**", (route) =>
      route.continue({ headers: { ...route.request().headers(), "x-e2e-role": "user" } }),
    );
    await page.goto("/wallet");
    const input = page.locator("#deposit-amount");
    await expect(input).toBeVisible();

    await input.click();
    await page.keyboard.type("10000000");
    await expect(input).toHaveValue("10.000.000");
    await expect(page.getByLabel("Quyền lợi dự kiến").or(page.locator("aside[aria-live]")).first()).toContainText("10.000.000");

    // Sửa ở giữa: xóa một chữ số, con trỏ không nhảy về cuối.
    await input.evaluate((node) => node.setSelectionRange(3, 3));
    await page.keyboard.press("Backspace");
    await expect(input).toHaveValue("1.000.000");
    await page.keyboard.type("5");
    await expect(input).toHaveValue("15.000.000");

    await input.fill("");
    await page.keyboard.type("abc12x");
    await expect(input).toHaveValue("12");
  });
});
