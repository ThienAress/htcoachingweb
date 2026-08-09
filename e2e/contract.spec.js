import { test, expect } from "@playwright/test";

test.describe("contract administration", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "admin" },
      }),
    );
  });

  test("loads the active contract and sends its cancel transition", async ({ page }) => {
    let cancelCalls = 0;
    page.on("dialog", (dialog) => dialog.accept());
    await page.route("**/api/contracts/contract-e2e/cancel", async (route) => {
      cancelCalls += 1;
      await route.fallback();
    });

    await page.goto("/admin/contracts");
    await expect(page.getByText("E2E Client").first()).toBeVisible();
    await page.getByTitle("Hủy").click();
    await expect.poll(() => cancelCalls).toBe(1);
  });
});
