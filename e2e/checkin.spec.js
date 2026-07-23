import { test, expect } from "@playwright/test";

test.describe("trainer check-in journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "trainer" },
      }),
    );
  });

  test("selects an owned order and submits one check-in request", async ({ page }) => {
    let createCalls = 0;
    await page.route("**/api/checkin", async (route) => {
      if (route.request().method() === "POST") createCalls += 1;
      await route.fallback();
    });

    await page.goto("/checkin");
    await page.getByText("Chọn khách hàng", { exact: true }).click();
    await page.getByText("E2E Client", { exact: true }).click();
    await page.locator("select").first().selectOption("order-e2e");
    await page.locator('input[type="datetime-local"]').fill("2026-07-19T09:00");
    await page.getByText("Chọn nhóm cơ", { exact: true }).click();
    await page.getByText("Ngực", { exact: true }).click();
    await page.getByText("1 nhóm đã chọn", { exact: true }).click();
    await page.getByRole("button", { name: /Checkin buổi tập/i }).click();

    await expect.poll(() => createCalls).toBe(1);
  });
});
