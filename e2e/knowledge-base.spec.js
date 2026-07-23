import { test, expect } from "@playwright/test";

test.describe("Knowledge Base administration", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "admin" },
      }),
    );
  });

  test("shows embedding failure state and sends regenerate command", async ({ page }) => {
    let regenerateCalls = 0;
    await page.route(
      "**/api/knowledge-base/kb-e2e/regenerate-embedding",
      async (route) => {
        regenerateCalls += 1;
        await route.fallback();
      },
    );

    await page.goto("/admin/knowledge-base");
    await expect(page.getByText("E2E verified question")).toBeVisible();
    await expect(page.getByText("vector: failed")).toBeVisible();
    await page.getByTitle("Tạo lại embedding").click();
    await expect.poll(() => regenerateCalls).toBe(1);
  });
});
